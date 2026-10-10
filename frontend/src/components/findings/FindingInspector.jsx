import { useState } from "react";
import { Copy, Eye, EyeOff, Lock, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { copyText } from "@/lib/desktop";
import { InlineError, KV } from "@/components/common/Panel";
import { SeverityBadge } from "@/components/common/Badges";
import AdvisoryDetails from "@/components/deps/AdvisoryDetails";

function Evidence({ finding, scanId }) {
  const [lines, setLines] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  if (finding.category !== "Secret") {
    return <p className="text-xs text-pg-muted">Source preview is not applicable to this finding type.</p>;
  }
  const toggle = async () => {
    if (lines) {
      setLines(null);
      setError(null);
      return;
    }
    setLoading(true);
    try {
      setLines((await api.evidence(scanId, finding.index)).lines);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  const copyMasked = async () => {
    if (!lines) return;
    const text = [`${finding.file}:${finding.line ?? "?"}`, ...lines.map((l) => `${l.number}: ${l.text}`)].join("\n");
    const ok = await copyText(text);
    toast[ok ? "success" : "error"](ok ? "Masked evidence copied" : "Clipboard unavailable");
  };
  return (
    <div>
      <div className="rounded-lg border border-pg-line bg-[#0D1113] font-mono text-[12px] leading-6 overflow-x-auto pg-scroll" data-testid="inspector-evidence">
        <div className="px-3 py-1.5 border-b border-pg-line/60 text-pg-muted text-[11px] flex items-center gap-1.5"><Lock className="h-3 w-3" />{finding.file}:{finding.line ?? "?"}</div>
        {lines ? lines.map((l) => (
          <div key={l.number} className={`flex gap-3 px-3 whitespace-pre ${l.flagged ? "bg-pg-crit/[0.08]" : ""}`}>
            <span className="text-pg-muted/70 select-none w-8 text-right">{l.number}</span><span>{l.text}</span>
          </div>
        )) : (
          <div className="flex gap-3 px-3 py-1 text-pg-muted"><span className="w-8 text-right">{finding.line ?? "?"}</span><span>[source content hidden]</span></div>
        )}
      </div>
      <InlineError message={error} testId="inspector-evidence-error" />
      <Button size="sm" variant="outline" className="mt-2" onClick={toggle} disabled={loading} aria-pressed={Boolean(lines)} data-testid="inspector-reveal-masked-btn">
        {lines ? <EyeOff className="h-3.5 w-3.5 mr-1.5" /> : <Eye className="h-3.5 w-3.5 mr-1.5" />}
        {lines ? "Hide masked context" : "Show masked context"}
      </Button>
      {lines && <Button size="sm" variant="outline" className="mt-2 ml-2" onClick={copyMasked} data-testid="inspector-copy-masked-btn"><Copy className="h-3.5 w-3.5 mr-1.5" />Copy masked content</Button>}
      <p className="text-[11px] text-pg-muted mt-2 leading-relaxed">Credentials are redacted inside the local engine bridge before display. Raw secret values are never sent to the interface.</p>
    </div>
  );
}

export default function FindingInspector({ finding: f, scanId, onClose }) {
  const copy = async () => {
    const text = [`Rule: ${f.rule}`, `Severity: ${f.severity}`, f.file && `Location: ${f.file}:${f.line ?? "?"}`, f.package && `Package: ${f.package} ${f.version || ""}`, f.advisory_id && `Advisory: ${f.advisory_id}`].filter(Boolean).join("\n");
    const ok = await copyText(text);
    toast[ok ? "success" : "error"](ok ? "Finding metadata copied (no secret values)" : "Clipboard unavailable");
  };
  return (
    <aside className="pg-panel w-[440px] shrink-0 flex flex-col min-h-0" data-testid="finding-inspector">
      <header className="px-5 pt-4 pb-3 border-b border-pg-line/60">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <SeverityBadge value={f.severity} testId="inspector-severity" />
            {f.advisory_severity && f.category === "Dependency vulnerability" && <span className="text-xs text-pg-muted">advisory: <SeverityBadge value={f.advisory_severity} /></span>}
          </div>
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={copy} aria-label="Copy metadata" data-testid="inspector-copy-btn"><Copy className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onClose} aria-label="Close inspector" data-testid="inspector-close-btn"><X className="h-4 w-4" /></Button>
          </div>
        </div>
        <h2 className="mt-3 text-base font-semibold leading-snug" data-testid="inspector-title">{f.advisory_id ? `${f.advisory_id}: ${f.summary || f.rule}` : f.rule}</h2>
      </header>
      <div className="flex-1 overflow-y-auto pg-scroll px-5 py-4 space-y-5">
        <dl>
          <KV label="Rule" testId="inspector-rule">{f.rule}</KV>
          <KV label="Category">{f.category}</KV>
          {f.confidence && <KV label="Confidence">{f.confidence}</KV>}
          {f.file && <KV label="File" mono testId="inspector-file">{f.file}</KV>}
          {f.line && <KV label="Line" mono testId="inspector-line">{f.line}</KV>}
          {f.package && <KV label="Package" mono>{f.package}{f.version ? ` @ ${f.version}` : ""}</KV>}
          <KV label="Status">{f.status}</KV>
        </dl>
        {(f.details || (f.summary && !f.advisory_id)) && (
          <section><h3 className="text-xs text-pg-muted mb-1.5">Description</h3><p className="text-sm leading-relaxed" data-testid="inspector-description">{f.details || f.summary}</p></section>
        )}
        <section><h3 className="text-xs text-pg-muted mb-1.5">Security impact</h3><p className="text-sm leading-relaxed" data-testid="inspector-impact">{f.impact}</p></section>
        {f.remediation && (
          <section>
            <h3 className="text-xs text-pg-muted mb-1.5">Recommended remediation {f.remediation_source === "guidance" && <span className="text-pg-muted/70">(general guidance)</span>}</h3>
            <p className="text-sm leading-relaxed" data-testid="inspector-remediation">{f.remediation}</p>
          </section>
        )}
        {f.advisory_id && <AdvisoryDetails advisory={f} />}
        <section><h3 className="text-xs text-pg-muted mb-1.5">Evidence preview</h3><Evidence key={`${scanId}:${f.index}`} finding={f} scanId={scanId} /></section>
      </div>
    </aside>
  );
}
