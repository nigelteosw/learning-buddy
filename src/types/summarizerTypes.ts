// src/lib/summarizerTypes.ts

// --- Core Types ---
export type SummaryType = "key-points" | "tldr" | "teaser" | "headline";
export type SummaryLength = "short" | "medium" | "long";
export type SummaryFormat = "markdown" | "plain-text";

// --- Global Options Type ---
export type GlobalSummarizerOpts = {
  type: SummaryType;
  length: SummaryLength;
  format: SummaryFormat;
  outputLanguage: "en" | "es" | "ja";
  sharedContext?: string;
};

// --- API Interface Types ---
export type SummarizerAvailability =
  | "available"
  | "downloadable"
  | "downloading"
  | "unavailable"
  | "unknown"; // Keep the string literal union

export interface SummarizerDownloadProgressEvent extends Event {
  loaded: number;
}

export interface SummarizerCreateOptions {
  type?: SummaryType;
  length?: SummaryLength;
  format?: SummaryFormat;
  sharedContext?: string;
  outputLanguage?: "en" | "es" | "ja";
  monitor?: (monitor: EventTarget) => void;
}

export interface SummarizerSession {
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
  ): AsyncIterable<string>; // Added streaming
  destroy(): void;
}

export interface SummarizerStatic {
  availability?(): Promise<SummarizerAvailability>;
  create(options: SummarizerCreateOptions): Promise<SummarizerSession>;
}

// --- Extend Global Window Interface ---
declare global {
  interface Window {
    Summarizer?: SummarizerStatic;
  }
}

// --- Parameter Type for Initialization ---
export type CreateParams = Partial<GlobalSummarizerOpts> & {
  onDownloadProgress?: (p: number) => void;
};