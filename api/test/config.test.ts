import { ConfigError, loadConfig } from "../src/lib/config";

const base = {
    AZURE_OPENAI_ENDPOINT: "https://your-resource.openai.azure.com/",
    AZURE_OPENAI_API_KEY: "your-azure-openai-key",
    AZURE_OPENAI_DEPLOYMENT: "chat",
};

describe("loadConfig", () => {
    it("applies defaults and normalises the endpoint", () => {
        expect(loadConfig(base)).toEqual({
            openAi: { endpoint: "https://your-resource.openai.azure.com", apiKey: "your-azure-openai-key", deployment: "chat", apiVersion: "2024-10-21" },
            maxSourceChars: 4000,
        });
    });

    it("reads optional overrides", () => {
        const config = loadConfig({ ...base, AZURE_OPENAI_API_VERSION: "2025-01-01-preview", MAX_SOURCE_CHARS: "1500" });
        expect(config.openAi.apiVersion).toBe("2025-01-01-preview");
        expect(config.maxSourceChars).toBe(1500);
    });

    it("lists every missing setting", () => {
        expect(() => loadConfig({ AZURE_OPENAI_DEPLOYMENT: "chat" })).toThrow(
            new ConfigError(["AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_API_KEY"]),
        );
    });
});
