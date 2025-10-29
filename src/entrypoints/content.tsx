// src/entrypoints/content.tsx
import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { Panel } from '@/components/Panel'; // Ensure Panel accepts stream props
import { SelectionButton } from '@/lib/SelectionButton';
import { isExtensionEnabled } from '@/lib/settings';
import { writerClient, defaultWriterOpts } from '@/lib/modelClients/writerClient';
import { summarizerClient, defaultSummarizerOpts } from '@/lib/modelClients/summarizerClient';
import { promptClient, defaultPromptOpts } from '@/lib/modelClients/promptClient';


let panelHost: HTMLElement | null = null;
let reactRoot: Root | null = null;
let currentButton: SelectionButton | null = null;

// --- React Panel Rendering ---
function ensureReactRoot(): Root {
  if (reactRoot) return reactRoot;

  panelHost = document.createElement("div");
  panelHost.id = "__lb-panel-host__";
  // Apply necessary base styles for the host
  panelHost.style.position = "fixed";
  panelHost.style.top = "0";
  panelHost.style.left = "0";
  panelHost.style.zIndex = "2147483647"; // Max z-index
  panelHost.style.pointerEvents = "none"; // Allow clicks to pass through normally

  document.body.appendChild(panelHost);
  reactRoot = createRoot(panelHost);
  return reactRoot;
}

type PanelData = {
  sourceText: string;
  nearRect: DOMRect | null;

  summaryText: string;
  explainText: string;
  keyIdeasText: string;
  analogyText: string;
  quizText: string;

  summaryLoading: boolean;
  explainLoading: boolean;
  keyIdeasLoading: boolean;
  analogyLoading: boolean;
  quizLoading: boolean;

  summaryError: string | null;
  explainError: string | null;
  keyIdeasError: string | null;
  analogyError: string | null;
  quizError: string | null;
};

let panelData: PanelData | null = null;
let panelActiveTab: "explain" | "key" | "analogy" | "quiz" = "explain";

function renderPanel() {
  if (!panelData) return;

  // snapshot so TS treats it as non-null and stable
  const data = panelData;

  const root = ensureReactRoot();
  if (panelHost) panelHost.style.pointerEvents = "auto";

  const handleClose = () => {
    root.render(null);
  };

  const handleAdd = (front: string, back: string) => {
    browser.runtime.sendMessage({
      type: "prefill-and-open-sidepanel",
      front: data.sourceText,
      heading: front,
      back: back,
    });
  };

  root.render(
    <Panel
      nearRect={data.nearRect}
      sourceText={data.sourceText}

      summaryText={data.summaryText}
      explainText={data.explainText}
      keyIdeasText={data.keyIdeasText}
      analogyText={data.analogyText}
      quizText={data.quizText}

      summaryLoading={data.summaryLoading}
      explainLoading={data.explainLoading}
      keyIdeasLoading={data.keyIdeasLoading}
      analogyLoading={data.analogyLoading}
      quizLoading={data.quizLoading}

      summaryError={data.summaryError}
      explainError={data.explainError}
      keyIdeasError={data.keyIdeasError}
      analogyError={data.analogyError}
      quizError={data.quizError}

      onClose={handleClose}
      onAdd={handleAdd}
      onTabChange={async (tab) => {
        // we still have access to `data` from this closure
        panelActiveTab = tab;

        // Key Ideas tab
        if (
          tab === "key" &&
          !data.keyIdeasText &&
          !data.keyIdeasLoading
        ) {
          streamPromptIntoField(
            () => promptClient.generateTakeawaysStream(data.sourceText),
            "keyIdeasText",
            "keyIdeasLoading",
            "keyIdeasError"
          );
          return;
        }

        // Analogy tab
        if (
          tab === "analogy" &&
          !data.analogyText &&
          !data.analogyLoading
        ) {
          streamPromptIntoField(
            () => promptClient.generateAnalogyStream(data.sourceText),
            "analogyText",
            "analogyLoading",
            "analogyError"
          );
          return;
        }

        // Quiz tab
        if (
          tab === "quiz" &&
          !data.quizText &&
          !data.quizLoading
        ) {
          streamPromptIntoField(
            () => promptClient.generateQuizStream(data.sourceText),
            "quizText",
            "quizLoading",
            "quizError"
          );
          return;
        }

        // just switching tabs when we already have that tab's data
        renderPanel();
      }}
    />
  );
}

async function streamPromptIntoField(
  getStream: () => Promise<AsyncIterable<string>>,
  textField: keyof Pick<
    PanelData,
    "summaryText" | "explainText" | "keyIdeasText" | "analogyText" | "quizText"
  >,
  loadingField: keyof Pick<
    PanelData,
    | "summaryLoading"
    | "explainLoading"
    | "keyIdeasLoading"
    | "analogyLoading"
    | "quizLoading"
  >,
  errorField: keyof Pick<
    PanelData,
    | "summaryError"
    | "explainError"
    | "keyIdeasError"
    | "analogyError"
    | "quizError"
  >
) {
  if (!panelData) return;

  // mark loading
  panelData[loadingField] = true;
  panelData[errorField] = null;
  panelData[textField] = "";
  renderPanel();

  try {
    const stream = await getStream();
    for await (const chunk of stream) {
      if (!panelData) break;
      panelData[textField] = (panelData[textField] as string) + chunk;
      renderPanel();
    }

    if (!panelData) return;
    panelData[loadingField] = false;
    if ((panelData[textField] as string).trim() === "") {
      panelData[textField] = "No output.";
    }
    renderPanel();
  } catch (err) {
    console.error("streamPromptIntoField error:", err);
    if (!panelData) return;
    panelData[loadingField] = false;
    panelData[errorField] = "Error generating content.";
    renderPanel();
  }
}

async function initPanelForText(text: string, rect: DOMRect | null) {
  // create initial state
  panelData = {
    sourceText: text,
    nearRect: rect,

    summaryText: "Please Wait",
    explainText: "Initializing AI...",
    keyIdeasText: "",
    analogyText: "",
    quizText: "",

    summaryLoading: true,
    explainLoading: true,
    keyIdeasLoading: false,
    analogyLoading: false,
    quizLoading: false,

    summaryError: null,
    explainError: null,
    keyIdeasError: null,
    analogyError: null,
    quizError: null,
  };

  panelActiveTab = "explain";
  renderPanel();

  // at this point you will already have initialized your clients (availability + initFromUserGesture)

  // start streaming summary (summarizerClient) into summaryText
  streamPromptIntoField(
    () => summarizerClient.summarizeStreaming(text, {}),
    "summaryText",
    "summaryLoading",
    "summaryError"
  );

  // start streaming explanation (writerClient) into explainText
  streamPromptIntoField(
    () => writerClient.writeStreaming(text, {}),
    "explainText",
    "explainLoading",
    "explainError"
  );
}

// --- Button Enable/Disable Logic ---
const setupButton = (isEnabled: boolean) => {
  if (isEnabled && !currentButton) {
    console.log('[content] Enabling button');
    currentButton = new SelectionButton();

    currentButton.setOnLearnClick(async (text, rect) => {
  let downloadProgress = { writer: -1, summarizer: -1 };
  let writerAvailable = "unknown",
    summarizerAvailable = "unknown",
    promptAvailable = "unknown";

  // Step 0: temporary panel while we check
  panelData = {
    sourceText: text,
    nearRect: rect,

    summaryText: "Please Wait",
    explainText: "Checking AI...",
    keyIdeasText: "",
    analogyText: "",
    quizText: "",

    summaryLoading: false,
    explainLoading: false,
    keyIdeasLoading: false,
    analogyLoading: false,
    quizLoading: false,

    summaryError: null,
    explainError: null,
    keyIdeasError: null,
    analogyError: null,
    quizError: null,
  };
  renderPanel();

  try {
    // Availability
    [writerAvailable, summarizerAvailable, promptAvailable] = await Promise.all([
      writerClient.availability(),
      summarizerClient.availability(),
      promptClient.availability(),
    ]);

    const needsDownload =
      writerAvailable === "downloadable" ||
      writerAvailable === "downloading" ||
      summarizerAvailable === "downloadable" ||
      summarizerAvailable === "downloading" ||
      promptAvailable === "downloadable" ||
      promptAvailable === "downloading";

    const isUnavailable =
      writerAvailable === "unavailable" ||
      writerAvailable === "no-api" ||
      summarizerAvailable === "unavailable" ||
      summarizerAvailable === "no-api" ||
      promptAvailable === "unavailable" ||
      promptAvailable === "no-api";

    if (isUnavailable) {
      throw new Error(
        "AI features are unavailable. Please ensure they are enabled in Chrome and your device is supported."
      );
    }

    // Show download status if needed
    function updateProgressUI() {
      if (!panelData) return;
      const wProg =
        downloadProgress.writer >= 0
          ? `Writer Download: ${Math.round(downloadProgress.writer * 100)}%`
          : "";
      const sProg =
        downloadProgress.summarizer >= 0
          ? `Summarizer Download: ${Math.round(downloadProgress.summarizer * 100)}%`
          : "";

      panelData.summaryText = "Please Wait";
      panelData.explainText = `Downloading AI model... ${wProg} ${sProg}`;
      renderPanel();
    }

    if (needsDownload) {
      // interim panel update
      panelData.summaryText = "Please Wait";
      panelData.explainText = "Gemini Nano might take some time to download.";
      renderPanel();
    }

    const writerProgress = (p: number) => {
      downloadProgress.writer = p;
      if (needsDownload) updateProgressUI();
    };
    const summarizerProgress = (p: number) => {
      downloadProgress.summarizer = p;
      if (needsDownload) updateProgressUI();
    };

    // Init
    summarizerClient.setOpts(defaultSummarizerOpts);
    await summarizerClient.initFromUserGesture({
      ...defaultSummarizerOpts,
      onDownloadProgress: summarizerProgress,
    });

    writerClient.setOpts(defaultWriterOpts);
    await writerClient.initFromUserGesture({
      ...defaultWriterOpts,
      onDownloadProgress: writerProgress,
    });

    promptClient.setOpts(defaultPromptOpts);
    await promptClient.initFromUserGesture({
      ...defaultPromptOpts,
    });

    // Now actually populate the panel with streamed AI output
    await initPanelForText(text, rect);
  } catch (err: any) {
    console.error("[content] AI error:", err);
    if (!panelData) return;
    panelData.summaryText = "Error";
    panelData.explainText = err?.message ?? String(err);
    renderPanel();
  }
}); // End setOnLearnClick

    currentButton.initializeListeners();
  } else if (!isEnabled && currentButton) {
    console.log("[content] Disabling button");
    currentButton.destroy();
    currentButton = null;
    if (reactRoot) {
      reactRoot.render(null); // Also close the panel if extension is disabled
      if (panelHost) panelHost.style.pointerEvents = "none";
    }
  }
};

// --- Content Script Definition ---
export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,
  main() {
    console.log('[content] loaded on', location.href);
    isExtensionEnabled.getValue().then(setupButton);
    isExtensionEnabled.watch(setupButton);

    browser.runtime.onMessage.addListener(async (msg) => {
  const isEnabled = await isExtensionEnabled.getValue();
  if (
    !isEnabled ||
    msg.type !== "EXPLAIN_TEXT_FROM_CONTEXT_MENU" ||
    typeof msg.text !== "string"
  )
    return;

  const text = msg.text.trim();
  if (!text) return;

  // boot panel in "initializing" mode in the center
  panelData = {
    sourceText: text,
    nearRect: null,

    summaryText: "Please Wait",
    explainText: "Initializing AI...",
    keyIdeasText: "",
    analogyText: "",
    quizText: "",

    summaryLoading: false,
    explainLoading: false,
    keyIdeasLoading: false,
    analogyLoading: false,
    quizLoading: false,

    summaryError: null,
    explainError: null,
    keyIdeasError: null,
    analogyError: null,
    quizError: null,
  };
  renderPanel();

  try {
    await Promise.all([
      writerClient.initFromUserGesture(defaultWriterOpts),
      summarizerClient.initFromUserGesture(defaultSummarizerOpts),
      promptClient.initFromUserGesture(defaultPromptOpts),
    ]);

    // start streaming into panelData
    await initPanelForText(text, null);
  } catch (err: any) {
    console.error("[content] AI error (from context menu):", err);
    if (!panelData) return;
    panelData.summaryText = "Error";
    panelData.explainText = err?.message ?? String(err);
    renderPanel();
  }
}); // End listener
  }, // End main
}); // End defineContentScript

// --- Helper type definition for SelectionButton (assuming it needs setOnLearnClick) ---
// You might need to adjust SelectionButton.ts to match this
declare module "@/lib/SelectionButton" {
  interface SelectionButton {
    setOnLearnClick(
      callback: (text: string, rect: DOMRect | null) => Promise<void>
    ): void;
  }
}
