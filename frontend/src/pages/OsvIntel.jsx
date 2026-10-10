import { useState } from "react";
import { Globe2, Loader2, Search, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";
import { EmptyState, InlineError, Note, PageHeader, Panel } from "@/components/common/Panel";
import { SeverityBadge } from "@/components/common/Badges";
import AdvisoryDetails from "@/components/deps/AdvisoryDetails";
import { fmtDate } from "@/lib/format";

export default function OsvIntel() {
  const { osvOnline, setOsvOnline, latest } = useApp();
  const [form, setForm] = useState({ name: "", version: "", ecosystem: "PyPI" });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [lookupEnabled, setLookupEnabled] = useState(false);
  const pinned = (latest?.dependencies.packages || []).filter((p) => p.version).slice(0, 12);

  const check = async () => {
    setChecking(true);
    try { setOsvOnline((await api.osvConnectivity()).online); } finally { setChecking(false); }
  };
  const lookup = async (e, override) => {
    e?.preventDefault();
    if (!lookupEnabled) { setError("Enable online OSV lookups first."); return; }
    const body = override || form;
    setBusy(true); setError(null);
    try { setResult(await api.osvQuery(body)); } catch (err) { setError(err.message); setResult(null); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="OSV Intelligence" description="Look up published advisories for a single package version using the engine's OSV client." />
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-4 flex flex-col gap-4">
          <Panel title="Connectivity" testId="osv-connectivity-panel">
            <div className="flex items-center justify-between">
              <span className="text-sm flex items-center gap-2" data-testid="osv-connectivity-status">
                <Wifi className={`h-4 w-4 ${osvOnline ? "text-pg-accent" : osvOnline === false ? "text-pg-crit" : "text-pg-muted"}`} />
                {osvOnline == null ? "Not checked" : osvOnline ? "api.osv.dev reachable" : "api.osv.dev unreachable"}
              </span>
              <Button size="sm" variant="outline" onClick={check} disabled={checking} data-testid="osv-check-connectivity-btn">{checking ? "Checking…" : "Check"}</Button>
            </div>
            <p className="text-xs text-pg-muted mt-3 leading-relaxed">Connectivity is only checked when you ask. No background requests are made.</p>
          </Panel>
          <Panel title="Online OSV permission"><div className="flex items-center justify-between gap-3"><div><Label htmlFor="osv-permission">Allow manual OSV lookups</Label><p className="text-xs text-pg-muted mt-1">Off by default. Connectivity checks do not enable lookups. Scan permissions are separate.</p></div><Switch id="osv-permission" checked={lookupEnabled} onCheckedChange={setLookupEnabled} data-testid="osv-permission-toggle" /></div></Panel>
          <Panel title="Package lookup" testId="osv-lookup-panel">
            <form onSubmit={lookup} className="space-y-3">
              <div><Label className="text-xs text-pg-muted">Ecosystem</Label>
                <Select value={form.ecosystem} onValueChange={(v) => setForm({ ...form, ecosystem: v })}>
                  <SelectTrigger className="mt-1.5 bg-pg-bg" data-testid="osv-ecosystem-select"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="PyPI">PyPI (Python)</SelectItem><SelectItem value="npm">npm (Node.js)</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label htmlFor="osv-name" className="text-xs text-pg-muted">Package name</Label>
                <Input id="osv-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. requests" className="mt-1.5 bg-pg-bg font-mono text-sm" data-testid="osv-name-input" /></div>
              <div><Label htmlFor="osv-version" className="text-xs text-pg-muted">Exact version</Label>
                <Input id="osv-version" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} placeholder="e.g. 2.19.0" className="mt-1.5 bg-pg-bg font-mono text-sm" data-testid="osv-version-input" /></div>
              <Button type="submit" className="w-full" disabled={!lookupEnabled || busy || !form.name || !form.version} data-testid="osv-lookup-btn">
                {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />} Look up advisories
              </Button>
              <Note testId="osv-privacy-note">Only the package name, version and ecosystem are sent to api.osv.dev, followed by advisory-detail requests for returned IDs.</Note>
            </form>
          </Panel>
          {pinned.length > 0 && (
            <Panel title="From latest inventory" description="Pinned versions only" testId="osv-inventory-shortcuts">
              <div className="flex flex-wrap gap-1.5">
                {pinned.map((p) => (
                  <button key={p.uid} disabled={!lookupEnabled || busy} onClick={() => { const b = { name: p.name, version: p.version, ecosystem: p.ecosystem }; setForm(b); lookup(null, b); }}
                    className="rounded-md border border-pg-line px-2 py-1 font-mono text-[11px] hover:border-pg-accent/50 hover:text-pg-accent transition-colors" data-testid={`osv-shortcut-${p.name}`}>
                    {p.name}@{p.version}
                  </button>
                ))}
              </div>
            </Panel>
          )}
        </div>
        <div className="xl:col-span-8">
          <Panel title="Advisory results" testId="osv-results-panel"
            description={result ? `${result.query.ecosystem} ${result.query.name}@${result.query.version} · ${fmtDate(result.queried_at)}` : undefined}>
            <InlineError message={error} testId="osv-error" />
            {!result && !error && <EmptyState compact icon={Globe2} title="No lookup yet" description="Results from OSV.dev appear here exactly as returned. Nothing is cached or inferred." testId="osv-empty" />}
            {result && (
              <div className="space-y-3">
                {result.notices.map((n) => <Note key={n.uid} tone="warn" testId="osv-incomplete-notice">Incomplete: {n.summary}{n.advisory_id ? ` (${n.advisory_id})` : ""}</Note>)}
                {result.complete && result.advisories.length === 0 && <p className="text-sm" data-testid="osv-no-advisories">OSV returned no advisories for this exact version. This is not a guarantee that the package is safe.</p>}
                {result.advisories.map((a) => (
                  <article key={a.uid} className="rounded-xl border border-pg-line/70 bg-pg-bg/40 p-4" data-testid={`osv-advisory-${a.advisory_id}`}>
                    <div className="flex items-center gap-2 mb-2"><SeverityBadge value={a.advisory_severity} /><span className="font-mono text-sm">{a.advisory_id}</span></div>
                    {a.summary && <p className="text-sm leading-relaxed mb-3">{a.summary}</p>}
                    <AdvisoryDetails advisory={a} />
                  </article>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
