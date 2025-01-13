use notify::{Event, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::{fs, os::unix::fs::PermissionsExt, path::Path, sync::mpsc, time::SystemTime};
use tauri::{command, Emitter, Manager, Runtime, WebviewWindow};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileSystemNode {
    id: String,
    name: String,
    #[serde(rename = "type")]
    node_type: String,
    path: String,
    metadata: FileMetadata,
    #[serde(skip_serializing_if = "Option::is_none")]
    children: Option<Vec<FileSystemNode>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileMetadata {
    created_at: String,
    modified_at: String,
    size: u64,
    permissions: String,
}

#[derive(Debug, Serialize)]
pub struct FileSystemError {
    code: String,
    message: String,
    path: Option<String>,
}

impl FileSystemError {
    fn new(code: &str, message: &str) -> Self {
        Self {
            code: code.to_string(),
            message: message.to_string(),
            path: None,
        }
    }

    fn with_path(code: &str, message: &str, path: &Path) -> Self {
        Self {
            code: code.to_string(),
            message: message.to_string(),
            path: Some(path.to_string_lossy().to_string()),
        }
    }
}

// Helper function to get file metadata
fn get_metadata(path: &Path) -> Result<FileMetadata, std::io::Error> {
    let metadata = fs::metadata(path)?;
    let created = metadata.created()?;
    let modified = metadata.modified()?;

    Ok(FileMetadata {
        created_at: created
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap()
            .as_secs()
            .to_string(),
        modified_at: modified
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap()
            .as_secs()
            .to_string(),
        size: metadata.len(),
        permissions: format!("{:o}", metadata.permissions().mode()),
    })
}

// Read directory contents
#[command]
pub async fn read_directory(path: String) -> Result<Vec<FileSystemNode>, FileSystemError> {
    let path = Path::new(&path);

    if !path.exists() {
        return Err(FileSystemError::with_path(
            "PATH_NOT_FOUND",
            "Directory not found",
            path,
        ));
    }

    let mut nodes = Vec::new();
    let entries = fs::read_dir(path)
        .map_err(|e| FileSystemError::with_path("READ_ERROR", &e.to_string(), path))?;

    for entry in entries {
        let entry =
            entry.map_err(|e| FileSystemError::with_path("ENTRY_ERROR", &e.to_string(), path))?;

        let path = entry.path();
        let metadata = get_metadata(&path)
            .map_err(|e| FileSystemError::with_path("METADATA_ERROR", &e.to_string(), &path))?;

        let node = FileSystemNode {
            id: path.to_string_lossy().to_string(),
            name: path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string(),
            node_type: if path.is_dir() { "directory" } else { "file" }.to_string(),
            path: path.to_string_lossy().to_string(),
            metadata,
            children: None,
        };

        nodes.push(node);
    }

    Ok(nodes)
}

// Read file contents
#[command]
pub async fn read_file(path: String) -> Result<String, FileSystemError> {
    let path = Path::new(&path);
    if !path.exists() {
        return Err(FileSystemError::with_path(
            "FILE_NOT_FOUND",
            "File not found",
            path,
        ));
    }

    fs::read_to_string(path)
        .map_err(|e| FileSystemError::with_path("READ_ERROR", &e.to_string(), path))
}

// Write file contents
#[command]
pub async fn write_file(path: String, content: String) -> Result<(), FileSystemError> {
    let path = Path::new(&path);
    fs::write(path, content)
        .map_err(|e| FileSystemError::with_path("WRITE_ERROR", &e.to_string(), path))
}

// Create directory
#[command]
pub async fn create_directory(path: String) -> Result<(), FileSystemError> {
    let path = Path::new(&path);
    fs::create_dir_all(path)
        .map_err(|e| FileSystemError::with_path("CREATE_ERROR", &e.to_string(), path))
}

// Delete file or directory
#[command]
pub async fn delete_path(path: String) -> Result<(), FileSystemError> {
    let path = Path::new(&path);
    if !path.exists() {
        return Err(FileSystemError::with_path(
            "PATH_NOT_FOUND",
            "Path not found",
            path,
        ));
    }

    if path.is_dir() {
        fs::remove_dir_all(path)
    } else {
        fs::remove_file(path)
    }
    .map_err(|e| FileSystemError::with_path("DELETE_ERROR", &e.to_string(), path))
}

// Rename/move file or directory
#[command]
pub async fn rename_path(old_path: String, new_path: String) -> Result<(), FileSystemError> {
    let old_path = Path::new(&old_path);
    let new_path = Path::new(&new_path);

    if !old_path.exists() {
        return Err(FileSystemError::with_path(
            "PATH_NOT_FOUND",
            "Source path not found",
            old_path,
        ));
    }

    fs::rename(old_path, new_path)
        .map_err(|e| FileSystemError::with_path("RENAME_ERROR", &e.to_string(), old_path))
}

// File system watcher setup
pub fn setup_fs_watcher<R: Runtime>(
    window: WebviewWindow<R>,
) -> Result<(), Box<dyn std::error::Error>> {
    let (tx, rx) = mpsc::channel();

    let mut watcher =
        notify::recommended_watcher(move |res: Result<Event, notify::Error>| match res {
            Ok(event) => {
                let _ = tx.send(event);
            }
            Err(e) => println!("Watch error: {:?}", e),
        })?;

    // Start watching the current directory recursively
    watcher.watch(Path::new("."), RecursiveMode::Recursive)?;

    // Handle file system events
    std::thread::spawn(move || {
        for event in rx {
            let event_type = match event.kind {
                notify::EventKind::Create(_) => "create",
                notify::EventKind::Modify(_) => "modify",
                notify::EventKind::Remove(_) => "delete",
                _ => continue,
            };

            // Send event to frontend
            for path in event.paths {
                let _ = window.emit(
                    "fs-change",
                    json!({
                        "type": event_type,
                        "path": path.to_string_lossy().to_string()
                    }),
                );
            }
        }
    });

    Ok(())
}

// Register commands with Tauri
pub fn register<R: Runtime>(app: &mut tauri::App<R>) -> Result<(), Box<dyn std::error::Error>> {
    // Setup file system watcher
    setup_fs_watcher(app.get_webview_window("main").unwrap())?;

    Ok(())
}
