import {
  type GlobalPromptOpts,
  type PromptAvailability,
  type PromptCreateParams,
  type PromptDownloadProgressEvent,
  type PromptMessage,
  type PromptPart,
  type PromptRole,
  type PromptSession,
} from "@/types/promptTypes";

function hasLanguageModel(): boolean {
  return typeof (self as any).LanguageModel !== "undefined";
}

// The Prompt API exposes LanguageModel.params() which returns model defaults:
// { defaultTopK, maxTopK, defaultTemperature, maxTemperature }
async function getModelParams() {
  const res = await (self as any).LanguageModel.params();
  return res as {
    defaultTopK: number;
    maxTopK: number;
    defaultTemperature: number;
    maxTemperature: number;
  };
}

// Normalize user input to what session.prompt() / session.promptStreaming() accept.
function normalizePromptInput(input: string | PromptMessage[]):
  | string
  | {
      role: PromptRole;
      content: string | PromptPart[];
      prefix?: boolean;
    }[] {
  if (typeof input === "string") {
    return input.trim();
  }

  // Convert PromptMessage[] to the minimal shape the API expects.
  return input.map((m) => ({
    role: m.role,
    content: m.content,
    ...(m.prefix ? { prefix: true } : {}),
  }));
}

export const defaultPromptOpts: GlobalPromptOpts = {
  systemPrompt: "You are a helpful on-device assistant.",
  history: [],
  expectedInputs: [
    { type: "text", languages: ["en"] }, // system + user prompt languages
  ],
  expectedOutputs: [
    { type: "text", languages: ["en"] }, // model response language
  ],
};

class PromptClient {
  private session: PromptSession | null = null;
  private creating?: Promise<PromptSession>;
  private opts: GlobalPromptOpts = { ...defaultPromptOpts };

  /**
   * Update the global defaults. Similar to writerClient.setOpts().
   * This DOES NOT recreate the session automatically. It affects
   * the next initFromUserGesture() if you haven't initialized yet.
   */
  setOpts(next: Partial<GlobalPromptOpts>) {
    this.opts = { ...this.opts, ...next };
  }

  async initFromUserGesture(params?: PromptCreateParams) {
    // If we already have a session, just bail.
    if (this.session) return;

    // If there is already a "creating" promise in flight, await that.
    if (this.creating) {
      await this.creating;
      return;
    }

    // Check API presence early.
    if (!hasLanguageModel()) {
      throw new Error(
        "Prompt API (LanguageModel) not available in this context."
      );
    }

    // Merge global opts + one-time init overrides.
    // Arrays/fields like history or expectedInputs should prefer params if provided.
    const merged: GlobalPromptOpts = {
      ...this.opts,
      ...params,
      history: params?.history ?? this.opts.history,
      expectedInputs: params?.expectedInputs ?? this.opts.expectedInputs,
      expectedOutputs: params?.expectedOutputs ?? this.opts.expectedOutputs,
      systemPrompt: params?.systemPrompt ?? this.opts.systemPrompt,
      temperature: params?.temperature ?? this.opts.temperature,
      topK: params?.topK ?? this.opts.topK,
    };

    // The API requires: either BOTH (temperature, topK) are provided or NEITHER.
    // If not both provided, we fill them from LanguageModel.params().
    if (merged.temperature === undefined || merged.topK === undefined) {
      const modelParams = await getModelParams();
      if (merged.temperature === undefined) {
        merged.temperature = modelParams.defaultTemperature;
      }
      if (merged.topK === undefined) {
        merged.topK = modelParams.defaultTopK;
      }
    }

    // Build initialPrompts for create():
    // We ALWAYS prepend the systemPrompt (if non-empty) as role:"system".
    const initialPrompts: PromptMessage[] = [];
    if (merged.systemPrompt?.trim()) {
      initialPrompts.push({
        role: "system",
        content: merged.systemPrompt.trim(),
      });
    }
    if (merged.history && merged.history.length > 0) {
      initialPrompts.push(...merged.history);
    }

    // Best-effort availability() check per spec.
    // Spec note: "Always pass the same options to availability() that you use
    // in prompt() or promptStreaming()." They don't show structured args,
    // so we just call it plain. We'll catch errors gracefully.
    try {
      if ((self as any).LanguageModel.availability) {
        await (self as any).LanguageModel.availability();
      }
    } catch (err) {
      console.warn("LanguageModel.availability() threw:", err);
    }

    // Prepare create() options for LanguageModel.create().
    const createOptions: Record<string, any> = {
      temperature: merged.temperature,
      topK: merged.topK,
      initialPrompts,
      expectedInputs: merged.expectedInputs,
      expectedOutputs: merged.expectedOutputs,
      signal: params?.signal,
      monitor: (m: EventTarget) => {
        if (params?.onDownloadProgress) {
          m.addEventListener("downloadprogress", (e) => {
            const ev = e as PromptDownloadProgressEvent;
            params.onDownloadProgress?.(ev.loaded);
          });
        }
      },
    };

    // Actually create and store session.
    this.creating = (self as any).LanguageModel.create(createOptions)
      .then((s: PromptSession) => {
        this.session = s;
        // Persist the merged config as our new baseline.
        this.opts = merged;
        return s;
      })
      .finally(() => {
        this.creating = undefined;
      });

    await this.creating;
  }

  async prompt(
    input: string | PromptMessage[],
    {
      signal,
      responseConstraint,
      omitResponseConstraintInput,
    }: {
      signal?: AbortSignal;
      responseConstraint?: unknown;
      omitResponseConstraintInput?: boolean;
    } = {}
  ): Promise<string> {
    if (!this.session) {
      throw new Error(
        "Prompt model not initialized. Call initFromUserGesture() on a user click first."
      );
    }

    const normalizedInput = normalizePromptInput(input);

    return await this.session.prompt(normalizedInput, {
      signal,
      responseConstraint,
      omitResponseConstraintInput,
    });
  }

  /**
   * Ask the model something and get an async iterator of chunks.
   * Use this for long outputs (so you can render streaming text in UI).
   */
  async promptStreaming(
    input: string | PromptMessage[],
    {
      signal,
      responseConstraint,
      omitResponseConstraintInput,
    }: {
      signal?: AbortSignal;
      responseConstraint?: unknown;
      omitResponseConstraintInput?: boolean;
    } = {}
  ): Promise<AsyncIterable<string>> {
    if (!this.session) {
      throw new Error(
        "Prompt model not initialized. Call initFromUserGesture() on a user click first."
      );
    }

    const normalizedInput = normalizePromptInput(input);

    return this.session.promptStreaming(normalizedInput, {
      signal,
      responseConstraint,
      omitResponseConstraintInput,
    });
  }

  private async runStreamingPrompt(
    builder: () => string,
    signal?: AbortSignal
  ): Promise<AsyncIterable<string>> {
    if (!this.session) {
      throw new Error(
        "Prompt session not initialized. Call initFromUserGesture() first."
      );
    }

    // build the final prompt text
    const raw = builder().trim().replace(/\s+/g, " ");
    if (!raw) {
      // Return an empty async generator if there's no content
      async function* emptyGen() {
        /* nothing */
      }
      return emptyGen();
    }

    // We assume TextSession.promptStreaming(prompt, { signal }) exists
    // and returns AsyncIterable<string>.
    return this.session.promptStreaming(raw, { signal });
  }

  async generateELI5Stream(
    text: string,
    { signal }: { signal?: AbortSignal } = {}
  ): Promise<AsyncIterable<string>> {
    return this.runStreamingPrompt(
      () =>
        `Explain the following concept like I'm 5 years old:\n\n"${text}"`,
      signal
    );
  }

  async generateAnalogyStream(
    text: string,
    { signal }: { signal?: AbortSignal } = {}
  ): Promise<AsyncIterable<string>> {
    return this.runStreamingPrompt(
      () =>
        `Provide a simple analogy to help understand this concept:\n\n"${text}"`,
      signal
    );
  }

  async generateTakeawaysStream(
    text: string,
    { signal }: { signal?: AbortSignal } = {}
  ): Promise<AsyncIterable<string>> {
    return this.runStreamingPrompt(
      () =>
        `List the 3 most important key takeaways from this text, as a bulleted list:\n\n"${text}"`,
      signal
    );
  }

  async generateQuizStream(
    text: string,
    { signal }: { signal?: AbortSignal } = {}
  ): Promise<AsyncIterable<string>> {
    return this.runStreamingPrompt(
      () =>
        `Based on the text below, create a simple multiple-choice question with one correct answer (A, B, C, or D) to test understanding. Clearly label the question, the options, and indicate the correct answer.

Text:
"${text}"

Format:
Question: [Your question here]
A) [Option A]
B) [Option B]
C) [Option C]
D) [Option D]
Correct Answer: [Letter only, e.g., B]`,
      signal
    );
  }

  /**
   * Append extra context to the active session without asking a direct question yet.
   * This primes the model. Great for "here's an image", "here's some notes", etc.
   */
  async append(msgs: PromptMessage | PromptMessage[]): Promise<void> {
    if (!this.session) {
      throw new Error(
        "Prompt model not initialized. Call initFromUserGesture() on a user click first."
      );
    }

    const arr = Array.isArray(msgs) ? msgs : [msgs];

    // We do NOT re-normalize heavily here, because append() in the spec
    // already expects the structured array-of-messages form.
    return this.session.append(
      arr.map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.prefix ? { prefix: true } : {}),
      }))
    );
  }

  /**
   * Clone the current session. The cloned session drops conversation context
   * but keeps the same persona / initial prompts.
   *
   * If makeActive=true, we replace our stored session with the clone.
   * Otherwise, we just hand you the clone; you manage it yourself.
   */
  async cloneSession({
    signal,
    makeActive = false,
  }: {
    signal?: AbortSignal;
    makeActive?: boolean;
  } = {}): Promise<PromptSession> {
    if (!this.session) {
      throw new Error(
        "Prompt model not initialized. Call initFromUserGesture() on a user click first."
      );
    }

    const cloned = await this.session.clone({ signal });

    if (makeActive) {
      this.session = cloned;
    }

    return cloned;
  }

  /**
   * Check how full the session context window is.
   * Returns { inputUsage, inputQuota } or zeros if no session.
   */
  getUsage() {
    if (!this.session) {
      return { inputUsage: 0, inputQuota: 0 };
    }
    const { inputUsage = 0, inputQuota = 0 } = this.session;
    return { inputUsage, inputQuota };
  }

  async availability(): Promise<PromptAvailability> {
    if (!hasLanguageModel()) {
      console.warn("LanguageModel API not found on self.");
      return "no-api";
    }

    const lm: any = (self as any).LanguageModel;
    if (!lm.availability) {
      console.warn("LanguageModel.availability() not found.");
      return "unknown";
    }

    try {
      const state = await lm.availability();
      const known: PromptAvailability[] = [
        "available",
        "downloadable",
        "downloading",
        "unavailable",
        "unknown",
        "no-api",
      ];

      if ((known as string[]).includes(state)) {
        return state as PromptAvailability;
      }

      console.warn(
        "LanguageModel.availability() returned unexpected state:",
        state
      );
      return "unknown";
    } catch (err) {
      console.error("Error calling LanguageModel.availability():", err);
      return "unavailable";
    }
  }

  /**
   * Destroy the current session and clear all refs.
   * After dispose(), you'll need to call initFromUserGesture() again
   * (from a user gesture) to recreate.
   */
  dispose() {
    try {
      this.session?.destroy?.();
    } catch (err) {
      console.warn("Error during prompt session disposal:", err);
    }
    this.session = null;
    this.creating = undefined;
  }
}

export const promptClient = new PromptClient();
