const pending = new Map();
let listening = false;

function ensureListener() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("surstudio:native-response", (event) => {
    const message = event.detail || {};
    const request = pending.get(message.id);
    if (!request) return;
    window.clearTimeout(request.timer);
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error));
    else request.resolve(message.result || {});
  });
}

export function hasNativeMacBridge() {
  if (typeof window === "undefined") return false;
  const nativePreview = import.meta.env.DEV && new URLSearchParams(window.location.search).has("native-preview");
  return Boolean(window.webkit?.messageHandlers?.surstudio || nativePreview);
}

export function callNative(method, params = {}, { timeout = method === "runLocalAI" ? 30 * 60_000 : 30_000 } = {}) {
  ensureListener();
  const handler = typeof window !== "undefined" ? window.webkit?.messageHandlers?.surstudio : null;
  if (!handler) return Promise.reject(new Error("This feature is available in the SurStudio Mac app."));
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      pending.delete(id);
      reject(new Error("The Mac service did not respond in time."));
    }, timeout);
    pending.set(id, { resolve, reject, timer });
    handler.postMessage({ id, method, params });
  });
}
