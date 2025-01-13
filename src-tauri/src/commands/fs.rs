use notify::{Event, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::env;
use std::path::PathBuf;
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

// Function to get the project root directory
fn get_project_root() -> PathBuf {
    // First, try to get the current working directory
    let current_dir = env::current_dir().expect("Failed to get current directory");

    // Look for common project root indicators
    let mut dir = current_dir.as_path();
    while let Some(parent) = dir.parent() {
        // Check for common project files/folders
        if dir.join("package.json").exists()
            || dir.join("Cargo.toml").exists()
            || dir.join(".git").exists()
            || dir.join("deno.json").exists()
        {
            return dir.to_path_buf();
        }
        dir = parent;
    }

    // If no project root indicators found, return the current directory
    current_dir
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

#[command]
pub async fn read_directory(path: String) -> Result<Vec<FileSystemNode>, FileSystemError> {
    let project_root = get_project_root();
    let full_path = if Path::new(&path).is_absolute() {
        PathBuf::from(path)
    } else {
        project_root.join(path)
    };

    if !full_path.exists() {
        return Err(FileSystemError::with_path(
            "PATH_NOT_FOUND",
            "Directory not found",
            &full_path,
        ));
    }

    let mut nodes = Vec::new();
    let entries = fs::read_dir(&full_path)
        .map_err(|e| FileSystemError::with_path("READ_ERROR", &e.to_string(), &full_path))?;

    for entry in entries {
        let entry = entry
            .map_err(|e| FileSystemError::with_path("ENTRY_ERROR", &e.to_string(), &full_path))?;
        let path = entry.path();

        // Make path relative to project root for consistency
        let relative_path = path
            .strip_prefix(&project_root)
            .unwrap_or(&path)
            .to_string_lossy()
            .to_string();

        let metadata = get_metadata(&path)
            .map_err(|e| FileSystemError::with_path("METADATA_ERROR", &e.to_string(), &path))?;

        let node = FileSystemNode {
            id: relative_path.clone(),
            name: path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string(),
            node_type: if path.is_dir() { "directory" } else { "file" }.to_string(),
            path: relative_path,
            metadata,
            children: None,
        };

        nodes.push(node);
    }

    // Sort nodes: directories first, then files, both alphabetically
    nodes.sort_by(|a, b| match (a.node_type.as_str(), b.node_type.as_str()) {
        ("directory", "file") => std::cmp::Ordering::Less,
        ("file", "directory") => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    Ok(nodes)
}

#[command]
pub async fn read_file(path: String) -> Result<String, FileSystemError> {
    let project_root = get_project_root();
    let full_path = project_root.join(path);

    if !full_path.exists() {
        return Err(FileSystemError::with_path(
            "FILE_NOT_FOUND",
            "File not found",
            &full_path,
        ));
    }

    fs::read_to_string(&full_path)
        .map_err(|e| FileSystemError::with_path("READ_ERROR", &e.to_string(), &full_path))
}

#[command]
pub async fn write_file(path: String, content: String) -> Result<(), FileSystemError> {
    let project_root = get_project_root();
    let full_path = project_root.join(path);

    // Ensure the parent directory exists
    if let Some(parent) = full_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| FileSystemError::with_path("CREATE_DIR_ERROR", &e.to_string(), parent))?;
    }

    fs::write(&full_path, content)
        .map_err(|e| FileSystemError::with_path("WRITE_ERROR", &e.to_string(), &full_path))
}

#[command]
pub async fn create_directory(path: String) -> Result<(), FileSystemError> {
    let project_root = get_project_root();
    let full_path = project_root.join(path);

    fs::create_dir_all(&full_path)
        .map_err(|e| FileSystemError::with_path("CREATE_ERROR", &e.to_string(), &full_path))
}

#[command]
pub async fn delete_path(path: String) -> Result<(), FileSystemError> {
    let project_root = get_project_root();
    let full_path = project_root.join(path);

    if !full_path.exists() {
        return Err(FileSystemError::with_path(
            "PATH_NOT_FOUND",
            "Path not found",
            &full_path,
        ));
    }

    if full_path.is_dir() {
        fs::remove_dir_all(&full_path)
    } else {
        fs::remove_file(&full_path)
    }
    .map_err(|e| FileSystemError::with_path("DELETE_ERROR", &e.to_string(), &full_path))
}

#[command]
pub async fn rename_path(old_path: String, new_path: String) -> Result<(), FileSystemError> {
    let project_root = get_project_root();
    let old_full_path = project_root.join(old_path);
    let new_full_path = project_root.join(new_path);

    if !old_full_path.exists() {
        return Err(FileSystemError::with_path(
            "PATH_NOT_FOUND",
            "Source path not found",
            &old_full_path,
        ));
    }

    // Ensure the parent directory of the new path exists
    if let Some(parent) = new_full_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| FileSystemError::with_path("CREATE_DIR_ERROR", &e.to_string(), parent))?;
    }

    fs::rename(&old_full_path, &new_full_path)
        .map_err(|e| FileSystemError::with_path("RENAME_ERROR", &e.to_string(), &old_full_path))
}

pub fn setup_fs_watcher<R: Runtime>(
    window: WebviewWindow<R>,
) -> Result<(), Box<dyn std::error::Error>> {
    let (tx, rx) = mpsc::channel();
    let project_root = get_project_root();

    let mut watcher =
        notify::recommended_watcher(move |res: Result<Event, notify::Error>| match res {
            Ok(event) => {
                let _ = tx.send(event);
            }
            Err(e) => println!("Watch error: {:?}", e),
        })?;

    // Watch the project root directory instead of the current directory
    watcher.watch(&project_root, RecursiveMode::Recursive)?;

    // Handle file system events
    std::thread::spawn(move || {
        for event in rx {
            let event_type = match event.kind {
                notify::EventKind::Create(_) => "create",
                notify::EventKind::Modify(_) => "modify",
                notify::EventKind::Remove(_) => "delete",
                _ => continue,
            };

            // Send event to frontend with paths relative to project root
            for path in event.paths {
                if let Ok(relative_path) = path.strip_prefix(&project_root) {
                    let _ = window.emit(
                        "fs-change",
                        json!({
                            "type": event_type,
                            "path": relative_path.to_string_lossy().to_string()
                        }),
                    );
                }
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
