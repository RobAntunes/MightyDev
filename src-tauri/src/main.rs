#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands {
    pub mod fs;
    pub mod terminal;
}

use commands::{fs, terminal};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_os::init())
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
            terminal::terminate_terminal_session
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}