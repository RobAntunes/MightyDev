// src/plugins/cors.rs

use tauri::{
    plugin::{Builder, TauriPlugin},
    Manager, Runtime,
};
use tauri::http::{Request, Response};

#[derive(Default)]
pub struct CorsHandler;

impl CorsHandler {
    fn handle_request(&self, request: Request<Vec<u8>>) -> Response<Vec<u8>> {
        if request.method() == "OPTIONS" {
            Response::builder()
                .status(204)
                .header("Access-Control-Allow-Origin", "*")
                .header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
                .header(
                    "Access-Control-Allow-Headers",
                    "Origin, X-Requested-With, Content-Type, Accept, Authorization, x-api-key, anthropic-version",
                )
                .header("Access-Control-Max-Age", "3600")
                .body(Vec::new())
                .unwrap_or_else(|_| {
                    Response::builder()
                        .status(500)
                        .body(Vec::new())
                        .expect("Failed to build 500 response")
                })
        } else {
            // For non-OPTIONS requests, you might want to forward them or handle accordingly
            // Ensure that these do not interfere with backend commands
            Response::builder()
                .status(200)
                .header("Access-Control-Allow-Origin", "*")
                .body(request.body().clone())
                .unwrap_or_else(|_| {
                    Response::builder()
                        .status(500)
                        .body(Vec::new())
                        .expect("Failed to build 500 response")
                })
        }
    }
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("cors")
        .setup(|app_handle, _plugin| {
            app_handle.manage(CorsHandler::default());
            Ok(())
        })
        .register_uri_scheme_protocol("mycors", move |app, request| {
            let cors_handler = app.app_handle().state::<CorsHandler>();
            cors_handler.handle_request(request)
        })
        .build()
}