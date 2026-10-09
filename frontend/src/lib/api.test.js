import { api } from "./api";

describe("desktop native IPC bridge", () => {
  const previousTauri = window.__TAURI__;
  const previousFetch = global.fetch;

  afterEach(() => {
    window.__TAURI__ = previousTauri;
    global.fetch = previousFetch;
    jest.clearAllMocks();
  });

  test("routes desktop API through IPC without fetch or renderer tokens", async () => {
    const invoke = jest.fn().mockResolvedValue({ status: 200, body: { ok: true } });
    window.__TAURI__ = { core: { invoke } };
    global.fetch = jest.fn();
    await expect(api.status()).resolves.toEqual({ ok: true });
    expect(invoke).toHaveBeenCalledWith("bridge_request", { method: "GET", path: "/status", body: null });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("fails closed when native IPC is unavailable", async () => {
    window.__TAURI__ = { core: { invoke: jest.fn().mockRejectedValue(new Error("offline")) } };
    global.fetch = jest.fn();
    await expect(api.status()).rejects.toThrow("Cerberus desktop bridge is unavailable");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("preserves native HTTP error detail", async () => {
    window.__TAURI__ = { core: { invoke: jest.fn().mockResolvedValue({ status: 401, body: { detail: "Unauthorized" } }) } };
    await expect(api.status()).rejects.toMatchObject({ status: 401, message: "Unauthorized" });
  });

  test("keeps browser development requests available", async () => {
    delete window.__TAURI__;
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    await api.health();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][1].headers["X-PipelineGuard-Token"]).toBeUndefined();
  });
});
