#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands {
    pub mod api;
    pub mod auth;
    pub mod fs;
    pub mod greptile;
    pub mod process_manager;
    pub mod storage;
    pub mod terminal;
}

mod bindings {
    pub mod embed;
    pub mod python_runtime;
}

mod config;
mod context {
    pub mod context;
    pub mod context_manager;
}

use std::fs::create_dir_all;
use auth::AppState;
use bindings::{embed, python_runtime};
use commands::*;
use config::AppConfig;
use log::info;
use std::{env, path::PathBuf, sync::Arc};
use tauri::{Listener, Manager};
use tokio::{self, sync::Mutex};

async fn initialize_systems(shared_config: Arc<Mutex<AppConfig>>) -> Result<(), Box<dyn std::error::Error>> {
    // Initialize Python runtime
    python_runtime::initialize_python_runtime().await?;

    // Setup storage paths
    let app_dir = std::env::current_exe()?
        .parent()
        .map(|p| p.join("storage"))
        .unwrap_or(PathBuf::from("storage"));

    info!("Initializing Storage Directory at: {}", app_dir.display());

    create_dir_all(&app_dir)?;
    let db_path = app_dir.join("storage.db");

    info!("Database Path: {}", db_path.display());

    // Set DB_PATH environment variable to ensure consistency
    env::set_var("DB_PATH", db_path.to_str().unwrap());
    info!("Set DB_PATH to: {}", env::var("DB_PATH").unwrap());

    // Initialize storage system **before** ProcessManager
    commands::storage::initialize_storage(&db_path).await?;

    // Force cleanup any stale locks first
    if let Err(e) = commands::process_manager::force_cleanup_locks().await {
        eprintln!("Warning: Failed to cleanup stale locks: {}", e);
    }

    // Initialize Process Manager with default options
    let process_manager_options = None; // Will use default options
    commands::process_manager::initialize_process_manager(process_manager_options).await?;

    // Initialize filesystem service
    commands::fs::initialize_fs()?;

    Ok(())
}

/// Cleans up resources when the application exits.
fn cleanup_on_exit() {
    tauri::async_runtime::spawn(async {
        if let Err(e) = commands::process_manager::force_cleanup_locks().await {
            eprintln!("Failed to cleanup locks: {}", e);
        }

        if let Err(e) = commands::storage::cleanup_storage().await {
            eprintln!("Failed to cleanup storage: {}", e);
        }

        if let Err(e) = commands::process_manager::cleanup_process_manager().await {
            eprintln!("Failed to cleanup process manager: {}", e);
        }
    });
}

fn main() {
    // Initialize logging
    env_logger::init();

    // Load configuration
    let config = match AppConfig::load() {
        Ok(cfg) => cfg,
        Err(e) => {
            eprintln!("Failed to load configuration: {}", e);
            std::process::exit(1);
        }
    };

    info!("Configuration loaded successfully.");

    // Wrap config in Arc<Mutex<_>> for async access
    let shared_config = Arc::new(Mutex::new(config));

    // Initialize and run the Tauri application
    tauri::Builder::default()
        // Register necessary plugins
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_dialog::init())
        // Manage other app states
        .manage(AppState::new())
        // Manage shared_config
        .manage(shared_config.clone())
        // Register command handlers
        .invoke_handler(tauri::generate_handler![
            // Auth commands
            auth::get_auth_token,
            auth::store_auth_token,
            auth::has_auth_token,
            // Storage commands
            storage::store_value,
            storage::get_value,
            storage::delete_value,
            storage::scan_prefix,
            // File system commands
            fs::read_directory,
            fs::read_file,
            fs::write_file,
            fs::create_directory,
            fs::delete_path,
            fs::rename_path,
            // Terminal commands
            terminal::create_terminal_session,
            terminal::write_to_terminal,
            terminal::resize_terminal,
            terminal::terminate_terminal_session,
            // AI commands
            api::anthropic_completion,
            // Context commands
            context::context::init_context_manager,
            context::context::get_context,
            context::context::generate_embeddings,
            context::context::read_context_file,
            context::context::add_to_context,
            context::context::search_similar_code,
            context::context::get_file_context,
            context::context::is_file_in_context,
            context::context::get_context_stats,
            // Process Manager commands
            process_manager::kill_other_instances,
            process_manager::force_cleanup_locks,
            // Embedding commands
            embed::embed_sentence,
            // Greptile commands
            greptile::greptile_search,
            greptile::test_greptile_connection,
            // Storage cleanup
            storage::cleanup_storage,
        ])
        // Setup window event handlers
        .setup(move |app| {
            let app_handle = app.handle();
            app_handle.listen("tauri://close-requested", move |_| {
                cleanup_on_exit();
            });

            let main_window = app.get_webview_window("main").unwrap();

            // Handle window close event with proper cleanup
            main_window.on_window_event(move |event| {
                let event = event.clone();
                tauri::async_runtime::spawn(async move {
                    if let tauri::WindowEvent::CloseRequested { .. } = event {
                        // Cleanup all systems
                        if let Err(e) = bindings::python_runtime::cleanup_all_systems().await {
                            eprintln!("Error during cleanup: {}", e);
                        }

                        // Additional cleanup if necessary
                        cleanup_on_exit();
                    }
                });
            });

            // Initialize systems asynchronously
            tauri::async_runtime::spawn(async move {
                if let Err(e) = initialize_systems(shared_config.clone()).await {
                    eprintln!("Failed to initialize systems: {}", e);
                    // Optionally, you can terminate the application or notify the user
                    // For example, you might want to exit the process:
                    std::process::exit(1);
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}