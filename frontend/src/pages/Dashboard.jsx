import { useNavigate } from "react-router-dom";
import { Activity, Clock, FileSearch, Package, Radar, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/context/AppContext";
import { EmptyState, PageHeader, Panel } from "@/components/common/Panel";
import { MetricCard, ScoreRing } from "@/components/common/MetricCard";
import { StatusPill } from "@/components/common/Badges";
import { fmtDuration, basename } from "@/lib/format";
import { CategoryChart, DependencyRisk, HistoryTrend, SeverityChart } from "@/components/dashboard/Charts";
import { ActivityFeed, CriticalPreview, RecentScans } from "@/components/dashboard/Lists";

export default function Dashboard() {
  const { latest, latestLoaded, history, activity } = useApp();
  const nav = useNavigate();
  const header = <PageHeader title="Security Command Center" description="Summary of the most recent Cerberus scan. Every figure below comes from the local engine." />;

  if (!latestLoaded) return <>{header}<div className="grid grid-cols-3 xl:grid-cols-6 gap-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="pg-panel h-[124px] animate-pulse" />)}</div></>;
  if (!latest) {
    return (
      <>
        {header}
        <div className="pg-panel">
          <EmptyState icon={Radar} title="No scan results yet" testId="dashboard-empty"
            description="Select a local project and run a scan. Cerberus will summarize secrets, dependency risk and release readiness here."
            action={<Button onClick={() => nav("/scan")} data-testid="dashboard-start-scan-btn">Go to Scan Project</Button>} />
        </div>
        {activity.length > 0 && <div className="mt-6"><ActivityFeed items={activity} /></div>}
      </>
    );
  }
  const s = latest.summary;
  const deps = latest.dependencies.insights;
  return (
    <>
      <PageHeader title="Security Command Center"
        description={`Latest scan of ${basename(latest.meta.project)} · ${latest.scan_profile || "default"} profile`} />
      <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-4" data-testid="dashboard-metrics">
        <MetricCard label="Security score" testId="metric-score">
          <div className="flex items-center gap-4">
            <ScoreRing score={latest.score} status={latest.status} />
            <div className="text-3xl font-semibold tabular-nums" data-testid="metric-score-value">{latest.score}<span className="text-base text-pg-muted">/100</span></div>
          </div>
        </MetricCard>
        <MetricCard label="Release status" icon={ShieldCheck} testId="metric-status"
          sub={latest.policy_blocked ? "Blocked by configured policy" : "Engine release decision"}>
          <StatusPill status={latest.status} large testId="metric-status-value" />
        </MetricCard>
        <MetricCard label="Total findings" icon={ShieldAlert} value={s.total_findings} testId="metric-findings"
          sub={<span><span className="text-pg-crit">{s.critical} critical</span> · <span className="text-pg-warn">{s.warnings} warning</span></span>} />
        <MetricCard label="Scan duration" icon={Clock} value={fmtDuration(latest.meta.duration_ms)} testId="metric-duration" sub="Measured by the engine" />
        <MetricCard label="Files scanned" icon={FileSearch} testId="metric-files"
          value={latest.meta.files_discovered ?? "—"}
          sub={latest.meta.files_discovered == null ? "Not reported for this profile" : "Eligible files discovered"} />
        <MetricCard label="Dependency vulnerabilities" icon={Package} value={deps.advisories} tone={deps.advisories ? "crit" : undefined} testId="metric-dep-vulns"
          sub={deps.mode === "offline" ? "Offline — not checked" : `${deps.vulnerable} vulnerable package${deps.vulnerable === 1 ? "" : "s"}`} />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 mt-4">
        <SeverityChart summary={s} className="xl:col-span-4" />
        <CategoryChart counts={latest.category_counts} className="xl:col-span-4" />
        <DependencyRisk scan={latest} className="xl:col-span-4" />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 mt-4">
        <CriticalPreview findings={latest.findings} className="xl:col-span-5" />
        <RecentScans items={history} className="xl:col-span-4" />
        <div className="xl:col-span-3 flex flex-col gap-4">
          {history.length >= 2 && <HistoryTrend items={history} />}
          <ActivityFeed items={activity} compact />
        </div>
      </div>
      {history.length < 2 && (
        <p className="mt-4 text-xs text-pg-muted flex items-center gap-1.5" data-testid="dashboard-trend-note">
          <Activity className="h-3.5 w-3.5" /> A score trend appears once two or more scans are stored in local history.
        </p>
      )}
    </>
  );
}

export { Panel };
