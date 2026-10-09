import { useMemo, useState } from "react";
import { ChevronDown, FolderGit2, FolderOpen } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useApp } from "@/context/AppContext";
import { basename } from "@/lib/format";
import PathPicker from "@/components/common/PathPicker";

export default function ProjectSelector() {
  const { selection, setSelection, history, status, running } = useApp();
  const [open, setOpen] = useState(false);
  const [picker, setPicker] = useState(false);
  const recents = useMemo(() => {
    const list = [...new Set(history.map((h) => h.project).filter(Boolean))];
    if (status?.sample_project && !list.includes(status.sample_project)) list.push(status.sample_project);
    return list.slice(0, 6);
  }, [history, status]);

  const choose = (p) => {
    setSelection({ project: p });
    setOpen(false);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            disabled={running}
            className="h-9 flex items-center gap-2 rounded-lg border border-pg-line bg-pg-surface px-3 text-sm hover:bg-pg-surface2 transition-colors disabled:opacity-60 max-w-[320px]"
            data-testid="header-project-selector"
          >
            <FolderGit2 className="h-4 w-4 text-pg-accent shrink-0" />
            <span className="truncate">{selection.project ? basename(selection.project) : "Select project"}</span>
            <ChevronDown className="h-3.5 w-3.5 text-pg-muted shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[420px] p-2 bg-pg-surface border-pg-line">
          <p className="px-2 pt-1 pb-2 text-xs text-pg-muted">Current project</p>
          <p className="px-2 pb-3 font-mono text-xs break-all text-pg-text" data-testid="header-project-path">
            {selection.project || "None selected"}
          </p>
          {recents.length > 0 && <p className="px-2 py-1 text-xs text-pg-muted border-t border-pg-line/60 pt-2">Recent & sample projects</p>}
          {recents.map((p) => (
            <button key={p} onClick={() => choose(p)} className="w-full text-left rounded-md px-2 py-2 hover:bg-pg-surface2 transition-colors" data-testid={`header-recent-project-${basename(p)}`}>
              <span className="block text-sm">{basename(p)}{p === status?.sample_project ? <span className="ml-2 text-xs text-pg-warn">bundled sample</span> : null}</span>
              <span className="block font-mono text-[11px] text-pg-muted truncate">{p}</span>
            </button>
          ))}
          <Button variant="outline" className="w-full mt-2 border-pg-line" onClick={() => { setOpen(false); setPicker(true); }} data-testid="header-browse-project-btn">
            <FolderOpen className="h-4 w-4 mr-2" /> Browse for folder…
          </Button>
        </PopoverContent>
      </Popover>
      <PathPicker open={picker} onOpenChange={setPicker} mode="dir" initialPath={selection.project} onSelect={choose} />
    </>
  );
}
