import "@testing-library/jest-dom";

// jsdom has no layout engine, so it ships without ResizeObserver. Fluent's
// MessageBar uses one to decide when to wrap its actions; a no-op is enough.
class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
}

globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
