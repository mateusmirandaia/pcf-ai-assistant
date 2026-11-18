import * as React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SuggestionPanel, SuggestionPanelProps } from "../components/SuggestionPanel";
import { createSuggestionClient, SuggestionClient } from "../services/suggestionClient";

function clientReturning(response: Promise<Response>): { client: SuggestionClient; fetchImpl: jest.Mock } {
    const fetchImpl = jest.fn().mockReturnValue(response);
    return { client: createSuggestionClient({ endpoint: "https://api.example.test/suggest", fetchImpl }), fetchImpl };
}

function ok(body: unknown): Promise<Response> {
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);
}

function renderPanel(overrides: Partial<SuggestionPanelProps> = {}) {
    const props: SuggestionPanelProps = {
        sourceText: "The invoice total is wrong.",
        tone: "friendly",
        client: null,
        disabled: false,
        onUseSuggestion: jest.fn(),
        ...overrides,
    };
    render(<SuggestionPanel {...props} />);
    return props;
}

describe("SuggestionPanel", () => {
    it("fetches suggestions and writes the chosen one back", async () => {
        const { client, fetchImpl } = clientReturning(
            ok({
                suggestions: [
                    { id: "1", text: "Thanks for flagging this, we are checking the invoice now." },
                    { id: "2", text: "Sorry about that, a corrected invoice is on its way." },
                ],
            }),
        );
        const props = renderPanel({ client });

        await userEvent.click(screen.getByRole("button", { name: "Suggest reply" }));

        expect(await screen.findByText("Sorry about that, a corrected invoice is on its way.")).toBeInTheDocument();
        expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({ sourceText: "The invoice total is wrong.", tone: "friendly" });

        await userEvent.click(screen.getByRole("button", { name: "Use suggestion 2" }));

        expect(props.onUseSuggestion).toHaveBeenCalledWith("Sorry about that, a corrected invoice is on its way.");
        expect(screen.queryByRole("list", { name: "Suggested replies" })).not.toBeInTheDocument();
    });

    it("shows a spinner while the request is pending", async () => {
        let resolve!: (value: Response) => void;
        const { client } = clientReturning(new Promise<Response>((r) => (resolve = r)));
        renderPanel({ client });

        await userEvent.click(screen.getByRole("button", { name: "Suggest reply" }));

        expect(screen.getByText("Drafting suggestions...")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Suggest reply" })).toBeDisabled();

        resolve({ ok: true, status: 200, json: () => Promise.resolve({ suggestions: [{ id: "1", text: "Done." }] }) } as Response);
        await waitFor(() => expect(screen.queryByText("Drafting suggestions...")).not.toBeInTheDocument());
    });

    it("renders the service error in a message bar", async () => {
        const { client } = clientReturning(
            Promise.resolve({ ok: false, status: 429, json: () => Promise.resolve({ error: "Too many requests, try again shortly." }) } as Response),
        );
        renderPanel({ client });

        await userEvent.click(screen.getByRole("button", { name: "Suggest reply" }));

        expect(await screen.findByText("Too many requests, try again shortly.")).toBeInTheDocument();
    });

    it("treats an empty suggestion list as an error the user can act on", async () => {
        const { client } = clientReturning(ok({ suggestions: [] }));
        renderPanel({ client });

        await userEvent.click(screen.getByRole("button", { name: "Suggest reply" }));

        expect(await screen.findByText(/No suggestions came back/)).toBeInTheDocument();
    });

    it("disables every action when the form is read-only", async () => {
        const { client, fetchImpl } = clientReturning(ok({ suggestions: [] }));
        renderPanel({ client, disabled: true });

        expect(screen.getByRole("button", { name: "Suggest reply" })).toBeDisabled();
        await userEvent.click(screen.getByRole("button", { name: "Suggest reply" }));
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it("does not call the service when there is nothing to answer", () => {
        const { client } = clientReturning(ok({ suggestions: [] }));
        renderPanel({ client, sourceText: "   " });

        expect(screen.getByRole("button", { name: "Suggest reply" })).toBeDisabled();
        expect(screen.getByText("There is no customer message to answer yet.")).toBeInTheDocument();
    });

    it("warns when the endpoint is not configured", () => {
        renderPanel({ client: null });

        expect(screen.getByText(/suggestion API URL is missing or invalid/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Suggest reply" })).toBeDisabled();
    });
});
