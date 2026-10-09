import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { InlineError, Note, Panel } from "@/components/common/Panel";

const lines = (t) => t.split("\n").map((s) => s.trim()).filter(Boolean);

function buildConfig(f) {
  const cfg = {
    ignored_directories: lines(f.ignored), max_file_size: Number(f.max_file_size), fail_on_warning: f.fail_on_warning,
    allowlist: f.allowlist.map((a) => ({ rule: a.rule.trim(), file: a.file.trim(), ...(a.line ? { line: Number(a.line) } : {}) })),
    minimum_score: Number(f.minimum_score), blocked_rules: lines(f.blocked),
    block_advisory_severity: f.block === "none" ? null : f.block,
  };
  return cfg;
}

const fromEffective = (e) => ({
  ignored: e.ignored_directories.join("\n"), max_file_size: e.max_file_size, fail_on_warning: e.fail_on_warning,
  allowlist: e.allowlist.map((a) => ({ rule: a.rule, file: a.file, line: a.line ?? "" })), minimum_score: e.minimum_score,
  blocked: e.blocked_rules.join("\n"), block: e.block_advisory_severity || "none",
});

export default function EngineConfigEditor({ defaultPath }) {
  const [path, setPath] = useState(defaultPath || "");
  const [form, setForm] = useState(null);
  const [exists, setExists] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const load = async (p) => {
    setError(null);
    try {
      const r = await api.engineConfig(p || undefined);
      setForm(fromEffective(r.effective));
      setExists(r.exists);
    } catch (e) { setError(e.message); }
  };
  useEffect(() => { load(defaultPath); }, [defaultPath]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    setBusy(true); setError(null);
    try {
      await api.saveEngineConfig(path, buildConfig(form));
      setExists(true);
      toast.success("Configuration saved and validated by the engine");
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  if (!form) return <Panel title="Scan engine configuration"><InlineError message={error} /></Panel>;
  const allow = form.allowlist;
  return (
    <Panel title="Scan engine configuration" description="Edits the seven keys accepted by pipelineguard/config.py. The engine validates every save." testId="settings-engine-panel">
      <Label htmlFor="cfg-path" className="text-xs text-pg-muted">Configuration file (.json)</Label>
      <div className="flex gap-2 mt-1.5">
        <Input id="cfg-path" value={path} onChange={(e) => setPath(e.target.value)} placeholder="/path/to/project/.pipelineguard.json" className="font-mono text-xs bg-pg-bg" data-testid="settings-config-path-input" />
        <Button variant="outline" onClick={() => load(path)} disabled={!path} data-testid="settings-config-load-btn">Load</Button>
      </div>
      <p className="text-xs text-pg-muted mt-1.5" data-testid="settings-config-state">{!path ? "No file selected — showing engine defaults." : exists ? "Loaded existing file." : "File does not exist yet — saving will create it with these values."}</p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
        <div>
          <Label className="text-xs text-pg-muted">Ignored directories (one per line — replaces defaults)</Label>
          <Textarea rows={6} value={form.ignored} onChange={(e) => set({ ignored: e.target.value })} className="mt-1.5 font-mono text-xs bg-pg-bg" data-testid="settings-ignored-dirs-input" />
        </div>
        <div>
          <Label className="text-xs text-pg-muted">Blocked rules (exact rule names, one per line)</Label>
          <Textarea rows={6} value={form.blocked} onChange={(e) => set({ blocked: e.target.value })} placeholder="Generic secret assignment" className="mt-1.5 font-mono text-xs bg-pg-bg" data-testid="settings-blocked-rules-input" />
        </div>
        <div>
          <Label htmlFor="cfg-size" className="text-xs text-pg-muted">Max file size (bytes)</Label>
          <Input id="cfg-size" type="number" min={1} value={form.max_file_size} onChange={(e) => set({ max_file_size: e.target.value })} className="mt-1.5 font-mono bg-pg-bg" data-testid="settings-max-file-size-input" />
        </div>
        <div>
          <Label htmlFor="cfg-score" className="text-xs text-pg-muted">Minimum score (0–100, blocks below)</Label>
          <Input id="cfg-score" type="number" min={0} max={100} value={form.minimum_score} onChange={(e) => set({ minimum_score: e.target.value })} className="mt-1.5 font-mono bg-pg-bg" data-testid="settings-min-score-input" />
        </div>
        <div>
          <Label className="text-xs text-pg-muted">Block advisories at or above</Label>
          <Select value={form.block} onValueChange={(v) => set({ block: v })}>
            <SelectTrigger className="mt-1.5 bg-pg-bg" data-testid="settings-advisory-gate-select"><SelectValue /></SelectTrigger>
            <SelectContent>{["none", "LOW", "MODERATE", "HIGH", "CRITICAL"].map((v) => <SelectItem key={v} value={v}>{v === "none" ? "Disabled (null)" : v}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-pg-line/70 px-3 py-2.5 self-end">
          <div><Label htmlFor="cfg-fow" className="text-sm">Fail on warning</Label><p className="text-xs text-pg-muted">Blocks release on WARNING, incl. incomplete checks</p></div>
          <Switch id="cfg-fow" checked={form.fail_on_warning} onCheckedChange={(v) => set({ fail_on_warning: v })} data-testid="settings-fail-on-warning-switch" />
        </div>
      </div>
      <div className="mt-5">
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs text-pg-muted">Allowlist (rule + file glob, optional line)</Label>
          <Button size="sm" variant="ghost" onClick={() => set({ allowlist: [...allow, { rule: "", file: "", line: "" }] })} data-testid="settings-allowlist-add-btn"><Plus className="h-3.5 w-3.5 mr-1" />Add entry</Button>
        </div>
        {allow.length === 0 && <p className="text-xs text-pg-muted">No allowlist entries.</p>}
        {allow.map((a, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_90px_36px] gap-2 mb-2" data-testid={`settings-allowlist-row-${i}`}>
            {["rule", "file", "line"].map((k) => (
              <Input key={k} value={a[k]} placeholder={k === "file" ? "tests/fixtures/*" : k} type={k === "line" ? "number" : "text"}
                onChange={(e) => set({ allowlist: allow.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)) })} className="font-mono text-xs bg-pg-bg" data-testid={`settings-allowlist-${k}-${i}`} />
            ))}
            <Button size="icon" variant="ghost" onClick={() => set({ allowlist: allow.filter((_, j) => j !== i) })} aria-label="Remove entry" data-testid={`settings-allowlist-remove-${i}`}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        <Note>Never allowlist genuine credentials. Omitting the line suppresses all matching lines for that rule and file pattern.</Note>
      </div>
      <div className="mt-4 space-y-3">
        <InlineError message={error} testId="settings-config-error" />
        <Button onClick={save} disabled={!path || busy} data-testid="settings-config-save-btn">{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save configuration file</Button>
      </div>
    </Panel>
  );
}
