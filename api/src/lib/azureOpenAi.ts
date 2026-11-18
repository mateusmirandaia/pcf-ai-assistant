import { OpenAiConfig } from "./config";
import { ChatMessage, SUGGESTION_COUNT } from "./prompt";

export class UpstreamError extends Error {
    constructor(
        message: string,
        readonly status?: number,
    ) {
        super(message);
        this.name = "UpstreamError";
    }
}

export interface CompletionOptions {
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
}

const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Calls the deployment-scoped chat completions endpoint directly. The REST
 * surface we need is one POST, which is not worth an SDK dependency and keeps
 * the function cold start small.
 */
export async function generateReplies(
    config: OpenAiConfig,
    messages: ChatMessage[],
    options: CompletionOptions = {},
): Promise<string[]> {
    const { timeoutMs = DEFAULT_TIMEOUT_MS, fetchImpl = fetch } = options;
    const url =
        `${config.endpoint}/openai/deployments/${encodeURIComponent(config.deployment)}/chat/completions` +
        `?api-version=${encodeURIComponent(config.apiVersion)}`;

    let response: Response;
    try {
        response = await fetchImpl(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", "api-key": config.apiKey },
            body: JSON.stringify({
                messages,
                temperature: 0.7,
                max_tokens: 800,
                response_format: { type: "json_object" },
            }),
            signal: AbortSignal.timeout(timeoutMs),
        });
    } catch (err) {
        const reason = err instanceof Error && err.name === "TimeoutError" ? "timed out" : "failed";
        throw new UpstreamError(`Azure OpenAI request ${reason}.`);
    }

    if (!response.ok) {
        throw new UpstreamError(`Azure OpenAI returned HTTP ${response.status}.`, response.status);
    }

    const payload = (await response.json()) as { choices?: { message?: { content?: string | null } }[] };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
        throw new UpstreamError("Azure OpenAI returned an empty completion.");
    }
    return parseReplies(content);
}

export function parseReplies(content: string): string[] {
    let parsed: unknown;
    try {
        parsed = JSON.parse(content);
    } catch {
        throw new UpstreamError("Azure OpenAI did not return valid JSON.");
    }

    const suggestions = (parsed as { suggestions?: unknown })?.suggestions;
    if (!Array.isArray(suggestions)) {
        throw new UpstreamError("Azure OpenAI response is missing the suggestions array.");
    }

    return suggestions
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
        .slice(0, SUGGESTION_COUNT);
}
