import * as React from "react";
import { SuggestionClient, SuggestionError } from "../services/suggestionClient";
import { Suggestion, SuggestionRequest } from "../services/types";

export type SuggestionState =
    | { status: "idle" }
    | { status: "loading" }
    | { status: "success"; suggestions: Suggestion[] }
    | { status: "error"; message: string };

export function useSuggestions(client: SuggestionClient | null) {
    const [state, setState] = React.useState<SuggestionState>({ status: "idle" });
    const inFlight = React.useRef<AbortController | null>(null);

    // The form can unload the control (tab switch, record navigation) while a
    // request is pending; aborting avoids a state update on an unmounted tree
    // and stops paying for a completion nobody will read.
    React.useEffect(() => () => inFlight.current?.abort(), []);

    const requestSuggestions = React.useCallback(
        async (request: SuggestionRequest) => {
            if (!client) {
                return;
            }
            inFlight.current?.abort();
            const controller = new AbortController();
            inFlight.current = controller;
            setState({ status: "loading" });

            try {
                const { suggestions } = await client.suggest(request, controller.signal);
                if (controller.signal.aborted) {
                    return;
                }
                setState(
                    suggestions.length > 0
                        ? { status: "success", suggestions }
                        : { status: "error", message: "No suggestions came back for this message. Try again or adjust the tone." },
                );
            } catch (err) {
                if (controller.signal.aborted || (err instanceof SuggestionError && err.kind === "aborted")) {
                    return;
                }
                setState({ status: "error", message: err instanceof Error ? err.message : "Something went wrong." });
            } finally {
                if (inFlight.current === controller) {
                    inFlight.current = null;
                }
            }
        },
        [client],
    );

    const reset = React.useCallback(() => setState({ status: "idle" }), []);

    return { state, requestSuggestions, reset };
}
