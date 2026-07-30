# Message Subject

Associate a message with a parent resource (GitHub issue, Linear ticket, etc.).

```ts
import { createSubject, subjectToString, subjectToUrl } from "@fluxy-chat/sdk";
```

## Creating a Subject

```ts
const subject = createSubject("github-issue", "42", {
  title: "Fix login bug",
  status: "open",
  url: "https://github.com/org/repo/issues/42",
});
```

Supported resource types:
- `github-issue`
- `github-pr`
- `linear-issue`
- `jira-ticket`
- `url`

## Formatting

```ts
subjectToString(createSubject("github-issue", "42", { title: "Bug" }));
// -> "#42: Bug"

subjectToString(createSubject("github-pr", "100"));
// -> "!100"

subjectToString(createSubject("linear-issue", "ABC-123", { title: "Feature" }));
// -> "LIN-ABC-123: Feature"
```

## URL Generation

```ts
subjectToUrl(createSubject("github-issue", "42"));
// -> "https://github.com/issues/42"

subjectToUrl(createSubject("url", "1", { url: "https://example.com/1" }));
// -> "https://example.com/1"
```

## Types

- `SubjectResourceType`: `"github-issue" | "github-pr" | "linear-issue" | "jira-ticket" | "url"`
- `MessageSubject`: `{ type, id, title?, url?, status?, metadata? }`
