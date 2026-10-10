import { useCallback, useEffect, useState } from "react";
import { ArrowUp, HardDrive, FileJson, Folder } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { dirname, joinPath } from "@/lib/format";
import { InlineError } from "@/components/common/Panel";

/** Local folder/JSON browser served by the bridge (the desktop shell can swap in a native dialog). */
export default function PathPicker({ open, onOpenChange, mode = "dir", initialPath, onSelect }) {
  const [data, setData] = useState(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState(null);
  const [dragging, setDragging] = useState(false);

  const load = useCallback(async (p) => {
    try {
      const d = await api.fsList(p);
      setData(d);
      setInput(d.path);
      setError(null);
    } catch (e) {
      setError(e.message);
      if (!p) return;
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const start = mode === "json" && initialPath ? dirname(initialPath) : initialPath;
    api.fsList(start || undefined).then((d) => { setData(d); setInput(d.path); setError(null); }).catch(() => load(undefined));
  }, [open, initialPath, mode, load]);

  useEffect(() => {
    if (!open) return undefined;
    let disposed = false;
    let unlisten;
    const handleDrop = async (event) => {
      if (disposed) return;
      const payload = event.payload || {};
      if (payload.type === "leave") setDragging(false);
      if (payload.type === "over") setDragging(true);
      if (payload.type !== "drop") return;
      setDragging(false);
      const path = payload.paths?.[0];
      if (!path) return setError("No filesystem path was provided by Windows.");
      if (mode === "json") {
        if (!/\\.json$/i.test(path)) return setError("Drop a JSON configuration file.");
        try {
          const folder = await api.fsList(dirname(path));
          if (!folder.json_files.includes(path.split(/[\\\\/]/).pop())) throw new Error("JSON file was not found");
          if (!disposed) { onSelect(path); onOpenChange(false); }
        } catch (e) { if (!disposed) setError(e.message); }
      } else {
        try {
          const folder = await api.fsList(path);
          if (!disposed) { setData(folder); setInput(folder.path); setError(null); onSelect(folder.path); onOpenChange(false); }
        } catch (e) { if (!disposed) setError("Drop a folder, not a file: " + e.message); }
      }
    };
    const tauri = window.__TAURI__;
    // Tauri 2 can expose native drops through the event bus even when the
    // webview wrapper is absent from the global API.
    const register = tauri?.event?.listen
      ? tauri.event.listen("tauri://drag-drop", handleDrop)
      : tauri?.webview?.getCurrentWebview?.()?.onDragDropEvent?.(handleDrop);
    if (register) Promise.resolve(register).then((fn) => { if (disposed) fn(); else unlisten = fn; }).catch(() => setError("Native drag-and-drop is unavailable in this desktop build."));
    else setError("Native drag-and-drop is unavailable; use Browse or paste a path.");
    return () => { disposed = true; unlisten?.(); };
  }, [open, mode, onSelect, onOpenChange]);

  const pick = (p) => {
    onSelect(p);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-pg-surface border-pg-line" data-testid="path-picker-dialog">
        <DialogHeader>
          <DialogTitle>{mode === "dir" ? "Select project folder" : "Select configuration file"}</DialogTitle>
          <DialogDescription>Browse the local file system. Only names are listed; file contents are not read.</DialogDescription>
        </DialogHeader>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); load(input); }}>
          <Input value={input} onChange={(e) => setInput(e.target.value)} className="font-mono text-xs bg-pg-bg" data-testid="path-picker-input" />
          <Button type="submit" variant="outline" data-testid="path-picker-go-btn">Go</Button>
        </form>
        <InlineError message={error} testId="path-picker-error" />
        <p className={`text-xs rounded-md border border-dashed p-2 text-center ${dragging ? "border-pg-accent text-pg-accent" : "border-pg-line text-pg-muted"}`} data-testid="path-picker-drop-hint">Drag a {mode === "dir" ? "folder" : "JSON file"} here from Windows Explorer, or browse drives below.</p>
        <div className="h-72 overflow-y-auto pg-scroll rounded-lg border border-pg-line bg-pg-bg/60 p-1" data-testid="path-picker-list">
          {data?.drives?.length > 0 && <div className="px-3 py-1 text-xs text-pg-muted">This PC · Available drives</div>}
          {data?.drives?.map((drive) => <button key={drive} onClick={() => load(drive)} className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-pg-surface2 text-left" data-testid={`path-picker-drive-${drive[0]}`}><HardDrive className="h-4 w-4 text-pg-accent shrink-0" />{drive}</button>)}
          {data?.parent && (
            <button onClick={() => load(data.parent)} className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-pg-muted hover:bg-pg-surface2" data-testid="path-picker-up">
              <ArrowUp className="h-4 w-4" /> Parent folder
            </button>
          )}
          {data?.directories.map((d) => (
            <button key={d} onClick={() => load(joinPath(data.path, d))} className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-pg-surface2 text-left" data-testid={`path-picker-dir-${d}`}>
              <Folder className="h-4 w-4 text-pg-accent2 shrink-0" /> <span className="truncate">{d}</span>
            </button>
          ))}
          {mode === "json" && data?.json_files.map((f) => (
            <button key={f} onClick={() => pick(joinPath(data.path, f))} className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-pg-surface2 text-left" data-testid={`path-picker-file-${f}`}>
              <FileJson className="h-4 w-4 text-pg-warn shrink-0" /> <span className="truncate">{f}</span>
            </button>
          ))}
          {data && !data.directories.length && !(mode === "json" && data.json_files.length) && (
            <p className="px-3 py-6 text-sm text-pg-muted text-center">This folder is empty.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} data-testid="path-picker-cancel">Cancel</Button>
          {mode === "dir" && <Button onClick={() => pick(data.path)} disabled={!data} data-testid="path-picker-select-btn">Select this folder</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
