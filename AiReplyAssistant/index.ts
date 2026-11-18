import * as React from "react";
import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import { IInputs, IOutputs } from "./generated/ManifestTypes";
import { SuggestionPanel } from "./components/SuggestionPanel";
import { resolveEndpoint } from "./services/endpoint";
import { createSuggestionClient, SuggestionClient } from "./services/suggestionClient";
import { TONES, Tone } from "./services/types";

export class AiReplyAssistant implements ComponentFramework.ReactControl<IInputs, IOutputs> {
    private notifyOutputChanged: () => void;
    private pendingReply: string | undefined;
    private client: SuggestionClient | null = null;

    public init(context: ComponentFramework.Context<IInputs>, notifyOutputChanged: () => void): void {
        this.notifyOutputChanged = notifyOutputChanged;
    }

    /**
     * Runs on every change to the property bag: field values, but also resize,
     * visibility, and the form saving. It has to be cheap and idempotent. Request
     * state lives inside React (useSuggestions), so returning a fresh element here
     * reconciles against the existing tree instead of wiping the suggestions.
     */
    public updateView(context: ComponentFramework.Context<IInputs>): React.ReactElement {
        const replyDraft = context.parameters.replyDraft;
        const disabled = context.mode.isControlDisabled || replyDraft.security?.editable === false;

        return React.createElement(
            FluentProvider,
            { theme: context.fluentDesignLanguage?.tokenTheme ?? webLightTheme },
            React.createElement(SuggestionPanel, {
                sourceText: context.parameters.sourceText.raw ?? "",
                tone: toTone(context.parameters.tone.raw),
                client: this.getClient(context.parameters.apiEndpoint.raw),
                disabled,
                onUseSuggestion: this.handleUseSuggestion,
            }),
        );
    }

    /**
     * The framework calls this only after notifyOutputChanged, and may batch
     * several notifications into one call, so the latest pick is held in a field
     * rather than passed through.
     */
    public getOutputs(): IOutputs {
        return { replyDraft: this.pendingReply };
    }

    public destroy(): void {
        // React unmounting is handled by the platform for virtual controls; the
        // panel's own effect aborts any request still in flight.
    }

    private readonly handleUseSuggestion = (text: string): void => {
        this.pendingReply = text;
        // Writing to the bound column is asynchronous from the control's point of
        // view: we flag a change and the form pulls it through getOutputs, which
        // also marks the record dirty and runs any OnChange handlers.
        this.notifyOutputChanged();
    };

    /**
     * Rebuilt only when the URL changes so the hook's callbacks keep a stable
     * identity across the many updateView calls a form makes.
     */
    private getClient(rawEndpoint: string | null): SuggestionClient | null {
        const endpoint = resolveEndpoint(rawEndpoint);
        if (endpoint === null) {
            this.client = null;
        } else if (this.client?.endpoint !== endpoint) {
            this.client = createSuggestionClient({ endpoint });
        }
        return this.client;
    }
}

function toTone(value: string | null | undefined): Tone {
    return TONES.find((tone) => tone === value) ?? "formal";
}
