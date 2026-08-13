# @fluxy-chat/svelte

Svelte 5 bindings for FluxyChat.

```svelte
<script lang="ts">
  import { useChat } from '@fluxy-chat/svelte';
  const chat = useChat({ roomId: 'room-1', client });
</script>

{#each $chat as state}
  <!-- use state.messages -->
{/each}
```

Prefer destructuring via a small wrapper component. See the docs site.
