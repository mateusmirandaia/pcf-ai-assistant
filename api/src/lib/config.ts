export interface OpenAiConfig {
    endpoint: string;
    apiKey: string;
    deployment: string;
    apiVersion: string;
}

export interface AppConfig {
    openAi: OpenAiConfig;
    maxSourceChars: number;
}

const DEFAULT_API_VERSION = "2024-10-21";
const DEFAULT_MAX_SOURCE_CHARS = 4000;

export class ConfigError extends Error {
    constructor(missing: string[]) {
        super(`Missing required app settings: ${missing.join(", ")}`);
        this.name = "ConfigError";
    }
}

/**
 * Read on every invocation rather than at module load so a settings change in
 * the portal (which restarts the host anyway) and tests that tweak process.env
 * behave the same way.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
    const required = {
        AZURE_OPENAI_ENDPOINT: env.AZURE_OPENAI_ENDPOINT,
        AZURE_OPENAI_API_KEY: env.AZURE_OPENAI_API_KEY,
        AZURE_OPENAI_DEPLOYMENT: env.AZURE_OPENAI_DEPLOYMENT,
    };
    const missing = Object.entries(required)
        .filter(([, value]) => !value?.trim())
        .map(([name]) => name);
    if (missing.length > 0) {
        throw new ConfigError(missing);
    }

    const maxSourceChars = Number.parseInt(env.MAX_SOURCE_CHARS ?? "", 10);

    return {
        openAi: {
            endpoint: required.AZURE_OPENAI_ENDPOINT!.replace(/\/+$/, ""),
            apiKey: required.AZURE_OPENAI_API_KEY!,
            deployment: required.AZURE_OPENAI_DEPLOYMENT!,
            apiVersion: env.AZURE_OPENAI_API_VERSION?.trim() || DEFAULT_API_VERSION,
        },
        maxSourceChars: Number.isFinite(maxSourceChars) && maxSourceChars > 0 ? maxSourceChars : DEFAULT_MAX_SOURCE_CHARS,
    };
}
