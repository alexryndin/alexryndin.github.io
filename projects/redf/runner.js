(() => {
  const TIMEOUT_MS = 2500;

  const FIB_PRESET = `((\\ '(self n a b)
    '(cond (eq n 0)
           a
           (self self (- n 1) b (+ a b))))
 (\\ '(self n a b)
    '(cond (eq n 0)
           a
           (self self (- n 1) b (+ a b))))
 10 0 1)`;

  function initRunner(root) {
    const textarea = root.querySelector("[data-redf-code]");
    const out = root.querySelector("[data-redf-output]");
    const status = root.querySelector("[data-redf-status]");
    const runBtn = root.querySelector("[data-redf-run]");
    const fibBtn = root.querySelector("[data-redf-fib]");

    if (!textarea || !out || !runBtn || !fibBtn) return;

    let worker = null;
    let timer = null;

    function setStatus(text) {
      if (!status) return;
      status.textContent = text || "";
    }

    function setOutput(text) {
      out.textContent = text || "";
    }

    function terminateWorker() {
      if (worker) {
        worker.terminate();
        worker = null;
      }
    }

    function ensureWorker() {
      if (worker) return worker;

      worker = new Worker("/projects/redf/worker.js");
      worker.onmessage = (ev) => {
        const msg = ev.data || {};
        if (msg.type === "ready") {
          setStatus("Ready");
          return;
        }

        if (msg.type === "error") {
          setStatus("Init error");
          setOutput(String(msg.message || "Unknown error"));
          runBtn.disabled = false;
          return;
        }

        if (msg.type === "done") {
          if (timer) {
            clearTimeout(timer);
            timer = null;
          }

          const blocks = [];
          const stderr = String(msg.stderr || "").trim();
          const stdout = String(msg.stdout || "").trim();

          if (stderr) blocks.push(`[stderr]\\n${stderr}`);
          if (stdout) blocks.push(`[stdout]\\n${stdout}`);
          if (!stderr && !stdout) blocks.push("(no output)");

          setStatus(`Exit code: ${msg.exitCode}`);
          setOutput(blocks.join("\n\n"));
          runBtn.disabled = false;
        }
      };
      worker.onerror = () => {
        setStatus("Worker error");
        runBtn.disabled = false;
      };

      setStatus("Loading...");
      return worker;
    }

    function run(code) {
      setOutput("");
      setStatus("Running...");
      runBtn.disabled = true;

      const w = ensureWorker();

      timer = setTimeout(() => {
        terminateWorker();
        runBtn.disabled = false;
        setStatus("Timed out (worker terminated)");
        setOutput("Timed out. This can happen on infinite loops (e.g. known join bug).");
      }, TIMEOUT_MS);

      w.postMessage({ type: "run", code });
    }

    fibBtn.addEventListener("click", () => {
      textarea.value = FIB_PRESET;
      textarea.focus();
    });

    runBtn.addEventListener("click", () => run(textarea.value));

    // Warm-up worker so the first run is faster.
    ensureWorker();
  }

  function main() {
    document.querySelectorAll("[data-redf-runner]").forEach(initRunner);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", main);
  } else {
    main();
  }
})();

