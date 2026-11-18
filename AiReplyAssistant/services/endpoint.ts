/**
 * Accepts only absolute HTTPS URLs, plus plain HTTP on localhost so the
 * control can talk to `func start` while running in the test harness.
 * Anything else returns null and the control renders a configuration warning
 * instead of firing requests at a typo.
 */
export function resolveEndpoint(raw: string | null | undefined): string | null {
    const value = raw?.trim();
    if (!value) {
        return null;
    }

    let url: URL;
    try {
        url = new URL(value);
    } catch {
        return null;
    }

    const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol === "https:" || (url.protocol === "http:" && isLocalhost)) {
        return url.toString();
    }
    return null;
}
