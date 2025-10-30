// src/lib/writerClient.ts
import {
  type GlobalWriterOpts,
  type CreateParams,
  type WriterSession,
  type WriterCreateOptions,
  type WriterDownloadProgressEvent,
  type WriterAvailability,
  SUPPORTED_LANGUAGES, // Import constants/types as needed
} from "@/types/writerTypes"; 
import { checkModelAvailability, getDefaultLanguage } from '@/lib/utils/language';

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
  private availabilityStatus: WriterAvailability | "no-api" | "unknown" | null =
    null;

  setOpts(next: Partial<GlobalWriterOpts>) {
    this.opts = { ...this.opts, ...next };
  }

  /** Must be called from a user gesture (click) in content/popup */
  async initFromUserGesture(params?: CreateParams) {
    // Reset availability status on re-init.
    this.availabilityStatus = null;
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
  async availability(
    force: boolean = false
  ): Promise<WriterAvailability | "no-api" | "unknown"> {
    if (this.availabilityStatus && !force) {
      return this.availabilityStatus;
    }

    const knownStates: readonly WriterAvailability[] = [
      "available",
      "downloadable",
      "downloading",
      "unavailable",
      "unknown",
    ];
    const status = await checkModelAvailability("Writer", knownStates);
    this.availabilityStatus = status;
    return status;
  }

  dispose() {
    try {
      this.session?.destroy?.();
    } catch (e) {
      console.warn("Error during writer session disposal:", e);
    }
    this.session = null;
    this.creating = undefined;
    this.availabilityStatus = null;
  }
}

export const writerClient = new WriterClient();
