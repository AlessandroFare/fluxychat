# Streaming Markdown Renderer

FluxyChat's `StreamingMarkdownRenderer` (P22-B) buffers incoming text chunks and produces clean, incrementally-rendered HTML — even when the markdown is incomplete mid-stream.

## Why It Matters

When an AI agent streams a response token-by-token, the partial markdown is often broken:

- Open code fences (`` ``` ``) without a closing fence
- Table headers (`| Name | Age |`) without a separator row yet
- Unclosed inline markers (`**bold` without closing `**`)
- Partial link syntax (`[link text` without `]`)

Naive rendering shows raw markdown text. The `StreamingMarkdownRenderer` fixes all of these.

## Features

### Table Buffering

Trailing pipe-delimited lines are held back until a separator row (`|---|---|`) confirms it's a table. This prevents `| Name | Age |` from flashing as raw text during streaming.

### Code Fence Tracking

A counter increments on every `` ``` `` or `~~~` encounter. Odd count = inside a code fence. This O(1) check prevents markdown inside code blocks from being rendered.

### Inline Marker Healing

Uses the `remend` library to scan backward from the end of the buffer for unclosed `*`, `~`, `` ` ``, and `[` markers. Returns the longest clean prefix, so partial bold/italic/code/link syntax doesn't break rendering.

### Monotonic Output

Wrapped tables are left open during streaming and closed only on `finish()`. This keeps output monotonic — downstream consumers can safely append deltas without worrying about mid-stream table closure.

## Usage

```ts
import { StreamingMarkdownRenderer } from "@fluxy-chat/sdk";

const renderer = new StreamingMarkdownRenderer();

// Feed chunks as they arrive
for await (const chunk of aiStream) {
  renderer.push(chunk);
  document.getElementById("output").innerHTML = renderer.getHtml();
}

// Finalize — closes any open tables, fences, markers
renderer.finish();
const finalHtml = renderer.getHtml();
```

## How It Works

```
Input stream:  "Here's a table:\n\n| Name | Age |\n|---"
                                   ↑ held back until separator confirmed

Buffer state:   "Here's a table:\n\n"
Output:         "<p>Here's a table:</p>\n"

After "|---|---|\n| Alice | 30 |":
Buffer:         "Here's a table:\n\n| Name | Age |\n|---|---|\n| Alice | 30 |"
Output:         "<table><thead>...</thead><tbody><tr><td>Alice</td><td>30</td></tr></tbody></table>"
```

## Integration

The renderer is used inside `adapter-web.js` when streaming AI agent responses. The worker imports it to transform streamed token deltas before broadcasting to WebSocket clients.

## See Also

- [Adapter Pattern Guide](./adapter-pattern.md) — Platform adapters and format conversion
- [Card Builder Guide](./card-builder.md) — Rich interactive message elements
