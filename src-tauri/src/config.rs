// src/config.rs
use serde::{Deserialize, Serialize};
use std::env;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BedrockConfig {
    pub endpoint_url: String,
    pub region: String,
    pub knowledge_base_id: String,
    pub knowledge_base_connection: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnthropicConfig {
    pub api_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GreptileConfig {
    pub api_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub anthropic: Option<AnthropicConfig>,
    pub greptile: Option<GreptileConfig>,
}

impl AppConfig {
    pub fn load() -> Result<Self, Box<dyn std::error::Error>> {
        // Handle Anthropic config
        let anthropic_config = env::var("ANTHROPIC_API_KEY")
            .ok()
            .map(|api_key| AnthropicConfig { api_key });

        // Handle Greptile config
        let greptile_config = env::var("GREPTILE_API_KEY")
            .ok()
            .map(|api_key| GreptileConfig { api_key });

        // Handle Bedrock config

        Ok(AppConfig {
            anthropic: anthropic_config,
            greptile: greptile_config,
        })
    }
}
