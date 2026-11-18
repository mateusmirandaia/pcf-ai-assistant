import { createSuggestionClient, SuggestionError } from "../services/suggestionClient";

const request = { sourceText: "My order arrived damaged.", tone: "formal" as const };

function jsonResponse(body: unknown, status = 200): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    } as Response;
}

/** A fetch that never settles on its own and rejects the way browsers do when aborted. */
function hangingFetch(): jest.Mock {
    return jest.fn((_url: string, init: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        });
    });
}

describe("createSuggestionClient", () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    it("posts the request as JSON and returns typed suggestions", async () => {
        const fetchImpl = jest.fn().mockResolvedValue(
            jsonResponse({ suggestions: [{ id: "a", text: "  Sorry to hear that.  " }, { id: "b", text: "We will replace it." }] }),
        );
        const client = createSuggestionClient({ endpoint: "https://api.example.test/suggest", fetchImpl });

        const result = await client.suggest(request);

        expect(result.suggestions).toEqual([
            { id: "a", text: "Sorry to hear that." },
            { id: "b", text: "We will replace it." },
        ]);
        const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
        expect(url).toBe("https://api.example.test/suggest");
        expect(init.method).toBe("POST");
        expect(JSON.parse(init.body as string)).toEqual(request);
    });

    it("drops malformed and empty items instead of failing the whole response", async () => {
        const fetchImpl = jest.fn().mockResolvedValue(
            jsonResponse({ suggestions: [{ id: "a", text: "ok" }, { id: 2, text: "bad id" }, { id: "c", text: "   " }, null] }),
        );
        const client = createSuggestionClient({ endpoint: "https://x.test", fetchImpl });

        await expect(client.suggest(request)).resolves.toEqual({ suggestions: [{ id: "a", text: "ok" }] });
    });

    it("surfaces the server's error message on HTTP failures", async () => {
        const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({ error: "sourceText is too long" }, 400));
        const client = createSuggestionClient({ endpoint: "https://x.test", fetchImpl });

        await expect(client.suggest(request)).rejects.toMatchObject({
            kind: "http",
            status: 400,
            message: "sourceText is too long",
        });
    });

    it("falls back to a generic message when the error body is not JSON", async () => {
        const fetchImpl = jest.fn().mockResolvedValue({
            ok: false,
            status: 502,
            json: () => Promise.reject(new SyntaxError("Unexpected token <")),
        });
        const client = createSuggestionClient({ endpoint: "https://x.test", fetchImpl });

        await expect(client.suggest(request)).rejects.toMatchObject({ kind: "http", message: "The suggestion service returned HTTP 502." });
    });

    it("rejects payloads without a suggestions array", async () => {
        const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({ choices: [] }));
        const client = createSuggestionClient({ endpoint: "https://x.test", fetchImpl });

        await expect(client.suggest(request)).rejects.toMatchObject({ kind: "invalid-response" });
    });

    it("maps a rejected fetch to a network error", async () => {
        const fetchImpl = jest.fn().mockRejectedValue(new TypeError("Failed to fetch"));
        const client = createSuggestionClient({ endpoint: "https://x.test", fetchImpl });

        await expect(client.suggest(request)).rejects.toMatchObject({ kind: "network" });
    });

    it("aborts and reports a timeout when the service is too slow", async () => {
        jest.useFakeTimers();
        const fetchImpl = hangingFetch();
        const client = createSuggestionClient({ endpoint: "https://x.test", fetchImpl, timeoutMs: 5_000 });

        const pending = client.suggest(request);
        jest.advanceTimersByTime(5_000);

        await expect(pending).rejects.toMatchObject({ kind: "timeout" });
        const init = fetchImpl.mock.calls[0][1] as RequestInit;
        expect(init.signal?.aborted).toBe(true);
    });

    it("honours a caller-supplied abort signal", async () => {
        const fetchImpl = hangingFetch();
        const client = createSuggestionClient({ endpoint: "https://x.test", fetchImpl });
        const controller = new AbortController();

        const pending = client.suggest(request, controller.signal);
        controller.abort();

        const error = await pending.catch((err: unknown) => err);
        expect(error).toBeInstanceOf(SuggestionError);
        expect((error as SuggestionError).kind).toBe("aborted");
    });
});
