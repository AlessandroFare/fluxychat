/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FLUXYCHAT_WORKER_URL: string;
  readonly VITE_FLUXYCHAT_MEMBER_JWT: string;
  readonly VITE_FLUXYCHAT_ROOM_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
