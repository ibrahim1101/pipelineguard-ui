#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use rand::RngCore;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::net::TcpListener;
use std::path::PathBuf;
use serde::Serialize;
use serde_json::Value;
use std::time::Duration;
use tauri::State;

struct ManagedChild(Mutex<Option<Child>>);

impl Drop for ManagedChild {
    fn drop(&mut self) {
        if let Ok(mut guard) = self.0.lock() {
            if let Some(mut child) = guard.take() {
                let _ = child.kill();
                let _ = child.wait();
            }
        }
    }
}

fn spawn_development_bridge() -> Result<(Child, String, u16), String> {
    // Explicit opt-in prevents accidentally starting a Python process in
    // release builds. The future installer will use a packaged sidecar.
    if std::env::var("CERBERUS_MANAGED_DEV").as_deref() != Ok("1") {
        return Err("Managed development bridge not enabled".into());
    }
    let backend = PathBuf::from(std::env::var_os("CERBERUS_BACKEND_DIR")
        .ok_or("CERBERUS_BACKEND_DIR is required")?);
    let engine = PathBuf::from(std::env::var_os("PIPELINEGUARD_ENGINE_PATH")
        .ok_or("PIPELINEGUARD_ENGINE_PATH is required")?);
    if !backend.join("launch_local.py").is_file() || !engine.is_dir() {
        return Err("Invalid backend or engine directory".into());
    }
    // Bind to an OS-assigned loopback port. The listener is released before
    // child bind: readiness must be authenticated to detect a port race.
    let listener = TcpListener::bind("127.0.0.1:0")
        .map_err(|_| "Unable to reserve local port")?;
    let port = listener.local_addr().map_err(|_| "Invalid local port")?.port();
    let mut secret = [0u8; 32];
    rand::rngs::OsRng.fill_bytes(&mut secret);
    let token: String = secret.iter().map(|b| format!("{b:02x}")).collect();
    let python = std::env::var_os("CERBERUS_PYTHON")
        .unwrap_or_else(|| "python".into());
    let child = Command::new(python)
        .arg("-m").arg("uvicorn")
        .arg("server:app")
        .arg("--host").arg("127.0.0.1")
        .arg("--port").arg(port.to_string())
        .current_dir(backend)
        .env("PIPELINEGUARD_ENGINE_PATH", engine)
        .env("PIPELINEGUARD_DESKTOP_MODE", "1")
        .env("PIPELINEGUARD_TOKEN", &token)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn().map_err(|_| "Unable to start Python bridge")?;
    drop(listener);
    Ok((child, token, port))
}

struct BridgeState {
    client: reqwest::Client,
    token: Option<String>,
    port: u16,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BridgeResponse {
    status: u16,
    status_text: String,
    body: Value,
}

fn allowed_request(method: &str, path: &str) -> bool {
    matches!(method, "GET" | "POST" | "PUT" | "DELETE")
        && path.starts_with('/')
        && !path.starts_with("//")
        && !path.contains("://")
        && !path.contains('#')
        && !path.contains('\\')
        && !path.chars().any(char::is_control)
        && !path.split('?').next().unwrap_or("").split('/').any(|part| part == ".." || part == ".")
}

#[tauri::command]
async fn bridge_request(
    method: String,
    path: String,
    body: Option<Value>,
    state: State<'_, BridgeState>,
) -> Result<BridgeResponse, String> {
    if !allowed_request(&method, &path) {
        return Err("Invalid desktop bridge request".into());
    }
    // Until the managed sidecar exists, an explicitly configured development
    // token is required. Never return it to the renderer or logs.
    let token = state.token.as_deref().ok_or("Desktop bridge is not initialized")?;
    let url = format!("http://127.0.0.1:{}/api{}", state.port, path);
    let method = reqwest::Method::from_bytes(method.as_bytes())
        .map_err(|_| "Invalid HTTP method")?;
    let mut request = state.client.request(method, url)
        .header("X-PipelineGuard-Token", token);
    if let Some(payload) = body {
        request = request.json(&payload);
    }
    let response = request.send().await.map_err(|_| "Local bridge unavailable")?;
    let status = response.status();
    let payload = response.json::<Value>().await
        .map_err(|_| "Invalid bridge response")?;
    Ok(BridgeResponse {
        status: status.as_u16(),
        status_text: status.canonical_reason().unwrap_or("").into(),
        body: payload,
    })
}

fn main() {
    // This is a development-only bridge configuration; a future native
    // process manager must generate and own the token and child lifecycle.
    let managed = spawn_development_bridge().ok();
    let token = managed.as_ref().map(|(_, token, _)| token.clone())
        .or_else(|| std::env::var("CERBERUS_DEV_BRIDGE_TOKEN").ok().filter(|s| !s.is_empty()));
    let fallback_port = std::env::var("CERBERUS_DEV_BRIDGE_PORT").ok()
        .and_then(|s| s.parse::<u16>().ok())
        .filter(|p| *p != 0)
        .unwrap_or(8000);
    let port = managed.as_ref().map(|(_, _, port)| *port).unwrap_or(fallback_port);
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(45))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .expect("failed to initialize loopback HTTP client");
    let managed_child = ManagedChild(Mutex::new(managed.map(|(child, _, _)| child)));
    tauri::Builder::default()
        .manage(managed_child)
        .manage(BridgeState { client, token, port })
        .invoke_handler(tauri::generate_handler![bridge_request])
        .run(tauri::generate_context!())
        .expect("failed to launch Cerberus desktop");
}

#[cfg(test)]
mod tests {
    use super::allowed_request;

    #[test]
    fn allows_known_http_methods_and_local_api_paths() {
        assert!(allowed_request("GET", "/status"));
        assert!(allowed_request("POST", "/scan"));
        assert!(allowed_request("GET", "/reports/content?path=%2Ftmp%2Freport.json"));
    }

    #[test]
    fn rejects_unsafe_paths_and_methods() {
        for path in ["//evil.example", "/../admin", "/a/./b", "/a\\b", "/a#fragment", "/http://evil"] {
            assert!(!allowed_request("GET", path), "{path}");
        }
        assert!(!allowed_request("PATCH", "/settings"));
    }
}
