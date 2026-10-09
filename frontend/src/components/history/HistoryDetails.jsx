import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useApp } from "@/context/AppContext";
import { KV, Note } from "@/components/common/Panel";
import { StatusPill } from "@/components/common/Badges";
import ReportPreview from "@/components/reports/ReportPreview";
import { basename, fmtDate, fmtDuration } from "@/lib/format";

export default function HistoryDetails({ entry: h, onClose }) {
  const { openScan } = useApp();
  const nav = useNavigate();
  const [preview, setPreview] = useState(null);
  const view = async (path) => { await openScan(h.scan_id); onClose(); nav(path); };
  return (
    <>
      <Sheet open={Boolean(h)} onOpenChange={(o) => !o && onClose()}>
        <SheetContent className="w-[460px] sm:max-w-[460px] bg-pg-surface border-pg-line overflow-y-auto pg-scroll" data-testid="history-details-sheet">
          {h && (
            <>
              <SheetHeader><SheetTitle>{basename(h.project)}</SheetTitle><SheetDescription className="font-mono text-xs break-all">{h.project}</SheetDescription></SheetHeader>
              <div className="mt-5 flex items-center gap-3"><StatusPill status={h.status} large /><span className="text-2xl font-semibold tabular-nums">{h.score}<span className="text-sm text-pg-muted">/100</span></span></div>
              <dl className="mt-5">
                <KV label="Date">{fmtDate(h.timestamp)}</KV>
                <KV label="Profile">{h.profile || "Not recorded"}</KV>
                <KV label="Findings" mono>{h.findings}</KV>
                <KV label="Duration" mono>{fmtDuration(h.duration_ms)}</KV>
                <KV label="Files" mono>{h.files ?? "Not reported"}</KV>
                <KV label="OSV lookup">{h.online == null ? "Not recorded" : h.online ? "Online" : "Offline"}</KV>
                <KV label="Dependency check">{h.dependency_check_complete == null ? "Not recorded" : h.dependency_check_complete ? "Complete" : "Incomplete"}</KV>
              </dl>
              {h.scan_id ? (
                <div className="flex gap-2 mt-5">
                  <Button size="sm" onClick={() => view("/findings")} data-testid="history-view-findings-btn">View findings</Button>
                  <Button size="sm" variant="outline" onClick={() => view("/dependencies")} data-testid="history-view-deps-btn">View dependencies</Button>
                </div>
              ) : <div className="mt-5"><Note>This entry was recorded by the Tk desktop, which stores summary fields only. Detailed findings are unavailable.</Note></div>}
              <h3 className="text-xs text-pg-muted mt-6 mb-2">Associated reports</h3>
              {h.reports?.length ? (
                <ul className="space-y-1">{h.reports.map((r) => (
                  <li key={r}><button className="text-left text-xs font-mono text-pg-accent hover:underline break-all" onClick={() => setPreview(r)} data-testid="history-report-link">{basename(r)}</button></li>
                ))}</ul>
              ) : <p className="text-sm text-pg-muted">No reports exported for this scan.</p>}
            </>
          )}
        </SheetContent>
      </Sheet>
      <ReportPreview path={preview} onClose={() => setPreview(null)} />
    </>
  );
}
