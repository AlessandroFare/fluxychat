import { openapi } from "@/lib/openapi";

export const { GET, HEAD, PUT, POST, PATCH, DELETE } = openapi.createProxy({
  allowedOrigins: [
    "http://127.0.0.1:8787",
    "http://localhost:8787",
    "https://your-worker.workers.dev",
  ],
});
