import {
  type GlobalPromptOpts,
  type ExpectedModality,
  type PromptAvailability,
  type PromptCreateParams,
  type PromptDownloadProgressEvent,
  type PromptMessage,
  type PromptPart,
  type PromptRole,
  type PromptSession,
} from "@/types/promptTypes";
import { checkModelAvailability, getDefaultLanguage } from "@/lib/utils/language";
import { Card } from "../db";

// Define a type for the browser's LanguageModel API to avoid 'any'
type LanguageModel = {
  create(options: {
    initialPrompts?: PromptMessage[];
    expectedInputs?: ExpectedModality[];
    expectedOutputs?: ExpectedModality[];
    temperature?: number;
    topK?: number;
    signal?: AbortSignal;
    monitor?: (m: EventTarget) => void;
  }): Promise<PromptSession>;
  params: () => Promise<{
    defaultTopK: number;
    maxTopK: number;
    defaultTemperature: number;
    maxTemperature: number;
  }>;
  availability: () => Promise<PromptAvailability>;
};

function hasLanguageModel(): boolean {
  return typeof (self as any).LanguageModel?.create === "function";
}

async function getModelParams() {
  return (self as any).LanguageModel.params();
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
    { type: "text", languages: [getDefaultLanguage()] }, // system + user prompt languages
  ],
  expectedOutputs: [
    { type: "text", languages: [getDefaultLanguage()] }, // model response language
  ],
};

class PromptClient {
  private session: PromptSession | null = null;
  private creating?: Promise<PromptSession>;
  private opts: GlobalPromptOpts = { ...defaultPromptOpts };
  private availabilityStatus: PromptAvailability | null = null;
  private pairCache = new Map<number, { trueText: string; falseText: string }>();

  /**
   * Update the global defaults. Similar to writerClient.setOpts().
   * This DOES NOT recreate the session automatically. It affects
   * the next initFromUserGesture() if you haven't initialized yet.
   */
  setOpts(next: Partial<GlobalPromptOpts>) {
    this.opts = { ...this.opts, ...next };
  }

  /**
   * Normalizes temperature and topK based on model capabilities.
   * @returns Sanitized tuning parameters or undefined if not supported.
   */
  private async _getTuningParams(
    params: PromptCreateParams | undefined
  ): Promise<{ temperature?: number; topK?: number }> {
    const modelParams = await getModelParams();

    const supportsTopK =
      typeof modelParams?.maxTopK === "number" && modelParams.maxTopK > 0;

    if (!supportsTopK) {
      // Device does not support topK -> must omit BOTH tuning params
      return { temperature: undefined, topK: undefined };
    }

    // Start with provided params, fallback to instance options, then model defaults
    let temperature =
      params?.temperature ??
      this.opts.temperature ??
      modelParams.defaultTemperature;
    let topK = params?.topK ?? this.opts.topK ?? modelParams.defaultTopK;

    // Sanitize topK into valid range [1, maxTopK]
    if (typeof topK !== "number" || !Number.isFinite(topK)) {
      topK = modelParams.defaultTopK;
    }
    topK = Math.round(topK);
    if (topK < 1) {
      topK = 1;
    }
    if (topK > modelParams.maxTopK) {
      topK = modelParams.maxTopK;
    }

    // Sanitize temperature into [0, maxTemperature]
    const maxT =
      typeof modelParams.maxTemperature === "number"
        ? modelParams.maxTemperature
        : 2;
    if (typeof temperature !== "number" || !Number.isFinite(temperature)) {
      temperature = modelParams.defaultTemperature ?? 1;
    }
    if (temperature < 0) {
      temperature = 0;
    }
    if (temperature > maxT) {
      temperature = maxT;
    }

    return { temperature, topK };
  }

  async initFromUserGesture(params?: PromptCreateParams) {
    // If we already have a session, just bail.
    // Reset availability status on re-init.
    this.availabilityStatus = null;

    if (this.session) return;

    // If there is already a "creating" promise in flight, await that.
    if (this.creating) {
      await this.creating;
      return;
    }

    // Check API presence early.
    if (!hasLanguageModel()) {
      throw new Error("Prompt API (LanguageModel) not available in this context.");
    }

    // Merge global opts + one-time init overrides.
    // Arrays/fields like history or expectedInputs should prefer params if provided.
    const merged: GlobalPromptOpts = { ...this.opts, ...params };

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

    const { temperature, topK } = await this._getTuningParams(params);

    // ---- build create() options ----------------------------------------
    const createOptions: Record<string, any> = {
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

    // Only include tuning if valid & supported (spec: either both or neither)
    if (temperature !== undefined && topK !== undefined) {
      createOptions.temperature = temperature;
      createOptions.topK = topK;
    }

    // Persist cleaned values back into opts for future calls/clones
    merged.temperature = temperature;
    merged.topK = topK;

    // Actually create and store session.
    const lm = (self as any as { LanguageModel: LanguageModel }).LanguageModel;
    this.creating = lm.create(createOptions)
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

  private async _runStreamingPrompt(
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
    return this._runStreamingPrompt(
      () =>
        `Explain the following concept like I'm 5 years old:\n\n"${text}"`,
      signal
    );
  }

  async generateAnalogyStream(
    text: string,
    { signal }: { signal?: AbortSignal } = {}
  ): Promise<AsyncIterable<string>> {
    return this._runStreamingPrompt(
      () =>
        `Provide a simple analogy to help understand this concept:\n\n"${text}"`,
      signal
    );
  }

  async generateTakeawaysStream(
    text: string,
    { signal }: { signal?: AbortSignal } = {}
  ): Promise<AsyncIterable<string>> {
    return this._runStreamingPrompt(
      () =>
        `List the 3 most important key takeaways from this text, as a bulleted list:\n\n"${text}"`,
      signal
    );
  }

  async generateQuizStream(
  text: string,
  { signal }: { signal?: AbortSignal } = {}
): Promise<AsyncIterable<string>> {
  // pick a random target answer letter before passing to model
  const correctLetter = ["A", "B", "C", "D"][Math.floor(Math.random() * 4)];

  return this._runStreamingPrompt(
    () => `
You are a quiz generator. Based on the text below, create ONE simple multiple-choice question
to test understanding. There must be exactly four options (A, B, C, D), and the correct answer
should be placed under option **${correctLetter}**.

Randomize which option is correct each time by following the letter above.

Text:
"${text}"

Format:
Question: [Your question here]
A) [Option A]
B) [Option B]
C) [Option C]
D) [Option D]
Correct Answer: ${correctLetter}
`,
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

  async resetContext({ signal }: { signal?: AbortSignal } = {}): Promise<void> {
    if (!this.session) {
      // No session to reset, so we can just return.
      return;
    }
    // Clone the session and make the new, clean-context session the active one.
    await this.cloneSession({ signal, makeActive: true });
  }

  private async _runSinglePrompt(prompt: string, { signal }: { signal?: AbortSignal } = {}) {
    const stream = await this._runStreamingPrompt(() => prompt, signal);

    let text = "";
    for await (const chunk of stream) text += chunk;
    return text.trim();
  }

  private async _generateTrueSentence(front: string, concept: string, signal?: AbortSignal) {
      return this._runSinglePrompt(
    `Write one natural, textbook-style sentence that correctly defines this idea.
    Use ONLY the explanation as truth. Do not name the concept. 12–26 words.

    Explanation:
    ${front}

    Output only the sentence.`,
        { signal }
      );
    }

  private async _generateFalseSentence(front: string, concept: string, signal?: AbortSignal) {
  return this._runSinglePrompt(
  `Write one natural, textbook-style sentence that SEEMS correct but is WRONG by contradicting ONE key fact in the explanation.
  Use ONLY the explanation. Do not name the concept. 12–26 words. No meta text.

  Explanation:
  ${front}

  Output only the sentence.`,
      { signal }
    );
  }

  async generateStatementStream(
    concept: string,
    front: string,
    wantsFalse: boolean,
    { signal }: { signal?: AbortSignal } = {}
  ): Promise<{ statementStream: AsyncIterable<string>; isFalse: boolean }> {
    const isFalse = wantsFalse;

    const promptFn = isFalse
      ? () => this._generateFalseSentence(front, concept, signal)
      : () => this._generateTrueSentence(front, concept, signal);

    // This wraps the single-string-returning promise in a stream-like object
    // so the UI can consume it consistently.
    const statementStream = (async function* () {
      try {
        const result = await promptFn();
        yield result;
      } catch (e) {
        console.error(
          `Failed to generate ${isFalse ? "false" : "true"} statement`,
          e
        );
        // Yield a fallback error message so the UI doesn't hang forever
        yield "Error generating statement.";
      }
    })();

    return { statementStream, isFalse };
  }

  async getPairForCard(card: Card, signal?: AbortSignal) {
    if (!card.id) {
      throw new Error("Card must have an ID to be used with getPairForCard");
    }

    const hit = this.pairCache.get(card.id);
    if (hit) return hit;

    // The private methods are available via `this`
    const [trueText, falseText] = await Promise.all([
      this._generateTrueSentence(card.front, card.concept, signal),
      this._generateFalseSentence(card.front, card.concept, signal),
    ]);

    const pair = { trueText, falseText };
    this.pairCache.set(card.id, pair);
    return pair;
  }



  /**
   * Clone the current session. The cloned session drops conversation history
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

  async availability(
    force: boolean = false
  ): Promise<PromptAvailability> {
    if (this.availabilityStatus && !force) {
      return this.availabilityStatus;
    }

    const knownStates: readonly (PromptAvailability | "no-api")[] = [
      "available",
      "downloadable",
      "downloading",
      "unavailable",
      "unknown",
      "no-api",
    ];
    // The base check already handles the 'no-api' case if LanguageModel is missing.
    const status = await checkModelAvailability("LanguageModel", knownStates);
    this.availabilityStatus = status;
    return status;
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
    this.availabilityStatus = null;
  }
}

export const promptClient = new PromptClient();
