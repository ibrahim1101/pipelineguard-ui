const SEV = {
  CRITICAL: "text-pg-crit bg-pg-crit/10 border-pg-crit/35",
  HIGH: "text-[#FF8A8F] bg-pg-crit/[0.06] border-pg-crit/25",
  WARNING: "text-pg-warn bg-pg-warn/10 border-pg-warn/30",
  MODERATE: "text-pg-warn bg-pg-warn/10 border-pg-warn/30",
  MEDIUM: "text-pg-warn bg-pg-warn/10 border-pg-warn/30",
  LOW: "text-pg-muted bg-pg-surface2 border-pg-line",
  UNKNOWN: "text-pg-muted bg-transparent border-dashed border-pg-line",
};

export function SeverityBadge({ value, testId }) {
  const v = (value || "UNKNOWN").toUpperCase();
  return (
    <span data-testid={testId} className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold tracking-wide ${SEV[v] || SEV.UNKNOWN}`}>
      {v === "WARNING" ? "Warning" : v.charAt(0) + v.slice(1).toLowerCase()}
    </span>
  );
}

const STATUS = {
  SAFE: "text-pg-accent border-pg-accent/40 bg-pg-accent/10",
  WARNING: "text-pg-warn border-pg-warn/40 bg-pg-warn/10",
  BLOCKED: "text-pg-crit border-pg-crit/40 bg-pg-crit/10",
};

export function StatusPill({ status, testId, large }) {
  return (
    <span data-testid={testId} className={`inline-flex items-center gap-1.5 rounded-full border font-semibold ${large ? "px-3 py-1 text-sm" : "px-2.5 py-0.5 text-xs"} ${STATUS[status] || "text-pg-muted border-pg-line"}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status || "—"}
    </span>
  );
}

const PKG = {
  Vulnerable: "text-pg-crit",
  "No known advisories": "text-pg-text",
  "Lookup failed": "text-pg-warn",
};

export function PackageStatus({ status, testId }) {
  return (
    <span data-testid={testId} className={`text-xs ${PKG[status] || "text-pg-muted"}`}>{status}</span>
  );
}
