import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "../lib/api";

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export function AppProvider({ children }) {
  const [backend, setBackend] = useState("connecting");
  const [status, setStatus] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [settings, setSettings] = useState(null);
  const [latest, setLatest] = useState(null);
  const [latestLoaded, setLatestLoaded] = useState(false);
  const [history, setHistory] = useState([]);
  const [activity, setActivity] = useState([]);
  const [scanState, setScanState] = useState({ status: "idle" });
  const [osvOnline, setOsvOnline] = useState(null);
  const [selection, setSelectionState] = useState({ project: "", config: "", profile: "standard", online: false });
  const [viewScan, setViewScan] = useState(null);
  const pollRef = useRef(null);
  const backendRef = useRef("connecting");
  const mountedRef = useRef(false);
  const generationRef = useRef(0);
  const initRef = useRef(0);
  const wasRunning = useRef(false);

  const setSelection = useCallback((patch) => setSelectionState((s) => ({ ...s, ...patch })), []);

  const refreshData = useCallback(async () => {
    const generation = generationRef.current;
    const [l, h, a] = await Promise.all([api.latestScan(), api.history(), api.activity()]);
    if (!mountedRef.current || generation !== generationRef.current) return null;
    setLatest(l);
    setHistory(h);
    setActivity(a);
    setLatestLoaded(true);
    return l;
  }, []);

  const poll = useCallback(async () => {
    if (!mountedRef.current) return;
    const generation = generationRef.current;
    clearTimeout(pollRef.current);
    try {
      const s = await api.scanState();
      if (!mountedRef.current || generation !== generationRef.current) return;
      setScanState(s);
      if (s.status === "running") {
        pollRef.current = setTimeout(poll, 600);
        return;
      }
      if (wasRunning.current) {
        wasRunning.current = false;
        const l = await refreshData();
        if (!mountedRef.current || generation !== generationRef.current) return;
        setViewScan(null);
        if (s.status === "completed") {
          toast.success(`Scan complete — ${s.result?.status}, score ${s.result?.score}/100`);
          if (s.online_effective && l) setOsvOnline(l.dependencies.insights.lookup_failed === 0);
        }
        if (s.status === "failed") toast.error(`Scan failed: ${s.error}`);
      }
    } catch {
      if (!mountedRef.current || generation !== generationRef.current) return;
      // Keep retrying after transient bridge failures; do not show stale scan progress.
      setBackend("offline");
      pollRef.current = setTimeout(poll, 2000);
    }
  }, [refreshData]);

  const init = useCallback(async () => {
    if (!mountedRef.current) return;
    const generation = generationRef.current;
    const request = ++initRef.current;
    setBackend("connecting");
    try {
      const [st, pr, se, ss] = await Promise.all([api.status(), api.profiles(), api.settings(), api.scanState()]);
      if (!mountedRef.current || generation !== generationRef.current || request !== initRef.current) return;
      setStatus(st);
      setProfiles(pr);
      setSettings(se);
      setSelectionState({ project: se.default_project || "", config: se.default_config || "",
        profile: se.default_profile, online: se.online_default });
      setScanState(ss);
      setBackend("connected");
      if (ss.status === "running") {
        wasRunning.current = true;
        poll();
      }
      await refreshData();
    } catch {
      if (mountedRef.current && generation === generationRef.current && request === initRef.current) setBackend("offline");
    }
  }, [poll, refreshData]);

  useEffect(() => {
    backendRef.current = backend;
  }, [backend]);

  useEffect(() => {
    mountedRef.current = true;
    generationRef.current += 1;
    init();
    // Health alone is insufficient: initialization must also reload profiles,
    // settings, scan state and history after the backend restarts.
    let recovering = false;
    const id = setInterval(async () => {
      if (recovering) return;
      try {
        await api.status();
        if (!mountedRef.current) return;
        if (backendRef.current === "offline") {
          recovering = true;
          try {
            await init();
          } finally {
            recovering = false;
          }
        }
      } catch {
        if (mountedRef.current) setBackend("offline");
      }
    }, 30000);
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      initRef.current += 1;
      clearInterval(id);
      clearTimeout(pollRef.current);
    };
  }, [init]);

  useEffect(() => {
    if (!settings) return;
    const root = document.documentElement;
    root.style.fontSize = `${settings.text_scale}%`;
    root.dataset.density = settings.density;
    root.classList.toggle("reduce-motion", settings.reduced_motion);
  }, [settings]);

  const startScan = useCallback(async () => {
    if (!selection.project) {
      toast.error("Select a project folder first");
      return false;
    }
    try {
      const s = await api.startScan({ project: selection.project, config: selection.config || null,
        profile: selection.profile, online: selection.online });
      setScanState(s);
      wasRunning.current = true;
      poll();
      api.activity().then(setActivity).catch(() => {});
      return true;
    } catch (e) {
      toast.error(e.message);
      return false;
    }
  }, [selection, poll]);

  const openScan = useCallback(async (id) => {
    if (!id || id === latest?.scan_id) return setViewScan(null);
    try {
      setViewScan(await api.scan(id));
    } catch (e) {
      toast.error(e.message);
    }
  }, [latest]);

  const value = {
    backend, status, profiles, settings, setSettings, latest, latestLoaded, history, activity, scanState,
    osvOnline, setOsvOnline, selection, setSelection, startScan, refreshData, retry: init,
    viewScan, openScan, clearViewScan: () => setViewScan(null), currentScan: viewScan || latest,
    running: scanState.status === "running",
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
