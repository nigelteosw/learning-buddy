// --- 1. Define the (hypothetical) Writer API Types ---
// By defining the API, we can remove all "any" types.

type WriterAvailability = "available" | "unavailable" | "unknown";

// The event for download progress
interface WriterDownloadProgressEvent extends Event {
  loaded: number;
}

// Options for creating a session
interface WriterCreateOptions {
  tone?: WriterTone;
  format?: WriterFormat;
  length?: WriterLength;
  sharedContext?: string;
  monitor?: (monitor: EventTarget) => void;
}

// The session object itself
interface WriterSession {
  write(
    text: string,
    opts?: { signal?: AbortSignal; context?: string }
  ): Promise<string>;
  writeStreaming(
   text: string,
    opts?: { signal?: AbortSignal; context?: string }
  ): Promise<string>;
  destroy(): void;
}

// The static Writer API on the global scope
interface WriterStatic {
  availability?(): Promise<WriterAvailability>;
  create(options: WriterCreateOptions): Promise<WriterSession>;
}

// Tell TypeScript that `self` (window) might have this `Writer` property
declare global {
  interface Window {
    Writer?: WriterStatic;
  }
}

// --- 2. Make Types DRY (Don't Repeat Yourself) ---

export const SUPPORTED_LANGUAGES = ["en", "es", "ja"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export type WriterTone = "formal" | "neutral" | "casual";
export type WriterFormat = "markdown" | "plain-text";
export type WriterLength = "short" | "medium" | "long";

export type GlobalWriterOpts = {
  tone: WriterTone;
  format: WriterFormat;
  length: WriterLength;
  outputLanguage: SupportedLanguage; // Use the new type
  sharedContext?: string;
};

// --- 3. Encapsulate Complex Logic ---
function getDefaultLanguage(): SupportedLanguage {
  const lang = navigator.language.slice(0, 2);
  if (SUPPORTED_LANGUAGES.includes(lang as any)) {
    return lang as SupportedLanguage;
  }
  return "en";
}

export const defaultWriterOpts: GlobalWriterOpts = {
  sharedContext: "Simplify this concept for me.",
  tone: "casual",
  format: "plain-text",
  length: "medium",
  outputLanguage: getDefaultLanguage(), // Much cleaner
};

type CreateParams = Partial<GlobalWriterOpts> & {
  onDownloadProgress?: (p: number) => void;
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

    // Use self.Writer directly, thanks to `declare global`
    if (!self.Writer) {
      throw new Error("Web Writer API not available in this context.");
    }

    try {
      const availability = await self.Writer.availability?.();
      if (availability === "unavailable") {
        throw new Error("Writer unavailable.");
      }
    } catch (e) {
      // Don't throw, just warn. Let create() be the final source of failure.
      console.warn("Error checking Writer availability:", e);
    }

    // --- 5. Simplify Options Merging ---
    const finalOpts = { ...this.opts, ...params };

    const createOpts: WriterCreateOptions = {
      tone: finalOpts.tone,
      format: finalOpts.format,
      length: finalOpts.length,
      sharedContext: finalOpts.sharedContext,
      monitor: (m: EventTarget) => {
        // <-- CORRECTED: 'm' is EventTarget
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

  async writeStreaming(
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
    return await this.session.writeStreaming(input, {
      signal,
      context,
    });
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
