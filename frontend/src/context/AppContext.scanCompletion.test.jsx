import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { AppProvider, useApp } from "./AppContext";
import { api } from "../lib/api";
import { toast } from "sonner";

jest.mock("../lib/api", () => ({
  api: {
    status: jest.fn(), profiles: jest.fn(), settings: jest.fn(), scanState: jest.fn(),
    latestScan: jest.fn(), history: jest.fn(), activity: jest.fn(), startScan: jest.fn(),
  },
}));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
global.IS_REACT_ACT_ENVIRONMENT = true;

let app;
function Probe() { app = useApp(); return <span>{app.backend}</span>; }
const settings = { default_project: "/project", default_config: "", default_profile: "standard",
  online_default: false, text_scale: 100, density: "comfortable", reduced_motion: false };

describe("scan completion and report refresh regressions", () => {
  let root, node;
  beforeEach(() => {
    jest.useFakeTimers();
    node = document.createElement("div");
    document.body.appendChild(node);
    root = createRoot(node);
    app = null;
    jest.clearAllMocks();
    api.status.mockResolvedValue({ ready: true });
    api.profiles.mockResolvedValue(["standard"]);
    api.settings.mockResolvedValue(settings);
    api.scanState.mockResolvedValue({ status: "idle" });
    api.latestScan.mockResolvedValue(null);
    api.history.mockResolvedValue([]);
    api.activity.mockResolvedValue([]);
    api.startScan.mockResolvedValue({ status: "running" });
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    node.remove();
    jest.clearAllTimers();
    jest.useRealTimers();
  });
  async function mountAndStart() {
    await act(async () => root.render(<AppProvider><Probe /></AppProvider>));
    api.scanState.mockResolvedValue({ status: "running" });
    await act(async () => { await app.startScan(); });
  }
  async function completeWith(failingMethod, finalStatus = "completed") {
    const state = finalStatus === "completed"
      ? { status: "completed", result: { status: "pass", score: 95 } }
      : { status: "failed", error: "scanner crashed" };
    api.scanState.mockResolvedValue(state);
    api[failingMethod].mockRejectedValueOnce(new Error("temporary report outage"));
    await act(async () => { jest.advanceTimersByTime(600); await Promise.resolve(); });
    expect(app.scanState.status).toBe(finalStatus);
    expect(app.backend).toBe("connected");
    expect(toast.error).toHaveBeenCalledWith("Scan finished, but reports could not be refreshed. Retry loading history.");
    if (finalStatus === "completed") {
      expect(toast.success).toHaveBeenCalledTimes(1);
    } else {
      expect(toast.error).toHaveBeenCalledWith("Scan failed: scanner crashed");
    }
  }
  test.each(["latestScan", "history", "activity"])(
    "successful scan stays completed when %s refresh fails", async (method) => {
      await mountAndStart();
      await completeWith(method);
    }
  );
  test("bridge interruption retries and completes without duplicate success notifications", async () => {
    await mountAndStart();
    api.scanState.mockRejectedValueOnce(new Error("bridge disconnected"));
    await act(async () => { jest.advanceTimersByTime(600); await Promise.resolve(); });
    expect(app.backend).toBe("offline");
    api.scanState.mockResolvedValue({ status: "completed", result: { status: "pass", score: 95 } });
    await act(async () => { jest.advanceTimersByTime(2000); await Promise.resolve(); });
    expect(app.backend).toBe("connected");
    expect(app.scanState.status).toBe("completed");
    expect(toast.success).toHaveBeenCalledTimes(1);
    await act(async () => { jest.advanceTimersByTime(5000); await Promise.resolve(); });
    expect(toast.success).toHaveBeenCalledTimes(1);
  });

  test("failed scan stays failed when history refresh fails", async () => {
    await mountAndStart();
    await completeWith("history", "failed");
    expect(toast.success).not.toHaveBeenCalled();
  });
});
