use anyhow::Result;
use chrono::Utc;
use once_cell::sync::OnceCell;
use serde::Deserialize;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex;

use super::context_manager::{
    ChunkInfo, ContextConfig, ContextStats, QueryContext, QueryMetadata, SmartContextManager
};

/// Thread-safe global state using tokio::sync::Mutex for async safety
struct GlobalState {
    manager: Arc<Mutex<Option<Arc<SmartContextManager>>>>,
    init_lock: Arc<Mutex<()>>,
}

impl GlobalState {
    fn new() -> Self {
        Self {
            manager: Arc::new(Mutex::new(None)),
            init_lock: Arc::new(Mutex::new(())),
        }
    }

    async fn get_manager(&self) -> Result<Arc<SmartContextManager>, String> {
        let guard = self.manager.lock().await;
        guard
            .as_ref()
            .cloned()
            .ok_or_else(|| "Context manager not initialized".to_string())
    }

    pub async fn reset(&self) -> Result<(), String> {
        let _init_guard = self.init_lock.lock().await;
        let mut manager_guard = self.manager.lock().await;
        *manager_guard = None;
        Ok(())
    }
}

// Thread-safe singleton instance
static GLOBAL_STATE: OnceCell<GlobalState> = OnceCell::new();

fn get_global_state() -> &'static GlobalState {
    GLOBAL_STATE.get_or_init(|| GlobalState::new())
}

#[tauri::command]
pub async fn init_context_manager(
    db_path: String,
    max_files: usize,
    max_embeddings: usize,
    watch_files: Option<bool>,
    chunk_size: Option<usize>,
    min_chunk_overlap: Option<usize>,
) -> Result<(), String> {
    println!("=== Rust Context Manager Initialization ===");

    let context_config = ContextConfig {
        max_files,
        max_embeddings,
        db_path: PathBuf::from(db_path),
        watch_files: Some(watch_files.unwrap_or(false)),
        chunk_size: Some(chunk_size.unwrap_or(512)),
        min_chunk_overlap: Some(min_chunk_overlap.unwrap_or(32)),
    };

    let state = get_global_state();
    let _init_guard = state.init_lock.lock().await;

    let mut manager_guard = state.manager.lock().await;
    if manager_guard.is_some() {
        println!("ContextManager is already initialized.");
        return Ok(());
    }

    let manager = SmartContextManager::new(context_config)
        .await
        .map_err(|e| format!("Failed to create SmartContextManager: {}", e))?;

    *manager_guard = Some(Arc::new(manager));
    println!("=== Context Manager Initialization Complete ===");
    Ok(())
}

#[tauri::command]
pub async fn reset_context_manager() -> Result<(), String> {
    let state = get_global_state();
    state.reset().await
}

#[tauri::command]
pub async fn get_context(query: String) -> Result<QueryContext, String> {
    let state = get_global_state();
    let manager = state.get_manager().await?;
    manager.get_context(&query).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn generate_embeddings(text: String) -> Result<Vec<f32>, String> {
    let state = get_global_state();
    let manager = state.get_manager().await?;
    manager
        .generate_embedding(&text)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn read_context_file(path: String) -> Result<String, String> {
    tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("Failed to read file {}: {}", path, e))
}

#[tauri::command]
pub async fn add_to_context(path: String, content: String) -> Result<(), String> {
    let state = get_global_state();
    let manager = state.get_manager().await?;
    manager
        .add_file(&path, &content)
        .await
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn search_similar_code(
    query: String,
    limit: Option<usize>,
) -> Result<QueryContext, String> {
    let state = get_global_state();
    let manager = state.get_manager().await?;

    let chunks = manager
        .search_similar(&query, limit.unwrap_or(5))
        .await
        .map_err(|e| e.to_string())?;

    Ok(QueryContext {
        chunks: chunks.clone(),
        relevance_score: 0.85,
        source_file: chunks.first().map(|c| c.file_path.clone()),
        metadata: QueryMetadata {
            timestamp: Utc::now(),
            execution_time_ms: 0,
            total_chunks_searched: chunks.len(),
        },
    })
}

#[tauri::command]
pub async fn get_file_context(path: String) -> Result<QueryContext, String> {
    let state = get_global_state();
    let manager = state.get_manager().await?;
    manager.get_context(&path).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn is_file_in_context(path: String) -> Result<bool, String> {
    let state = get_global_state();
    let manager = state.get_manager().await?;
    manager.has_file(&path).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_context_stats() -> Result<ContextStats, String> {
    let state = get_global_state();
    let manager = state.get_manager().await?;
    manager.get_stats().await.map_err(|e| e.to_string())
}
