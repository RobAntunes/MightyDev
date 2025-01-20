use serde::{Deserialize, Serialize};
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use tauri::command;

#[derive(Debug, Serialize, Deserialize)]
pub struct GreptileConfig {
    api_key: String,
    base_url: Option<String>,
    max_results: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchOptions {
    case_sensitive: Option<bool>,
    use_regex: Option<bool>,
    include_tests: Option<bool>,
    max_results: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchRequest {
    query: String,
    options: Option<SearchOptions>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchResult {
    file: String,
    line_number: u32,
    matched_text: String,
    score: f64,
    context: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchResponse {
    results: Vec<SearchResult>,
    metadata: SearchMetadata,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchMetadata {
    total_results: usize,
    execution_time: u64,
    query: String,
}

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    code: String,
    message: String,
    details: Option<String>,
}

#[command]
pub async fn greptile_search(
    config: GreptileConfig,
    request: SearchRequest,
) -> Result<SearchResponse, ErrorResponse> {
    let client = reqwest::Client::new();
    let base_url = config.base_url.unwrap_or_else(|| "https://api.greptile.com".to_string());
    
    // Set up headers
    let mut headers = HeaderMap::new();
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    headers.insert(
        AUTHORIZATION,
        HeaderValue::from_str(&format!("Bearer {}", config.api_key))
            .map_err(|e| ErrorResponse {
                code: "INVALID_API_KEY".to_string(),
                message: "Invalid API key format".to_string(),
                details: Some(e.to_string()),
            })?
    );

    // Prepare request body
    let body = serde_json::json!({
        "query": request.query,
        "maxResults": request.options.as_ref()
            .and_then(|opt| opt.max_results)
            .or(config.max_results),
        "options": {
            "caseSensitive": request.options.as_ref().and_then(|opt| opt.case_sensitive),
            "useRegex": request.options.as_ref().and_then(|opt| opt.use_regex),
            "includeTests": request.options.as_ref().and_then(|opt| opt.include_tests),
        }
    });

    // Make the request
    let start_time = std::time::Instant::now();
    let response = client
        .post(format!("{}/search", base_url))
        .headers(headers)
        .json(&body)
        .send()
        .await
        .map_err(|e| ErrorResponse {
            code: "REQUEST_FAILED".to_string(),
            message: "Failed to send request to Greptile API".to_string(),
            details: Some(e.to_string()),
        })?;

    if !response.status().is_success() {
        return Err(ErrorResponse {
            code: "API_ERROR".to_string(),
            message: format!("Greptile API error: {}", response.status()),
            details: Some(response.text().await.unwrap_or_default()),
        });
    }

    let results: Vec<SearchResult> = response.json().await.map_err(|e| ErrorResponse {
        code: "PARSE_ERROR".to_string(),
        message: "Failed to parse API response".to_string(),
        details: Some(e.to_string()),
    })?;

    Ok(SearchResponse {
        results: results.clone(),
        metadata: SearchMetadata {
            total_results: results.len(),
            execution_time: start_time.elapsed().as_millis() as u64,
            query: request.query,
        },
    })
}

// Test connection to Greptile API
#[command]
pub async fn test_greptile_connection(config: GreptileConfig) -> Result<bool, ErrorResponse> {
    let client = reqwest::Client::new();
    let base_url = config.base_url.unwrap_or_else(|| "https://api.greptile.com".to_string());

    let response = client
        .get(format!("{}/ping", base_url))
        .header(
            AUTHORIZATION,
            format!("Bearer {}", config.api_key)
        )
        .send()
        .await
        .map_err(|e| ErrorResponse {
            code: "CONNECTION_ERROR".to_string(),
            message: "Failed to connect to Greptile API".to_string(),
            details: Some(e.to_string()),
        })?;

    Ok(response.status().is_success())
}