export type Tone = "formal" | "friendly" | "concise";

export const TONES: readonly Tone[] = ["formal", "friendly", "concise"];

export interface SuggestionRequest {
    sourceText: string;
    tone: Tone;
}

export interface Suggestion {
    id: string;
    text: string;
}

export interface SuggestionResponse {
    suggestions: Suggestion[];
}
