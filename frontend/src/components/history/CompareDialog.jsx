import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { InlineError } from "@/components/common/Panel";
import { SeverityBadge } from "@/components/common/Badges";
import { fmtDate, location } from "@/lib/format";

const Stat = ({ label, value, tone, testId }) => (
  <div className="rounded-lg border border-pg-line/70 bg-pg-bg/50 px-3 py-2.5" data-testid={testId}>
    <p className="text-[11px] text-pg-muted">{label}</p><p className={`text-xl font-semibold tabular-nums ${tone || ""}`}>{value}</p>
  </div>
);

export default function CompareDialog({ pair, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    setData(null); setError(null);
    if (pair) api.compare(pair.base, pair.target).then(setData).catch((e) => setError(e.message));
  }, [pair]);
  return (
    <Dialog open={Boolean(pair)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto pg-scroll bg-pg-surface border-pg-line" data-testid="compare-dialog">
        <DialogHeader>
          <DialogTitle>Scan comparison</DialogTitle>
          <DialogDescription>{data ? `${fmtDate(data.base.started_at)} → ${fmtDate(data.target.started_at)} · uses the engine's baseline comparison` : "Comparing…"}</DialogDescription>
        </DialogHeader>
        <InlineError message={error} testId="compare-error" />
        {data && (
          <>
            <div className="grid grid-cols-5 gap-2">
              <Stat label="New" value={data.new} tone={data.new ? "text-pg-crit" : ""} testId="compare-new" />
              <Stat label="Regressed" value={data.regressed} tone={data.regressed ? "text-pg-warn" : ""} testId="compare-regressed" />
              <Stat label="Unchanged" value={data.existing} testId="compare-existing" />
              <Stat label="Fixed" value={data.fixed} tone={data.fixed ? "text-pg-accent" : ""} testId="compare-fixed" />
              <Stat label="Score change" value={`${data.score_delta > 0 ? "+" : ""}${data.score_delta}`} testId="compare-score-delta" />
            </div>
            {data.changed_findings.length > 0 && (
              <section><h3 className="text-xs text-pg-muted mb-2">New & regressed findings</h3>
                <ul className="space-y-1">{data.changed_findings.slice(0, 100).map((f) => (
                  <li key={f.uid} className="flex items-center gap-3 text-sm py-1"><span className="text-[11px] w-16 text-pg-muted">{f.state}</span><SeverityBadge value={f.severity} /><span className="truncate">{f.advisory_id || f.rule}</span><span className="ml-auto font-mono text-xs text-pg-muted truncate">{location(f)}</span></li>
                ))}</ul>
              </section>
            )}
            {data.fixed_findings.length > 0 && (
              <section><h3 className="text-xs text-pg-muted mb-2">Fixed since base scan</h3>
                <ul className="space-y-1">{data.fixed_findings.slice(0, 100).map((f, i) => (
                  <li key={i} className="text-sm flex gap-3"><span className="truncate">{f.id || f.rule}</span><span className="ml-auto font-mono text-xs text-pg-muted truncate">{location(f)}</span></li>
                ))}</ul>
              </section>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
