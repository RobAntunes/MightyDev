use std::sync::Mutex;
use tauri::State;

// Define our AppState to hold the authentication token
pub struct AppState {
    auth_token: Mutex<Option<String>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            auth_token: Mutex::new(None),
        }
    }

    pub fn store_token(&self, token: String) {
        let mut token_guard = self.auth_token.lock().unwrap();
        *token_guard = Some(token);
    }

    pub fn get_token(&self) -> Option<String> {
        let token_guard = self.auth_token.lock().unwrap();
        token_guard.clone()
    }
}

// Command to store the auth token
#[tauri::command]
pub async fn store_auth_token(
    token: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.store_token(token);
    Ok(())
}

// Command to check if we have an auth token
#[tauri::command]
pub async fn has_auth_token(state: State<'_, AppState>) -> Result<bool, String> {
    Ok(state.get_token().is_some())
}

// Command to get the current auth token
#[tauri::command]
pub async fn get_auth_token(state: State<'_, AppState>) -> Result<Option<String>, String> {
    Ok(state.get_token())
}

// Helper function to get a token for other commands
pub fn get_token_from_state(state: &State<AppState>) -> Option<String> {
    state.get_token()
}