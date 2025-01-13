// src/commands/terminal.rs

use crate::terminal_session::TerminalInstance;
use portable_pty::native_pty_system;
use portable_pty::CommandBuilder;
use portable_pty::PtySize;
use serde_json::json;
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::Manager;
use tauri::{command, Emitter, Window};
use uuid::Uuid;
type SharedSessionManager = Arc<Mutex<SessionManager>>;
use super::terminal_session::{get_default_shell, Session, SessionManager, TerminalConfig};

#[command]
pub async fn create_terminal_session(
    window: Window,
    state: tauri::State<'_, SharedSessionManager>,
    config: Option<TerminalConfig>,
) -> Result<Session, String> {
    let mut manager = state.lock().unwrap();
    let session = manager.create_session(config)?;

    // Set up output handling
    if let Some(terminal) = manager.get_session(&session.id) {
        let mut reader = terminal
            .pty_pair
            .master
            .try_clone_reader()
            .map_err(|e| e.to_string())?;
        let session_id = session.id.clone();
        let window_clone = window.clone();

        thread::spawn(move || {
            let mut buffer = [0u8; 1024];
            loop {
                match reader.read(&mut buffer) {
                    Ok(0) => break, // EOF
                    Ok(n) => {
                        let data = String::from_utf8_lossy(&buffer[..n]).to_string();
                        let payload = json!({
                            "session_id": session_id,
                            "data": data
                        });

                        if let Err(e) = window_clone.emit("terminal-output", payload) {
                            eprintln!("Failed to emit terminal output: {}", e);
                            break;
                        }
                    }
                    Err(_) => break,
                }
            }
        });
    }

    Ok(session)
}

#[command]
pub async fn write_to_terminal(
    state: tauri::State<'_, SharedSessionManager>,
    session_id: String,
    data: String,
) -> Result<(), String> {
    let manager = state.lock().unwrap();
    if let Some(terminal) = manager.get_session(&session_id) {
        let mut writer = terminal.writer.lock().unwrap();
        writer
            .write_all(data.as_bytes())
            .map_err(|e| e.to_string())?;
        writer.flush().map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("Terminal session not found".to_string())
    }
}

#[command]
pub async fn resize_terminal(
    state: tauri::State<'_, SharedSessionManager>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let manager = state.lock().unwrap();
    if let Some(terminal) = manager.get_session(&session_id) {
        terminal
            .pty_pair
            .master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("Terminal session not found".to_string())
    }
}

#[command]
pub async fn terminate_terminal_session(
    state: tauri::State<'_, SharedSessionManager>,
    session_id: String,
) -> Result<(), String> {
    let mut manager = state.lock().unwrap();
    if manager.remove_session(&session_id).is_some() {
        Ok(())
    } else {
        Err("Terminal session not found".to_string())
    }
}
