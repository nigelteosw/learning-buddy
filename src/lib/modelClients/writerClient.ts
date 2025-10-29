// src/lib/writerClient.ts
import {
  type GlobalWriterOpts,
  type CreateParams,
  type WriterSession,
  type WriterCreateOptions,
  type WriterDownloadProgressEvent,
  type WriterAvailability,
  SUPPORTED_LANGUAGES, // Import constants/types as needed
  type SupportedLanguage,
} from "@/types/writerTypes";

// Language Checking
function isSupportedLanguage(lang: string): lang is SupportedLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(lang);
}

function getDefaultLanguage(): SupportedLanguage {
  const browserLang = (navigator.language || "en").slice(0, 2);
  if (isSupportedLanguage(browserLang)) {
    return browserLang;
  }
  return "en";
}

export const defaultWriterOpts: GlobalWriterOpts = {
  sharedContext: "Simplify this concept for me.",
  tone: "casual",
  format: "plain-text",
  length: "medium",
  outputLanguage: getDefaultLanguage(),
};

class WriterClient {
  // --- 4. Use Specific Types instead of "any" ---
  private session: WriterSession | null = null;
  private creating?: Promise<WriterSession>; // Use real type
  private opts: GlobalWriterOpts = defaultWriterOpts;

  setOpts(next: Partial<GlobalWriterOpts>) {
    this.opts = { ...this.opts, ...next };
  }

  /** Must be called from a user gesture (click) in content/popup */
  async initFromUserGesture(params?: CreateParams) {
    if (this.session) return;
    if (this.creating) {
      await this.creating;
      return;
    }

    if (!self.Writer) {
      throw new Error("Web Writer API not available in this context.");
    }

    // --- 5. Simplify Options Merging ---
    const finalOpts = { ...this.opts, ...params };

    const createOpts: WriterCreateOptions = {
      tone: finalOpts.tone,
      format: finalOpts.format,
      length: finalOpts.length,
      sharedContext: finalOpts.sharedContext,
      monitor: (m: EventTarget) => {
        if (params?.onDownloadProgress) {
          m.addEventListener("downloadprogress", (e) =>
            params.onDownloadProgress?.(
              (e as WriterDownloadProgressEvent).loaded
            )
          );
        }
      },
    };

    this.creating = self
      .Writer!.create(createOpts)
      .then((s: WriterSession) => {
        this.session = s;
        return s;
      })
      .finally(() => {
        this.creating = undefined;
      });

    await this.creating;
  }

  /** Can be called later without user activation (reuses the session) */
  async write(
    text: string,
    { signal, context }: { signal?: AbortSignal; context?: string } = {}
  ) {
    if (!this.session) {
      throw new Error(
        "Writer not initialized. Call initFromUserGesture() on a user click first."
      );
    }
    const input = text.trim().replace(/\s+/g, " ");
    if (!input) return "";

    // Type casting is no longer needed, session.write is typed
    return await this.session.write(input, {
      signal,
      context,
    });
  }

  /**
   * Calls the underlying session's writeStreaming method.
   * Returns an async iterable stream of text chunks.
   */
  async writeStreaming(
    text: string,
    { signal, context }: { signal?: AbortSignal; context?: string } = {}
  ): Promise<AsyncIterable<string>> {
    // Return type matches interface
    if (!this.session) {
      throw new Error(
        "Writer not initialized. Call initFromUserGesture() on a user click first."
      );
    }
    const input = text.trim().replace(/\s+/g, " ");
    if (!input) {
      // Return an empty async iterable if input is empty
      async function* emptyGenerator(): AsyncIterable<string> {}
      return emptyGenerator();
    }

    return this.session.writeStreaming(input, {
      signal,
      context,
    });
  }

  /**
   * Checks availability of the writer.
   */
  async availability(): Promise<WriterAvailability | "no-api" | "unknown"> {
    if (!self.Writer) {
      console.warn("Writer API not found on self.");
      return "no-api"; // Return the specific 'no-api' string
    }
    if (!self.Writer.availability) {
      console.warn("Writer.availability() method not found.");
      return "unknown"; // Return the specific 'unknown' string
    }

    try {
      const state = await self.Writer.availability();

      // Define the known states from your type
      const knownStates: WriterAvailability[] = [
        "available",
        "downloadable",
        "downloading",
        "unavailable",
        "unknown",
      ];

      // 3. Check if the returned state is one of the known ones
      if ((knownStates as string[]).includes(state)) {
        // 4. Cast to your type alias
        return state as WriterAvailability;
      }

      console.warn("Writer.availability() returned unexpected state:", state);
      return "unknown"; // Fallback to 'unknown' for unexpected states
    } catch (e) {
      console.error("Error calling Writer.availability():", e);
      return "unavailable"; // Treat errors as 'unavailable'
    }
  }

  dispose() {
    try {
      this.session?.destroy?.();
    } catch (e) {
      console.warn("Error during writer session disposal:", e);
    }
    this.session = null;
    this.creating = undefined;
  }
}

export const writerClient = new WriterClient();
