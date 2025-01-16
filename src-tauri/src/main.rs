#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Import modules containing your Tauri commands
mod commands {
    pub mod api;
    pub mod fs;
    pub mod proxy;
    pub mod terminal;
}

use commands::{api, fs, proxy, terminal};
use dotenvy::dotenv;
use std::env;

/// The main entry point of the Tauri application.
fn main() {
    // Load environment variables from the `.env` file (if present)
    dotenv().ok();

    // Initialize the logger (optional but recommended for debugging)
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
    .format(|buf, record| {
        use std::io::Write;
        writeln!(
            buf,
            "[{}] {}: {}",
            record.level(),
            record.target(),
            record.args()
        )
    })
    .init();

    // **Security Check:** Ensure that the `ANTHROPIC_API_KEY` is set.
    // This prevents the application from running without the necessary API credentials.
    if env::var("ANTHROPIC_API_KEY").is_err() {
        eprintln!("Error: ANTHROPIC_API_KEY must be set in the environment.");
        std::process::exit(1);
    }

    // Initialize and run the Tauri application
    tauri::Builder::default()
        // Register necessary plugins
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_dialog::init())
        // **Note:** The custom CORS plugin has been removed to simplify architecture
        // and avoid runtime panics related to CORS issues.
        // .plugin(cors::init()) // Removed as per previous instructions

        // Register Tauri commands that can be invoked from the frontend
        .invoke_handler(tauri::generate_handler![
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
        // Generate the Tauri context from `tauri.conf.json` or other configuration files
        .run(tauri::generate_context!())
        // Handle any errors that occur during the application run
        .expect("error while running tauri application");
}