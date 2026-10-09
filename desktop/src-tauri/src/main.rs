#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use rand::RngCore;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::net::{TcpListener, TcpStream, SocketAddr};
use std::io::{Read, Write};
use std::thread;
use std::time::Instant;
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
        .env("CERBERUS_MANAGED_CHILD", "1")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn().map_err(|_| "Unable to start Python bridge")?;
    drop(listener);
    Ok((child, token, port))
}

// The packaged bridge lives next to the desktop executable under
// cerberus-runtime/; never search PATH for an untrusted sidecar.
fn packaged_sidecar_paths(executable: &std::path::Path) -> Result<(PathBuf, PathBuf), String> {
    let parent = executable.parent().ok_or("Missing desktop executable directory")?;
    let runtime = parent.join("cerberus-runtime");
    let sidecar = runtime.join("cerberus-bridge.exe");
    let engine = runtime.join("engine");
    if !sidecar.is_file() || !engine.join("pipelineguard").is_dir() {
        return Err("Packaged Cerberus runtime is missing".into());
    }
    Ok((sidecar, engine))
}

fn spawn_packaged_bridge() -> Result<(Child, String, u16), String> {
    let executable = std::env::current_exe().map_err(|_| "Unable to locate desktop executable")?;
    let (sidecar, engine) = packaged_sidecar_paths(&executable)?;
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|_| "Unable to reserve local port")?;
    let port = listener.local_addr().map_err(|_| "Invalid local port")?.port();
    let mut secret = [0u8; 32];
    rand::rngs::OsRng.fill_bytes(&mut secret);
    let token: String = secret.iter().map(|b| format!("{b:02x}")).collect();
    let child = Command::new(sidecar)
        .current_dir(executable.parent().ok_or("Missing desktop executable directory")?)
        .env("CERBERUS_BRIDGE_PORT", port.to_string())
        .env("PIPELINEGUARD_ENGINE_PATH", engine)
        .env("PIPELINEGUARD_DESKTOP_MODE", "1")
        .env("PIPELINEGUARD_TOKEN", &token)
        .env("CERBERUS_MANAGED_CHILD", "1")
        .stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null())
        .spawn().map_err(|_| "Unable to start packaged Cerberus bridge")?;
    drop(listener);
    Ok((child, token, port))
}

// Verify the protected API with the native-only token, not the public health route.
fn authenticated_ready(port: u16, token: &str) -> bool {
    let address = SocketAddr::from(([127, 0, 0, 1], port));
    let Ok(mut stream) = TcpStream::connect_timeout(&address, Duration::from_millis(300)) else {
        return false;
    };
    let _ = stream.set_read_timeout(Some(Duration::from_millis(500)));
    let _ = stream.set_write_timeout(Some(Duration::from_millis(500)));
    let request = format!(
        "GET /api/status HTTP/1.1\r\nHost: 127.0.0.1\r\nX-PipelineGuard-Token: {token}\r\nConnection: close\r\n\r\n"
    );
    if stream.write_all(request.as_bytes()).is_err() {
        return false;
    }
    let mut buffer = [0u8; 256];
    match stream.read(&mut buffer) {
        Ok(n) => {
            let line = String::from_utf8_lossy(&buffer[..n]);
            line.starts_with("HTTP/1.1 200 ") || line.starts_with("HTTP/1.0 200 ")
        }
        Err(_) => false,
    }
}

fn wait_for_managed_bridge(child: &mut Child, port: u16, token: &str) -> Result<(), String> {
    let deadline = Instant::now() + Duration::from_secs(12);
    while Instant::now() < deadline {
        match child.try_wait() {
            Ok(Some(status)) => return Err(format!("Managed Python bridge exited before readiness: {status}")),
            Err(_) => return Err("Unable to inspect managed Python bridge process".into()),
            Ok(None) => {}
        }
        if authenticated_ready(port, token) {
            return Ok(());
        }
        thread::sleep(Duration::from_millis(150));
    }
    Err("Managed Python bridge did not pass authenticated readiness within 12 seconds".into())
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

fn unsafe_encoded_path(path: &str) -> bool {
    let pathname = path.split('?').next().unwrap_or("");
    let lower = pathname.to_ascii_lowercase();
    ["%2e", "%2f", "%5c", "%25"].iter().any(|code| lower.contains(code))
}

fn allowed_request(method: &str, path: &str) -> bool {
    matches!(method, "GET" | "POST" | "PUT" | "DELETE")
        && path.starts_with('/')
        && !path.starts_with("//")
        && !path.contains("://")
        && !path.contains('#')
        && !unsafe_encoded_path(path)
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
    // Production always requires a native-managed packaged bridge; only debug
    // builds may use an explicitly configured development bridge token.
    let packaged_requested = std::env::current_exe().ok()
        .and_then(|exe| exe.parent().map(|p| p.join("cerberus-runtime").exists()))
        .unwrap_or(false);
    let managed = match if packaged_requested { spawn_packaged_bridge() } else { spawn_development_bridge() } {
        Ok((mut child, token, port)) => {
            match wait_for_managed_bridge(&mut child, port, &token) {
                Ok(()) => Some((child, token, port)),
                Err(reason) => {
                    eprintln!("Cerberus managed bridge readiness failed: {reason}");
                    let _ = child.kill();
                    let _ = child.wait();
                    None
                }
            }
        },
        Err(reason) => {
            if std::env::var("CERBERUS_MANAGED_DEV").as_deref() == Ok("1") {
                eprintln!("Cerberus managed development bridge failed: {reason}");
            }
            None
        }
    };
    let managed_start_failed = (packaged_requested || std::env::var("CERBERUS_MANAGED_DEV").as_deref() == Ok("1")) && managed.is_none();
    let token = managed.as_ref().map(|(_, token, _)| token.clone())
        .or_else(|| if cfg!(debug_assertions) && !managed_start_failed { std::env::var("CERBERUS_DEV_BRIDGE_TOKEN").ok().filter(|s| !s.is_empty()) } else { None });
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
    fn managed_child_drop_reaps_exited_process() {
        use super::ManagedChild;
        use std::process::{Command, Stdio};
        use std::sync::Mutex;

        // An already-exited process is safe to kill/wait and must not panic on drop.
        let mut child = if cfg!(windows) {
            Command::new("cmd").args(["/C", "exit", "0"])
                .stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null())
                .spawn().expect("spawn Windows test child")
        } else {
            Command::new("true")
                .stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null())
                .spawn().expect("spawn Unix test child")
        };
        let _ = child.wait().expect("wait for test child");
        drop(ManagedChild(Mutex::new(Some(child))));
    }

    #[test]
    fn managed_child_drop_terminates_running_process() {
        use super::ManagedChild;
        use std::process::{Command, Stdio};
        use std::sync::Mutex;
        use std::thread;
        use std::time::{Duration, Instant};

        let mut child = if cfg!(windows) {
            Command::new("powershell").args(["-NoProfile", "-NonInteractive", "-Command", "Start-Sleep -Seconds 60"])
                .stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null())
                .spawn().expect("spawn Windows long-running child")
        } else {
            Command::new("sleep").arg("60")
                .stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null())
                .spawn().expect("spawn Unix long-running child")
        };
        assert!(child.try_wait().expect("inspect running child").is_none());
        let started = Instant::now();
        drop(ManagedChild(Mutex::new(Some(child))));
        assert!(started.elapsed() < Duration::from_secs(10), "managed child cleanup took too long");
        // Drop invokes kill followed by wait; the child handle is reaped before return.
        thread::yield_now();
    }

    #[test]
    fn managed_bridge_rejects_child_exit_before_readiness() {
        use super::wait_for_managed_bridge;
        use std::process::{Command, Stdio};
        use std::net::TcpListener;
        use std::time::{Duration, Instant};

        let listener = TcpListener::bind("127.0.0.1:0").expect("reserve test port");
        let port = listener.local_addr().expect("test port").port();
        let mut child = if cfg!(windows) {
            Command::new("cmd").args(["/C", "exit", "17"])
                .stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null())
                .spawn().expect("spawn Windows failing child")
        } else {
            Command::new("sh").args(["-c", "exit 17"])
                .stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null())
                .spawn().expect("spawn Unix failing child")
        };
        let started = Instant::now();
        let result = wait_for_managed_bridge(&mut child, port, "test-token");
        assert!(result.is_err(), "exited backend must not pass readiness");
        assert!(result.unwrap_err().contains("exited before readiness"));
        assert!(started.elapsed() < Duration::from_secs(5), "exited child should fail promptly");
        let _ = child.wait();
        drop(listener);
    }

    #[test]
    fn native_readiness_accepts_real_authenticated_bridge() {
        use super::{authenticated_ready, wait_for_managed_bridge, ManagedChild};
        use std::net::TcpListener;
        use std::process::{Command, Stdio};
        use std::sync::Mutex;

        // CI explicitly supplies paths; skip this integration case for local cargo test.
        let Ok(backend) = std::env::var("CERBERUS_TEST_BACKEND_DIR") else { return; };
        let Ok(engine) = std::env::var("CERBERUS_TEST_ENGINE_DIR") else { return; };
        let python = std::env::var("CERBERUS_TEST_PYTHON").unwrap_or_else(|_| "python".into());
        let listener = TcpListener::bind("127.0.0.1:0").expect("reserve loopback port");
        let port = listener.local_addr().expect("loopback address").port();
        let token = "native-readiness-integration-token";
        let child = Command::new(python)
            .args(["-m", "uvicorn", "server:app", "--host", "127.0.0.1", "--port", &port.to_string()])
            .current_dir(backend)
            .env("PIPELINEGUARD_ENGINE_PATH", engine)
            .env("PIPELINEGUARD_DESKTOP_MODE", "1")
            .env("PIPELINEGUARD_TOKEN", token)
            .env("CERBERUS_MANAGED_CHILD", "1")
            .stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null())
            .spawn().expect("start actual Python bridge");
        let managed = ManagedChild(Mutex::new(Some(child)));
        drop(listener);
        {
            let mut guard = managed.0.lock().expect("managed child lock");
            let child = guard.as_mut().expect("managed bridge child");
            wait_for_managed_bridge(child, port, token).expect("authenticated native readiness");
        }
        assert!(!authenticated_ready(port, "incorrect-token"), "wrong token cannot pass readiness");
        drop(managed);
    }

    #[test]
    fn packaged_sidecar_requires_complete_adjacent_runtime() {
        use super::packaged_sidecar_paths;
        let fake_executable = std::env::temp_dir().join("cerberus-missing-runtime-test").join("cerberus.exe");
        assert!(packaged_sidecar_paths(&fake_executable).is_err());
    }

    #[test]
    fn rejects_unsafe_paths_and_methods() {
        for path in ["//evil.example", "/../admin", "/a/./b", "/a\\b", "/a#fragment", "/http://evil"] {
            assert!(!allowed_request("GET", path), "{path}");
        }
        assert!(!allowed_request("PATCH", "/settings"));
        for path in ["/%2e%2e/admin", "/%2E%2E/admin", "/%2f%2fevil", "/%5cadmin", "/%252e%252e/admin"] {
            assert!(!allowed_request("GET", path), "encoded unsafe path: {path}");
        }
    }
}
