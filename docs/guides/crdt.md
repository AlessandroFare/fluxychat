# Collaborative Editing (CRDT)

Operation-based CRDT for shared document editing.

```ts
import { createCrdt } from "@fluxy-chat/sdk";
```

## Document Operations

```ts
const crdt = createCrdt();
crdt.createDocument("doc-1", "hello");
crdt.applyOperation("doc-1", { userId: "u1", type: "insert", position: 5, value: " world" });
crdt.applyOperation("doc-1", { userId: "u1", type: "delete", position: 0, length: 1 });
```

## Snapshots & Merging

```ts
const snap = crdt.createSnapshot("doc-1");
crdt.applySnapshot(snap);

const applied = crdt.merge("doc-1", remoteOps); // idempotent merge
```

## Awareness

```ts
crdt.setAwareness("doc-1", { userId: "u1", cursorPosition: 3, lastActive: new Date().toISOString() });
const users = crdt.getAwareness("doc-1");
```
