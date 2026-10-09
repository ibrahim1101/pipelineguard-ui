export const basename = (p) => (p ? p.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || p : "—");

export const dirname = (p) => {
  if (!p) return "";
  const parts = p.replace(/[\\/]+$/, "").split(/[\\/]/);
  parts.pop();
  return parts.join(p.includes("\\") && !p.includes("/") ? "\\" : "/") || "/";
};

export const joinPath = (dir, name) => {
  const sep = dir.includes("\\") && !dir.includes("/") ? "\\" : "/";
  return `${dir.replace(/[\\/]+$/, "")}${sep}${name}`;
};

export const fmtDuration = (ms) => {
  if (ms == null || Number.isNaN(ms)) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
};

export const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
};

export const fmtBytes = (n) => {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};

export const relTime = (iso) => {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
};

export const location = (f) =>
  f.file ? `${f.file}${f.line ? `:${f.line}` : ""}` : f.package ? `${f.package}${f.version ? `@${f.version}` : ""}` : "—";

export const C = {
  crit: "#FF5964", warn: "#F0B65C", accent: "#A4D65E", accent2: "#708D47", muted: "#A4B0B0",
  line: "#364144", surface: "#1B2225", surface2: "#252C2B", text: "#F1F4F3",
};

export const SEV_RANK = { CRITICAL: 4, HIGH: 3, WARNING: 2, MODERATE: 2, MEDIUM: 2, LOW: 1, UNKNOWN: 0 };
