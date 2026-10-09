import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";
import { InlineError, KV, Note, PageHeader, Panel } from "@/components/common/Panel";
import EngineConfigEditor from "@/components/settings/EngineConfigEditor";

const Field = ({ label, hint, children }) => (
  <div className="py-3 border-b border-pg-line/40 last:border-0 grid grid-cols-1 md:grid-cols-[260px_1fr] gap-3 items-center">
    <div><p className="text-sm">{label}</p>{hint && <p className="text-xs text-pg-muted mt-0.5 leading-relaxed">{hint}</p>}</div>
    <div className="min-w-0">{children}</div>
  </div>
);

const Pick = ({ value, onChange, options, testId }) => (
  <Select value={String(value)} onValueChange={onChange}>
    <SelectTrigger className="w-full sm:w-[220px] bg-pg-bg" data-testid={testId}><SelectValue /></SelectTrigger>
    <SelectContent>{options.map(([v, l]) => <SelectItem key={v} value={String(v)}>{l}</SelectItem>)}</SelectContent>
  </Select>
);

function About() {
  const { status, backend } = useApp();
  const [diag, setDiag] = useState(null);
  useEffect(() => { api.diagnostics().then(setDiag).catch(() => {}); }, []);
  return (
    <Panel title="About Cerberus" testId="settings-about-panel">
      <dl>
        <KV label="Application" testId="about-version">Cerberus {status?.app_version} (v2.0 development, unreleased)</KV>
        <KV label="Engine" mono>{status?.engine_version} · {status?.engine_path}</KV>
        <KV label="Stable release">v1.0.0</KV>
        <KV label="License">No LICENSE file is present in the repository; license not specified.</KV>
        <KV label="Repository"><a href="https://github.com/ibrahim1101/PipelineGuard" target="_blank" rel="noopener noreferrer" className="text-pg-accent hover:underline" data-testid="about-repo-link">github.com/ibrahim1101/PipelineGuard</a></KV>
        <KV label="Engine bridge" testId="about-backend-status">{backend}</KV>
        <KV label="Data folder" mono>{diag?.data_dir}</KV>
        <KV label="Python" mono>{diag?.python}</KV>
        <KV label="Platform" mono>{diag?.platform}</KV>
        <KV label="History entries" mono>{diag?.history_entries}</KV>
      </dl>
    </Panel>
  );
}

export default function Settings() {
  const { settings, setSettings, profiles } = useApp();
  const [form, setForm] = useState(settings);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setForm(settings), [settings]);
  if (!form) return null;
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const dirty = JSON.stringify(form) !== JSON.stringify(settings);

  const save = async () => {
    setBusy(true); setError(null);
    try {
      const { effective_export_dir, ...body } = form;
      const clean = Object.fromEntries(Object.entries(body).map(([k, v]) => [k, v === "" ? null : v]));
      setSettings(await api.saveSettings(clean));
      toast.success("Settings saved");
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const saveBar = (
    <div className="flex items-center gap-3 mt-4">
      <Button onClick={save} disabled={!dirty || busy} data-testid="settings-save-btn">{busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}Save preferences</Button>
      {dirty && <span className="text-xs text-pg-warn" data-testid="settings-unsaved">Unsaved changes</span>}
      <div className="flex-1"><InlineError message={error} testId="settings-error" /></div>
    </div>
  );

  return (
    <>
      <PageHeader title="Settings" description="Preferences are stored locally in the Cerberus local data folder. Policy settings live in your JSON configuration file." />
      <Tabs defaultValue="general">
        <div className="overflow-x-auto pg-scroll mb-4"><TabsList className="bg-pg-surface border border-pg-line w-max min-w-full" data-testid="settings-tabs">
          {[["general", "General"], ["engine", "Scan Engine"], ["intel", "Vulnerability Intelligence"], ["appearance", "Appearance"], ["reports", "Reports"], ["about", "About"]].map(([v, l]) => (
            <TabsTrigger key={v} value={v} className="data-[state=active]:bg-pg-surface2" data-testid={`settings-tab-${v}`}>{l}</TabsTrigger>
          ))}
        </TabsList></div>
        <TabsContent value="general">
          <Panel title="General" testId="settings-general-panel">
            <Field label="Default scan profile"><Pick value={form.default_profile} onChange={(v) => set({ default_profile: v })} options={profiles.map((p) => [p.name, p.name[0].toUpperCase() + p.name.slice(1)])} testId="settings-default-profile-select" /></Field>
            <Field label="Default project folder" hint="Pre-selected at startup."><Input value={form.default_project || ""} onChange={(e) => set({ default_project: e.target.value })} className="font-mono text-xs bg-pg-bg" data-testid="settings-default-project-input" /></Field>
            <Field label="Default configuration file" hint="Optional JSON policy used for new scans."><Input value={form.default_config || ""} onChange={(e) => set({ default_config: e.target.value })} className="font-mono text-xs bg-pg-bg" data-testid="settings-default-config-input" /></Field>
            {saveBar}
          </Panel>
        </TabsContent>
        <TabsContent value="engine"><EngineConfigEditor defaultPath={settings.default_config} /></TabsContent>
        <TabsContent value="intel">
          <Panel title="Vulnerability intelligence" testId="settings-intel-panel">
            <Field label="Enable live OSV lookup by default" hint="You can still change it per scan."><Switch checked={form.online_default} onCheckedChange={(v) => set({ online_default: v })} data-testid="settings-online-default-switch" /></Field>
            <div className="mt-3 space-y-2">
              <Note>Data sent online: package name, exact version and ecosystem (PyPI or npm) to api.osv.dev, plus advisory IDs to fetch details. Source code, file paths and findings are never sent.</Note>
              <Note tone="warn">Offline behaviour: dependencies are inventoried but not checked. The engine marks the dependency check incomplete, which yields at least a WARNING and can block release when fail_on_warning is set.</Note>
            </div>
            {saveBar}
          </Panel>
        </TabsContent>
        <TabsContent value="appearance">
          <Panel title="Appearance" testId="settings-appearance-panel">
            <Field label="Theme" hint="Premium Dark Titanium is the only theme."><span className="text-sm text-pg-muted">Premium Dark Titanium</span></Field>
            <Field label="Text size"><Pick value={form.text_scale} onChange={(v) => set({ text_scale: Number(v) })} options={[[90, "90%"], [100, "100%"], [110, "110%"], [120, "120%"]]} testId="settings-text-scale-select" /></Field>
            <Field label="Density"><Pick value={form.density} onChange={(v) => set({ density: v })} options={[["comfortable", "Comfortable"], ["compact", "Compact"]]} testId="settings-density-select" /></Field>
            <Field label="Reduced motion" hint="Disables page transitions and animations."><Switch checked={form.reduced_motion} onCheckedChange={(v) => set({ reduced_motion: v })} data-testid="settings-reduced-motion-switch" /></Field>
            {saveBar}
          </Panel>
        </TabsContent>
        <TabsContent value="reports">
          <Panel title="Reports" testId="settings-reports-panel">
            <Field label="Default export folder" hint={`Currently: ${settings.effective_export_dir}`}><Input value={form.export_dir || ""} placeholder="Leave blank for the data folder" onChange={(e) => set({ export_dir: e.target.value })} className="font-mono text-xs bg-pg-bg" data-testid="settings-export-dir-input" /></Field>
            <Field label="Preferred format"><Pick value={form.preferred_format} onChange={(v) => set({ preferred_format: v })} options={[["html", "HTML"], ["json", "JSON"], ["sarif", "SARIF"]]} testId="settings-preferred-format-select" /></Field>
            {saveBar}
          </Panel>
        </TabsContent>
        <TabsContent value="about"><About /></TabsContent>
      </Tabs>
      <Label className="sr-only">settings</Label>
    </>
  );
}
