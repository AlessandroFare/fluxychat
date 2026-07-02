# Card Element Builder

FluxyChat's card builder (P22-C) lets you compose structured, interactive messages with buttons, tables, images, and sections — using either JSX or function-call syntax.

## Overview

Cards go beyond plain text and markdown. They enable:

- **Interactive buttons** for approvals, quick replies, and form submissions
- **Structured layouts** with sections, dividers, and fields
- **Tables** with headers and rows
- **Images** with captions
- **Cross-platform rendering** — one card definition renders as Slack Block Kit, Teams Adaptive Cards, or web markdown

## Element Types

| Element | Description |
|---------|-------------|
| `Card` | Root container with optional title |
| `Section` | Grouped content block |
| `Text` | Text content (plain or markdown) |
| `Button` | Interactive button with id and URL |
| `LinkButton` | Button that opens a URL |
| `Actions` | Horizontal action button group |
| `Image` | Image with optional alt text |
| `Divider` | Horizontal separator |
| `Field` | Label-value pair |
| `Fields` | Grid of field pairs |
| `Table` | Header + rows structured table |
| `CardLink` | Card-level link |

## Function API

```ts
import { Card, Text, Button, Actions, Divider, Section, cardToMarkdown, cardToFallbackText } from "@fluxy-chat/sdk";

const card = Card(
  Text("🎉 Welcome to FluxyChat!"),
  Divider(),
  Section(
    Text("Get started:"),
    Actions(
      Button("Create a room", "action:create-room"),
      LinkButton("Read docs", "https://docs.fluxychat.com"),
    ),
  ),
);

// Render for different platforms
const markdown = cardToMarkdown(card);     // Web/markdown clients
const fallback = cardToFallbackText(card);  // SMS, email
```

## JSX API

The card builder includes a custom JSX runtime (no React required):

```tsx
/** @jsxImportSource @fluxy-chat/sdk */

const card = (
  <Card title="Support Ticket #42">
    <Section>
      <Text>**Status:** Open</Text>
      <Text>**Priority:** High</Text>
    </Section>
    <Divider />
    <Actions>
      <Button id="resolve">✅ Resolve</Button>
      <Button id="escalate">⬆️ Escalate</Button>
    </Actions>
  </Card>
);
```

## Fallback Text

For platforms that can't render cards (SMS, email, IRC), `cardToFallbackText()` generates a plain-text representation:

```
Welcome to FluxyChat!
---------------------
Get started: [Create a room] [Read docs → https://docs.fluxychat.com]
```

## Platform Rendering

Each adapter's `FormatConverter` knows how to render cards natively:

- **Slack:** Block Kit JSON with `actions`, `section`, `divider` blocks
- **Teams:** Adaptive Cards JSON with `ActionSet`, `TextBlock`, `ColumnSet`
- **Web:** Markdown with button links
- **SMS/Email:** Fallback text

## Callback URLs

Buttons with `id` values can trigger server-side actions via the callback URL system (P22-F3). When a user clicks a button, the adapter encodes the callback token and routes it to your handler:

```ts
// Button click → webhook → your handler
{
  type: "button_click",
  buttonId: "resolve",
  threadId: "slack:C123:1234",
  userId: "U456"
}
```

## See Also

- [Adapter Pattern Guide](./adapter-pattern.md) — How cards render per platform
- [AI Tool Presets Guide](./ai-tool-presets.md) — Approval gates for card interactions
