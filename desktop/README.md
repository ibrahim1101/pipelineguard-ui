# Cerberus desktop shell — development integration

The Tauri 2 desktop shell now registers a native `bridge_request` command. The React frontend calls this command in desktop mode instead of making browser HTTP requests or reading an authentication token.

## Native IPC development setup

For **local development only**, start the Python bridge separately with `PIPELINEGUARD_DESKTOP_MODE=1`, `PIPELINEGUARD_TOKEN` and `PIPELINEGUARD_ENGINE_PATH` configured, then launch the Tauri shell with `CERBERUS_DEV_BRIDGE_TOKEN` set to the same token and `CERBERUS_DEV_BRIDGE_PORT` (default `8000`). The native command attaches the token to loopback requests without returning it to JavaScript.

The native handler rejects missing tokens, unsafe request paths and unsupported HTTP methods, and disallows HTTP redirects. Its token is read from a process environment variable, which is **not** a production secret-provisioning mechanism. This mode is suitable for local development only.

## Remaining release blockers

1. Generate a per-launch token in Rust and start the Python bridge as a managed child, without requiring environment-based token sharing.
2. Dynamically choose and reserve a loopback port; wait for authenticated readiness.
3. Terminate/reap child on exit and failure, with crash/restart handling.
4. Restrict allowed API routes and capabilities to only required UI operations; audit native IPC attack surface.
5. Package Python engine/bridge, final branded Windows icon, installer and signed binaries.
6. Add end-to-end desktop runtime tests and verify Windows installation/uninstallation.

Do not distribute this as a secure production desktop application yet. The existing Python engine and browser development workflow remain unchanged.
