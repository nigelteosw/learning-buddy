import type {
  PromptSession,
  GlobalPromptOpts,
  PromptAvailability,
  PromptCreateParams,
} from '@/types/promptTypes';
import type {
  SummarizerSession,
  GlobalSummarizerOpts,
  SummarizerAvailability,
} from '@/types/summarizerTypes';
import type {
  WriterSession,
  GlobalWriterOpts,
  WriterAvailability,
  CreateParams,
} from '@/types/writerTypes';
import { checkModelAvailability } from '@/lib/utils/language';

// --- Generic Type Definitions for the Base Class ---

type AnySession = PromptSession | SummarizerSession | WriterSession;

type AnyOpts = GlobalPromptOpts | GlobalSummarizerOpts | GlobalWriterOpts;

type AnyAvailability =
  | PromptAvailability
  | SummarizerAvailability
  | WriterAvailability;

// CreateParams is mostly the same, but PromptCreateParams has extra fields.
// We use a generic constraint to handle this.
type AnyCreateParams = CreateParams | PromptCreateParams;

/**
 * An abstract base class for AI model clients to handle common logic:
 * - Session creation and lifecycle management (init, dispose, cloning).
 * - Availability checking.
 * - Options management.
 */
export abstract class BaseModelClient<
  TSession extends AnySession,
  TOpts extends AnyOpts,
  TAvailability extends AnyAvailability,
  TCreateParams extends AnyCreateParams,
> {
  protected session: TSession | null = null;
  protected creating?: Promise<TSession>;
  protected opts: TOpts;
  protected availabilityStatus: TAvailability | 'no-api' | 'unknown' | null =
    null;

  constructor(
    defaultOpts: TOpts,
    protected modelName: 'LanguageModel' | 'Summarizer' | 'Writer',
    protected knownStates: readonly TAvailability[]
  ) {
    this.opts = { ...defaultOpts };
  }

  /**
   * Updates the client's default options. This affects subsequent initializations.
   */
  setOpts(next: Partial<TOpts>): void {
    this.opts = { ...this.opts, ...next };
  }

  /**
   * Checks if the underlying model is available, with caching.
   */
  async availability(
    force = false
  ): Promise<TAvailability | 'no-api' | 'unknown'> {
    if (this.availabilityStatus && !force) {
      return this.availabilityStatus;
    }

    const status = await checkModelAvailability(this.modelName, this.knownStates);
    this.availabilityStatus = status;
    return status;
  }

  /**
   * Disposes of the current session, releasing resources.
   */
  dispose(): void {
    try {
      // The `destroy` method is optional on some session types.
      (this.session as any)?.destroy?.();
    } catch (e) {
      console.warn(`Error during ${this.modelName} session disposal:`, e);
    }
    this.session = null;
    this.creating = undefined;
    this.availabilityStatus = null;
  }

  /**
   * Abstract method for initialization, to be implemented by subclasses.
   */
  abstract initFromUserGesture(params?: TCreateParams): Promise<void>;
}