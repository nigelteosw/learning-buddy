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

export type WriterAvailability =
  | "available"
  | "downloadable"
  | "downloading"
  | "unavailable"
  | "unknown";

export type CreateParams = Partial<GlobalWriterOpts> & {
  onDownloadProgress?: (p: number) => void;
};

export interface WriterDownloadProgressEvent extends Event {
  loaded: number;
}

export interface WriterCreateOptions {
  tone?: WriterTone;
  format?: WriterFormat;
  length?: WriterLength;
  sharedContext?: string;
  monitor?: (monitor: EventTarget) => void;
}

export interface WriterSession {
  write(
    text: string,
    opts?: { signal?: AbortSignal; context?: string }
  ): Promise<string>;
  writeStreaming(
    text: string,
    opts?: { signal?: AbortSignal; context?: string }
  ): AsyncIterable<string>;
  destroy(): void;
}

export interface WriterStatic {
  availability?(): Promise<WriterAvailability>;
  create(options: WriterCreateOptions): Promise<WriterSession>;
}

declare global {
  interface Window {
    Writer?: WriterStatic;
  }
}