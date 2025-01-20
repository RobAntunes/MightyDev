// src/commands/context_manager.rs

use ::arrow::array::{
    self, Array, FixedSizeListArray, Float32Array, Int32Array, RecordBatch, RecordBatchIterator,
    StringArray,
};
use ::arrow::datatypes::DataType;
use ::arrow::error::ArrowError;
use anyhow::Result;
use chrono::{DateTime, Utc};
use futures::TryStreamExt;
use lancedb::arrow::arrow_schema::Schema;
use lancedb::index::vector::IvfPqIndexBuilder;
use lancedb::index::{Index, IndexConfig};
use once_cell::sync::OnceCell;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::num::NonZeroUsize;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use uuid::Uuid;

use lancedb::query::ExecutableQuery;
use lancedb::{arrow, connect, table::Table, Connection};
use lru::LruCache;
use parking_lot::Mutex;
use pyo3::prelude::*; // For Python embedding calls

// Constants for the embedding size
const EMBEDDING_DIM: i32 = 1024; // Adjust as per your model

#[derive(Debug, Serialize, Deserialize)]
pub struct CodeLocation {
    pub file: String,
    pub start_line: usize,
    pub end_line: usize,
    pub start_col: usize,
    pub end_col: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ContextStats {
    pub totalFiles: usize,
    pub activeFiles: usize,
    pub totalSize: usize, // in bytes
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CodeSymbol {
    pub name: String,
    pub kind: SymbolKind,
    pub location: CodeLocation,
    pub related_symbols: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileContext {
    pub content: String,
    pub symbols: Vec<CodeSymbol>,
    pub imports: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct ContextConfig {
    pub db_path: PathBuf,
    pub max_files: usize,
    pub max_embeddings: usize,
    pub watch_files: Option<bool>,
    pub chunk_size: Option<usize>,
    pub min_chunk_overlap: Option<usize>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct QueryContext {
    pub chunks: Vec<ChunkInfo>,
    pub relevance_score: f32,
    pub source_file: Option<String>,
    pub metadata: QueryMetadata,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct QueryMetadata {
    #[serde(with = "chrono::serde::ts_milliseconds")]
    pub timestamp: DateTime<Utc>,
    pub execution_time_ms: u64,
    pub total_chunks_searched: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SymbolKind {
    File,
    Class,
    Interface,
    Function,
    Method,
    Variable,
    Import,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChunkInfo {
    pub content: String,
    pub start_line: usize,
    pub end_line: usize,
    pub file_path: String,
    pub symbol_kind: Option<SymbolKind>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileMetadata {
    pub id: String,
    pub path: String,
    pub last_updated: i64,
}

/// Main context manager implementation using LanceDB for vector storage
pub struct SmartContextManager {
    db: Connection, // The LanceDB connection
    table: Table,   // The table storing code chunks
    file_cache: Arc<Mutex<LruCache<String, FileContext>>>,
    base_path: PathBuf,
}

impl SmartContextManager {
    pub async fn cleanup(&mut self) -> Result<()> {
        // Clear the cache
        self.file_cache.lock().clear();
        // Any other cleanup needed for LanceDB connections
        Ok(())
    }

    /// Create a new instance of the manager with given config.
    pub async fn new(config: ContextConfig) -> Result<Self> {
        // 1) Build a path for the LanceDB directory.
        let uri = format!("{}/context.lancedb", config.db_path.to_string_lossy());
        let uri_str = uri.as_str();

        // 2) Connect to the LanceDB database (creates if not exists)
        let db = connect(uri_str).execute().await?;

        // 3) Choose a table name
        let table_name = "context_chunks";

        // 4) Define an Arrow schema for storing your data
        let schema = Arc::new(Schema::new(vec![
            arrow::arrow_schema::Field::new("id", DataType::Utf8, false),
            arrow::arrow_schema::Field::new("file_path", DataType::Utf8, false),
            arrow::arrow_schema::Field::new("content", DataType::Utf8, false),
            arrow::arrow_schema::Field::new(
                "embedding",
                DataType::FixedSizeList(
                    Arc::new(arrow::arrow_schema::Field::new(
                        "item",
                        DataType::Float32,
                        false,
                    )),
                    EMBEDDING_DIM,
                ),
                false,
            ),
            arrow::arrow_schema::Field::new("start_line", DataType::Int32, false),
            arrow::arrow_schema::Field::new("end_line", DataType::Int32, false),
            arrow::arrow_schema::Field::new("symbol_kind", DataType::Utf8, true),
        ]));

        // 5) Try to open existing table first, create if it doesn't exist
        let table = match db.open_table(table_name).execute().await {
            Ok(table) => {
                println!("Successfully opened existing table '{}'", table_name);
                table
            }
            Err(_) => {
                println!("Creating new table '{}'", table_name);
                db.create_empty_table(table_name, schema).execute().await?
            }
        };

        // 6) Build up the manager
        Ok(Self {
            db,
            table,
            file_cache: Arc::new(Mutex::new(LruCache::new(
                NonZeroUsize::new(config.max_files).unwrap(),
            ))),
            base_path: config.db_path.into(),
        })
    }

    /// Add a new file to the context system
    pub async fn add_file(&self, path: &str, content: &str) -> Result<FileMetadata> {
        // Check if the file is already in context
        if self.has_file(path).await? {
            return Err(anyhow::anyhow!("File {} is already in context", path));
        }

        // Parse file into chunks and symbols
        let (chunks, symbols) = self.process_file(path, content)?;

        // Generate embeddings for chunks
        let embeddings = self.generate_embeddings_for_chunks(&chunks).await?;

        // Build up a vector of arrays (one row per chunk)
        let mut ids = Vec::new();
        let mut file_paths = Vec::new();
        let mut contents = Vec::new();
        let mut embedding_arrays = Vec::new();
        let mut start_lines = Vec::new();
        let mut end_lines = Vec::new();
        let mut symbol_kinds = Vec::new();

        for (chunk, emb) in chunks.iter().zip(embeddings.iter()) {
            ids.push(Uuid::new_v4().to_string());
            file_paths.push(chunk.file_path.clone());
            contents.push(chunk.content.clone());
            start_lines.push(chunk.start_line as i32);
            end_lines.push(chunk.end_line as i32);
            // SymbolKind as a string or None
            let sk_str = chunk
                .symbol_kind
                .as_ref()
                .map(|k| format!("{:?}", k))
                .unwrap_or_default();
            symbol_kinds.push(sk_str);
            embedding_arrays.push(emb.clone()); // store the Vec<f32>
        }

        // Now convert them to Arrow arrays
        let id_array = Arc::new(StringArray::from(ids)) as Arc<dyn Array>;
        let path_array = Arc::new(StringArray::from(file_paths)) as Arc<dyn Array>;
        let content_array = Arc::new(StringArray::from(contents)) as Arc<dyn Array>;
        let symbol_kind_array = Arc::new(StringArray::from(symbol_kinds)) as Arc<dyn Array>;
        let start_line_array = Arc::new(Int32Array::from(start_lines)) as Arc<dyn Array>;
        let end_line_array = Arc::new(Int32Array::from(end_lines)) as Arc<dyn Array>;

        let item_field = Arc::new(arrow::arrow_schema::Field::new(
            "item",
            DataType::Float32,
            false,
        ));

        // For embeddings, build a Float32Array for each row, then wrap in FixedSizeList
        // Flatten all embeddings into one big Float32Array:
        let flat_embeddings: Vec<f32> = embedding_arrays.into_iter().flatten().collect();
        let float32_arr: Arc<dyn Array> = Arc::new(Float32Array::from(flat_embeddings.clone()));

        // Each embedding is EMBEDDING_DIM in length, so total length = num_rows * EMBEDDING_DIM
        let embedding_list_array = Arc::new(FixedSizeListArray::try_new(
            item_field.clone(),  // Arc<Field> with a descriptive name
            EMBEDDING_DIM,       // list size
            float32_arr.clone(), // values array
            None,                // Option<NullBuffer>
        )?) as Arc<dyn Array>;

        assert_eq!(
            flat_embeddings.len(),
            (start_line_array.len() as usize) * (EMBEDDING_DIM as usize),
            "Mismatch between number of embeddings and embedding dimensions"
        );

        // We need to ensure the table's schema matches the order of fields we specified above
        let batch = RecordBatch::try_new(
            self.table.schema().await?.clone(),
            vec![
                id_array,
                path_array,
                content_array,
                embedding_list_array,
                start_line_array,
                end_line_array,
                symbol_kind_array,
            ],
        )?;

        let iter_batch =
            RecordBatchIterator::new(vec![Ok(batch)].into_iter(), self.table.schema().await?);

        // Insert the record batch into LanceDB
        self.table.add(iter_batch);

        // Cache the file context
        let file_context = FileContext {
            content: content.to_string(),
            symbols,
            imports: self.extract_imports(content),
        };
        let metadata = FileMetadata {
            id: Uuid::new_v4().to_string(),
            path: path.to_string(),
            last_updated: Utc::now().timestamp(),
        };

        self.file_cache.lock().put(path.to_string(), file_context);

        Ok(metadata)
    }

    pub async fn has_file(&self, path: &str) -> Result<bool> {
        // Implement a query to check if the file exists
        let mut stream = self.table.query().execute().await?;

        while let Some(_batch) = stream.try_next().await? {
            // If any batch returns, the file exists
            return Ok(true);
        }

        Ok(false)
    }

    /// Search for semantically similar code chunks
    pub async fn search_similar(&self, query: &str, limit: usize) -> Result<Vec<ChunkInfo>> {
        // Generate embedding for query using BGE (Python)
        let query_embedding: Vec<f32> = self.generate_embedding(query).await?;

        // Record search start time for metrics
        let start_time = std::time::Instant::now();

        // Check if index exists and create if needed
        let indices = self.table.list_indices().await?;
        if !indices
            .iter()
            .any(|idx| idx.columns.contains(&"embedding".to_string()))
        {
            self.table
                .create_index(
                    &["embedding"],
                    Index::IvfPq(
                        IvfPqIndexBuilder::default()
                            .distance_type(lancedb::DistanceType::Cosine)
                            .num_partitions(64)
                            .num_sub_vectors(16),
                    ),
                )
                .execute()
                .await?;
        }

        // Perform vector search
        let plan = self.table.vector_search(query_embedding.clone());

        // Log search latency
        println!(
            "Vector search completed in {:?}ms",
            start_time.elapsed().as_millis()
        );

        let mut chunks = Vec::new();
        let copy = plan?.clone();
        // Process results from the stream
        while let Some(batch) = copy.execute().await?.try_next().await? {
            // Extract columns from the batch
            let content = batch
                .column_by_name("content")
                .expect("content column not found in record batch")
                .as_any()
                .downcast_ref::<StringArray>()
                .unwrap();

            let file_path = batch
                .column_by_name("file_path")
                .expect("file_path column not found in record batch")
                .as_any()
                .downcast_ref::<StringArray>()
                .unwrap();

            let start_line = batch
                .column_by_name("start_line")
                .expect("start_line column not found in record batch")
                .as_any()
                .downcast_ref::<Int32Array>()
                .unwrap();

            let end_line = batch
                .column_by_name("end_line")
                .expect("end_line column not found in record batch")
                .as_any()
                .downcast_ref::<Int32Array>()
                .unwrap();

            let symbol_kind = batch
                .column_by_name("symbol_kind")
                .expect("symbol_kind does not exist")
                .as_any()
                .downcast_ref::<StringArray>()
                .unwrap();

            // Process each row in the batch
            for i in 0..batch.num_rows() {
                chunks.push(ChunkInfo {
                    content: content.value(i).to_string(),
                    file_path: file_path.value(i).to_string(),
                    start_line: start_line.value(i) as usize,
                    end_line: end_line.value(i) as usize,
                    symbol_kind: if symbol_kind.is_valid(i) {
                        match symbol_kind.value(i).to_lowercase().as_str() {
                            "file" => Some(SymbolKind::File),
                            "class" => Some(SymbolKind::Class),
                            "interface" => Some(SymbolKind::Interface),
                            "function" | "fn" => Some(SymbolKind::Function),
                            "method" => Some(SymbolKind::Method),
                            "variable" | "var" => Some(SymbolKind::Variable),
                            "import" | "use" => Some(SymbolKind::Import),
                            _ => {
                                println!("Unknown symbol kind: {}", symbol_kind.value(i));
                                None
                            }
                        }
                    } else {
                        None
                    },
                });
            }
        }

        Ok(chunks)
    }

    /// Process a file into chunks and extract symbols
    fn process_file(&self, path: &str, content: &str) -> Result<(Vec<ChunkInfo>, Vec<CodeSymbol>)> {
        let mut chunks = Vec::new();
        let mut symbols = Vec::new();

        // Simple chunking logic; can be enhanced based on requirements
        let lines: Vec<&str> = content.lines().collect();
        let chunk_size = 50; // Can be made configurable

        for (i, chunk) in lines.chunks(chunk_size).enumerate() {
            let start_line = i * chunk_size;
            let end_line = start_line + chunk.len();

            chunks.push(ChunkInfo {
                content: chunk.join("\n"),
                start_line,
                end_line,
                file_path: path.to_string(),
                symbol_kind: None,
            });
        }

        // Basic symbol extraction with Regex
        let patterns = [
            (Regex::new(r"class\s+(\w+)")?, SymbolKind::Class),
            (Regex::new(r"fn\s+(\w+)")?, SymbolKind::Function),
            (Regex::new(r"struct\s+(\w+)")?, SymbolKind::Class),
            // Add more patterns as needed
        ];

        for (re, kind) in patterns.iter() {
            for cap in re.captures_iter(content) {
                let name = cap[1].to_string();
                symbols.push(CodeSymbol {
                    name,
                    kind: kind.clone(),
                    location: CodeLocation {
                        file: path.to_string(),
                        start_line: 0, // Can be enhanced to capture actual locations
                        end_line: 0,
                        start_col: 0,
                        end_col: 0,
                    },
                    related_symbols: Vec::new(),
                });
            }
        }

        Ok((chunks, symbols))
    }

    /// Extract imports from content
    fn extract_imports(&self, content: &str) -> Vec<String> {
        let mut imports = Vec::new();
        let re = Regex::new(r"use\s+([^;]+);").unwrap();
        for cap in re.captures_iter(content) {
            imports.push(cap[1].trim().to_string());
        }
        imports
    }

    /// Generate embeddings for a single piece of text using BGE (PyO3 example)
    pub async fn generate_embedding(&self, text: &str) -> Result<Vec<f32>> {
        // Hypothetical Python code in bge_embed.py
        Python::with_gil(|py| {
            let embed_module = py.import("bge_embed")?;
            let embed_func = embed_module.getattr("embed_text")?;
            let embeddings: Vec<f32> = embed_func.call1((text,))?.extract()?;
            Ok(embeddings)
        })
    }

    /// Generate embeddings for multiple chunks
    pub async fn generate_embeddings_for_chunks(
        &self,
        chunks: &[ChunkInfo],
    ) -> Result<Vec<Vec<f32>>> {
        let texts: Vec<String> = chunks.iter().map(|c| c.content.clone()).collect();

        Python::with_gil(|py| {
            let embed_module = py.import("bge_embed")?;
            let embed_batch_func = embed_module.getattr("embed_text_batch")?;
            let embeddings: Vec<Vec<f32>> = embed_batch_func.call1((texts,))?.extract()?;
            Ok(embeddings)
        })
    }

    /// Retrieve context for a given query
    pub async fn get_context(&self, query: &str) -> Result<QueryContext> {
        let start_time = std::time::Instant::now();

        // Search for similar chunks
        let chunks = self.search_similar(query, 5).await?;

        // Build query metadata
        let metadata = QueryMetadata {
            timestamp: Utc::now(),
            execution_time_ms: start_time.elapsed().as_millis() as u64,
            total_chunks_searched: chunks.len(),
        };

        // If we found chunks, use the first one's file path
        let source_file = chunks.first().map(|c| c.file_path.clone());

        // Calculate an overall relevance score (simplified example)
        let relevance_score = if chunks.is_empty() { 0.0 } else { 0.85 };

        Ok(QueryContext {
            chunks,
            relevance_score,
            source_file,
            metadata,
        })
    }

    /// Retrieve context statistics
    pub async fn get_stats(&self) -> Result<ContextStats> {
        // Implement logic to calculate stats
        let total_files = self.table.count_rows(None).await? as usize;
        let active_files = self.file_cache.lock().len();
        let total_size = self.calculate_total_size().await?;

        Ok(ContextStats {
            totalFiles: total_files,
            activeFiles: active_files,
            totalSize: total_size,
        })
    }

    /// Calculate total size of all files in context
    async fn calculate_total_size(&self) -> Result<usize> {
        // Implement logic to calculate total size
        // Example: Sum the length of all file contents
        let mut total = 0;
        let mut stream = self.table.query().execute().await?;

        while let Some(batch) = stream.try_next().await? {
            let content = batch
                .column_by_name("content")
                .expect("content column not found")
                .as_any()
                .downcast_ref::<StringArray>()
                .unwrap();

            for i in 0..batch.num_rows() {
                total += content.value(i).len();
            }
        }

        Ok(total)
    }
}
