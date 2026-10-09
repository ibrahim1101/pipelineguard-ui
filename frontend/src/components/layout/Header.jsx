import { Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApp } from "@/context/AppContext";
import ProjectSelector from "@/components/layout/ProjectSelector";
import { StatusPill } from "@/components/common/Badges";

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export default function Header() {
  const { profiles, selection, setSelection, startScan, running, scanState, latest } = useApp();
  return (
    <header className="h-14 shrink-0 bg-pg-side border-b border-pg-line/80 flex items-center gap-3 px-4 z-40" data-testid="app-header">
      <div className="flex items-center gap-2.5 w-[216px] shrink-0" data-testid="app-brand">
        <span aria-hidden="true" className="h-8 w-8 rounded-md ring-1 ring-pg-line bg-pg-surface flex items-center justify-center font-brand font-bold text-pg-text">C</span>
        <span className="font-brand text-[17px] font-semibold tracking-[0.02em] text-pg-text">CERBERUS</span>
      </div>
      <ProjectSelector />
      <Select value={selection.profile} onValueChange={(v) => setSelection({ profile: v })} disabled={running}>
        <SelectTrigger className="w-[140px] h-9 bg-pg-surface border-pg-line text-sm" data-testid="header-profile-select" aria-label="Scan profile">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {profiles.map((p) => (
            <SelectItem key={p.name} value={p.name} data-testid={`header-profile-${p.name}`}>{cap(p.name)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex-1" />
      {running && (
        <div className="hidden md:flex items-center gap-3 min-w-[220px]" data-testid="header-scan-progress">
          <div className="flex-1">
            <div className="flex justify-between text-xs text-pg-muted mb-1">
              <span className="truncate max-w-[160px]">{scanState.current_stage || "Starting"}</span>
              <span className="font-mono">{Math.round(scanState.progress || 0)}%</span>
            </div>
            <div className="h-1 rounded-full bg-pg-surface2 overflow-hidden">
              <div className="h-full bg-pg-accent transition-[width] duration-500" style={{ width: `${scanState.progress || 0}%` }} />
            </div>
          </div>
        </div>
      )}
      {!running && latest && <StatusPill status={latest.status} testId="header-last-status" />}
      <Button onClick={startScan} disabled={running} className="h-9 px-4 font-semibold" data-testid="header-start-scan-btn">
        {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
        {running ? "Scanning" : "Start Scan"}
      </Button>
    </header>
  );
}
