import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GitCompare, History as HistoryIcon, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";
import { EmptyState, PageHeader, Panel } from "@/components/common/Panel";
import { StatusPill } from "@/components/common/Badges";
import HistoryDetails from "@/components/history/HistoryDetails";
import CompareDialog from "@/components/history/CompareDialog";
import { basename, fmtDate, fmtDuration } from "@/lib/format";

export default function History() {
  const { history, refreshData } = useApp();
  const nav = useNavigate();
  const [qText, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [picked, setPicked] = useState([]);
  const [detail, setDetail] = useState(null);
  const [compare, setCompare] = useState(null);

  const rows = useMemo(() => history.filter((h) => (status === "all" || h.status === status) && (!qText || (h.project || "").toLowerCase().includes(qText.toLowerCase()))), [history, qText, status]);
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id].slice(-2)));
  const runCompare = () => {
    const [a, b] = picked.map((id) => history.find((h) => h.scan_id === id)).sort((x, y) => new Date(x.timestamp) - new Date(y.timestamp));
    setCompare({ base: a.scan_id, target: b.scan_id });
  };
  const clear = async () => {
    try { await api.clearHistory(); setPicked([]); await refreshData(); toast.success("Scan history cleared"); } catch (e) { toast.error(e.message); }
  };

  return (
    <>
      <PageHeader title="Scan History" description={`Stored locally (last 25 scans, same retention as the engine desktop).`}
        actions={history.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="outline" className="border-pg-crit/40 text-pg-crit hover:bg-pg-crit/10" data-testid="history-clear-btn"><Trash2 className="h-4 w-4 mr-2" />Clear history</Button></AlertDialogTrigger>
            <AlertDialogContent className="bg-pg-surface border-pg-line">
              <AlertDialogHeader><AlertDialogTitle>Clear all scan history?</AlertDialogTitle><AlertDialogDescription>This deletes every stored history entry and scan snapshot on this machine. Exported report files are not deleted.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel data-testid="history-clear-cancel">Cancel</AlertDialogCancel><AlertDialogAction onClick={clear} className="bg-pg-crit text-white hover:bg-pg-crit/90" data-testid="history-clear-confirm">Clear history</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )} />
      {history.length === 0 ? (
        <div className="pg-panel"><EmptyState icon={HistoryIcon} title="No stored scans" description="Completed scans are recorded here automatically." action={<Button onClick={() => nav("/scan")} data-testid="history-go-scan-btn">Start a scan</Button>} testId="history-empty" /></div>
      ) : (
        <Panel testId="history-panel">
          <div className="flex flex-wrap items-center gap-2 pt-4 mb-3">
            <div className="relative w-[260px]"><Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-pg-muted" />
              <Input value={qText} onChange={(e) => setQ(e.target.value)} placeholder="Search projects" className="pl-9 bg-pg-bg" data-testid="history-search-input" /></div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[160px] bg-pg-bg" data-testid="history-status-filter"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="SAFE">SAFE</SelectItem><SelectItem value="WARNING">WARNING</SelectItem><SelectItem value="BLOCKED">BLOCKED</SelectItem></SelectContent>
            </Select>
            <span className="text-xs text-pg-muted ml-2">Select two scans to compare</span>
            <Button className="ml-auto" size="sm" disabled={picked.length !== 2} onClick={runCompare} data-testid="history-compare-btn"><GitCompare className="h-4 w-4 mr-2" />Compare ({picked.length}/2)</Button>
          </div>
          <div className="overflow-x-auto pg-scroll">
            <table className="w-full text-sm" data-testid="history-table">
              <thead><tr className="text-xs text-pg-muted text-left border-b border-pg-line/70">
                <th className="w-10 py-2.5" /><th className="py-2.5 font-normal">Project</th><th className="font-normal">Date & time</th><th className="font-normal">Profile</th><th className="font-normal">Score</th><th className="font-normal">Status</th><th className="font-normal">Findings</th><th className="font-normal">Duration</th>
              </tr></thead>
              <tbody>
                {rows.map((h, i) => (
                  <tr key={`${h.timestamp}-${i}`} onClick={() => setDetail(h)} className="border-b border-pg-line/30 hover:bg-pg-surface2/50 cursor-pointer transition-colors" data-testid={`history-row-${i}`}>
                    <td className="py-2.5" onClick={(e) => e.stopPropagation()}>
                      {h.scan_id && <Checkbox checked={picked.includes(h.scan_id)} onCheckedChange={() => toggle(h.scan_id)} aria-label="Select for comparison" data-testid={`history-select-${i}`} />}
                    </td>
                    <td className="py-2.5"><p>{basename(h.project)}</p><p className="font-mono text-[11px] text-pg-muted truncate max-w-[280px]">{h.project}</p></td>
                    <td className="text-pg-muted">{fmtDate(h.timestamp)}</td>
                    <td className="capitalize">{h.profile || <span className="text-pg-muted">—</span>}</td>
                    <td className="font-mono">{h.score}</td>
                    <td><StatusPill status={h.status} /></td>
                    <td className="font-mono">{h.findings}</td>
                    <td className="font-mono text-pg-muted">{fmtDuration(h.duration_ms)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && <EmptyState compact title="No scans match these filters" testId="history-no-match" />}
          </div>
        </Panel>
      )}
      <HistoryDetails entry={detail} onClose={() => setDetail(null)} />
      <CompareDialog pair={compare} onClose={() => setCompare(null)} />
    </>
  );
}
