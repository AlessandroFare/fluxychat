/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FLUXYCHAT_WORKER_URL: string;
  readonly VITE_FLUXYCHAT_PUBLISHABLE_KEY?: string;
  readonly VITE_FLUXYCHAT_ROOM_ID?: string;
  readonly VITE_FLUXYCHAT_AGENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
