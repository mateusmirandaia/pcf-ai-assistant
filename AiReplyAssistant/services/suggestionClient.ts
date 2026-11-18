import { Suggestion, SuggestionRequest, SuggestionResponse } from "./types";

export type SuggestionErrorKind = "timeout" | "aborted" | "network" | "http" | "invalid-response";

export class SuggestionError extends Error {
    readonly kind: SuggestionErrorKind;
    readonly status?: number;

    constructor(kind: SuggestionErrorKind, message: string, status?: number) {
        super(message);
        this.name = "SuggestionError";
        this.kind = kind;
        this.status = status;
    }
}

export interface SuggestionClientOptions {
    endpoint: string;
    timeoutMs?: number;
    /** Injected so tests (and the jsdom environment, which has no fetch) can supply their own. */
    fetchImpl?: typeof fetch;
}

export interface SuggestionClient {
    readonly endpoint: string;
    suggest(request: SuggestionRequest, signal?: AbortSignal): Promise<SuggestionResponse>;
}

export const DEFAULT_TIMEOUT_MS = 20_000;

export function createSuggestionClient(options: SuggestionClientOptions): SuggestionClient {
    const { endpoint, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
    // Resolve fetch lazily: binding window.fetch at module load breaks in test
    // environments that install a mock after import.
    const doFetch = (input: string, init: RequestInit) => (options.fetchImpl ?? fetch)(input, init);

    return {
        endpoint,
        async suggest(request, signal) {
            const controller = new AbortController();
            let timedOut = false;
            const timer = setTimeout(() => {
                timedOut = true;
                controller.abort();
            }, timeoutMs);

            // AbortSignal.any() would be neater, but the Unified Interface still
            // runs in browsers and WebViews where it is not available.
            const forwardAbort = () => controller.abort();
            if (signal?.aborted) {
                controller.abort();
            } else {
                signal?.addEventListener("abort", forwardAbort, { once: true });
            }

            try {
                let response: Response;
                try {
                    response = await doFetch(endpoint, {
                        method: "POST",
                        headers: { "Content-Type": "application/json", Accept: "application/json" },
                        body: JSON.stringify(request),
                        signal: controller.signal,
                    });
                } catch {
                    if (timedOut) {
                        throw new SuggestionError("timeout", `The suggestion service did not answer within ${timeoutMs / 1000}s.`);
                    }
                    if (controller.signal.aborted) {
                        throw new SuggestionError("aborted", "The request was cancelled.");
                    }
                    throw new SuggestionError("network", "Could not reach the suggestion service.");
                }

                if (!response.ok) {
                    throw new SuggestionError("http", await readErrorMessage(response), response.status);
                }

                let body: unknown;
                try {
                    body = await response.json();
                } catch {
                    throw new SuggestionError("invalid-response", "The suggestion service returned malformed JSON.");
                }
                return parseSuggestionResponse(body);
            } finally {
                clearTimeout(timer);
                signal?.removeEventListener("abort", forwardAbort);
            }
        },
    };
}

async function readErrorMessage(response: Response): Promise<string> {
    const fallback = `The suggestion service returned HTTP ${response.status}.`;
    try {
        const body: unknown = await response.json();
        if (isRecord(body) && typeof body.error === "string" && body.error.trim()) {
            return body.error;
        }
    } catch {
        // Non-JSON error bodies (gateway pages, plain text) are not worth surfacing.
    }
    return fallback;
}

export function parseSuggestionResponse(body: unknown): SuggestionResponse {
    if (!isRecord(body) || !Array.isArray(body.suggestions)) {
        throw new SuggestionError("invalid-response", "The suggestion service returned an unexpected payload.");
    }

    const suggestions = body.suggestions
        .filter((item): item is Suggestion => isRecord(item) && typeof item.id === "string" && typeof item.text === "string")
        .map((item) => ({ id: item.id, text: item.text.trim() }))
        .filter((item) => item.text.length > 0);

    return { suggestions };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}
