use serde::{Deserialize, Serialize};
use tauri::{command, State};
use log::{error, info};
use crate::config::AppConfig;

#[derive(Debug, Serialize, Deserialize)]
pub struct AnthropicRequest {
    pub model: String,
    pub max_tokens: i32,
    pub messages: Vec<AnthropicMessage>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AnthropicMessage {
    pub role: String,
    pub content: String,
}

#[command]
pub async fn anthropic_completion(
    request: AnthropicRequest,
    config: State<'_, AppConfig>
) -> Result<String, String> {
    info!("=== Starting Anthropic completion ===");
    info!("Incoming request: {}", serde_json::to_string_pretty(&request).unwrap_or_else(|_| "Failed to serialize request".to_string()));
    info!("Model: {}", request.model);
    info!("Messages count: {}", request.messages.len());
    
    for (i, msg) in request.messages.iter().enumerate() {
        info!("Message {}: role='{}', content='{}'", i, msg.role, msg.content);
    }

    // Properly handle the Option<AnthropicConfig>
    let api_key = config.anthropic.as_ref()
        .ok_or_else(|| "Anthropic config missing in AppConfig".to_string())?
        .api_key.as_str();

    let client = reqwest::Client::new();
    
    // Construct the Anthropic API request
    let anthropic_request = serde_json::json!({
        "model": request.model,
        "max_tokens": request.max_tokens,
        "messages": request.messages,
    });
    
    info!("Prepared Anthropic API request: {}", 
        serde_json::to_string_pretty(&anthropic_request)
            .unwrap_or_else(|_| "Failed to serialize API request".to_string()));
    
    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&anthropic_request)
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
        error!("API request failed!");
        error!("Status code: {}", status);
        error!("Response body: {}", response_text);
        error!("Request body: {}", serde_json::to_string_pretty(&anthropic_request).unwrap());
        return Err(format!(
            "API request failed with status {}: {}",
            status,
            response_text
        ));
    }

    info!("Received response from Anthropic API: {}", response_text);

    let response_json: serde_json::Value = serde_json::from_str(&response_text).map_err(|e| {
        error!("Failed to parse response JSON: {}", e);
        e.to_string()
    })?;

    // Extract the content from the response
    let content = response_json["content"]
        .as_array()
        .and_then(|arr| arr.first())
        .and_then(|content| content["text"].as_str())
        .ok_or_else(|| {
            let error = "Invalid response format from Anthropic API";
            error!("{}", error);
            error.to_string()
        })?;

    info!("Successfully processed Anthropic completion");
    Ok(content.to_string())
}