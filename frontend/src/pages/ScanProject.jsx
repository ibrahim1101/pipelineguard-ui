import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, FileJson, FolderOpen, Info, Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useApp } from "@/context/AppContext";
import { api } from "@/lib/api";
import { InlineError, Note, PageHeader, Panel } from "@/components/common/Panel";
import PathPicker from "@/components/common/PathPicker";
import ScanMonitor from "@/components/scan/ScanMonitor";
import ProfilePicker from "@/components/scan/ProfilePicker";

export default function ScanProject() {
  const { selection, setSelection, startScan, running, profiles, status } = useApp();
  const [picker, setPicker] = useState(null);
  const [configMsg, setConfigMsg] = useState(null);
  const [configErr, setConfigErr] = useState(null);
  const [validating, setValidating] = useState(false);
  const profile = profiles.find((p) => p.name === selection.profile);

  const validate = async () => {
    setValidating(true);
    setConfigErr(null);
    setConfigMsg(null);
    try {
      const r = await api.validateConfig(selection.config);
      setConfigMsg(`Valid configuration · min score ${r.config.minimum_score} · ${r.config.blocked_rules.length} blocked rules · advisory gate ${r.config.block_advisory_severity || "off"}`);
    } catch (e) {
      setConfigErr(e.message);
    } finally {
      setValidating(false);
    }
  };

  const go = async () => {
    if (selection.config) {
      try { await api.validateConfig(selection.config); } catch (e) { setConfigErr(e.message); return toast.error("Fix the configuration before scanning"); }
    }
    await startScan();
  };

  return (
    <>
      <PageHeader title="Scan Project" description="Choose a local project, an optional policy configuration and a scan profile. Scans run in the background on this machine." />
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-7 flex flex-col gap-4">
          <Panel title="Project" testId="scan-project-panel">
            <Label htmlFor="project-path" className="text-xs text-pg-muted">Project folder</Label>
            <div className="flex gap-2 mt-1.5">
              <Input id="project-path" value={selection.project} disabled={running} placeholder="Absolute path to a local project folder"
                onChange={(e) => setSelection({ project: e.target.value })} className="font-mono text-xs bg-pg-bg" data-testid="scan-project-path-input" />
              <Button variant="outline" onClick={() => setPicker("dir")} disabled={running} data-testid="scan-browse-project-btn"><FolderOpen className="h-4 w-4 mr-2" />Browse</Button>
            </div>
            {status?.sample_project && selection.project !== status.sample_project && (
              <button className="mt-2 text-xs text-pg-muted hover:text-pg-accent transition-colors" onClick={() => setSelection({ project: status.sample_project })} disabled={running} data-testid="scan-use-sample-btn">
                Use bundled sample project (intentionally insecure, fake credentials)
              </button>
            )}
            <Label htmlFor="config-path" className="text-xs text-pg-muted mt-5 block">Configuration file (optional JSON)</Label>
            <div className="flex gap-2 mt-1.5">
              <Input id="config-path" value={selection.config} disabled={running} placeholder="Leave blank to use engine defaults"
                onChange={(e) => { setSelection({ config: e.target.value }); setConfigMsg(null); setConfigErr(null); }} className="font-mono text-xs bg-pg-bg" data-testid="scan-config-path-input" />
              <Button variant="outline" onClick={() => setPicker("json")} disabled={running} data-testid="scan-browse-config-btn"><FileJson className="h-4 w-4 mr-2" />Choose</Button>
              <Button variant="outline" onClick={validate} disabled={!selection.config || validating} data-testid="scan-validate-config-btn">Validate</Button>
            </div>
            <div className="mt-2 space-y-2">
              <InlineError message={configErr} testId="scan-config-error" />
              {configMsg && <p className="text-xs text-pg-accent flex items-center gap-1.5" data-testid="scan-config-valid"><CheckCircle2 className="h-3.5 w-3.5" />{configMsg}</p>}
            </div>
          </Panel>
          <Panel title="Scan profile" description="Behaviour shown is read from the engine's profile definitions." testId="scan-profile-panel">
            <ProfilePicker profiles={profiles} value={selection.profile} disabled={running} onChange={(p) => setSelection({ profile: p })} />
          </Panel>
          <Panel title="Vulnerability intelligence" testId="scan-osv-panel">
            <div className="flex items-start justify-between gap-6">
              <div>
                <Label htmlFor="osv-toggle" className="text-sm">Live OSV lookup</Label>
                <p className="text-xs text-pg-muted mt-1 leading-relaxed max-w-lg">Sends only package names, exact versions and ecosystems to api.osv.dev. Source code and findings are never uploaded.</p>
              </div>
              <Switch id="osv-toggle" checked={selection.online} disabled={running} onCheckedChange={(v) => setSelection({ online: v })} data-testid="scan-osv-toggle" />
            </div>
            <div className="mt-3 space-y-2">
              {!selection.online && <Note tone="warn" testId="scan-offline-note">Offline mode: dependencies are inventoried but not checked for advisories. The engine records the dependency check as incomplete and the result can be at most WARNING for that reason.</Note>}
              {selection.online && profile && !profile.online_intelligence && <Note tone="warn" testId="scan-profile-offline-note">The {profile.name} profile disables online intelligence by design, so OSV will not be queried.</Note>}
            </div>
          </Panel>
        </div>
        <div className="xl:col-span-5 flex flex-col gap-4">
          <Button size="lg" className="h-12 text-base font-semibold" onClick={go} disabled={running || !selection.project} data-testid="scan-start-btn">
            {running ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Play className="h-5 w-5 mr-2" />}
            {running ? "Scan in progress" : "Start scan"}
          </Button>
          <ScanMonitor />
          <p className="text-xs text-pg-muted flex gap-1.5 leading-relaxed" data-testid="scan-cancel-note">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" /> The current engine has no safe cancellation hook, so a started scan runs to completion in the background. The interface stays responsive meanwhile.
          </p>
        </div>
      </div>
      <PathPicker open={picker === "dir"} onOpenChange={(o) => !o && setPicker(null)} mode="dir" initialPath={selection.project} onSelect={(p) => setSelection({ project: p })} />
      <PathPicker open={picker === "json"} onOpenChange={(o) => !o && setPicker(null)} mode="json" initialPath={selection.config || selection.project} onSelect={(p) => { setSelection({ config: p }); setConfigErr(null); setConfigMsg(null); }} />
    </>
  );
}

export function useScanNav() {
  return useNavigate();
}
