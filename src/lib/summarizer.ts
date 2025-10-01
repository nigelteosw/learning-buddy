// summarizer.ts
export type SummaryType = "key-points" | "tldr" | "teaser" | "headline";
export type SummaryLength = "short" | "medium" | "long";
export type SummaryFormat = "markdown" | "plain-text";

export async function hasSummarizer(): Promise<boolean> {
  if (!("Summarizer" in self)) return false;
  try {
    const availability = await (self as any).Summarizer.availability();
    return availability !== "unavailable";
  } catch {
    return false;
  }
}

type SummarizeOpts = {
  type?: SummaryType;
  length?: SummaryLength;
  format?: SummaryFormat;
  context?: string;             // per-call context (goes to summarize)
  sharedContext?: string;       // per-instance context (goes to create)
  signal?: AbortSignal;         // allow real cancellation
  onDownloadProgress?: (p: number) => void;
};

export async function summarizeText(
  text: string,
  opts: SummarizeOpts = {}
): Promise<string | null> {
  if (!(await hasSummarizer())) return null;
  if (!(navigator as any).userActivation?.isActive) {
    throw new Error("User activation required before creating a Summarizer.");
  }

  try {
    const summarizer = await (self as any).Summarizer.create({
      type: opts.type ?? "key-points",
      length: opts.length ?? "medium",
      format: opts.format ?? "markdown",
      sharedContext: opts.sharedContext,
      monitor(m: any) {
        if (opts.onDownloadProgress) {
          m.addEventListener("downloadprogress", (e: any) =>
            opts.onDownloadProgress?.(e.loaded)
          );
        }
      },
    });

    // NOTE: summarize() returns a STRING, not an object.
    // Also accepts { context, signal }.
    const summary: string = await summarizer.summarize(text, {
      context: opts.context,
      signal: opts.signal,
    });

    return summary ?? null;
  } catch (err) {
    console.error("summarizeText error:", err);
    return null;
  }
}