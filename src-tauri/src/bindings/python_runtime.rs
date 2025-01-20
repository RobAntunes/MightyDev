use anyhow::{Context, Result};
use once_cell::sync::OnceCell;
use parking_lot::Mutex;
use pyo3::prelude::*;
use std::{env, fs, path::PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::sync::Mutex as AsyncMutex;

// Global initialization guards
static INIT_GUARD: OnceCell<Arc<AsyncMutex<()>>> = OnceCell::new();
static IS_INITIALIZED: AtomicBool = AtomicBool::new(false);
static PYTHON_RUNTIME: OnceCell<Mutex<Option<PythonRuntime>>> = OnceCell::new();

pub struct PythonRuntime {
    python_dir: PathBuf,
    site_packages: PathBuf,
}

impl PythonRuntime {
    fn new() -> Result<Self> {
        let base_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let python_dir = base_dir.join("python");
        let site_packages = if cfg!(target_os = "windows") {
            python_dir.join("venv").join("Lib").join("site-packages")
        } else {
            python_dir
                .join("venv")
                .join("lib")
                .join("python3.11")
                .join("site-packages")
        };

        // Verify directories exist
        if !python_dir.exists() {
            return Err(anyhow::anyhow!(
                "Python directory not found: {:?}",
                python_dir
            ));
        }
        if !site_packages.exists() {
            return Err(anyhow::anyhow!(
                "Site packages directory not found: {:?}",
                site_packages
            ));
        }

        Ok(Self {
            python_dir,
            site_packages,
        })
    }

    fn setup_python_environment(&self) -> Result<()> {
        // Create PYTHONPATH with proper system separator
        let pythonpath = env::join_paths([&self.python_dir, &self.site_packages])?;
        let pythonpath_str = pythonpath.to_string_lossy().into_owned();

        env::set_var("PYTHONPATH", pythonpath.clone());
        println!("Python directory: {}", self.python_dir.display());
        println!("PYTHONPATH set to: {}", pythonpath_str);

        Python::with_gil(|py| -> PyResult<()> {
            // Set up sys.path
            let sys = py.import("sys")?;
            let sys_path = sys.getattr("path")?;

            // Add our directories to sys.path
            sys_path.call_method1("insert", (0, self.python_dir.to_string_lossy()))?;
            sys_path.call_method1("insert", (1, self.site_packages.to_string_lossy()))?;

            // Verify required packages
            self.verify_package(py, "numpy")?;
            self.verify_package(py, "bge_embed")?;

            Ok(())
        })
        .context("Failed to set up Python environment")?;

        Ok(())
    }

    fn verify_package<'py>(&self, py: Python<'py>, package: &str) -> PyResult<()> {
        match py.import(package) {
            Ok(_) => {
                println!("Successfully imported {}", package);
                Ok(())
            }
            Err(e) => {
                println!("Failed to import {}: {}", package, e);
                if let Ok(modname) = e.get_type(py).name() {
                    match modname.to_string_lossy().as_ref() {
                        "ModuleNotFoundError" => println!(
                            "Module not found. Please ensure {} is installed correctly.",
                            package
                        ),
                        "ImportError" => println!(
                            "Import error. This might be due to missing dependencies for {}.",
                            package
                        ),
                        _ => println!("Unexpected error type: {}", modname.to_string_lossy())
                    }
                }
                Err(e)
            }
        }
    }

    pub fn cleanup(&self) -> Result<()> {
        Python::with_gil(|py| {
            // Run garbage collection
            py.run(std::ffi::CString::new("import gc; gc.collect()").unwrap().as_c_str(), None, None)?;
            Ok(())
        })
    }
}

// System cleanup functions
fn cleanup_python_locks() -> Result<()> {
    let base_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let python_dir = base_dir.join("python");
    
    // Common Python lock file patterns
    let lock_patterns = [
        "*.lock",
        "*.pid",
        "__pycache__",
        "*.pyc",
    ];

    // Clean up lock files
    for pattern in lock_patterns.iter() {
        for entry in glob::glob(&python_dir.join(pattern).to_string_lossy())? {
            if let Ok(path) = entry {
                if path.is_file() {
                    fs::remove_file(path)?;
                } else if path.is_dir() {
                    fs::remove_dir_all(path)?;
                }
            }
        }
    }

    Ok(())
}

pub async fn initialize_python_runtime() -> Result<(), String> {
    // Get or initialize the guard
    let guard = INIT_GUARD.get_or_init(|| Arc::new(AsyncMutex::new(())));
    
    // Acquire the lock to ensure only one initialization happens at a time
    let _lock = guard.lock().await;
    
    // Check if already initialized
    if IS_INITIALIZED.load(Ordering::SeqCst) {
        return Ok(());
    }

    println!("=== Python Environment Initialization ===");

    // Initialize Python runtime
    PYTHON_RUNTIME.get_or_try_init::<_, String>(|| {
        // Initialize Python once at the start
        pyo3::prepare_freethreaded_python();

        let runtime = PythonRuntime::new().map_err(|e| e.to_string())?;
        runtime.setup_python_environment().map_err(|e| e.to_string())?;

        println!("=== Python Environment Successfully Initialized ===");
        Ok(Mutex::new(Some(runtime)))
    })
    .map_err(|e| format!("Failed to initialize Python runtime: {}", e))?;

    IS_INITIALIZED.store(true, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
pub async fn cleanup_all_systems() -> Result<(), String> {
    if IS_INITIALIZED.load(Ordering::SeqCst) {
        // Acquire initialization lock
        if let Some(guard) = INIT_GUARD.get() {
            let _lock = guard.lock().await;
            
            // Clean up Python runtime
            if let Some(runtime_mutex) = PYTHON_RUNTIME.get() {
                if let Some(runtime) = runtime_mutex.lock().as_ref() {
                    if let Err(e) = runtime.cleanup() {
                        eprintln!("Error cleaning up Python runtime: {}", e);
                    }
                }
            }
            
            // Reset initialization flag
            IS_INITIALIZED.store(false, Ordering::SeqCst);
        }
    }
    Ok(())
}

// Helper function for Python commands
pub fn run_python<F, R>(f: F) -> Result<R, String>
where
    F: FnOnce(Python<'_>) -> PyResult<R>,
{
    Python::with_gil(f).map_err(|e| e.to_string())
}