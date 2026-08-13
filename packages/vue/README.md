# @fluxy-chat/vue

Vue 3 composables for FluxyChat.

```vue
<script setup lang="ts">
import { useChat } from '@fluxy-chat/vue';
import { FluxyChatClient } from '@fluxy-chat/sdk';

const client = new FluxyChatClient({ baseUrl: import.meta.env.VITE_WORKER_URL, userId: 'u1', token });
const { messages, connected, sendMessage } = useChat({ roomId: 'room-1', client });
</script>
```

See `@fluxy-chat/react` for the React equivalent.
