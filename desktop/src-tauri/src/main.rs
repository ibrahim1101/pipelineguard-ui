#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use serde_json::Value;
use std::time::Duration;
use tauri::State;

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
    let token = std::env::var("CERBERUS_DEV_BRIDGE_TOKEN").ok()
        .filter(|s| !s.is_empty());
    let port = std::env::var("CERBERUS_DEV_BRIDGE_PORT").ok()
        .and_then(|s| s.parse::<u16>().ok())
        .filter(|p| *p != 0)
        .unwrap_or(8000);
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(45))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .expect("failed to initialize loopback HTTP client");
    tauri::Builder::default()
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
