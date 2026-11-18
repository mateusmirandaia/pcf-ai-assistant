import { validateSuggestRequest } from "../src/lib/validation";

describe("validateSuggestRequest", () => {
    it("accepts a valid request and trims the text", () => {
        expect(validateSuggestRequest({ sourceText: "  Where is my refund?  ", tone: "concise" }, 100)).toEqual({
            ok: true,
            value: { sourceText: "Where is my refund?", tone: "concise" },
        });
    });

    it.each([
        [null, "Request body must be a JSON object."],
        [[], "Request body must be a JSON object."],
        [{ tone: "formal" }, "sourceText is required."],
        [{ sourceText: "   ", tone: "formal" }, "sourceText is required."],
        [{ sourceText: 42, tone: "formal" }, "sourceText is required."],
        [{ sourceText: "Hi", tone: "sarcastic" }, "tone must be one of: formal, friendly, concise."],
        [{ sourceText: "Hi" }, "tone must be one of: formal, friendly, concise."],
    ])("rejects %p", (body, error) => {
        expect(validateSuggestRequest(body, 100)).toEqual({ ok: false, error });
    });

    it("enforces the length limit after trimming", () => {
        expect(validateSuggestRequest({ sourceText: `  ${"a".repeat(10)}  `, tone: "formal" }, 10).ok).toBe(true);
        expect(validateSuggestRequest({ sourceText: "a".repeat(11), tone: "formal" }, 10)).toEqual({
            ok: false,
            error: "sourceText is too long (11 characters, limit is 10).",
        });
    });
});
