"""Convert raw engine reports into bounded, display-safe API payloads."""
from __future__ import annotations

import re

from pipelineguard.baseline import finding_key
from scanners.secret_scanner import RULES

SECRET_RULES = {name for name, _ in RULES}
_CTRL = re.compile(r"[\x00-\x1f\x7f]")
SEVERITY_RANK = {"UNKNOWN": 0, "LOW": 1, "MODERATE": 2, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}
SERVICE_FAILURES = {"Vulnerability service unavailable.", "Invalid vulnerability service response."}

IMPACT = {
    "Secret": "An exposed credential can grant unauthorized access to the associated service, data or infrastructure.",
    "Dependency vulnerability": "A dependency version is listed in a published advisory; impact depends on how the package is used.",
    "Dependency manifest": "A malformed manifest prevents dependency inventory and vulnerability analysis for that file.",
    "Dependency analysis": "Dependency analysis was incomplete, so vulnerability results may be missing.",
    "Other": "Review this finding in context.",
}
SECRET_GUIDANCE = ("Remove the credential from source control, revoke or rotate it with the issuing provider, "
                   "and load it from a secret manager or environment variable.")


def clean(value, limit: int = 400):
    if value is None:
        return None
    text = _CTRL.sub(" ", str(value)).strip()
    return (text[:limit] + "…" if len(text) > limit else text) or None


def category(finding: dict) -> str:
    rule = finding.get("rule")
    if rule in SECRET_RULES:
        return "Secret"
    return {"Known dependency vulnerability": "Dependency vulnerability",
            "Malformed dependency manifest": "Dependency manifest",
            "Dependency check incomplete": "Dependency analysis"}.get(rule, "Other")


def _strings(values, limit=20, size=120):
    return [clean(v, size) for v in (values or []) if isinstance(v, (str, int, float))][:limit]


def _ranges(ranges):
    out = []
    for interval in (ranges or [])[:10]:
        if not isinstance(interval, dict):
            continue
        events = [{k: clean(v, 64) for k, v in ev.items() if k in ("introduced", "fixed", "last_affected", "limit")}
                  for ev in interval.get("events", []) if isinstance(ev, dict)][:20]
        out.append({"type": clean(interval.get("type"), 24), "events": events})
    return out


def present_finding(index: int, f: dict) -> dict:
    cat = category(f)
    refs = [r for r in (f.get("references") or []) if isinstance(r, str) and r.startswith(("https://", "http://"))]
    cvss = f.get("cvss_score")
    return {
        "uid": f"{index}-{finding_key(f)[:12]}", "index": index,
        "severity": clean(f.get("severity"), 16), "rule": clean(f.get("rule"), 120), "category": cat,
        "file": clean(f.get("file"), 300), "line": f.get("line") if type(f.get("line")) is int else None,
        "package": clean(f.get("package"), 214), "version": clean(f.get("version"), 64),
        "confidence": clean(f.get("confidence"), 16), "advisory_id": clean(f.get("id"), 80),
        "aliases": _strings(f.get("aliases"), size=80), "summary": clean(f.get("summary"), 600),
        "details": clean(f.get("details"), 300), "advisory_severity": clean(f.get("advisory_severity"), 16),
        "cvss_score": cvss if isinstance(cvss, (int, float)) and not isinstance(cvss, bool) else None,
        "fixed_versions": _strings(f.get("fixed_versions"), size=64), "affected_ranges": _ranges(f.get("affected_ranges")),
        "references": refs[:20],
        "remediation": clean(f.get("remediation"), 300) or (SECRET_GUIDANCE if cat == "Secret" else None),
        "remediation_source": "engine" if f.get("remediation") else ("guidance" if cat == "Secret" else None),
        "impact": IMPACT[cat],
        "status": "Incomplete analysis" if f.get("rule") == "Dependency check incomplete" else "Detected",
        "baseline_state": clean(f.get("baseline_state"), 16),
    }


def present_dependencies(report: dict, meta: dict) -> dict:
    findings = report.get("findings", [])
    vulns = [f for f in findings if f.get("rule") == "Known dependency vulnerability"]
    notices = [clean(f.get("summary"), 200) for f in findings if f.get("rule") == "Dependency check incomplete"]
    service_failed = any(n in SERVICE_FAILURES for n in notices)
    online = bool(meta.get("online_effective"))
    packages = []
    for record in report.get("dependency_inventory", []):
        for dep in record.get("dependencies", []) if isinstance(record, dict) else []:
            name, version = clean(dep.get("name"), 214), clean(dep.get("version"), 64)
            advisories = [present_finding(findings.index(v), v) for v in vulns
                          if version and v.get("package") == dep.get("name") and v.get("version") == dep.get("version")]
            if not online:
                status = "Not checked (offline)"
            elif not version:
                status = "Not checked (no exact version)"
            elif service_failed:
                status = "Lookup failed"
            elif advisories:
                status = "Vulnerable"
            else:
                status = "No known advisories"
            ranks = [a.get("advisory_severity") or "UNKNOWN" for a in advisories]
            packages.append({
                "uid": f"{len(packages)}-{name}", "name": name, "version": version,
                "constraint": clean(dep.get("constraint"), 120), "constraint_type": clean(dep.get("constraint_type"), 24),
                "ecosystem": clean(dep.get("ecosystem"), 16), "manifest": clean(dep.get("manifest"), 300),
                "resolved": bool(dep.get("resolved")), "vulnerability_count": len(advisories),
                "highest_severity": max(ranks, key=lambda r: SEVERITY_RANK.get(r, 0)) if ranks else None,
                "status": status, "advisories": advisories,
            })
    count = lambda s: sum(p["status"] == s for p in packages)
    return {
        "packages": packages,
        "manifests": [{"file": clean(r.get("file"), 300), "ecosystem": clean(r.get("ecosystem"), 16),
                       "dependency_count": r.get("dependency_count")} for r in report.get("dependency_inventory", [])],
        "insights": {"total": len(packages), "vulnerable": count("Vulnerable"),
                     "no_known_advisories": count("No known advisories"),
                     "not_checked": count("Not checked (offline)") + count("Not checked (no exact version)"),
                     "lookup_failed": count("Lookup failed"), "advisories": len(vulns),
                     "mode": "online" if online else "offline", "notices": sorted({n for n in notices if n}),
                     "complete": bool(report.get("dependency_check_complete"))},
    }


def _git(ctx):
    if not isinstance(ctx, dict) or not ctx.get("available"):
        return {"available": False}
    return {"available": True, "commit": clean(ctx.get("commit"), 64), "branch": clean(ctx.get("branch"), 120),
            "dirty": bool(ctx.get("dirty")), "remote": clean(ctx.get("remote"), 200)}


def present_scan(snapshot: dict) -> dict:
    report, meta = snapshot["report"], snapshot.get("meta", {})
    findings = [present_finding(i, f) for i, f in enumerate(report.get("findings", []))]
    by_cat: dict[str, int] = {}
    for f in findings:
        by_cat[f["category"]] = by_cat.get(f["category"], 0) + 1
    return {
        "scan_id": meta.get("scan_id"), "meta": meta, "status": report.get("status"), "score": report.get("score"),
        "summary": report.get("summary", {}), "policy_blocked": bool(report.get("policy_blocked")),
        "dependency_check_complete": bool(report.get("dependency_check_complete")),
        "scanned_at": report.get("scanned_at"), "scan_profile": report.get("scan_profile"),
        "git_context": _git(report.get("git_context")), "secret_cache": report.get("secret_cache"),
        "findings": findings, "category_counts": by_cat, "dependencies": present_dependencies(report, meta),
    }
