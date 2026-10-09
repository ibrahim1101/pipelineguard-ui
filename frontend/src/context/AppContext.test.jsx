import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { AppProvider, useApp } from "./AppContext";
import { api } from "../lib/api";

jest.mock("../lib/api", () => ({
  api: {
    status: jest.fn(), profiles: jest.fn(), settings: jest.fn(), scanState: jest.fn(),
    latestScan: jest.fn(), history: jest.fn(), activity: jest.fn(),
  },
}));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

global.IS_REACT_ACT_ENVIRONMENT = true;

const defaults = {
  default_project: "", default_config: "", default_profile: "standard",
  online_default: false, text_scale: 100, density: "comfortable", reduced_motion: false,
};
let observed;
function Probe() {
  observed = useApp();
  return <div data-testid="backend">{observed.backend}</div>;
}

async function flush() {
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

describe("AppProvider bridge lifecycle", () => {
  let container;
  let root;

  beforeEach(() => {
    jest.useFakeTimers();
    observed = null;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    api.status.mockReset().mockResolvedValue({ ready: true });
    api.profiles.mockReset().mockResolvedValue(["standard"]);
    api.settings.mockReset().mockResolvedValue(defaults);
    api.scanState.mockReset().mockResolvedValue({ status: "idle" });
    api.latestScan.mockReset().mockResolvedValue(null);
    api.history.mockReset().mockResolvedValue([]);
    api.activity.mockReset().mockResolvedValue([]);
  });

  afterEach(async () => {
    await act(async () => { root.unmount(); });
    container.remove();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test("initializes connected state and loads history", async () => {
    await act(async () => { root.render(<AppProvider><Probe /></AppProvider>); });
    await flush();
    expect(container.textContent).toBe("connected");
    expect(api.history).toHaveBeenCalledTimes(1);
    expect(observed.latestLoaded).toBe(true);
  });

  test("recovers and refreshes data after a backend outage", async () => {
    await act(async () => { root.render(<AppProvider><Probe /></AppProvider>); });
    await flush();
    api.status.mockRejectedValueOnce(new Error("bridge offline"));
    await act(async () => { jest.advanceTimersByTime(30000); });
    await flush();
    expect(container.textContent).toBe("offline");

    await act(async () => { jest.advanceTimersByTime(30000); });
    await flush();
    expect(container.textContent).toBe("connected");
    expect(api.history.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  test("ignores stale initialization when a newer retry finishes first", async () => {
    let resolveOld;
    api.status.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
    await act(async () => { root.render(<AppProvider><Probe /></AppProvider>); });
    expect(container.textContent).toBe("connecting");

    await act(async () => { await observed.retry(); });
    expect(container.textContent).toBe("connected");
    expect(api.history).toHaveBeenCalledTimes(1);

    await act(async () => { resolveOld({ ready: true }); });
    expect(container.textContent).toBe("connected");
    expect(api.history).toHaveBeenCalledTimes(1);
  });

  test("preserves user-edited scan selection during reconnect", async () => {
    await act(async () => { root.render(<AppProvider><Probe /></AppProvider>); });
    await act(async () => { observed.setSelection({ project: "/my-project", profile: "deep" }); });
    api.settings.mockResolvedValue({ ...defaults, default_project: "/server-default" });
    await act(async () => { await observed.retry(); });
    expect(observed.selection.project).toBe("/my-project");
    expect(observed.selection.profile).toBe("deep");
  });

  test("ignores older refresh results when a newer refresh completes", async () => {
    await act(async () => { root.render(<AppProvider><Probe /></AppProvider>); });
    let resolveOld;
    api.history.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
    let pending;
    await act(async () => { pending = observed.refreshData(); });
    api.history.mockResolvedValue([{ scan_id: "newer" }]);
    await act(async () => { await observed.refreshData(); });
    expect(observed.history).toEqual([{ scan_id: "newer" }]);
    await act(async () => { resolveOld([{ scan_id: "older" }]); await pending; });
    expect(observed.history).toEqual([{ scan_id: "newer" }]);
  });

  test("ignores initialization response after unmount", async () => {
    let resolveStatus;
    api.status.mockImplementationOnce(() => new Promise((resolve) => { resolveStatus = resolve; }));
    await act(async () => { root.render(<AppProvider><Probe /></AppProvider>); });
    await act(async () => { root.unmount(); });
    await act(async () => { resolveStatus({ ready: true }); });
    expect(api.history).not.toHaveBeenCalled();
    root = createRoot(container);
  });

  test("does not schedule polling after unmount while a scan-state request is pending", async () => {
    let resolveScan;
    api.scanState.mockImplementationOnce(() => new Promise((resolve) => { resolveScan = resolve; }));
    await act(async () => { root.render(<AppProvider><Probe /></AppProvider>); });
    await act(async () => { root.unmount(); });
    await act(async () => { resolveScan({ status: "running" }); });
    // React/jsdom may own timers; assert our app does not make another scan request.
    const calls = api.scanState.mock.calls.length;
    await act(async () => { jest.advanceTimersByTime(5000); });
    expect(api.scanState).toHaveBeenCalledTimes(calls);
    root = createRoot(container);
  });
});
