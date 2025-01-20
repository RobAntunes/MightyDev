use crate::bindings::python_runtime::run_python;
use pyo3::types::PyAnyMethods;
use tauri::command;

#[command]
pub fn embed_sentence(text: String) -> Result<Vec<f32>, String> {
    run_python(|py| {
        let embed_module = py.import("bge_embed")?;
        let embed_text_func = embed_module.getattr("embed_text")?;
        let embeddings_any = embed_text_func.call1((text,))?;
        embeddings_any.extract::<Vec<f32>>()
    })
}