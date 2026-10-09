import { useCallback, useEffect, useState } from "react";
import { Copy, Eye, FileText, FolderOpen, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";
import { copyText, isDesktop, openPath } from "@/lib/desktop";
import { EmptyState, InlineError, PageHeader, Panel } from "@/components/common/Panel";
import { StatusPill } from "@/components/common/Badges";
import ReportPreview from "@/components/reports/ReportPreview";
import { basename, fmtBytes, fmtDate } from "@/lib/format";

const FORMATS = [
  { id: "html", label: "HTML", desc: "Readable report with advisory details" },
  { id: "json", label: "JSON", desc: "Full machine-readable engine report" },
  { id: "sarif", label: "SARIF 2.1.0", desc: "Code-scanning integrations" },
];

export default function Reports() {
  const { latest, settings, refreshData } = useApp();
  const [format, setFormat] = useState(settings?.preferred_format || "html");
  const [dir, setDir] = useState(settings?.effective_export_dir || "");
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);

  const loadList = useCallback(async (d) => {
    try { setList(await api.reports(d || undefined)); } catch (e) { setList(null); setError(e.message); }
  }, []);
  useEffect(() => { loadList(settings?.effective_export_dir); }, [loadList, settings]);

  const exportNow = async () => {
    setBusy(true); setError(null);
    try {
      const r = await api.exportReport({ scan_id: latest.scan_id, format, directory: dir || null });
      toast.success(`Report written: ${basename(r.path)}`);
      await Promise.all([loadList(dir), refreshData()]);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const openFolder = async () => { if (!(await openPath(list.directory))) toast.error("Opening folders requires the desktop shell"); };

  return (
    <>
      <PageHeader title="Reports" description="Export Cerberus engine reports as HTML, JSON or SARIF." />
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-5 flex flex-col gap-4">
          <Panel title="Latest scan" testId="reports-latest-panel">
            {latest ? (
              <div className="flex items-center gap-4" data-testid="reports-latest-summary">
                <StatusPill status={latest.status} large />
                <div className="text-sm"><p>{basename(latest.meta.project)} · score {latest.score}/100</p><p className="text-xs text-pg-muted">{fmtDate(latest.scanned_at)} · {latest.summary.total_findings} findings</p></div>
              </div>
            ) : <p className="text-sm text-pg-muted" data-testid="reports-no-scan">Run a scan before exporting a report.</p>}
          </Panel>
          <Panel title="Export" testId="reports-export-panel">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" role="radiogroup" aria-label="Report format">
              {FORMATS.map((f) => (
                <button key={f.id} role="radio" aria-checked={format === f.id} onClick={() => setFormat(f.id)} data-testid={`reports-format-${f.id}`}
                  className={`rounded-xl border p-3 text-left transition-colors ${format === f.id ? "border-pg-accent/60 bg-pg-accent/[0.06]" : "border-pg-line hover:bg-pg-surface2/50"}`}>
                  <p className="text-sm font-semibold">{f.label}</p><p className="text-[11px] text-pg-muted mt-1 leading-snug">{f.desc}</p>
                </button>
              ))}
            </div>
            <Label htmlFor="export-dir" className="text-xs text-pg-muted mt-4 block">Destination folder</Label>
            <Input id="export-dir" value={dir} onChange={(e) => setDir(e.target.value)} className="mt-1.5 font-mono text-xs bg-pg-bg" data-testid="reports-destination-input" />
            <div className="mt-3"><InlineError message={error} testId="reports-error" /></div>
            <Button className="w-full mt-3" onClick={exportNow} disabled={!latest || busy || !dir} data-testid="reports-export-btn">
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />} Generate {format.toUpperCase()} report
            </Button>
            <p className="text-[11px] text-pg-muted mt-2">PDF export is not implemented by the engine.</p>
          </Panel>
        </div>
        <Panel title="Existing reports" className="xl:col-span-7" testId="reports-list-panel"
          description={list ? list.directory : undefined}
          actions={<>
            <Button size="sm" variant="ghost" onClick={() => loadList(dir)} data-testid="reports-refresh-btn"><RefreshCw className="h-3.5 w-3.5" /></Button>
            {list && (isDesktop()
              ? <Button size="sm" variant="outline" onClick={openFolder} data-testid="reports-open-folder-btn"><FolderOpen className="h-3.5 w-3.5 mr-1.5" />Open folder</Button>
              : <Button size="sm" variant="outline" onClick={async () => toast[(await copyText(list.directory)) ? "success" : "error"]("Folder path copied")} data-testid="reports-copy-folder-btn"><Copy className="h-3.5 w-3.5 mr-1.5" />Copy folder path</Button>)}
          </>}>
          {!list?.files.length ? <EmptyState compact icon={FileText} title="No reports in this folder" description="Generated Cerberus reports will be listed here." testId="reports-empty" /> : (
            <ul className="divide-y divide-pg-line/40" data-testid="reports-file-list">
              {list.files.map((f, i) => (
                <li key={f.path} className="flex items-center gap-3 py-2.5" data-testid={`reports-file-${i}`}>
                  <span className="font-mono text-[10px] uppercase rounded border border-pg-line px-1.5 py-0.5 text-pg-muted w-12 text-center">{f.format}</span>
                  <div className="min-w-0 flex-1"><p className="text-sm truncate">{f.name}</p><p className="text-xs text-pg-muted">{fmtDate(f.modified)} · {fmtBytes(f.size)}</p></div>
                  <Button size="sm" variant="ghost" onClick={() => setPreview(f.path)} data-testid={`reports-preview-btn-${i}`}><Eye className="h-3.5 w-3.5 mr-1.5" />Open</Button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      <ReportPreview path={preview} onClose={() => setPreview(null)} />
    </>
  );
}
