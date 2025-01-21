// src-tauri/src/config.rs

use serde::Deserialize;
use std::fs;
use std::path::Path;

/// Configuration specific to Bedrock.
#[derive(Debug, Clone, Deserialize)]
pub struct BedrockConfig {
    pub endpoint_url: String,
    pub region: String,
    pub knowledge_base_id: String,
    pub knowledge_base_connection: String,
}

/// Configuration specific to Anthropic API.
#[derive(Debug, Clone, Deserialize)]
pub struct AnthropicConfig {
    pub api_key: String,
}

/// Configuration specific to Greptile API.
#[derive(Debug, Clone, Deserialize)]
pub struct GreptileConfig {
    pub api_key: String,
}

/// Main application configuration.
#[derive(Debug, Clone, Deserialize)]
pub struct AppConfig {
    pub anthropic: Option<AnthropicConfig>,
    pub greptile: Option<GreptileConfig>,
}

impl AppConfig {
    /// Loads configuration from `config.toml`.
    pub fn load() -> Result<Self, Box<dyn std::error::Error>> {
        // Define the path to config.toml
        let config_path = Path::new("config.toml");
        
        // Check if config.toml exists
        if !config_path.exists() {
            return Err(format!(
                "Configuration file not found at path: {}",
                config_path.display()
            ).into());
        }
        
        // Read the contents of config.toml
        let config_content = fs::read_to_string(config_path)?;
        
        // Parse the TOML content into AppConfig
        let config: AppConfig = toml::from_str(&config_content)?;
        
        Ok(config)
    }
}