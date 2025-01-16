#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands {
    pub mod api;
    pub mod fs;
    pub mod proxy;
    pub mod storage;
    pub mod terminal;
}

use commands::{api, fs, proxy, storage, terminal};
use dotenvy::dotenv;
use std::env;
use std::path::PathBuf;
use tauri::Manager;

fn main() {
    // Load environment variables from the `.env` file (if present)
    dotenv().ok();

    // Initialize the logger (optional but recommended for debugging)
    env_logger::init();

    // **Security Check:** Ensure that the `ANTHROPIC_API_KEY` is set.
    if env::var("ANTHROPIC_API_KEY").is_err() {
        eprintln!("Error: ANTHROPIC_API_KEY must be set in the environment.");
        std::process::exit(1);
    }

    // Get app directory for storage
    let app_dir = match env::current_exe() {
        Ok(exe_path) => exe_path
            .parent()
            .map(|p| p.join("storage"))
            .unwrap_or(PathBuf::from("storage")),
        Err(_) => PathBuf::from("storage"),
    };

    // Ensure the app directory exists
    std::fs::create_dir_all(&app_dir).expect("Failed to create storage directory");

    let db_path = app_dir.join("storage.db");

    // Initialize RocksDB
    storage::initialize_db(&db_path).expect("Failed to initialize RocksDB");

    // Initialize and run the Tauri application
    tauri::Builder::default()
        // Register necessary plugins
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_dialog::init())
        // Register command handlers
        .invoke_handler(tauri::generate_handler![
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
            // Proxy commands
            proxy::proxy_request,
            // AI commands
            api::anthropic_completion
        ])
        // Setup window event handlers
        .setup(|app| {
            let main_window = app.get_webview_window("main").unwrap();

            // Handle window close event
            main_window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    storage::cleanup();
                    api.prevent_close();
                    std::process::exit(0);
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
