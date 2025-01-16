use reqwest::{Client, header};
use serde::{Deserialize, Serialize};
use tauri::command;
use std::time::Duration;

#[derive(Debug, Serialize, Deserialize)]
pub struct ProxyRequest {
    url: String,
    api_key: String,
    method: String,
    body: serde_json::Value,
    metadata: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProxyResponse {
    message: Message,
    usage: Usage,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Message {
    id: String,
    role: String,
    content: Vec<Content>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Content {
    #[serde(rename = "type")]
    content_type: String,
    content: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Usage {
    prompt_tokens: u32,
    completion_tokens: u32,
    total_tokens: u32,
}

#[command]
pub async fn proxy_request(request: ProxyRequest) -> Result<ProxyResponse, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;

    let mut headers = header::HeaderMap::new();
    headers.insert(
        "Content-Type",
        header::HeaderValue::from_static("application/json"),
    );
    headers.insert(
        "x-api-key",
        header::HeaderValue::from_str(&request.api_key)
            .map_err(|e| e.to_string())?
    );
    headers.insert(
        "anthropic-version",
        header::HeaderValue::from_static("2023-06-01"),
    );

    let response = client
        .request(
            reqwest::Method::from_bytes(request.method.as_bytes())
                .map_err(|e| e.to_string())?,
            &request.url,
        )
        .headers(headers)
        .json(&request.body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!(
            "API request failed: {} - {}",
            response.status(),
            response.text().await.unwrap_or_default()
        ));
    }

    let proxy_response = response
        .json::<ProxyResponse>()
        .await
        .map_err(|e| e.to_string())?;

    Ok(proxy_response)
}