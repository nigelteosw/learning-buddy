import {
  type GlobalSummarizerOpts,
  type CreateParams,
  type SummarizerSession,
  type SummarizerCreateOptions,
  type SummarizerDownloadProgressEvent,
  type SummarizerAvailability, // Import the type alias
} from "@/types/summarizerTypes";

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


class SummarizerClient {
  private session: SummarizerSession | null = null;
  private creating?: Promise<SummarizerSession>;
  private opts: GlobalSummarizerOpts = defaultSummarizerOpts;

  setOpts(next: Partial<GlobalSummarizerOpts>) {
    this.opts = { ...this.opts, ...next };
  }

  async availability(): Promise<SummarizerAvailability | 'no-api' | 'unknown'> {
    if (!self.Summarizer) {
      console.warn("Summarizer API not found on self.");
      return "no-api";
    }
    if (!self.Summarizer.availability) {
      console.warn("Summarizer.availability() method not found.");
      return "unknown";
    }
    try {
      const state = await self.Summarizer.availability();
      // Define known states based on the imported type
      const knownStates: SummarizerAvailability[] = [
          'available', 'downloadable', 'downloading', 'unavailable', 'unknown'
      ];
      if ((knownStates as string[]).includes(state)) {
         return state as SummarizerAvailability; // Cast to imported type
      }
      console.warn("Summarizer.availability() returned unexpected state:", state);
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
