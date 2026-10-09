import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { basename } from "@/lib/format";
import { InlineError } from "@/components/common/Panel";

const pretty = (text) => {
  try { return JSON.stringify(JSON.parse(text), null, 2); } catch { return text; }
};

/** HTML reports render in a fully sandboxed iframe (no scripts, no same-origin). */
export default function ReportPreview({ path, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    setData(null); setError(null);
    if (path) api.reportContent(path).then(setData).catch((e) => setError(e.message));
  }, [path]);
  return (
    <Dialog open={Boolean(path)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col bg-pg-surface border-pg-line" data-testid="report-preview-dialog">
        <DialogHeader>
          <DialogTitle>{path ? basename(path) : ""}</DialogTitle>
          <DialogDescription className="font-mono text-xs break-all">{path}</DialogDescription>
        </DialogHeader>
        <InlineError message={error} testId="report-preview-error" />
        {data && (data.format === "html" ? (
          <iframe title="Report preview" sandbox="" srcDoc={data.content} className="flex-1 w-full rounded-lg bg-white" data-testid="report-preview-iframe" />
        ) : (
          <pre className="flex-1 overflow-auto pg-scroll rounded-lg bg-[#0D1113] border border-pg-line p-4 text-xs font-mono" data-testid="report-preview-text">{pretty(data.content)}</pre>
        ))}
      </DialogContent>
    </Dialog>
  );
}
