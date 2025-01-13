// src/main.rs

mod commands {
    pub mod fs;
    pub mod terminal;
    pub mod terminal_session;
}

use commands::{fs, terminal, terminal_session};
use std::sync::{Arc, Mutex};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn main() {
    let session_manager = Arc::new(Mutex::new(
        terminal_session::SessionManager::new()
    ));

    tauri::Builder::default()
        .manage(session_manager)
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