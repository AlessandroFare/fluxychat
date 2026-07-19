# Skill Uploads

Skill uploads let you upload custom skill bundles to AI providers. A skill is a set of files (e.g., a `SKILL.md` describing behavior) that providers load into sandboxed environments.

## Basic Usage

```ts
import { uploadSkill, generateText } from '@fluxy-chat/agent';

const { providerReference } = await uploadSkill({
  api: mySkillProvider,
  files: [
    { path: 'my-skill/SKILL.md', content: readFileSync('./SKILL.md') },
  ],
  displayTitle: 'My Custom Skill',
});

// Use the providerReference in subsequent model calls
```

## Skill Files

Each file has a relative `path` and `content` (string or Uint8Array):

```ts
const { providerReference } = await uploadSkill({
  api: provider,
  files: [
    { path: 'skill/SKILL.md', content: '# My Skill\nHelps with data analysis.' },
    { path: 'skill/helper.py', content: 'def analyze(data): ...' },
  ],
});
```

## Upload Result

`uploadSkill` returns an `UploadSkillResult`:

| Field | Type | Description |
|-------|------|-------------|
| `providerReference` | `ProviderReference` | Maps provider names to skill IDs |
| `displayTitle` | `string?` | Human-readable title |
| `name` | `string?` | Name inferred by the provider |
| `description` | `string?` | Description inferred by the provider |
| `latestVersion` | `string?` | Latest version identifier |
| `providerMetadata` | `object?` | Provider-specific metadata |
| `warnings` | `Warning[]` | Warnings for unsupported options |

## ProviderReference

A `ProviderReference` maps provider names to provider-specific skill IDs:

```ts
type ProviderReference = Record<string, string>;
// Example: { anthropic: 'skill_abc123', openai: 'sk_...' }
```

## Multi-Provider Usage

Upload a skill to multiple providers and merge references:

```ts
const [openaiUpload, anthropicUpload] = await Promise.all([
  uploadSkill({ api: openaiProvider, files }),
  uploadSkill({ api: anthropicProvider, files, displayTitle: 'My Skill' }),
]);

const mergedRef = {
  ...openaiUpload.providerReference,
  ...anthropicUpload.providerReference,
};
```

## Implementing a SkillProvider

```ts
import type { SkillProvider, UploadSkillResult, SkillFile } from '@fluxy-chat/agent';

class MySkillProvider implements SkillProvider {
  async upload(files: readonly SkillFile[], options?: { displayTitle?: string }): Promise<UploadSkillResult> {
    // Upload files to the provider's API
    return {
      providerReference: { myprovider: 'sk_abc' },
      displayTitle: options?.displayTitle,
    };
  }
}
```

## Type Reference

```ts
type ProviderReference = Record<string, string>;

interface SkillFile {
  path: string;
  content: string | Uint8Array;
}

interface SkillProvider {
  upload(files: readonly SkillFile[], options?: { displayTitle?: string }): Promise<UploadSkillResult>;
}

interface UploadSkillOptions {
  api: SkillProvider;
  files: readonly SkillFile[];
  displayTitle?: string;
}

interface UploadSkillResult {
  providerReference: ProviderReference;
  displayTitle?: string;
  name?: string;
  description?: string;
  latestVersion?: string;
  providerMetadata?: Record<string, unknown>;
  warnings?: Array<{ code?: string; message: string }>;
}

function uploadSkill(options: UploadSkillOptions): Promise<UploadSkillResult>;
```

## See Also

- [Provider Registry](./provider-registry.md) — combining providers
- [HarnessAgent](./harness-agent.md) — external agent runtime wrapper
