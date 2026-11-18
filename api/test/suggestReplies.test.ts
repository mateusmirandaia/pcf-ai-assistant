import { HttpRequest, InvocationContext } from "@azure/functions";
import { UpstreamError } from "../src/lib/azureOpenAi";
import { AppConfig, ConfigError } from "../src/lib/config";
import { createSuggestRepliesHandler, HandlerDeps } from "../src/functions/suggestReplies";

const config: AppConfig = {
    openAi: { endpoint: "https://your-resource.openai.azure.com", apiKey: "your-azure-openai-key", deployment: "chat", apiVersion: "2024-10-21" },
    maxSourceChars: 50,
};

function post(body: string): HttpRequest {
    return new HttpRequest({
        method: "POST",
        url: "http://localhost:7071/api/suggest-replies",
        headers: { "content-type": "application/json" },
        body: { string: body },
    });
}

function setup(overrides: Partial<HandlerDeps> = {}) {
    const deps: HandlerDeps = {
        getConfig: () => config,
        complete: jest.fn().mockResolvedValue(["Thanks for reaching out.", "We are on it."]),
        ...overrides,
    };
    const context = new InvocationContext({ functionName: "suggestReplies" });
    jest.spyOn(context, "warn").mockImplementation(() => undefined);
    jest.spyOn(context, "error").mockImplementation(() => undefined);
    return { handler: createSuggestRepliesHandler(deps), deps, context };
}

describe("suggestReplies", () => {
    it("returns suggestions with ids", async () => {
        const { handler, deps, context } = setup();

        const response = await handler(post(JSON.stringify({ sourceText: "Package is late", tone: "friendly" })), context);

        expect(response.status).toBe(200);
        const body = response.jsonBody as { suggestions: { id: string; text: string }[] };
        expect(body.suggestions.map((s) => s.text)).toEqual(["Thanks for reaching out.", "We are on it."]);
        expect(new Set(body.suggestions.map((s) => s.id)).size).toBe(2);

        const [, messages] = (deps.complete as jest.Mock).mock.calls[0];
        expect(messages[1].content).toContain("Package is late");
    });

    it("rejects invalid JSON", async () => {
        const { handler, context } = setup();

        const response = await handler(post("{not json"), context);

        expect(response).toEqual({ status: 400, jsonBody: { error: "Request body must be valid JSON." } });
    });

    it("rejects text over the configured limit without calling the model", async () => {
        const { handler, deps, context } = setup();

        const response = await handler(post(JSON.stringify({ sourceText: "x".repeat(51), tone: "formal" })), context);

        expect(response.status).toBe(400);
        expect(deps.complete).not.toHaveBeenCalled();
    });

    it("rejects oversized bodies before parsing", async () => {
        const { handler, deps, context } = setup();

        const response = await handler(post(JSON.stringify({ sourceText: "x".repeat(40_000), tone: "formal" })), context);

        expect(response.status).toBe(413);
        expect(deps.complete).not.toHaveBeenCalled();
    });

    it("passes upstream throttling through as 429", async () => {
        const { handler, context } = setup({ complete: jest.fn().mockRejectedValue(new UpstreamError("throttled", 429)) });

        const response = await handler(post(JSON.stringify({ sourceText: "Hi", tone: "formal" })), context);

        expect(response.status).toBe(429);
    });

    it("hides upstream details behind a 502", async () => {
        const { handler, context } = setup({ complete: jest.fn().mockRejectedValue(new UpstreamError("Azure OpenAI returned HTTP 500.", 500)) });

        const response = await handler(post(JSON.stringify({ sourceText: "Hi", tone: "formal" })), context);

        expect(response.status).toBe(502);
        expect(JSON.stringify(response.jsonBody)).not.toContain("HTTP 500");
        expect(context.warn).toHaveBeenCalled();
    });

    it("returns 500 and logs when app settings are missing", async () => {
        const { handler, context } = setup({
            getConfig: () => {
                throw new ConfigError(["AZURE_OPENAI_API_KEY"]);
            },
        });

        const response = await handler(post(JSON.stringify({ sourceText: "Hi", tone: "formal" })), context);

        expect(response).toEqual({ status: 500, jsonBody: { error: "The suggestion service is not configured." } });
        expect(context.error).toHaveBeenCalledWith(expect.stringContaining("AZURE_OPENAI_API_KEY"));
    });
});
