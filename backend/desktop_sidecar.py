"""Entry point for a packaged, local-only Cerberus Python bridge.

The native shell must supply the port, engine directory and per-launch token.
Never accept remote binds or silently generate a shared token.
"""
import os
import sys

def main():
    port_text = os.environ.get("CERBERUS_BRIDGE_PORT", "")
    try:
        port = int(port_text)
    except ValueError:
        raise SystemExit("CERBERUS_BRIDGE_PORT must be a valid loopback port")
    if not 1 <= port <= 65535:
        raise SystemExit("CERBERUS_BRIDGE_PORT must be between 1 and 65535")
    if os.environ.get("PIPELINEGUARD_DESKTOP_MODE") != "1":
        raise SystemExit("Desktop mode must be explicitly enabled")
    if not os.environ.get("PIPELINEGUARD_TOKEN"):
        raise SystemExit("Desktop mode requires PIPELINEGUARD_TOKEN")
    if not os.environ.get("PIPELINEGUARD_ENGINE_PATH"):
        raise SystemExit("PIPELINEGUARD_ENGINE_PATH is required")
    import uvicorn
    uvicorn.run("server:app", host="127.0.0.1", port=port, log_level="warning")

if __name__ == "__main__":
    main()
