import { useApp } from "@/context/AppContext";
import { relTime } from "@/lib/format";

const Dot = ({ color }) => <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: color }} />;

export default function StatusBar() {
  const { status, backend, latest, scanState, osvOnline } = useApp();
  const backendColor = { connected: "#A4D65E", connecting: "#F0B65C", offline: "#FF5964" }[backend];
  const osv = osvOnline == null ? ["Not checked", "#A4B0B0"] : osvOnline ? ["Reachable", "#A4D65E"] : ["Unreachable", "#FF5964"];
  return (
    <footer className="h-7 shrink-0 bg-pg-side border-t border-pg-line/80 px-4 flex items-center gap-6 text-[11.5px] text-pg-muted font-mono" data-testid="status-bar">
      <span data-testid="status-version">Cerberus {status?.app_version || "—"} · engine {status?.engine_version || "—"}</span>
      <span className="flex items-center gap-1.5" data-testid="status-backend"><Dot color={backendColor} /> Engine bridge: {backend}</span>
      <span data-testid="status-last-scan">
        {scanState.status === "running" ? `Scanning · ${Math.round(scanState.progress || 0)}%` :
          latest ? `Last scan: ${latest.status} · ${relTime(latest.scanned_at)}` : "No scans yet"}
      </span>
      <span className="flex items-center gap-1.5 ml-auto" data-testid="status-osv"><Dot color={osv[1]} /> OSV: {osv[0]}</span>
    </footer>
  );
}
