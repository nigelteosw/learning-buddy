// src/lib/writerClient.ts
import {
  GlobalWriterOpts,
  type CreateParams,
  type WriterSession,
  type WriterCreateOptions,
  type WriterDownloadProgressEvent,
  type WriterAvailability,
  SUPPORTED_LANGUAGES, // Import constants/types as needed
} from "@/types/writerTypes";
import { getDefaultLanguage } from '@/lib/utils/language';
import { BaseModelClient } from './baseClient';

export const defaultWriterOpts: GlobalWriterOpts = {
  sharedContext: "Simplify this concept for me.",
  tone: "casual",
  format: "plain-text",
  length: "medium",
  outputLanguage: getDefaultLanguage(),
};

const WRITER_KNOWN_STATES: readonly WriterAvailability[] = [
  "available",
  "downloadable",
  "downloading",
  "unavailable",
  "unknown",
];

class WriterClient extends BaseModelClient<WriterSession, GlobalWriterOpts, WriterAvailability, CreateParams> {
  constructor() {
    super(defaultWriterOpts, 'Writer', WRITER_KNOWN_STATES);
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
}

export const writerClient = new WriterClient();
