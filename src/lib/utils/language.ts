import {
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from "@/types/writerTypes";

/**
 * Checks if a language code is supported by the models.
 */
export function isSupportedLanguage(lang: string): lang is SupportedLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(lang);
}

/**
 * Gets the default supported language based on the browser's language settings.
 */
export function getDefaultLanguage(): SupportedLanguage {
  const browserLang = (navigator.language || "en").slice(0, 2);
  return isSupportedLanguage(browserLang) ? browserLang : "en";
}

/**
 * A generic availability checker for the built-in model APIs.
 * @param modelName The name of the model on the `self` object (e.g., "Writer", "Summarizer").
 * @param knownStates An array of valid availability states for the model.
 * @returns A promise that resolves to the availability state.
 */
export async function checkModelAvailability<T extends string>(
  modelName: "Writer" | "Summarizer" | "LanguageModel",
  knownStates: readonly T[]
): Promise<T | "no-api" | "unknown"> {
  const modelApi = (self as any)[modelName];

  if (!modelApi) {
    console.warn(`${modelName} API not found on self.`);
    return "no-api";
  }
  if (typeof modelApi.availability !== "function") {
    console.warn(`${modelName}.availability() method not found.`);
    return "unknown";
  }

  try {
    const state = await modelApi.availability();
    if ((knownStates as readonly string[]).includes(state)) {
      return state as T;
    }
    console.warn(`${modelName}.availability() returned unexpected state:`, state);
    return "unknown";
  } catch (e) {
    console.error(`Error calling ${modelName}.availability():`, e);
    return "unavailable" as T; // Assume 'unavailable' is a common state
  }
}