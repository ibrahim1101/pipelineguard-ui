// Bridges to the Tauri shell when running as the packaged desktop app.
export const isDesktop = () => Boolean(window.__TAURI__?.core?.invoke);

export async function openPath(path) {
  if (!isDesktop()) return false;
  await window.__TAURI__.core.invoke("open_path", { path });
  return true;
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
