// src-tauri/src/commands/api.rs

use serde::{Deserialize, Serialize};
use tauri::State;
use tokio::sync::Mutex;
use std::sync::Arc;
use crate::config::AppConfig;
use log::{error, info};
use reqwest;

#[derive(Debug, Serialize, Deserialize)]
pub struct AnthropicRequest {
    pub id: String,
    pub model: String,
    pub max_tokens: i32,
    pub messages: Vec<AnthropicMessage>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AnthropicMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct AnthropicContent {
    text: String,
    #[serde(rename = "type")]
    content_type: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct AnthropicResponse {
    content: Vec<AnthropicContent>,
    id: String,
    model: String,
    role: String,
    #[serde(rename = "type")]
    response_type: String,
    usage: Option<AnthropicUsage>,
}

#[derive(Debug, Serialize, Deserialize)]
struct AnthropicUsage {
    input_tokens: u32,
    output_tokens: u32,
}

#[derive(Debug, Serialize, Deserialize)]
struct ApiResponse {
    id: String,
    text: String,
    model: String,
    usage: Option<AnthropicUsage>,
}

#[tauri::command]
pub async fn anthropic_completion(
    request: AnthropicRequest,
    config: State<'_, Arc<Mutex<AppConfig>>>,
) -> Result<String, String> {
    info!("=== Starting Anthropic completion ===");
    info!("Incoming request ID: {}", request.id);
    
    let config_guard = config.lock().await;
    let api_key = match &config_guard.anthropic {
        Some(anthropic) => anthropic.api_key.as_str(),
        None => {
            error!("Anthropic config missing in AppConfig");
            return Err("Anthropic API key not configured.".to_string());
        }
    };

    let client = reqwest::Client::new();

    let anthropic_api_request = serde_json::json!({
        "model": request.model,
        "max_tokens": request.max_tokens,
        "messages": request.messages,
    });

    info!("Sending request to Anthropic API");
    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("Content-Type", "application/json")
        .header("anthropic-version", "2023-06-01")
        .json(&anthropic_api_request)
        .send()
        .await
        .map_err(|e| {
            error!("API request failed: {}", e);
            e.to_string()
        })?;

    let status = response.status();
    let response_text = response.text().await.map_err(|e| {
        error!("Failed to get response text: {}", e);
        e.to_string()
    })?;

    if !status.is_success() {
        error!("API request failed with status {}: {}", status, response_text);
        return Err(format!(
            "API request failed with status {}: {}",
            status,
            response_text
        ));
    }

    info!("Received response from Anthropic API");
    let anthropic_response: AnthropicResponse = serde_json::from_str(&response_text)
        .map_err(|e| {
            error!("Failed to parse response JSON: {}", e);
            e.to_string()
        })?;

    // Transform the response to match our expected format
    let api_response = ApiResponse {
        id: request.id,
        text: anthropic_response.content
            .first()
            .map(|c| c.text.clone())
            .unwrap_or_default(),
        model: anthropic_response.model,
        usage: anthropic_response.usage,
    };

    let response_json = serde_json::to_string(&api_response).map_err(|e| {
        error!("Failed to serialize response: {}", e);
        e.to_string()
    })?;

    info!("Successfully processed Anthropic completion");
    Ok(response_json)
}