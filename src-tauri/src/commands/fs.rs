use notify::{Event, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::env;
use std::path::PathBuf;
use std::{fs, os::unix::fs::PermissionsExt, path::Path, sync::mpsc, time::SystemTime};
use tauri::{command, Emitter, Manager, Runtime, WebviewWindow};

// File watcher configuration
use once_cell::sync::Lazy;
use parking_lot::Mutex;
use std::sync::Arc;

static FILE_WATCHER: Lazy<Arc<Mutex<Option<FileWatcher>>>> =
    Lazy::new(|| Arc::new(Mutex::new(None)));

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

// Enhanced file watcher configuration
pub struct FileWatcher {
    watcher: notify::RecommendedWatcher,
    _tx: mpsc::Sender<Event>,
}

impl FileWatcher {
    pub fn new() -> notify::Result<Self> {
        let (tx, rx) = mpsc::channel();

        let tx_clone = tx.clone();
        let watcher = notify::RecommendedWatcher::new(
            move |res: notify::Result<Event>| {
                if let Ok(event) = res {
                    // Filter out events we want to ignore
                    if !should_ignore_event(&event) {
                        let _ = tx_clone.send(event);
                    }
                }
            },
            notify::Config::default(),
        )?;

        Ok(Self { watcher, _tx: tx })
    }

    pub fn watch<P: AsRef<Path>>(&mut self, path: P) -> notify::Result<()> {
        self.watcher.watch(path.as_ref(), RecursiveMode::Recursive)
    }
}

fn should_ignore_event(event: &Event) -> bool {
    event.paths.iter().any(|path| should_ignore_path(path))
}

fn should_ignore_path(path: &Path) -> bool {
    let path_str = path.to_string_lossy();
    let ignore_patterns = [
        "__pycache__",
        "/venv/",
        ".pyc",
        "/.pytest_cache/",
        "/target/",
        "/.git/",
        "/node_modules/",
        ".DS_Store",
        "/storage/",
        "/storage.db/",
        ".db",
        "LOCK",
        ".wal",
    ];

    ignore_patterns
        .iter()
        .any(|pattern| path_str.contains(pattern))
}

// Initialize the file watcher
pub fn initialize_watcher() -> Result<(), Box<dyn std::error::Error>> {
    let mut watcher = FileWatcher::new()?;
    let project_root = get_project_root();
    watcher.watch(project_root)?;

    *FILE_WATCHER.lock() = Some(watcher);
    Ok(())
}

// Function to get the project root directory
fn get_project_root() -> PathBuf {
    let current_dir = env::current_dir().expect("Failed to get current directory");

    let mut dir = current_dir.as_path();
    while let Some(parent) = dir.parent() {
        if dir.join("package.json").exists()
            || dir.join("Cargo.toml").exists()
            || dir.join(".git").exists()
            || dir.join("deno.json").exists()
        {
            return dir.to_path_buf();
        }
        dir = parent;
    }

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

        // Skip ignored files and directories
        if should_ignore_path(&path) {
            continue;
        }

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

// Initialize function to be called at startup
pub fn initialize_fs() -> Result<(), Box<dyn std::error::Error>> {
    initialize_watcher()?;
    Ok(())
}

// Cleanup function to be called on shutdown
pub fn cleanup_fs() {
    if let Some(_watcher) = FILE_WATCHER.lock().take() {
        // The watcher will be dropped here, cleaning up its resources
    }
}
