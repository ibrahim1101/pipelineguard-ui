import hmac
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")
sys.path.insert(0, os.environ["PIPELINEGUARD_ENGINE_PATH"])
sys.path.insert(0, str(ROOT_DIR))

from fastapi import FastAPI, Request  # noqa: E402
from fastapi.responses import JSONResponse  # noqa: E402
from starlette.middleware.cors import CORSMiddleware  # noqa: E402

from bridge.routes import router  # noqa: E402

app = FastAPI(title="PipelineGuard Bridge", docs_url=None, redoc_url=None)
app.include_router(router)

TOKEN = os.environ.get("PIPELINEGUARD_TOKEN")
if os.environ.get("PIPELINEGUARD_DESKTOP_MODE") == "1" and not TOKEN:
    raise RuntimeError("Desktop mode requires PIPELINEGUARD_TOKEN")


@app.middleware("http")
async def desktop_token(request: Request, call_next):
    # Desktop shell injects a per-launch token so other local processes cannot drive scans.
    if TOKEN and request.method != "OPTIONS" and request.url.path != "/api/health":
        supplied = request.headers.get("x-pipelineguard-token", "")
        if not hmac.compare_digest(supplied, TOKEN):
            return JSONResponse({"detail": "Unauthorized"}, status_code=401)
    return await call_next(request)


ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get(
        "CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
    ).split(",")
    if origin.strip()
]
if "*" in ALLOWED_ORIGINS:
    raise RuntimeError("Wildcard CORS is not permitted for the PipelineGuard bridge")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)
