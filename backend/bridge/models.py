from __future__ import annotations

import re
from pathlib import Path
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

Profile = Literal["quick", "standard", "deep", "release", "forensic"]
ReportFormat = Literal["html", "json", "sarif"]


def _absolute(value: Optional[str]) -> Optional[str]:
    if value in (None, ""):
        return None
    if "\x00" in value or not Path(value).is_absolute():
        raise ValueError("Path must be absolute")
    return value


class ScanRequest(BaseModel):
    project: str
    config: Optional[str] = None
    profile: Profile = "standard"
    online: bool = False
    _abs = field_validator("project", "config")(_absolute)


class ExportRequest(BaseModel):
    scan_id: str = Field(pattern=r"^[0-9a-f]{16}$")
    format: ReportFormat
    directory: Optional[str] = None
    _abs = field_validator("directory")(_absolute)


class EvidenceRequest(BaseModel):
    scan_id: str = Field(pattern=r"^[0-9a-f]{16}$")
    index: int = Field(ge=0)


class OsvQuery(BaseModel):
    name: str = Field(min_length=1, max_length=214)
    version: str = Field(min_length=1, max_length=64)
    ecosystem: Literal["PyPI", "npm"]

    @field_validator("name")
    @classmethod
    def _name(cls, v):
        if not re.fullmatch(r"[A-Za-z0-9@/._\-]+", v):
            raise ValueError("Invalid package name")
        return v

    @field_validator("version")
    @classmethod
    def _version(cls, v):
        if not re.fullmatch(r"[0-9A-Za-z.+_\-]+", v):
            raise ValueError("Invalid version")
        return v


class Settings(BaseModel):
    default_profile: Profile = "standard"
    default_project: Optional[str] = None
    default_config: Optional[str] = None
    online_default: bool = False
    export_dir: Optional[str] = None
    preferred_format: ReportFormat = "html"
    density: Literal["comfortable", "compact"] = "comfortable"
    text_scale: Literal[90, 100, 110, 120] = 100
    reduced_motion: bool = False
    _abs = field_validator("default_project", "default_config", "export_dir")(_absolute)


class EngineConfigWrite(BaseModel):
    path: str
    config: dict
    _abs = field_validator("path")(_absolute)
