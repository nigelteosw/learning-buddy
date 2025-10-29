// --- 1. Define Core Types First ---
export type SummaryType = "key-points" | "tldr" | "teaser" | "headline";
export type SummaryLength = "short" | "medium" | "long";
export type SummaryFormat = "markdown" | "plain-text";

// --- 2. Define Global Options using Core Types ---
export type GlobalSummarizerOpts = {
  type: SummaryType;
  length: SummaryLength;
  format: SummaryFormat;
  outputLanguage: "en" | "es" | "ja";
  sharedContext?: string;
};

// --- 3. Define Default Options ---
export const defaultSummarizerOpts: GlobalSummarizerOpts = {
  sharedContext:
    "These are requests to summarize a concept. DO NOT use the name of the concepts in your summary.",
  type: "tldr",
  length: "short",
  format: "plain-text",
  outputLanguage: ["en", "es", "ja"].includes(
    (navigator.language || "en").slice(0, 2)
  )
    ? (navigator.language.slice(0, 2) as "en" | "es" | "ja")
    : "en",
};

// --- 4. Define API Interface Types ---
type SummarizerAvailability =
  | "available"
  | "downloadable"
  | "downloading"
  | "unavailable"
  | "unknown";

interface SummarizerDownloadProgressEvent extends Event {
  loaded: number;
}

interface SummarizerCreateOptions {
  type?: SummaryType;
  length?: SummaryLength;
  format?: SummaryFormat;
  sharedContext?: string;
  outputLanguage?: "en" | "es" | "ja";
  monitor?: (monitor: EventTarget) => void;
}

interface SummarizerSession {
  summarize(
    text: string,
    opts?: {
      outputLanguage?: "en" | "es" | "ja";
      signal?: AbortSignal;
      context?: string;
    }
  ): Promise<string>;
  summarizeStreaming(
    text: string,
    opts?: {
      outputLanguage?: "en" | "es" | "ja";
      signal?: AbortSignal;
      context?: string;
    }
  ): AsyncIterable<string>;
  destroy(): void;
}

interface SummarizerStatic {
  availability?(): Promise<SummarizerAvailability>;
  create(options: SummarizerCreateOptions): Promise<SummarizerSession>;
}

// --- 5. Extend Global Window Interface ---
declare global {
  interface Window {
    Summarizer?: SummarizerStatic;
  }
}

// --- 6. Define Parameter Type for Initialization ---
// (Use Partial<> to make base options optional when creating)
export type CreateParams = Partial<GlobalSummarizerOpts> & {
  onDownloadProgress?: (p: number) => void;
};

// --- (The rest of your SummarizerClient class goes here) ---

class SummarizerClient {
  private session: SummarizerSession | null = null;
  private creating?: Promise<SummarizerSession>;
  private opts: GlobalSummarizerOpts = defaultSummarizerOpts;

  setOpts(next: Partial<GlobalSummarizerOpts>) {
    this.opts = { ...this.opts, ...next };
  }

  async availability(): Promise<
    | "available"
    | "downloadable"
    | "downloading"
    | "unavailable"
    | "unknown"
    | "no-api"
  > {
    // 1. Check if the main Summarizer API exists
    if (!self.Summarizer) {
      console.warn("Summarizer API not found on self.");
      return "no-api";
    }
    // 2. Check if the availability method exists
    if (!self.Summarizer.availability) {
      console.warn("Summarizer.availability() method not found.");
      return "unknown";
    }

    // 3. Call the browser's availability function
    try {
      const state = await self.Summarizer.availability();
      if (
        [
          "available",
          "downloadable",
          "downloading",
          "unavailable",
          "unknown",
        ].includes(state)
      ) {
        return state as
          | "available"
          | "downloadable"
          | "downloading"
          | "unavailable"
          | "unknown";
      }
      console.warn(
        "Summarizer.availability() returned unexpected state:",
        state
      );
      return "unknown";
    } catch (e) {
      console.error("Error calling Summarizer.availability():", e);
      return "unavailable";
    }
  }

  /** Must be called from a user gesture (click) in content/popup */
  async initFromUserGesture(params?: CreateParams) {
    if (this.session) return;
    if (this.creating) {
      await this.creating;
      return;
    }

    // Optional: Add availability check here like in WriterClient if needed
    // const availabilityState = await this.availability(); ... handle states ...

    // Fallback check
    if (!self.Summarizer) {
      throw new Error("Web Summarizer API not available in this context.");
    }

    // Simplify Options Merging
    const finalOpts = { ...this.opts, ...params };

    const createOpts: SummarizerCreateOptions = {
      type: finalOpts.type,
      length: finalOpts.length,
      format: finalOpts.format,
      sharedContext: finalOpts.sharedContext,
      outputLanguage: finalOpts.outputLanguage,
      monitor: (m: EventTarget) => {
        // Use specific type
        if (params?.onDownloadProgress) {
          m.addEventListener("downloadprogress", (e) =>
            params.onDownloadProgress?.(
              // Cast event to access 'loaded'
              (e as SummarizerDownloadProgressEvent).loaded
            )
          );
        }
      },
    };

    this.creating = self
      .Summarizer!.create(createOpts) // Use ! since we checked above
      .then((s: SummarizerSession) => {
        // Use specific type
        this.session = s;
        return s;
      })
      .finally(() => {
        this.creating = undefined;
      });

    await this.creating;
  }

  /** Can be called later without user activation (reuses the session) */
  async summarize(
    text: string,
    { signal, context }: { signal?: AbortSignal; context?: string } = {}
  ) {
    if (!this.session) {
      throw new Error(
        "Summarizer not initialized. Call initFromUserGesture() on a user click first."
      );
    }
    const input = text.trim().replace(/\s+/g, " ");
    if (!input) return "";

    // Session methods are now typed
    return await this.session.summarize(input, {
      outputLanguage: this.opts.outputLanguage, // Pass outputLanguage from stored opts
      signal,
      context,
    });
  }

  /**
   * Calls the underlying session's summarizeStreaming method (assumed).
   * Returns an async iterable stream of text chunks.
   */
  async summarizeStreaming(
    text: string,
    { signal, context }: { signal?: AbortSignal; context?: string } = {}
  ): Promise<AsyncIterable<string>> { // Return type matches interface
    if (!this.session) {
      throw new Error(
        "Summarizer not initialized. Call initFromUserGesture() on a user click first."
      );
    }
    const input = text.trim().replace(/\s+/g, " ");
    if (!input) {
      // Return an empty async iterable if input is empty
      async function* emptyGenerator(): AsyncIterable<string> {}
      return emptyGenerator();
    }

    // Check if the method actually exists on the session before calling
    if (typeof this.session.summarizeStreaming !== 'function') {
        throw new Error("Summarizer session does not support summarizeStreaming.");
    }

    // Call the session's streaming method and return the stream directly
    return this.session.summarizeStreaming(input, {
      outputLanguage: this.opts.outputLanguage, // Pass relevant options
      signal,
      context,
    });
  }

  dispose() {
    try {
      this.session?.destroy?.();
    } catch (e) {
      console.warn("Error during summarizer session disposal:", e);
    }
    this.session = null;
    this.creating = undefined;
  }
}

export const summarizerClient = new SummarizerClient();
