/* global createRedFModule, importScripts */

importScripts("redf.js");

const baseUrl = (() => {
  const href = self.location.href;
  return href.slice(0, href.lastIndexOf("/") + 1);
})();

let modulePromise = null;
let stdout = [];
let stderr = [];

function ensureModule() {
  if (modulePromise) return modulePromise;

  modulePromise = createRedFModule({
    locateFile: (path) => baseUrl + path,
    print: (text) => stdout.push(String(text)),
    printErr: (text) => stderr.push(String(text)),
  });

  return modulePromise;
}

ensureModule()
  .then(() => self.postMessage({ type: "ready" }))
  .catch((err) =>
    self.postMessage({ type: "error", message: String(err && err.message ? err.message : err) }),
  );

self.onmessage = async (ev) => {
  const msg = ev.data || {};
  if (msg.type !== "run") return;

  try {
    const Module = await ensureModule();

    stdout = [];
    stderr = [];

    const code = String(msg.code || "");
    const exitCode = Module.ccall("redf_eval", "number", ["string"], [code]);

    self.postMessage({
      type: "done",
      exitCode,
      stdout: stdout.join("\n"),
      stderr: stderr.join("\n"),
    });
  } catch (err) {
    self.postMessage({
      type: "done",
      exitCode: 1,
      stdout: "",
      stderr: String(err && err.message ? err.message : err),
    });
  }
};

