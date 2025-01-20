// src/commands/process_manager.rs

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::process;
use sysinfo::{ProcessesToUpdate, System};
use tauri::command;

/// Configuration options for initializing the ProcessManager.
#[derive(Debug, Serialize, Deserialize)]
pub struct ProcessManagerOptions {
    pub max_retries: u32,
    pub retry_delay: u32, // in milliseconds
}

impl Default for ProcessManagerOptions {
    fn default() -> Self {
        Self {
            max_retries: 3,
            retry_delay: 1000, // 1 second
        }
    }
}

/// Struct representing the Process Manager responsible for managing application instances and lock files.
pub struct ProcessManager {
    sys: System,
    app_name: String,
    db_path: String,
    max_retries: u32,
    retry_delay: u32, // in milliseconds
}

impl ProcessManager {
    /// Creates a new instance of ProcessManager.
    ///
    /// # Arguments
    ///
    /// * `app_name` - The name of the application to monitor.
    /// * `db_path` - The absolute path to the database directory whose lock needs to be managed.
    /// * `options` - Configuration options for retries and delays.
    ///
    /// # Returns
    ///
    /// A new instance of ProcessManager.
    pub fn new(app_name: &str, db_path: &str, options: ProcessManagerOptions) -> Self {
        let mut sys = System::new_all();
        sys.refresh_all(); // Initial refresh to populate process information

        Self {
            sys,
            app_name: app_name.to_string(),
            db_path: db_path.to_string(),
            max_retries: options.max_retries,
            retry_delay: options.retry_delay,
        }
    }

    /// Initializes the ProcessManager by ensuring a single application instance and cleaning up lock files.
    ///
    /// This method attempts to:
    /// 1. Find and terminate any other running instances of the application.
    /// 2. Clean up any existing lock files.
    ///
    /// # Returns
    ///
    /// * `Ok(())` if initialization succeeds.
    /// * `Err(anyhow::Error)` if any step fails.
    pub fn initialize(&mut self) -> Result<()> {
        // Attempt to find and terminate other instances
        self.terminate_other_instances()?;

        Ok(())
    }

    /// Finds and terminates other running instances of the application.
    ///
    /// # Returns
    ///
    /// * `Ok(usize)` indicating the number of instances terminated.
    /// * `Err(anyhow::Error)` if termination fails.
    fn terminate_other_instances(&mut self) -> Result<usize> {
        self.sys.refresh_processes(ProcessesToUpdate::All, true);
        let current_pid = process::id();

        let mut terminated_count = 0;

        for (pid, process) in self.sys.processes() {
            let process_name = process.name().to_string_lossy().to_ascii_lowercase();
            let target_name = self.app_name.to_ascii_lowercase();

            if process_name.contains(&target_name) && pid.as_u32() != current_pid {
                println!(
                    "Terminating other instance: PID {}, Name {:?}",
                    pid.as_u32(),
                    process.name()
                );

                if process.kill() {
                    println!("Successfully terminated PID {}", pid.as_u32());
                    terminated_count += 1;
                } else {
                    println!("Failed to terminate PID {}", pid.as_u32());
                }
            }
        }

        Ok(terminated_count)
    }

    /// Cleans up the database lock file if it exists.
    ///
    /// # Returns
    ///
    /// * `Ok(())` if cleanup succeeds or no lock file exists.
    /// * `Err(anyhow::Error)` if removal fails.
    fn cleanup_db_locks(&self) -> Result<()> {
        let lock_file = Path::new(&self.db_path).join("LOCK");
        println!("Looking for lock file at {:?}", lock_file);

        if lock_file.exists() {
            fs::remove_file(&lock_file)
                .with_context(|| format!("Failed to remove lock file at {:?}", lock_file))?;
            println!("Successfully removed lock file at {:?}", lock_file);
        } else {
            println!("No lock file found at {:?}", lock_file);
        }

        Ok(())
    }
}

/// Struct representing the result of a process cleanup operation.
#[derive(Debug, Serialize)]
pub struct ProcessCleanupResult {
    pub killed_processes: usize,
    pub message: String,
}

/// Initializes the Process Manager by ensuring a single application instance and cleaning up lock files.
///
/// This command should be called once during the application's startup sequence.
///
/// # Arguments
///
/// * `options` - Optional configuration options for retries and delays.
///
/// # Returns
///
/// * `Ok(())` if initialization succeeds.
/// * `Err(String)` if any step fails.
pub async fn initialize_process_manager(
    options: Option<ProcessManagerOptions>,
) -> Result<(), String> {
    // Retrieve the database path from environment variables or use default
    let db_path = std::env::var("DB_PATH").unwrap_or_else(|_| "storage/storage.db".to_string());

    println!("ProcessManager initializing with DB_PATH: {}", db_path);

    // Use provided options or default options
    let options = options.unwrap_or_default();

    // Create a new ProcessManager instance
    let mut manager = ProcessManager::new("mighty", &db_path, options);

    // Initialize the ProcessManager
    manager
        .initialize()
        .map_err(|e| format!("ProcessManager initialization failed: {}", e))?;

    Ok(())
}

/// Finds and terminates other running instances of the application.
///
/// # Returns
///
/// * `Ok(ProcessCleanupResult)` indicating the number of instances terminated and whether locks were cleaned.
/// * `Err(String)` if any step fails.
#[command]
pub async fn kill_other_instances() -> Result<ProcessCleanupResult, String> {
    // Retrieve the database path from environment variables or use default
    let db_path = std::env::var("DB_PATH").unwrap_or_else(|_| "storage/storage.db".to_string());

    // Create a new ProcessManager instance with default options
    let options = ProcessManagerOptions::default();
    let mut manager = ProcessManager::new("mighty", &db_path, options);

    // Attempt to terminate other instances
    let killed_count = manager
        .terminate_other_instances()
        .map_err(|e| format!("Failed to terminate other instances: {}", e))?;

    Ok(ProcessCleanupResult {
        killed_processes: killed_count,
        message: format!("Terminated {} other instance(s)", killed_count),
    })
}

/// Forcefully cleans up database lock files without terminating other instances.
///
/// # Returns
///
/// * `Ok(ProcessCleanupResult)` indicating whether locks were cleaned.
/// * `Err(String)` if cleanup fails.
#[command]
pub async fn force_cleanup_locks() -> Result<ProcessCleanupResult, String> {
    // Retrieve the database path from environment variables or use default
    let db_path = std::env::var("DB_PATH").unwrap_or_else(|_| "storage/storage.db".to_string());

    // Create a new ProcessManager instance with default options
    let options = ProcessManagerOptions::default();
    let manager = ProcessManager::new("mighty", &db_path, options);

    // Attempt to clean up lock files
    match manager.cleanup_db_locks() {
        Ok(_) => Ok(ProcessCleanupResult {
            killed_processes: 0,
            message: "Successfully cleaned up lock files.".to_string(),
        }),
        Err(e) => Err(format!("Failed to clean up lock files: {}", e)),
    }
}

/// Cleans up lock files upon application exit.
///
/// This function should be called during the application's shutdown sequence to ensure that lock files are properly removed.
pub async fn cleanup_process_manager() -> Result<ProcessCleanupResult, String> {
    // Retrieve the database path from environment variables or use default
    let db_path = std::env::var("DB_PATH").unwrap_or_else(|_| "storage/storage.db".to_string());

    // Create a new ProcessManager instance with default options
    let options = ProcessManagerOptions::default();
    let manager = ProcessManager::new("mighty", &db_path, options);

    // Attempt to clean up lock files
    match manager.cleanup_db_locks() {
        Ok(_) => Ok(ProcessCleanupResult {
            killed_processes: 0,
            message: "Successfully cleaned up lock files.".to_string(),
        }),
        Err(e) => Err(format!("Failed to clean up lock files: {}", e)),
    }
}
