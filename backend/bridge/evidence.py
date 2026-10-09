"""Masked, on-demand context for secret findings. Raw values never leave the bridge."""
from __future__ import annotations

import re
from pathlib import Path

from scanners.secret_scanner import RULES

_LONG_RUN = re.compile(r"[A-Za-z0-9+/=_\-]{16,}")
_QUOTED = re.compile(r"""(["'])[^"']{6,}\1""")
MAX_BYTES = 2_000_000


def mask_line(text: str) -> str:
    for name, pattern in RULES:
        text = pattern.sub(f"[REDACTED: {name}]", text)
    text = _QUOTED.sub(lambda m: m.group(1) + "••••••" + m.group(1), text)
    text = _LONG_RUN.sub("••••••", text)
    return text[:160] + ("…" if len(text) > 160 else "")


def masked_context(project: str, relative: str, line: int, rule: str) -> list[dict]:
    root = Path(project).resolve()
    target = (root / relative).resolve()
    if not target.is_relative_to(root) or not target.is_file():
        raise ValueError("Finding location is outside the scanned project or no longer exists")
    if target.stat().st_size > MAX_BYTES:
        raise ValueError("File too large for a safe preview")
    lines = target.read_text(encoding="utf-8", errors="ignore").splitlines()
    if not 1 <= line <= len(lines):
        raise ValueError("Line no longer exists; the file changed since the scan")
    # Private-key bodies follow the header line, so never show surrounding lines for them.
    span = range(line, line + 1) if "private key" in rule.lower() else range(max(1, line - 1), min(len(lines), line + 1) + 1)
    return [{"number": n, "text": mask_line(lines[n - 1]), "flagged": n == line} for n in span]
