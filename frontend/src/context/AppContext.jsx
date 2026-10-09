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
  const [reportsError, setReportsError] = useState(false);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [activity, setActivity] = useState([]);
  const [scanState, setScanState] = useState({ status: "idle" });
  const [osvOnline, setOsvOnline] = useState(null);
  const [selection, setSelectionState] = useState({ project: "", config: "", profile: "standard", online: false });
  const [viewScan, setViewScan] = useState(null);
  const pollRef = useRef(null);
  const pollInFlightRef = useRef(false);
  const backendRef = useRef("connecting");
  const mountedRef = useRef(false);
  const generationRef = useRef(0);
  const initRef = useRef(0);
  const refreshRef = useRef(0);
  const selectionTouchedRef = useRef(false);
  const wasRunning = useRef(false);

  const setSelection = useCallback((patch) => {
    selectionTouchedRef.current = true;
    setSelectionState((s) => ({ ...s, ...patch }));
  }, []);

  const refreshData = useCallback(async () => {
    const generation = generationRef.current;
    const request = ++refreshRef.current;
    setReportsLoading(true);
    try {
      const [l, h, a] = await Promise.all([api.latestScan(), api.history(), api.activity()]);
      if (!mountedRef.current || generation !== generationRef.current || request !== refreshRef.current) return null;
      setLatest(l);
      setHistory(h);
      setActivity(a);
      setLatestLoaded(true);
      setReportsError(false);
      return l;
    } catch (error) {
      if (mountedRef.current && generation === generationRef.current && request === refreshRef.current) setReportsError(true);
      throw error;
    } finally {
      if (mountedRef.current && generation === generationRef.current && request === refreshRef.current) setReportsLoading(false);
    }
  }, []);

  const poll = useCallback(async () => {
    if (!mountedRef.current || pollInFlightRef.current) return;
    pollInFlightRef.current = true;
    const generation = generationRef.current;
    clearTimeout(pollRef.current);
    try {
      const s = await api.scanState();
      if (!mountedRef.current || generation !== generationRef.current) return;
      setBackend("connected");
      setScanState(s);
      if (s.status === "running") {
        pollRef.current = setTimeout(poll, 600);
        return;
      }
      if (wasRunning.current) {
        wasRunning.current = false;
        // Report loading is separate from scan execution. A transient history
        // failure must not turn a completed scan into a bridge outage.
        setViewScan(null);
        if (s.status === "completed") {
          toast.success(`Scan complete — ${s.result?.status}, score ${s.result?.score}/100`);
        } else if (s.status === "failed") {
          toast.error(`Scan failed: ${s.error}`);
        }
        try {
          const l = await refreshData();
          if (!mountedRef.current || generation !== generationRef.current) return;
          if (s.status === "completed" && s.online_effective && l) {
            const failed = l.dependencies?.insights?.lookup_failed;
            if (typeof failed === "number") setOsvOnline(failed === 0);
          }
        } catch {
          if (mountedRef.current && generation === generationRef.current) {
            toast.error("Scan finished, but reports could not be refreshed. Retry loading history.");
          }
        }
      }
    } catch {
      if (!mountedRef.current || generation !== generationRef.current) return;
      // Keep retrying after transient bridge failures; do not show stale scan progress.
      setBackend("offline");
      pollRef.current = setTimeout(poll, 2000);
    } finally {
      pollInFlightRef.current = false;
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
      if (!selectionTouchedRef.current) {
        setSelectionState({ project: se.default_project || "", config: se.default_config || "",
          profile: se.default_profile, online: se.online_default });
      }
      setScanState(ss);
      setBackend("connected");
      if (ss.status === "running") {
        wasRunning.current = true;
        poll();
      }
      // A report endpoint can fail while the bridge itself remains healthy.
      // Keep connectivity and scan state authoritative; surface a separate warning.
      try {
        await refreshData();
      } catch {
        if (mountedRef.current && generation === generationRef.current && request === initRef.current) {
          toast.error("Connected to the bridge, but reports could not be loaded. Retry loading history.");
        }
      }
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
      refreshRef.current += 1;
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
      if (!mountedRef.current) return false;
      setScanState(s);
      wasRunning.current = true;
      poll();
      const generation = generationRef.current;
      api.activity().then((events) => {
        if (mountedRef.current && generation === generationRef.current) setActivity(events);
      }).catch(() => {});
      return true;
    } catch (e) {
      toast.error(e.message);
      return false;
    }
  }, [selection, poll]);

  const openScan = useCallback(async (id) => {
    if (!id || id === latest?.scan_id) return setViewScan(null);
    try {
      const generation = generationRef.current;
      const scan = await api.scan(id);
      if (mountedRef.current && generation === generationRef.current) setViewScan(scan);
    } catch (e) {
      toast.error(e.message);
    }
  }, [latest]);

  const value = {
    backend, status, profiles, settings, setSettings, latest, latestLoaded, reportsError, reportsLoading, history, activity, scanState,
    osvOnline, setOsvOnline, selection, setSelection, startScan, refreshData, retry: init,
    viewScan, openScan, clearViewScan: () => setViewScan(null), currentScan: viewScan || latest,
    running: scanState.status === "running",
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
