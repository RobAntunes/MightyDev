use rocksdb::{DB, Options};
use serde::{Deserialize, Serialize};
use tauri::command;
use std::path::Path;
use std::sync::Mutex;
use lazy_static::lazy_static;

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

// Global database instance
lazy_static! {
    static ref DB_INSTANCE: Mutex<Option<DB>> = Mutex::new(None);
}

/// Initialize RocksDB with the specified path
pub fn initialize_db(path: &Path) -> Result<(), StorageError> {
    let mut options = Options::default();
    options.create_if_missing(true);
    
    match DB::open(&options, path) {
        Ok(db) => {
            let mut instance = DB_INSTANCE.lock().unwrap();
            *instance = Some(db);
            Ok(())
        },
        Err(e) => Err(StorageError {
            code: "INIT_ERROR".to_string(),
            message: e.to_string(),
        })
    }
}

#[command]
pub async fn store_value(key: String, value: String) -> Result<(), StorageError> {
    let instance = DB_INSTANCE.lock().unwrap();
    let db = instance.as_ref().ok_or(StorageError {
        code: "NOT_INITIALIZED".to_string(),
        message: "Database not initialized".to_string(),
    })?;

    db.put(key.as_bytes(), value.as_bytes())
        .map_err(|e| StorageError {
            code: "WRITE_ERROR".to_string(),
            message: e.to_string(),
        })
}

#[command]
pub async fn get_value(key: String) -> Result<Option<String>, StorageError> {
    let instance = DB_INSTANCE.lock().unwrap();
    let db = instance.as_ref().ok_or(StorageError {
        code: "NOT_INITIALIZED".to_string(),
        message: "Database not initialized".to_string(),
    })?;

    match db.get(key.as_bytes()) {
        Ok(Some(value)) => Ok(Some(String::from_utf8_lossy(&value).to_string())),
        Ok(None) => Ok(None),
        Err(e) => Err(StorageError {
            code: "READ_ERROR".to_string(),
            message: e.to_string(),
        })
    }
}

/// Close the database connection
pub fn cleanup() {
    let mut instance = DB_INSTANCE.lock().unwrap();
    *instance = None;
}

#[command]
pub async fn delete_value(key: String) -> Result<(), StorageError> {
    let instance = DB_INSTANCE.lock().unwrap();
    let db = instance.as_ref().ok_or(StorageError {
        code: "NOT_INITIALIZED".to_string(),
        message: "Database not initialized".to_string(),
    })?;

    db.delete(key.as_bytes())
        .map_err(|e| StorageError {
            code: "DELETE_ERROR".to_string(),
            message: e.to_string(),
        })
}

// Prefix scanning support
#[command]
pub async fn scan_prefix(prefix: String) -> Result<Vec<(String, String)>, StorageError> {
    let instance = DB_INSTANCE.lock().unwrap();
    let db = instance.as_ref().ok_or(StorageError {
        code: "NOT_INITIALIZED".to_string(),
        message: "Database not initialized".to_string(),
    })?;

    let mut results = Vec::new();
    let iterator = db.prefix_iterator(prefix.as_bytes());

    for item in iterator {
        match item {
            Ok((key, value)) => {
                if let (Ok(k), Ok(v)) = (String::from_utf8(key.to_vec()), String::from_utf8(value.to_vec())) {
                    results.push((k, v));
                }
            }
            Err(e) => return Err(StorageError {
                code: "SCAN_ERROR".to_string(),
                message: e.to_string(),
            })
        }
    }

    Ok(results)
}