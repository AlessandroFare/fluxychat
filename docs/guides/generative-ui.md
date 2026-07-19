# Generative UI

Tool-name-prefixed parts for rendering AI tool results as UI components. Framework-agnostic core with `ComponentRegistry` for mapping tool names to renderers.

## Parts

```ts
import { createTextPart, createToolCallPart, createToolResultPart } from "@fluxy-chat/sdk";

const parts = [
  createTextPart("The weather is:"),
  createToolCallPart("getWeather", "call-1", { location: "SF" }),
  createToolResultPart("getWeather", "call-1", "output-available", { temp: 72 }),
];
```

## Component Registry

```ts
import { createComponentRegistry, renderParts } from "@fluxy-chat/sdk";

const registry = createComponentRegistry();
registry.register("getWeather", {
  component: { render: (props) => `Weather: ${props.temp}°` },
  loadingComponent: { render: () => "Loading..." },
  errorComponent: { render: (props) => `Error: ${props.errorText}` },
});

const result = renderParts(parts, registry);
// ["The weather is:", "[getWeather loading...]", "Weather: 72°"]
```

## Type Guards

```ts
import { isTextPart, isToolPart, isToolCallPart, isToolResultPart } from "@fluxy-chat/sdk";

if (isToolResultPart(part) && part.state === "output-available") {
  renderComponent(part.toolName, part.output);
}
```
