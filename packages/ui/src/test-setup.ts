import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// jsdom does not implement scrollIntoView; MessageInput uses it for mention options.
Element.prototype.scrollIntoView = vi.fn();
