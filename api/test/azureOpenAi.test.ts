import { generateReplies, parseReplies, UpstreamError } from "../src/lib/azureOpenAi";

const config = {
    endpoint: "https://your-resource.openai.azure.com",
    apiKey: "your-azure-openai-key",
    deployment: "chat",
    apiVersion: "2024-10-21",
};

function completion(content: string | null, status = 200): Response {
    return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status });
}

describe("generateReplies", () => {
    it("calls the deployment endpoint with the key header and parses the replies", async () => {
        const fetchImpl = jest.fn().mockResolvedValue(completion(JSON.stringify({ suggestions: ["One", "Two", "Three", "Four"] })));

        const replies = await generateReplies(config, [{ role: "user", content: "hi" }], { fetchImpl });

        expect(replies).toEqual(["One", "Two", "Three"]);
        const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
        expect(url).toBe("https://your-resource.openai.azure.com/openai/deployments/chat/chat/completions?api-version=2024-10-21");
        expect((init.headers as Record<string, string>)["api-key"]).toBe("your-azure-openai-key");
        expect(JSON.parse(init.body as string)).toMatchObject({ response_format: { type: "json_object" } });
    });

    it("keeps the HTTP status of upstream failures", async () => {
        const fetchImpl = jest.fn().mockResolvedValue(new Response("{}", { status: 429 }));

        await expect(generateReplies(config, [], { fetchImpl })).rejects.toMatchObject({ name: "UpstreamError", status: 429 });
    });

    it("wraps network failures", async () => {
        const fetchImpl = jest.fn().mockRejectedValue(new TypeError("fetch failed"));

        await expect(generateReplies(config, [], { fetchImpl })).rejects.toThrow("Azure OpenAI request failed.");
    });

    it("rejects an empty completion", async () => {
        const fetchImpl = jest.fn().mockResolvedValue(completion(null));

        await expect(generateReplies(config, [], { fetchImpl })).rejects.toBeInstanceOf(UpstreamError);
    });
});

describe("parseReplies", () => {
    it("drops blank and non-string entries", () => {
        expect(parseReplies(JSON.stringify({ suggestions: ["  ok  ", "", 3, null, "fine"] }))).toEqual(["ok", "fine"]);
    });

    it.each(["not json", JSON.stringify({ replies: [] }), "null"])("throws on %p", (content) => {
        expect(() => parseReplies(content)).toThrow(UpstreamError);
    });
});
