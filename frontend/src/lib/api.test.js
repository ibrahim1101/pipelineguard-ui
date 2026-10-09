import { api } from "./api";

describe("desktop bridge authentication", () => {
  const previousTauri = window.__TAURI__;
  const previousToken = window.__PIPELINEGUARD_TOKEN__;
  const previousFetch = global.fetch;

  afterEach(() => {
    window.__TAURI__ = previousTauri;
    window.__PIPELINEGUARD_TOKEN__ = previousToken;
    global.fetch = previousFetch;
    jest.clearAllMocks();
  });

  test("blocks desktop API requests when the launch token is missing", async () => {
    window.__TAURI__ = { core: { invoke: jest.fn() } };
    delete window.__PIPELINEGUARD_TOKEN__;
    global.fetch = jest.fn();
    await expect(api.status()).rejects.toThrow("Desktop bridge authentication is not initialized");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("sends the provisioned token only in an authentication header", async () => {
    window.__TAURI__ = { core: { invoke: jest.fn() } };
    window.__PIPELINEGUARD_TOKEN__ = "in-memory-launch-token";
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    await api.status();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).not.toContain("in-memory-launch-token");
    expect(options.headers["X-PipelineGuard-Token"]).toBe("in-memory-launch-token");
  });

  test("keeps token-free browser development requests available", async () => {
    delete window.__TAURI__;
    delete window.__PIPELINEGUARD_TOKEN__;
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    await api.health();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][1].headers["X-PipelineGuard-Token"]).toBeUndefined();
  });
});
