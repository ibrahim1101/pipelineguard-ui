import { useNavigate } from "react-router-dom";
import { Check, Circle, Loader2, MinusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/context/AppContext";
import { InlineError, Panel } from "@/components/common/Panel";
import { StatusPill } from "@/components/common/Badges";
import { fmtDuration } from "@/lib/format";

const StageIcon = ({ state }) => {
  if (state === "done") return <Check className="h-4 w-4 text-pg-accent" />;
  if (state === "active") return <Loader2 className="h-4 w-4 text-pg-accent animate-spin" />;
  if (state === "skipped") return <MinusCircle className="h-4 w-4 text-pg-muted" />;
  return <Circle className="h-4 w-4 text-pg-line" />;
};

const Stat = ({ label, value, testId }) => (
  <div className="rounded-lg bg-pg-bg/60 border border-pg-line/60 px-3 py-2.5">
    <p className="text-[11px] text-pg-muted">{label}</p>
    <p className="font-mono text-base mt-0.5 tabular-nums" data-testid={testId}>{value}</p>
  </div>
);

export default function ScanMonitor() {
  const { scanState: s, latest } = useApp();
  const nav = useNavigate();
  if (s.status === "idle") {
    return <Panel title="Scan monitor" testId="scan-monitor"><p className="text-sm text-pg-muted py-6 text-center" data-testid="scan-monitor-idle">No scan running. Progress events from the engine appear here.</p></Panel>;
  }
  const files = s.files_discovered == null ? "—" : `${s.files_processed ?? "—"} / ${s.files_discovered}`;
  const done = s.status === "completed" && latest?.scan_id === s.scan_id;
  return (
    <Panel title="Scan monitor" description={`${s.profile} profile · ${s.online_effective ? "online" : "offline"}`} testId="scan-monitor"
      actions={<span className="text-xs font-mono text-pg-muted" data-testid="scan-monitor-status">{s.status}</span>}>
      <div className="flex justify-between text-xs text-pg-muted mb-1.5">
        <span data-testid="scan-current-stage">{s.current_stage || "Starting"}</span>
        <span className="font-mono" data-testid="scan-progress-pct">{Math.round(s.progress || 0)}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-pg-surface2 overflow-hidden" role="progressbar" aria-valuenow={Math.round(s.progress || 0)} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full transition-[width] duration-500 ${s.status === "failed" ? "bg-pg-crit" : "bg-pg-accent"}`} style={{ width: `${s.progress || 0}%` }} />
      </div>
      <ol className="mt-4 space-y-2.5" data-testid="scan-stage-list">
        {s.stages?.map((st) => (
          <li key={st.key} className={`flex items-center gap-2.5 text-sm ${st.state === "pending" ? "text-pg-muted" : ""}`} data-testid={`scan-stage-${st.key}`} data-state={st.state}>
            <StageIcon state={st.state} /> {st.label}
          </li>
        ))}
      </ol>
      <div className="grid grid-cols-3 gap-2 mt-4">
        <Stat label="Elapsed" value={fmtDuration(s.elapsed_ms)} testId="scan-elapsed" />
        <Stat label="Files processed" value={files} testId="scan-files" />
        <Stat label="Findings detected" value={s.findings_detected ?? 0} testId="scan-findings-count" />
      </div>
      {s.status === "failed" && <div className="mt-4"><InlineError message={s.error} testId="scan-error" /></div>}
      {done && (
        <div className="mt-4 rounded-xl border border-pg-line bg-pg-bg/50 p-4" data-testid="scan-result-summary">
          <div className="flex items-center justify-between">
            <StatusPill status={latest.status} large />
            <span className="text-2xl font-semibold tabular-nums">{latest.score}<span className="text-sm text-pg-muted">/100</span></span>
          </div>
          <p className="text-xs text-pg-muted mt-2">{latest.summary.total_findings} findings · {latest.summary.critical} critical · dependency check {latest.dependency_check_complete ? "complete" : "incomplete"}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <Button size="sm" onClick={() => nav("/findings")} data-testid="scan-view-findings-btn">View findings</Button>
            <Button size="sm" variant="outline" onClick={() => nav("/dependencies")} data-testid="scan-view-dependencies-btn">View dependencies</Button>
            <Button size="sm" variant="outline" onClick={() => nav("/reports")} data-testid="scan-export-report-btn">Export report</Button>
          </div>
        </div>
      )}
    </Panel>
  );
}
