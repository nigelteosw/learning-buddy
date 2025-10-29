// --- 1. Define the (hypothetical) Writer API Types ---
import {
  type GlobalWriterOpts,
  type CreateParams,
  type WriterSession,
  type WriterCreateOptions,
  type WriterDownloadProgressEvent,
  type WriterAvailability,
  SUPPORTED_LANGUAGES, // Import constants/types as needed
  type SupportedLanguage,
} from '@/types/writerTypes';


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
  ): Promise<AsyncIterable<string>> { // Return type matches interface
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

    // Call the session's streaming method and return the stream directly
    // Note: This method itself might not need to be async if it just returns the iterable
    // but keeping it async allows for potential future checks.
    return this.session.writeStreaming(input, {
      signal,
      context,
    });
  }

  async availability(): Promise<
    'available' | 'downloadable' | 'downloading' | 'unavailable' | 'unknown' | 'no-api'
  > {
    // 1. Check if the main Writer API exists
    if (!self.Writer) {
      console.warn("Writer API not found on self.");
      return 'no-api';
    }
    // 2. Check if the specific availability method exists
    if (!self.Writer.availability) {
       console.warn("Writer.availability() method not found.");
       // If the main API exists but availability doesn't, assume it might be available
       // but we can't be sure about downloading state.
       return 'unknown';
    }

    // 3. Call the browser's availability function
    try {
      const state = await self.Writer.availability();
      // The official docs mention 'available', 'downloadable', 'downloading'.
      // Add 'unavailable' and 'unknown' as likely possibilities.
      // Explicitly check for expected values.
      if (['available', 'downloadable', 'downloading', 'unavailable', 'unknown'].includes(state)) {
         return state as 'available' | 'downloadable' | 'downloading' | 'unavailable' | 'unknown';
      }
      console.warn("Writer.availability() returned unexpected state:", state);
      return 'unknown';
    } catch (e) {
      console.error("Error calling Writer.availability():", e);
      return 'unavailable'; // Treat errors as unavailable
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
