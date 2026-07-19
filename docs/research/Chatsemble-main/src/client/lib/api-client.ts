import type { AppType } from "@server/routes";
import { hc } from "hono/client";

const API_HOST = import.meta.env.VITE_APP_URL || "http://localhost:5173";

export const honoClient = hc<AppType>(API_HOST);
