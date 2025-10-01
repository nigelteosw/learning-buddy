import { useRef, useState } from "react";
import {
  hasSummarizer,
  summarizeText,
  type SummaryLength,
  type SummaryType,
} from "../lib/summarizer";

export default function App() {
  const [input, setInput] = useState("");
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [length, setLength] = useState<SummaryLength>("medium");
  const [stype, setStype] = useState<SummaryType>("key-points");

  // Manage the active request & controller so Cancel actually aborts summarize()
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

    // fresh controller per run
    ctrlRef.current = new AbortController();

    try {
      const ok = await hasSummarizer();
      if (!ok) {
        setErr("Summarizer API not available in this Chrome profile.");
        return;
      }

      const summary = await summarizeText(input, {
        type: stype,
        length,
        format: "markdown",
        // context: "This article is intended for a tech-savvy audience.",
        signal: ctrlRef.current.signal, // <-- real cancel hook
      });

      if (myToken !== reqToken.current) return; // user canceled

      if (summary == null) {
        setErr("Summarization failed (no result).");
      } else {
        setOut(summary);
      }
    } catch (e: any) {
      if (myToken !== reqToken.current) return;
      // Optional: map DOMExceptions like NotReadableError / NotSupportedError
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
