export const TONES = ["formal", "friendly", "concise"] as const;
export type Tone = (typeof TONES)[number];

export interface SuggestRepliesInput {
    sourceText: string;
    tone: Tone;
}

export type ValidationResult = { ok: true; value: SuggestRepliesInput } | { ok: false; error: string };

export function validateSuggestRequest(body: unknown, maxSourceChars: number): ValidationResult {
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
        return { ok: false, error: "Request body must be a JSON object." };
    }
    const { sourceText, tone } = body as Record<string, unknown>;

    if (typeof sourceText !== "string" || sourceText.trim().length === 0) {
        return { ok: false, error: "sourceText is required." };
    }
    const trimmed = sourceText.trim();
    if (trimmed.length > maxSourceChars) {
        return { ok: false, error: `sourceText is too long (${trimmed.length} characters, limit is ${maxSourceChars}).` };
    }

    if (typeof tone !== "string" || !(TONES as readonly string[]).includes(tone)) {
        return { ok: false, error: `tone must be one of: ${TONES.join(", ")}.` };
    }

    return { ok: true, value: { sourceText: trimmed, tone: tone as Tone } };
}
