// src/commands/storage.rs

use anyhow::{Context, Result};
use once_cell::sync::OnceCell;
use parking_lot::RwLock;
use rocksdb::{DBWithThreadMode, MultiThreaded, Options};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;

type DB = DBWithThreadMode<MultiThreaded>;

#[derive(Debug, Serialize, Deserialize)]
pub struct StorageError {
    code: String,
    message: String,
}

impl std::error::Error for StorageError {}

impl std::fmt::Display for StorageError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.code, self.message)
    }
}

#[derive(Clone)]
pub struct StorageManager {
    db: Arc<DB>,
    db_path: PathBuf,
}

static STORAGE_MANAGER: OnceCell<RwLock<Option<StorageManager>>> = OnceCell::new();

impl StorageManager {
    pub fn new(path: PathBuf) -> Result<Self, Box<dyn std::error::Error>> {
        // Create database directory if it doesn't exist
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .with_context(|| format!("Failed to create parent directory for {:?}", path))?;
            println!("Created parent directory for {:?}", path);
        }

        // Configure RocksDB options
        let mut opts = Options::default();
        opts.create_if_missing(true);
        opts.set_keep_log_file_num(10);
        opts.set_max_total_wal_size(536870912); // 512MB
        opts.set_write_buffer_size(67108864); // 64MB
        opts.set_max_open_files(32);

        // Open database with multi-threaded mode
        match DB::open(&opts, &path) {
            Ok(db) => {
                println!("Successfully opened RocksDB at {:?}", path);
                Ok(Self {
                    db: Arc::new(db),
                    db_path: path,
                })
            }
            Err(e) => {
                eprintln!("Failed to open RocksDB at {:?}: {}", path, e);
                Err(Box::new(e))
            }
        }
    }

    pub fn initialize(path: &Path) -> Result<(), Box<dyn std::error::Error>> {
        // Initialize the OnceCell if not already done
        let manager_lock = STORAGE_MANAGER.get_or_init(|| RwLock::new(None));

        // Check if StorageManager is already initialized
        if manager_lock.read().is_some() {
            println!("StorageManager is already initialized.");
            return Ok(());
        }

        // Initialize StorageManager
        let manager = Self::new(path.to_path_buf())?;
        *manager_lock.write() = Some(manager);
        println!("StorageManager initialized and set in STORAGE_MANAGER.");
        Ok(())
    }

    pub fn shutdown(&self) -> Result<(), Box<dyn std::error::Error>> {
        // RocksDB handles its own cleanup upon drop, so manual removal is unnecessary
        // If you have additional cleanup, perform it here
        println!("Shutting down StorageManager.");
        Ok(())
    }
}

#[derive(Debug, Serialize)]
pub struct StorageCleanupResult {
    pub cleaned_locks: bool,
    pub message: String,
}

#[tauri::command]
pub async fn initialize_storage(db_path: &Path) -> Result<(), Box<dyn std::error::Error>> {
    println!(
        "Attempting to initialize StorageManager at path: {}",
        db_path.display()
    );
    StorageManager::initialize(db_path)
}

#[tauri::command]
pub async fn store_value(key: String, value: String) -> Result<(), StorageError> {
    let manager_lock = STORAGE_MANAGER.get().ok_or_else(|| StorageError {
        code: "NOT_INITIALIZED".to_string(),
        message: "Storage manager not initialized".to_string(),
    })?;

    let manager_read = manager_lock.read();
    let manager = manager_read.as_ref().ok_or_else(|| StorageError {
        code: "NOT_INITIALIZED".to_string(),
        message: "Storage manager not initialized".to_string(),
    })?;

    println!("Storing value: key={}, value={}", key, value);

    manager
        .db
        .put(key.as_bytes(), value.as_bytes())
        .map_err(|e| StorageError {
            code: "WRITE_ERROR".to_string(),
            message: e.to_string(),
        })
}

#[tauri::command]
pub async fn get_value(key: String) -> Result<Option<String>, StorageError> {
    let manager_lock = STORAGE_MANAGER.get().ok_or_else(|| StorageError {
        code: "NOT_INITIALIZED".to_string(),
        message: "Storage manager not initialized".to_string(),
    })?;

    let manager_read = manager_lock.read();
    let manager = manager_read.as_ref().ok_or_else(|| StorageError {
        code: "NOT_INITIALIZED".to_string(),
        message: "Storage manager not initialized".to_string(),
    })?;

    println!("Retrieving value for key: {}", key);

    match manager.db.get(key.as_bytes()) {
        Ok(Some(value)) => {
            let retrieved = String::from_utf8_lossy(&value).to_string();
            println!("Retrieved value: {}", retrieved);
            Ok(Some(retrieved))
        }
        Ok(None) => {
            println!("No value found for key: {}", key);
            Ok(None)
        }
        Err(e) => Err(StorageError {
            code: "READ_ERROR".to_string(),
            message: e.to_string(),
        }),
    }
}

#[tauri::command]
pub async fn delete_value(key: String) -> Result<(), StorageError> {
    let manager_lock = STORAGE_MANAGER.get().ok_or_else(|| StorageError {
        code: "NOT_INITIALIZED".to_string(),
        message: "Storage manager not initialized".to_string(),
    })?;

    let manager_read = manager_lock.read();
    let manager = manager_read.as_ref().ok_or_else(|| StorageError {
        code: "NOT_INITIALIZED".to_string(),
        message: "Storage manager not initialized".to_string(),
    })?;

    println!("Deleting value for key: {}", key);

    manager.db.delete(key.as_bytes()).map_err(|e| StorageError {
        code: "DELETE_ERROR".to_string(),
        message: e.to_string(),
    })
}

#[tauri::command]
pub async fn scan_prefix(prefix: String) -> Result<Vec<(String, String)>, StorageError> {
    let manager_lock = STORAGE_MANAGER.get().ok_or_else(|| StorageError {
        code: "NOT_INITIALIZED".to_string(),
        message: "Storage manager not initialized".to_string(),
    })?;

    let manager_read = manager_lock.read();
    let manager = manager_read.as_ref().ok_or_else(|| StorageError {
        code: "NOT_INITIALIZED".to_string(),
        message: "Storage manager not initialized".to_string(),
    })?;

    println!("Scanning for prefix: {}", prefix);

    let mut results = Vec::new();
    let iterator = manager.db.prefix_iterator(prefix.as_bytes());

    for item in iterator {
        match item {
            Ok((key, value)) => {
                if let (Ok(k), Ok(v)) = (
                    String::from_utf8(key.to_vec()),
                    String::from_utf8(value.to_vec()),
                ) {
                    println!("Found key: {}, value: {}", k, v);
                    results.push((k, v));
                }
            }
            Err(e) => {
                println!("Error scanning prefix: {}", e);
                return Err(StorageError {
                    code: "SCAN_ERROR".to_string(),
                    message: e.to_string(),
                });
            }
        }
    }

    Ok(results)
}

#[tauri::command]
pub async fn cleanup_storage() -> Result<StorageCleanupResult, String> {
    if let Some(manager_lock) = STORAGE_MANAGER.get() {
        if let Some(manager) = manager_lock.write().take() {
            if let Err(e) = manager.shutdown() {
                return Err(format!("Failed to shutdown storage manager: {}", e));
            }
            return Ok(StorageCleanupResult {
                cleaned_locks: true,
                message: "Successfully shut down storage manager and cleaned up lock files."
                    .to_string(),
            });
        }
    }
    Ok(StorageCleanupResult {
        cleaned_locks: false,
        message: "Storage manager was not initialized.".to_string(),
    })
}