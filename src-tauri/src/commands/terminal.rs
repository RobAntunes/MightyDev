use lazy_static::lazy_static;
use nix::{
    pty::{openpty, Winsize},
    libc,
    sys::termios::{self, InputFlags, LocalFlags, OutputFlags, SetArg, Termios},
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::{
    collections::HashMap,
    fs::File,
    io::{Read, Write},
    os::unix::io::{AsRawFd, FromRawFd},
    sync::{Arc, Mutex},
    thread,
};
use tauri::{command, Emitter, Window};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TerminalSession {
    pub id: String,
    pub pid: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TerminalConfig {
    pub shell: Option<String>,
    pub args: Option<Vec<String>>,
    pub env: Option<HashMap<String, String>>,
}

struct TerminalInstance {
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
    running: Arc<Mutex<bool>>,
    raw_fd: i32,
}

lazy_static! {
    static ref TERMINAL_SESSIONS: Arc<Mutex<HashMap<String, TerminalInstance>>> =
        Arc::new(Mutex::new(HashMap::new()));
}

fn configure_terminal(fd: &File) -> nix::Result<()> {
    let mut termios = termios::tcgetattr(fd)?;
    
    // Disable both terminal echo and keyboard echo
    termios.local_flags &= !(LocalFlags::ECHO | LocalFlags::ECHOE | LocalFlags::ECHOK | LocalFlags::ECHONL);
    
    // Set the new attributes
    termios::tcsetattr(fd, SetArg::TCSANOW, &termios)?;
    
    Ok(())
}

#[command]
pub async fn create_terminal_session(
    window: Window,
    config: Option<TerminalConfig>,
) -> Result<TerminalSession, String> {
    // Open a new PTY
    let pty = openpty(
        Some(&Winsize {
            ws_row: 24,
            ws_col: 80,
            ws_xpixel: 0,
            ws_ypixel: 0,
        }),
        None,
    )
    .map_err(|e| e.to_string())?;

    let session_id = Uuid::new_v4().to_string();

    // Convert to File types for easier handling
    let master_file = unsafe { File::from_raw_fd(pty.master.as_raw_fd()) };
    
    // Configure the master side of the PTY
    configure_terminal(&master_file).map_err(|e| e.to_string())?;

    // Get default shell configuration
    let (shell, default_args) = get_default_shell();
    let shell_path = if let Some(cfg) = &config {
        cfg.shell.clone().unwrap_or(shell)
    } else {
        shell
    };

    let args = if let Some(cfg) = &config {
        cfg.args.clone().unwrap_or(default_args)
    } else {
        default_args
    };

    // Set up environment variables if provided
    if let Some(cfg) = &config {
        if let Some(env_vars) = &cfg.env {
            for (key, value) in env_vars {
                std::env::set_var(key, value);
            }
        }
    }

    // Create terminal instance
    let raw_fd = pty.master.as_raw_fd();
    let terminal = TerminalInstance {
        writer: Arc::new(Mutex::new(Box::new(master_file))),
        running: Arc::new(Mutex::new(true)),
        raw_fd,
    };

    // Store the session
    TERMINAL_SESSIONS
        .lock()
        .unwrap()
        .insert(session_id.clone(), terminal);

    // Fork process using libc for better control
    let pid = unsafe { libc::fork() };
    
    match pid {
        -1 => Err("Failed to fork process".to_string()),
        0 => {
            // Child process
            let slave_file = unsafe { File::from_raw_fd(pty.slave.as_raw_fd()) };
            configure_terminal(&slave_file).map_err(|e| e.to_string())?;

            // Set up stdio
            unsafe {
                libc::dup2(pty.slave.as_raw_fd(), libc::STDIN_FILENO);
                libc::dup2(pty.slave.as_raw_fd(), libc::STDOUT_FILENO);
                libc::dup2(pty.slave.as_raw_fd(), libc::STDERR_FILENO);
            }

            // Execute shell
            let error = unsafe {
                let args_cstring: Vec<std::ffi::CString> = std::iter::once(shell_path.clone())
                    .chain(args)
                    .map(|s| std::ffi::CString::new(s).unwrap())
                    .collect();
                let mut args_ptr: Vec<*const libc::c_char> = args_cstring
                    .iter()
                    .map(|s| s.as_ptr())
                    .chain(std::iter::once(std::ptr::null()))
                    .collect();
                
                let path = std::ffi::CString::new(shell_path).unwrap();
                libc::execvp(path.as_ptr(), args_ptr.as_mut_ptr())
            };

            // If we get here, exec failed
            std::process::exit(error);
        }
        n => {
            // Parent process
            let running = Arc::new(Mutex::new(true));
            let running_clone = running.clone();
            let window_clone = window.clone();
            let session_id_clone = session_id.clone();

            // Set up output reader thread
            thread::spawn(move || {
                let mut reader = unsafe { File::from_raw_fd(pty.master.as_raw_fd()) };
                let mut buffer = [0u8; 1024];

                while *running_clone.lock().unwrap() {
                    match reader.read(&mut buffer) {
                        Ok(0) => break,
                        Ok(n) => {
                            let data = String::from_utf8_lossy(&buffer[..n]).to_string();
                            let payload = json!({
                                "session_id": session_id_clone,
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

            Ok(TerminalSession {
                id: session_id,
                pid: n as u32,
            })
        }
    }
}

#[command]
pub async fn write_to_terminal(session_id: String, data: String) -> Result<(), String> {
    let sessions = TERMINAL_SESSIONS.lock().unwrap();
    if let Some(terminal) = sessions.get(&session_id) {
        let mut writer = terminal.writer.lock().unwrap();
        writer.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
        writer.flush().map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("Terminal session not found".to_string())
    }
}

fn get_default_shell() -> (String, Vec<String>) {
    #[cfg(target_os = "windows")]
    {
        ("cmd.exe".to_string(), vec!["/C".to_string()])
    }
    #[cfg(target_os = "macos")]
    {
        let shell = std::env::var("SHELL")
            .or_else(|_| {
                std::fs::read_to_string("/etc/shells").map(|s| {
                    s.lines()
                        .find(|line| line.contains("zsh") || line.contains("bash"))
                        .unwrap_or("/bin/bash")
                        .to_string()
                })
            })
            .unwrap_or_else(|_| "/bin/bash".to_string());
        (shell, vec!["-l".to_string()])
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string());
        (shell, vec!["-l".to_string()])
    }
}

#[command]
pub async fn resize_terminal(session_id: String, cols: u16, rows: u16) -> Result<(), String> {
    let sessions = TERMINAL_SESSIONS.lock().unwrap();
    if let Some(terminal) = sessions.get(&session_id) {
        let size = Winsize {
            ws_row: rows,
            ws_col: cols,
            ws_xpixel: 0,
            ws_ypixel: 0,
        };

        unsafe {
            if libc::ioctl(terminal.raw_fd, libc::TIOCSWINSZ, &size) == -1 {
                return Err("Failed to resize terminal".to_string());
            }
        }
        
        Ok(())
    } else {
        Err("Terminal session not found".to_string())
    }
}

#[command]
pub async fn terminate_terminal_session(session_id: String) -> Result<(), String> {
    let mut sessions = TERMINAL_SESSIONS.lock().unwrap();
    if let Some(terminal) = sessions.remove(&session_id) {
        // Set running flag to false
        if let Ok(mut running) = terminal.running.lock() {
            *running = false;
        }

        Ok(())
    } else {
        Err("Terminal session not found".to_string())
    }
}