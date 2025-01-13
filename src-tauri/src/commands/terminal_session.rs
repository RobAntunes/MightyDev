// src/commands/terminal_session.rs

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use portable_pty::{native_pty_system, CommandBuilder, PtyPair, PtySize};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Session {
    pub id: String,
    pub pid: u32,
}

pub struct TerminalInstance {
    pub pty_pair: PtyPair,
    pub writer: Arc<Mutex<Box<dyn std::io::Write + Send>>>,
}

pub struct SessionManager {
    sessions: HashMap<String, TerminalInstance>,
}

impl SessionManager {
    pub fn new() -> Self {
        SessionManager {
            sessions: HashMap::new(),
        }
    }

    pub fn create_session(&mut self, config: Option<TerminalConfig>) -> Result<Session, String> {
        let pty_system = native_pty_system();
        let session_id = Uuid::new_v4().to_string();

        // Get shell command and arguments
        let (shell, args) = get_default_shell();
        println!("Spawning shell: {} with args: {:?}", shell, args); // Added logging

        let mut cmd = CommandBuilder::new(shell);
        cmd.args(&args);

        // Create PTY pair with non-zero pixel dimensions
        let pair = pty_system
            .openpty(PtySize {
                rows: 24,
                cols: 80,
                pixel_width: 800,  // Updated
                pixel_height: 600, // Updated
            })
            .map_err(|e| {
                println!("Failed to open PTY: {}", e); // Added logging
                e.to_string()
            })?;

        // Spawn process
        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| {
                println!("Failed to spawn command: {}", e); // Added logging
                e.to_string()
            })?;

        let pid = child.process_id().ok_or_else(|| "Failed to retrieve child PID".to_string())?;
        println!("Spawned shell with PID: {}", pid);

        let writer = pair.master.take_writer().map_err(|e| {
            println!("Failed to take writer: {}", e); // Added logging
            e.to_string()
        })?;

        let terminal = TerminalInstance {
            pty_pair: pair,
            writer: Arc::new(Mutex::new(writer)),
        };

        self.sessions.insert(session_id.clone(), terminal);

        Ok(Session {
            id: session_id,
            pid: pid as u32,
        })
    }

    pub fn get_session(&self, id: &str) -> Option<&TerminalInstance> {
        self.sessions.get(id)
    }

    pub fn remove_session(&mut self, id: &str) -> Option<TerminalInstance> {
        self.sessions.remove(id)
    }
}

#[derive(Debug, Serialize, Deserialize)]pub struct TerminalConfig {
    pub shell: Option<String>,
    pub args: Option<Vec<String>>,
    pub env: Option<HashMap<String, String>>,
}

pub fn get_default_shell() -> (String, Vec<String>) {
    #[cfg(target_os = "windows")]
    {
        println!("Using shell: cmd.exe with args: /C cmd.exe");
        (
            "cmd.exe".to_string(),
            vec!["/C".to_string(), "cmd.exe".to_string()],
        )
    }
    #[cfg(not(target_os = "windows"))]
    {
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string());
        println!("Using shell: {} with args: {:?}", shell, vec![shell.clone()]);
        (shell.clone(), vec![shell])
    }
}