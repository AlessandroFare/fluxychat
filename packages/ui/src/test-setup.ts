import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => cleanup());

// jsdom does not implement scrollIntoView; MessageInput uses it for mention options.
Element.prototype.scrollIntoView = vi.fn();
