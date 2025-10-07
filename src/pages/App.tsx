import { useRef, useState } from "react";
import {
  summarizerClient,
  defaultOpts,
  type SummaryType,
  type SummaryLength,
} from "../lib/summarizerClient";

export default function App() {
  const [input, setInput] = useState("");
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // options UI
  const [stype, setStype] = useState<SummaryType>("key-points");
  const [length, setLength] = useState<SummaryLength>("medium");

  // Manage cancelation / ignore-late-results
  const reqToken = useRef(0);
  const ctrlRef = useRef<AbortController | null>(null);

  const abort = () => {
    ctrlRef.current?.abort();
    ctrlRef.current = null;
    reqToken.current += 1; // ignore any late results
    setBusy(false);
    setErr(null);
  };

  async function run() {
    const myToken = ++reqToken.current;
    setBusy(true);
    setErr(null);
    setOut("");
    ctrlRef.current = new AbortController();

    try {
      // 1) update global opts (optional persist to chrome.storage.sync if you want)
      summarizerClient.setOpts({
        ...defaultOpts,
        type: stype,
        length,
        // format: "markdown", // default already
        // outputLanguage: "en", // default from navigator; set explicitly if you prefer
      });

      // 2) IMPORTANT: create the session *inside this click handler*
      await summarizerClient.initFromUserGesture({
        ...defaultOpts,
        type: stype,
        length,
        // outputLanguage: "en",
      });

      // 3) summarize (reuses the session; no more user activation needed)
      const summary = await summarizerClient.summarize(input, {
        signal: ctrlRef.current.signal,
        // context: "This article is intended for a tech-savvy audience.",
      });

      if (myToken !== reqToken.current) return; // was canceled

      if (!summary) {
        setErr("Summarization failed (no result).");
      } else {
        setOut(summary);
        // Optional: store so popup re-opens with latest result
        try {
          await chrome.storage?.local?.set({
            lastSummary: summary,
            lastSourceLen: input.length,
            lastAt: Date.now(),
          });
        } catch {}
      }
    } catch (e: any) {
      if (myToken !== reqToken.current) return;
      setErr(e?.message ?? "Unexpected error during summarization.");
    } finally {
      if (myToken === reqToken.current) setBusy(false);
      ctrlRef.current = null;
    }
  }

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 12, width: 360 }}>
      <h3 style={{ margin: 0 }}>Learning Buddy • Summarizer</h3>

      <textarea
        style={{ width: "100%", marginTop: 8 }}
        rows={6}
        placeholder="Paste or type text to summarize…"
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />

      <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
        <select
          value={length}
          onChange={(e) => setLength(e.target.value as SummaryLength)}
          disabled={busy}
          title="Summary length"
        >
          <option value="short">short</option>
          <option value="medium">medium</option>
          <option value="long">long</option>
        </select>

        <select
          value={stype}
          onChange={(e) => setStype(e.target.value as SummaryType)}
          disabled={busy}
          title="Summary type"
        >
          <option value="key-points">key-points</option>
          <option value="teaser">teaser</option>
          <option value="headline">headline</option>
          <option value="tldr">tldr</option>
        </select>

        <button onClick={run} disabled={busy || !input.trim()}>
          {busy ? "Summarizing…" : "Summarize"}
        </button>
        <button onClick={abort} disabled={!busy}>
          Cancel
        </button>
      </div>

      {err && <div style={{ color: "crimson", marginTop: 8 }}>{err}</div>}

      <pre style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>
        {busy ? "Thinking…" : out}
      </pre>
    </div>
  );
}
