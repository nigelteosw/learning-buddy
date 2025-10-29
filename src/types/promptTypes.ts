export type PromptRole = "system" | "user" | "assistant";

// Multimodal content parts. Text is always allowed.
// image/audio are in origin trial, but we include them for futureproofing.
export type PromptPart =
  | { type: "text"; value: string }
  | { type: "image"; value: Blob | File }
  | { type: "audio"; value: Blob | File };

// One conversational turn.
export type PromptMessage = {
  role: PromptRole;
  /**
   * content can be:
   *   - simple string, e.g. "What's the capital of Italy?"
   *   - array of structured parts for multimodal:
   *        [
   *          { type: "text", value: "Here's an image." },
   *          { type: "image", value: fileInput.files[0] }
   *        ]
   */
  content: string | PromptPart[];

  /**
   * Optional. If this is an "assistant" message and prefix===true,
   * the model treats it as a partial assistant reply to continue
   * (useful for constraining output format).
   */
  prefix?: boolean;
};

// Expected modality / languages when creating sessions.
export interface ExpectedModality {
  type: "text" | "image" | "audio";
  languages?: string[]; // e.g. ["en"], or ["en", "ja"]
}

// Global config we keep in the client, similar to your GlobalWriterOpts.
export interface GlobalPromptOpts {
  /**
   * A high-level system instruction describing how the assistant should behave.
   * We'll automatically prepend this as a "system" message in initialPrompts.
   */
  systemPrompt: string;

  /**
   * Conversation history / memory to preload at session creation, e.g. to
   * restore context after a browser restart.
   *
   * We will append this AFTER systemPrompt when we build initialPrompts.
   */
  history: PromptMessage[];

  /**
   * Decoding / sampling configuration. If you don't provide these, we will
   * auto-fill from LanguageModel.params() (defaultTemperature, defaultTopK).
   *
   * IMPORTANT: The Prompt API requires that if you pass temperature or topK,
   * you must pass BOTH.
   */
  temperature?: number;
  topK?: number;

  /**
   * Input expectations, e.g. multimodal text/image/audio plus languages.
   * We'll pass these as expectedInputs to LanguageModel.create().
   */
  expectedInputs?: ExpectedModality[];

  /**
   * Output expectations, e.g. `[{ type: "text", languages: ["en"] }]`.
   * We'll pass these as expectedOutputs to LanguageModel.create().
   */
  expectedOutputs?: ExpectedModality[];
}

// Passed to initFromUserGesture() for first-time setup.
export interface PromptCreateParams {
  // Per-init overrides of global options:
  systemPrompt?: string;
  history?: PromptMessage[];
  temperature?: number;
  topK?: number;
  expectedInputs?: ExpectedModality[];
  expectedOutputs?: ExpectedModality[];

  /**
   * Called on model download progress events.
   * Chrome fires EventTarget "downloadprogress" with e.loaded in [0..1].
   */
  onDownloadProgress?: (loadedFraction: number) => void;

  /**
   * AbortSignal to tie to LanguageModel.create() itself.
   * If aborted, creation should cancel.
   */
  signal?: AbortSignal;
}

// Availability states returned by LanguageModel.availability().
export type PromptAvailability =
  | "available"
  | "downloadable"
  | "downloading"
  | "unavailable"
  | "unknown"
  | "no-api";

// downloadprogress event shape. Docs: console.log(`Downloaded ${e.loaded * 100}%`)
export interface PromptDownloadProgressEvent extends Event {
  loaded: number; // [0..1]
}

// Shape of the session returned by LanguageModel.create().
export interface PromptSession {
  /**
   * Ask the model for a response and wait for the full string.
   *
   * The API examples show two allowed input shapes:
   *   session.prompt("Write me a poem!")
   *   session.prompt([
   *     { role: "user", content: "..." },
   *     { role: "assistant", content: "Presentations are tough!" }
   *   ])
   *
   * We'll normalize our input to one of those shapes in PromptClient.
   */
  prompt(
    input:
      | string
      | {
          role: PromptRole;
          content: string | PromptPart[];
          prefix?: boolean;
        }[],
    opts?: {
      signal?: AbortSignal;
      responseConstraint?: unknown; // JSON Schema or RegExp-like thing
      omitResponseConstraintInput?: boolean;
    }
  ): Promise<string>;

  /**
   * Ask the model for a response, but stream partial text chunks.
   *
   * Docs:
   *   const stream = session.promptStreaming("Write me an extra-long poem!");
   *   for await (const chunk of stream) { ... }
   */
  promptStreaming(
    input:
      | string
      | {
          role: PromptRole;
          content: string | PromptPart[];
          prefix?: boolean;
        }[],
    opts?: {
      signal?: AbortSignal;
      responseConstraint?: unknown;
      omitResponseConstraintInput?: boolean;
    }
  ): AsyncIterable<string>;

  /**
   * Append messages into the session context without immediately asking
   * a question. This "primes" the model with new info, e.g. images,
   * transcripts, notes, etc.
   *
   * Docs:
   *   await session.append([{ role: "user", content: [...] }]);
   */
  append(
    msgs:
      | {
          role: PromptRole;
          content: string | PromptPart[];
          prefix?: boolean;
        }[]
      | {
          role: PromptRole;
          content: string | PromptPart[];
          prefix?: boolean;
        }
  ): Promise<void>;

  /**
   * Clone the session. The cloned session resets conversation context,
   * but keeps the original initial prompt / persona. You can provide
   * a signal to abort clone creation.
   */
  clone(opts?: { signal?: AbortSignal }): Promise<PromptSession>;

  /**
   * Destroy the session and free underlying resources. After destroy(),
   * all further calls reject.
   */
  destroy(): void;

  /**
   * Token budget tracking so you can check how "full" the session is.
   *
   * Docs:
   *   console.log(`${session.inputUsage}/${session.inputQuota}`);
   */
  inputUsage?: number;
  inputQuota?: number;
}
