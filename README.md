# PipelineGuard UI

A React-based frontend and Python FastAPI integration bridge for [PipelineGuard](https://github.com/ibrahim1101/PipelineGuard), a local-first DevSecOps scanner.

> **Development status:** UI and bridge source are present. A production-ready Windows desktop installer, backend startup/shutdown integration, and end-to-end security validation have **not** been verified. Do not treat the frontend as a replacement for the existing stable PipelineGuard release.

## Repositories

- **Security engine:** [PipelineGuard](https://github.com/ibrahim1101/PipelineGuard), development branch `feat/v2-engine-integration`.
- **Frontend and bridge:** this repository. Keep engine and UI changes separate until integration tests pass.

## Structure

- `frontend/`: React application, eight routed workspaces (Dashboard, Scan Project, Findings, Dependencies, OSV Intelligence, Reports, History, Settings).
- `backend/server.py`: FastAPI application, CORS configuration, optional request-token middleware.
- `backend/bridge/`: scan management, reporting, OSV, settings, and local history integration.

## Development prerequisites

Python 3.11+, Node.js, Yarn, and a local checkout of the PipelineGuard Python engine. The bridge imports the engine from the path supplied in `PIPELINEGUARD_ENGINE_PATH`.

The frontend expects `REACT_APP_BACKEND_URL` to point to the local bridge. Review `frontend/package.json` for build commands.

The default allowed frontend origins are `http://localhost:3000` and `http://127.0.0.1:3000`. Set `CORS_ORIGINS` to an explicit comma-separated list if necessary; wildcard `*` is rejected.

## Security boundaries

- For desktop mode, set `PIPELINEGUARD_DESKTOP_MODE=1` and supply a fresh unpredictable `PIPELINEGUARD_TOKEN` at launch. Desktop mode refuses to initialize without the token.
- The frontend sends the token in `X-PipelineGuard-Token` when provided by the desktop shell.
- **Important:** Without desktop mode and without a token, the current bridge still accepts unauthenticated API calls. Do not expose it to a network or run it as a public web service.
- Run the bridge on `127.0.0.1` only; CORS is not an authentication or network isolation mechanism.
- OSV lookups require network access. Never send source files or detected secrets to external services.

## Remaining integration work

1. Verify a desktop shell exists and starts/stops the Python bridge with a per-launch token.
2. Add automated tests for authentication, origin handling, filesystem operations, and scan lifecycle.
3. Audit all filesystem and report endpoints for local path handling and sensitive-data disclosure.
4. Remove unused development dependencies only after import checks.
5. Validate frontend production builds, Python tests, and Windows packaging.
6. Integrate the UI with the engine in an isolated branch, preserving the original CLI and stable release.

Do not fabricate scan results or mark unverified backend functionality as complete.
