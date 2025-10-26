// summarizer.ts
export type SummaryType = "key-points" | "tldr" | "teaser" | "headline";
export type SummaryLength = "short" | "medium" | "long";
export type SummaryFormat = "markdown" | "plain-text";

export type GlobalSummarizerOpts = {
  type: SummaryType;
  length: SummaryLength;
  format: SummaryFormat;
  outputLanguage: "en" | "es" | "ja";
  sharedContext?: string;
};

export const defaultSummarizerOpts: GlobalSummarizerOpts = {
  sharedContext: "Do not include the name of the concept at all.",
  type: "tldr",
  length: "short",
  format: "plain-text",
  outputLanguage: (["en","es","ja"].includes((navigator.language||"en").slice(0,2)) 
    ? (navigator.language.slice(0,2) as "en"|"es"|"ja") 
    : "en"),
};


type CreateParams = GlobalSummarizerOpts & {
  onDownloadProgress?: (p: number) => void;
};


class SummarizerClient {
  private session: any | null = null;
  private creating?: Promise<any>;
  private opts: GlobalSummarizerOpts = defaultSummarizerOpts;

  setOpts(next: Partial<GlobalSummarizerOpts>) {
    this.opts = { ...this.opts, ...next };
  }

  /** Must be called from a user gesture (click) in content/popup */
  async initFromUserGesture(params?: CreateParams) {
    if (this.session) return;
    if (this.creating) {
      await this.creating;
      return;
    }

    if (!("Summarizer" in self)) {
      throw new Error("Web Summarizer API not available in this context.");
    }

    // Optional: check availability() first
    try {
      const availability = await (self as any).Summarizer.availability?.();
      if (availability === "unavailable") {
        throw new Error("Summarizer unavailable.");
      }
    } catch { /* ignore */ }

    // Create inside the click
    const createOpts = {
      type: params?.type ?? this.opts.type,
      length: params?.length ?? this.opts.length,
      format: params?.format ?? this.opts.format,
      sharedContext: params?.sharedContext ?? this.opts.sharedContext,
      outputLanguage: params?.outputLanguage ?? this.opts.outputLanguage,
      monitor: (m: any) => {
        if (params?.onDownloadProgress) {
          m.addEventListener("downloadprogress", (e: any) =>
            params.onDownloadProgress?.(e.loaded)
          );
        }
      },
    };

    this.creating = (self as any).Summarizer.create(createOpts)
      .then((s: any) => (this.session = s))
      .finally(() => { this.creating = undefined; });

    await this.creating;
  }

  /** Can be called later without user activation (reuses the session) */
  async summarize(text: string, { signal, context }: { signal?: AbortSignal; context?: string } = {}) {
    if (!this.session) {
      throw new Error("Summarizer not initialized. Call initFromUserGesture() on a user click first.");
    }
    const input = text.trim().replace(/\s+/g, " ");
    if (!input) return "";
    return await this.session.summarize(input, {
      outputLanguage: this.opts.outputLanguage,
      signal,
      context,
    }) as string;
  }

  dispose() {
    try { this.session?.destroy?.(); } catch {}
    this.session = null;
    this.creating = undefined;
  }
}

export const summarizerClient = new SummarizerClient();