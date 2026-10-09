# PipelineGuard desktop shell — foundation only

This directory contains an **isolated Tauri 2 scaffold**, not a working installer.
It is deliberately not wired into the existing CI build or React development mode.

## Security architecture to implement

1. Package the Python bridge and engine as a managed desktop sidecar.
2. On launch, generate a cryptographically random token in the **native shell**, start the bridge bound only to `127.0.0.1`, and wait for authenticated readiness.
3. Do **not** expose the token to arbitrary renderer JavaScript. Replace the current `window.__PIPELINEGUARD_TOKEN__` transitional adapter with narrowly scoped Tauri IPC requests; the native layer attaches the token to loopback HTTP requests.
4. Bind to a dynamically reserved local port and avoid untrusted host overrides. Restrict Tauri capabilities to the app window and necessary commands only.
5. On window exit, terminate and reap the child process, including startup failures. Test orphan prevention, repeated launches, wrong-token requests, and process crashes.
6. Verify platform packaging and signature/installer behavior on Windows before enabling `bundle.active`.

## Current limitations

- `src-tauri/src/main.rs` launches only a window; **no Python process management, token provisioning, or IPC bridge is implemented**.
- Tauri build prerequisites and app icon assets have not yet been provisioned or validated.
- The frontend currently expects a token on `window.__PIPELINEGUARD_TOKEN__`; it intentionally refuses API requests in a Tauri context until provisioned.
- `tauri.conf.json` uses a fixed development API URL and intentionally disables bundling. Its CSP is an initial baseline, not a completed production security policy.
- Do not ship or distribute this scaffold as a secure desktop app.

The Python development bridge and the separate engine repository are unchanged.
