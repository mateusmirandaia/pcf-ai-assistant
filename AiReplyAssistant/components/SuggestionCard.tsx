import * as React from "react";
import { Button, Card, CardFooter, Text, makeStyles, tokens } from "@fluentui/react-components";
import { Suggestion } from "../services/types";

const useStyles = makeStyles({
    card: {
        rowGap: tokens.spacingVerticalS,
    },
    text: {
        whiteSpace: "pre-wrap",
    },
});

export interface SuggestionCardProps {
    suggestion: Suggestion;
    index: number;
    disabled: boolean;
    onUse: (suggestion: Suggestion) => void;
}

export const SuggestionCard: React.FC<SuggestionCardProps> = ({ suggestion, index, disabled, onUse }) => {
    const styles = useStyles();

    return (
        <Card className={styles.card} size="small" appearance="outline" aria-label={`Suggestion ${index + 1}`}>
            <Text className={styles.text}>{suggestion.text}</Text>
            <CardFooter>
                <Button
                    appearance="primary"
                    size="small"
                    disabled={disabled}
                    onClick={() => onUse(suggestion)}
                    aria-label={`Use suggestion ${index + 1}`}
                >
                    Use this
                </Button>
            </CardFooter>
        </Card>
    );
};
