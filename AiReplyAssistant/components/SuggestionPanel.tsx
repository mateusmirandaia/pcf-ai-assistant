import * as React from "react";
import {
    Button,
    MessageBar,
    MessageBarBody,
    Spinner,
    Text,
    makeStyles,
    tokens,
} from "@fluentui/react-components";
import { useSuggestions } from "../hooks/useSuggestions";
import { SuggestionClient } from "../services/suggestionClient";
import { Suggestion, Tone } from "../services/types";
import { SuggestionCard } from "./SuggestionCard";

const useStyles = makeStyles({
    root: {
        display: "flex",
        flexDirection: "column",
        rowGap: tokens.spacingVerticalM,
        width: "100%",
    },
    toolbar: {
        display: "flex",
        alignItems: "center",
        columnGap: tokens.spacingHorizontalM,
    },
    list: {
        display: "flex",
        flexDirection: "column",
        rowGap: tokens.spacingVerticalS,
    },
});

export interface SuggestionPanelProps {
    sourceText: string;
    tone: Tone;
    client: SuggestionClient | null;
    /** True when the form, the column security profile or the record state blocks edits. */
    disabled: boolean;
    onUseSuggestion: (text: string) => void;
}

export const SuggestionPanel: React.FC<SuggestionPanelProps> = ({ sourceText, tone, client, disabled, onUseSuggestion }) => {
    const styles = useStyles();
    const { state, requestSuggestions, reset } = useSuggestions(client);

    const hasSource = sourceText.trim().length > 0;
    const isLoading = state.status === "loading";
    const canRequest = !disabled && hasSource && client !== null && !isLoading;

    const handleUse = (suggestion: Suggestion) => {
        onUseSuggestion(suggestion.text);
        reset();
    };

    return (
        <div className={styles.root}>
            <div className={styles.toolbar}>
                <Button
                    appearance="secondary"
                    disabled={!canRequest}
                    onClick={() => void requestSuggestions({ sourceText, tone })}
                >
                    Suggest reply
                </Button>
                {isLoading && <Spinner size="tiny" label="Drafting suggestions..." />}
                {!hasSource && !disabled && <Text size={200}>There is no customer message to answer yet.</Text>}
            </div>

            {client === null && (
                <MessageBar intent="warning">
                    <MessageBarBody>
                        The suggestion API URL is missing or invalid. Ask your administrator to configure the control.
                    </MessageBarBody>
                </MessageBar>
            )}

            {state.status === "error" && (
                <MessageBar intent="error">
                    <MessageBarBody>{state.message}</MessageBarBody>
                </MessageBar>
            )}

            {state.status === "success" && (
                <div className={styles.list} role="list" aria-label="Suggested replies">
                    {state.suggestions.map((suggestion, index) => (
                        <div role="listitem" key={suggestion.id}>
                            <SuggestionCard suggestion={suggestion} index={index} disabled={disabled} onUse={handleUse} />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
