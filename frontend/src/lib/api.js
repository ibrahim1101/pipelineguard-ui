/**
 * Typed adapter between the UI and the PipelineGuard Python bridge.
 * Every call goes to the local bridge; nothing here talks to third parties.
 *
 * @typedef {"quick"|"standard"|"deep"|"release"|"forensic"} ProfileName
 * @typedef {"html"|"json"|"sarif"} ReportFormat
 * @typedef {{status: "idle"|"running"|"completed"|"failed", scan_id?: string, progress?: number,
 *   stages?: {key: string, label: string, state: "pending"|"active"|"done"|"skipped"}[],
 *   current_stage?: string, elapsed_ms?: number, files_discovered?: number|null,
 *   files_processed?: number|null, findings_detected?: number, error?: string|null}} ScanState
 * @typedef {{uid: string, index: number, severity: string, rule: string, category: string,
 *   file?: string, line?: number, package?: string, version?: string, advisory_id?: string}} Finding
 */

const BASE = `${process.env.REACT_APP_BACKEND_URL}/api`;

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function formatDetail(detail) {
  if (!detail) return null;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d) => d.msg?.replace(/^Value error, /, "") || String(d)).join("; ");
  return String(detail);
}

async function request(method, path, body) {
  const headers = { "Content-Type": "application/json" };
  // Desktop requests are routed through trusted native IPC. No bridge token
  // is exposed to renderer JavaScript or sent by browser fetch.
  const desktopInvoke = window.__TAURI__?.core?.invoke;
  let res;
  if (desktopInvoke) {
    try {
      const result = await desktopInvoke("bridge_request", { method, path, body: body ?? null });
      if (!result || typeof result.status !== "number") {
        throw new Error("Invalid desktop bridge response");
      }
      res = {
        ok: result.status >= 200 && result.status < 300,
        status: result.status,
        statusText: result.statusText || "",
        json: async () => result.body,
      };
    } catch {
      throw new ApiError("Cerberus desktop bridge is unavailable", 0);
    }
  } else {
    // Browser development retains its existing local HTTP bridge behavior.
    let response;
    try {
      response = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    } catch {
      throw new ApiError("PipelineGuard engine bridge is unreachable", 0);
    }
    res = response;
  }
  if (!res.ok) {
    let detail = null;
    try {
      detail = (await res.json()).detail;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(formatDetail(detail) || res.statusText || "Request failed", res.status);
  }
  return res.json();
}

const q = (params) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== "")).toString();
  return s ? `?${s}` : "";
};

export const api = {
  health: () => request("GET", "/health"),
  status: () => request("GET", "/status"),
  profiles: () => request("GET", "/profiles"),
  fsList: (path) => request("GET", `/fs/list${q({ path })}`),
  validateConfig: (path) => request("POST", "/config/validate", { path }),
  engineConfig: (path) => request("GET", `/engine-config${q({ path })}`),
  saveEngineConfig: (path, config) => request("PUT", "/engine-config", { path, config }),
  /** @returns {Promise<ScanState>} */
  startScan: (body) => request("POST", "/scan", body),
  /** @returns {Promise<ScanState>} */
  scanState: () => request("GET", "/scan/state"),
  latestScan: () => request("GET", "/scans/latest"),
  scan: (id) => request("GET", `/scans/${id}`),
  evidence: (scanId, index) => request("POST", "/findings/evidence", { scan_id: scanId, index }),
  history: () => request("GET", "/history"),
  clearHistory: () => request("DELETE", "/history"),
  compare: (base, target) => request("GET", `/history/compare${q({ base, target })}`),
  activity: () => request("GET", "/activity"),
  osvQuery: (body) => request("POST", "/osv/query", body),
  osvConnectivity: () => request("GET", "/osv/connectivity"),
  exportReport: (body) => request("POST", "/reports/export", body),
  reports: (directory) => request("GET", `/reports${q({ directory })}`),
  reportContent: (path) => request("GET", `/reports/content${q({ path })}`),
  settings: () => request("GET", "/settings"),
  saveSettings: (body) => request("PUT", "/settings", body),
  diagnostics: () => request("GET", "/diagnostics"),
};
