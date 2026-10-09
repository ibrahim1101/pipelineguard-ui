"""Run the PipelineGuard bridge on loopback with a per-launch authentication token.

For desktop-shell integration only. The caller must pass the generated token
to the trusted frontend; never print it to stdout or place it in a URL.
"""
from __future__ import annotations

import argparse
import os
import secrets


def configure_local_bridge() -> str:
    """Set the required desktop security environment before importing server."""
    token = secrets.token_urlsafe(32)
    os.environ["PIPELINEGUARD_DESKTOP_MODE"] = "1"
    os.environ["PIPELINEGUARD_TOKEN"] = token
    return token


def main() -> None:
    parser = argparse.ArgumentParser(description="Start a loopback-only PipelineGuard bridge")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error("port must be between 1 and 65535")
    if not os.environ.get("PIPELINEGUARD_ENGINE_PATH"):
        parser.error("PIPELINEGUARD_ENGINE_PATH must point to the engine checkout")

    # Native Tauri owner provisions a per-launch token via child environment.
    # Standalone development launches continue generating their own token.
    if os.environ.get("CERBERUS_MANAGED_CHILD") == "1":
        if not os.environ.get("PIPELINEGUARD_TOKEN"):
            parser.error("managed bridge requires PIPELINEGUARD_TOKEN")
        os.environ["PIPELINEGUARD_DESKTOP_MODE"] = "1"
    else:
        configure_local_bridge()
    import uvicorn

    # Never accept a host override here: this launcher is strictly local.
    uvicorn.run("server:app", host="127.0.0.1", port=args.port, reload=False)


if __name__ == "__main__":
    main()
