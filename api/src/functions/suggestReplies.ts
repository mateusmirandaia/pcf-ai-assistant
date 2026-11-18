import { randomUUID } from "node:crypto";
import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { generateReplies, UpstreamError } from "../lib/azureOpenAi";
import { AppConfig, ConfigError, loadConfig } from "../lib/config";
import { buildMessages } from "../lib/prompt";
import { validateSuggestRequest } from "../lib/validation";

/** Generous for a few thousand characters of JSON-escaped text, small enough to reject junk early. */
const MAX_BODY_BYTES = 32 * 1024;

export interface HandlerDeps {
    getConfig: () => AppConfig;
    complete: typeof generateReplies;
}

const defaultDeps: HandlerDeps = { getConfig: () => loadConfig(), complete: generateReplies };

export function createSuggestRepliesHandler(deps: HandlerDeps = defaultDeps) {
    return async function suggestReplies(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
        let config: AppConfig;
        try {
            config = deps.getConfig();
        } catch (err) {
            if (err instanceof ConfigError) {
                context.error(err.message);
                return errorResponse(500, "The suggestion service is not configured.");
            }
            throw err;
        }

        const declaredLength = Number(request.headers.get("content-length") ?? 0);
        if (declaredLength > MAX_BODY_BYTES) {
            return errorResponse(413, "Request body is too large.");
        }

        const raw = await request.text();
        if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
            return errorResponse(413, "Request body is too large.");
        }

        let body: unknown;
        try {
            body = JSON.parse(raw);
        } catch {
            return errorResponse(400, "Request body must be valid JSON.");
        }

        const validation = validateSuggestRequest(body, config.maxSourceChars);
        if (!validation.ok) {
            return errorResponse(400, validation.error);
        }

        try {
            const replies = await deps.complete(config.openAi, buildMessages(validation.value.sourceText, validation.value.tone));
            return {
                status: 200,
                jsonBody: { suggestions: replies.map((text) => ({ id: randomUUID(), text })) },
            };
        } catch (err) {
            if (err instanceof UpstreamError) {
                // Log the upstream detail for operators but keep it out of the
                // response; the browser only needs to know whether to retry.
                context.warn(`Upstream failure: ${err.message}`);
                if (err.status === 429) {
                    return errorResponse(429, "The AI service is busy. Try again in a few seconds.");
                }
                return errorResponse(502, "The AI service could not produce suggestions right now.");
            }
            throw err;
        }
    };
}

function errorResponse(status: number, error: string): HttpResponseInit {
    return { status, jsonBody: { error } };
}

// authLevel is anonymous on purpose: a function key would end up in the
// browser bundle, which is no better than no key. Authentication belongs in
// front of the function (App Service authentication with Entra ID, or APIM
// validating the caller's token). See the README before deploying this.
app.http("suggestReplies", {
    route: "suggest-replies",
    methods: ["POST"],
    authLevel: "anonymous",
    handler: createSuggestRepliesHandler(),
});
