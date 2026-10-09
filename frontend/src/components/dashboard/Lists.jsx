import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2, FileText, Play, Settings2, Trash2, XCircle, Globe2 } from "lucide-react";
import { Panel } from "@/components/common/Panel";
import { SeverityBadge, StatusPill } from "@/components/common/Badges";
import { basename, location, relTime } from "@/lib/format";

const ICONS = { "scan-started": Play, "scan-completed": CheckCircle2, "scan-failed": XCircle, "report-generated": FileText,
  "config-saved": Settings2, "history-cleared": Trash2, "osv-lookup": Globe2 };

export function ActivityFeed({ items, compact }) {
  return (
    <Panel title="Recent security activity" testId="dashboard-activity">
      {items.length === 0 ? <p className="text-sm text-pg-muted">No activity recorded yet.</p> : (
        <ul className="space-y-3">
          {items.slice(0, compact ? 6 : 10).map((a, i) => {
            const Icon = ICONS[a.kind] || CheckCircle2;
            return (
              <li key={`${a.timestamp}-${i}`} className="flex gap-3 text-sm" data-testid={`activity-item-${i}`}>
                <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${a.kind === "scan-failed" ? "text-pg-crit" : "text-pg-accent2"}`} />
                <div className="min-w-0">
                  <p className="truncate">{a.message}</p>
                  <p className="text-xs text-pg-muted">{relTime(a.timestamp)}{a.project ? ` · ${basename(a.project)}` : ""}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

export function RecentScans({ items, className }) {
  const nav = useNavigate();
  return (
    <Panel title="Recent scans" className={className} testId="dashboard-recent-scans"
      actions={<Link to="/history" className="text-xs text-pg-muted hover:text-pg-accent transition-colors" data-testid="dashboard-view-history-link">View history</Link>}>
      <ul className="divide-y divide-pg-line/40">
        {items.slice(0, 6).map((h, i) => (
          <li key={`${h.timestamp}-${i}`}>
            <button onClick={() => nav("/history")} className="w-full flex items-center gap-3 py-2.5 text-left hover:bg-pg-surface2/40 rounded-md px-1 transition-colors" data-testid={`recent-scan-${i}`}>
              <div className="min-w-0 flex-1">
                <p className="text-sm truncate">{basename(h.project)}</p>
                <p className="text-xs text-pg-muted">{relTime(h.timestamp)} · {h.findings} findings</p>
              </div>
              <span className="font-mono text-sm tabular-nums">{h.score}</span>
              <StatusPill status={h.status} />
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function CriticalPreview({ findings, className }) {
  const nav = useNavigate();
  const critical = findings.filter((f) => f.severity === "CRITICAL");
  return (
    <Panel title="Critical findings" description={`${critical.length} critical in the latest scan`} className={className} testId="dashboard-critical-preview"
      actions={<Link to="/findings" className="text-xs text-pg-muted hover:text-pg-accent inline-flex items-center gap-1 transition-colors" data-testid="dashboard-view-findings-link">All findings <ArrowRight className="h-3 w-3" /></Link>}>
      {critical.length === 0 ? <p className="text-sm text-pg-muted">No critical findings in the latest scan.</p> : (
        <ul className="space-y-1.5">
          {critical.slice(0, 7).map((f) => (
            <li key={f.uid}>
              <button onClick={() => nav(`/findings?f=${encodeURIComponent(f.uid)}`)} data-testid={`critical-finding-${f.index}`}
                className="w-full grid grid-cols-[84px_1fr] items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-pg-surface2/50 transition-colors">
                <SeverityBadge value={f.advisory_severity && f.category === "Dependency vulnerability" ? f.advisory_severity : f.severity} />
                <div className="min-w-0">
                  <p className="text-sm truncate">{f.advisory_id ? `${f.advisory_id} · ${f.rule}` : f.rule}</p>
                  <p className="text-xs text-pg-muted font-mono truncate">{location(f)}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
