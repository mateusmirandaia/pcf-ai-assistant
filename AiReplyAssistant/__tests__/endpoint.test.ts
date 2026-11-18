import { resolveEndpoint } from "../services/endpoint";

describe("resolveEndpoint", () => {
    it.each([
        ["https://contoso-ai.azurewebsites.net/api/suggest-replies", "https://contoso-ai.azurewebsites.net/api/suggest-replies"],
        ["  https://apim.example.com/replies  ", "https://apim.example.com/replies"],
        ["http://localhost:7071/api/suggest-replies", "http://localhost:7071/api/suggest-replies"],
    ])("accepts %s", (raw, expected) => {
        expect(resolveEndpoint(raw)).toBe(expected);
    });

    it.each([null, undefined, "", "   ", "not a url", "http://contoso.com/api", "ftp://localhost/file", "/api/relative"])(
        "rejects %p",
        (raw) => {
            expect(resolveEndpoint(raw)).toBeNull();
        },
    );
});
