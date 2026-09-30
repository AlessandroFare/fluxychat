/**
 * shadcn CLI registry. Items wrap published npm packages; they do not copy the UI source tree.
 * Serve with CORS from GET /r/:name
 */

const WIDGET_FILE = `"use client";

import { FluxyChatWidget } from "@fluxy-chat/ui-kit";

export function FluxyChatWidgetBlock(props: {
  roomId: string;
  workerUrl: string;
  token?: string;
  guest?: boolean;
  publishableKey?: string;
  agentId?: string;
}) {
  return <FluxyChatWidget {...props} />;
}
`;

const WINDOW_FILE = `"use client";

export { ChatWindow } from "@fluxy-chat/ui";
export type { ChatWindowProps } from "@fluxy-chat/ui";
`;

export interface ShadcnRegistryFile {
  path: string;
  type: "registry:component";
  content: string;
}

export interface ShadcnRegistryItem {
  $schema: string;
  name: string;
  type: "registry:component";
  title: string;
  description: string;
  dependencies: string[];
  files: ShadcnRegistryFile[];
}

export const SHADCN_REGISTRY_NAME = "fluxychat";

const ITEMS: ShadcnRegistryItem[] = [
  {
    $schema: "https://ui.shadcn.com/schema/registry-item.json",
    name: "fluxy-chat-widget",
    type: "registry:component",
    title: "FluxyChat widget",
    description:
      "Drop-in guest or JWT chat widget. Installs a thin wrapper around @fluxy-chat/ui-kit, not a fork of the component source.",
    dependencies: ["@fluxy-chat/ui-kit", "@fluxy-chat/ui", "@fluxy-chat/sdk", "@fluxy-chat/react"],
    files: [
      {
        path: "components/fluxy-chat-widget-block.tsx",
        type: "registry:component",
        content: WIDGET_FILE,
      },
    ],
  },
  {
    $schema: "https://ui.shadcn.com/schema/registry-item.json",
    name: "fluxy-chat-window",
    type: "registry:component",
    title: "FluxyChat window",
    description: "Re-export of ChatWindow from @fluxy-chat/ui for shadcn add.",
    dependencies: ["@fluxy-chat/ui", "@fluxy-chat/sdk"],
    files: [
      {
        path: "components/fluxy-chat-window.tsx",
        type: "registry:component",
        content: WINDOW_FILE,
      },
    ],
  },
];

export function listShadcnRegistryItems() {
  return ITEMS.map((item) => ({
    name: item.name,
    type: item.type,
    title: item.title,
    description: item.description,
  }));
}

export function getShadcnRegistryIndex() {
  return {
    $schema: "https://ui.shadcn.com/schema/registry.json",
    name: SHADCN_REGISTRY_NAME,
    homepage: "https://github.com/AlessandroFare/fluxychat",
    items: listShadcnRegistryItems(),
  };
}

export function getShadcnRegistryItem(name: string) {
  const slug = name.replace(/\.json$/i, "").trim();
  return ITEMS.find((item) => item.name === slug) ?? null;
}

export const SHADCN_REGISTRY_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "public, max-age=300",
} as const;
