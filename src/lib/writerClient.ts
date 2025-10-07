export type WriterTone = "formal" | "neutral" | "casual";
export type WriterFormat = "markdown" | "plain-text";
export type WriterLength = "short" | "medium" | "long";
 
export type GlobalWriterOpts = {
	tone: WriterTone,
	format: WriterFormat,
	length: WriterLength,
	outputLanguage: "en" | "es" | "ja",
  sharedContext?: string;
};

export const defaultWriterOpts: GlobalWriterOpts = {
  sharedContext: "Simplify this concept for me.",
	tone: "casual",
	format: "plain-text",
	length: "medium",
	outputLanguage: (["en","es","ja"].includes((navigator.language||"en").slice(0,2)) 
    ? (navigator.language.slice(0,2) as "en"|"es"|"ja") 
    : "en"),
};

type CreateParams = GlobalWriterOpts & {
	onDownloadProgress?: (p: number) => void;
};

class WriterClient {
	private session: any | null = null;
	private creating?: Promise<any>;
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

		if (!("Writer" in self)) {
			throw new Error("Web Writer API not available in this context.");
		}

		// Optional: check availability() first
		try {
			const availability = await (self as any).Writer.availability?.();
			if (availability === "unavailable") {
				throw new Error("Writer unavailable.");
			}
		} catch { /* ignore */ }

		// Create inside the click
		const createOpts = {
			tone: params?.tone ?? this.opts.tone,
			format: params?.format ?? this.opts.format,
			length: params?.length ?? this.opts.length,
			sharedContext: params?.sharedContext ?? this.opts.sharedContext,
			monitor: (m: any) => {
				if (params?.onDownloadProgress) {
					m.addEventListener("downloadprogress", (e: any) =>
						params.onDownloadProgress?.(e.loaded)
					);
				}
			},
		};

		this.creating = (self as any).Writer.create(createOpts)
			.then((s: any) => (this.session = s))
			.finally(() => { this.creating = undefined; });

		await this.creating;
	}

	/** Can be called later without user activation (reuses the session) */
	async write(text: string, { signal, context }: { signal?: AbortSignal; context?: string } = {}) {
		if (!this.session) {
			throw new Error("Writer not initialized. Call initFromUserGesture() on a user click first.");
		}
		const input = text.trim().replace(/\s+/g, " ");
		if (!input) return "";
		return await this.session.write(input, {
			signal,
			context,
		}) as string;
	}

	dispose() {
		try { this.session?.destroy?.(); } catch {}
		this.session = null;
		this.creating = undefined;
	}
}

export const writerClient = new WriterClient();