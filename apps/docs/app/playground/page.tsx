import type { Metadata } from "next";
import { PlaygroundClient } from "./playground-client";

export const metadata: Metadata = {
  title: "SDK playground",
  description: "Generate FluxyChat SDK and curl snippets for send message, inbox, and mark read.",
};

export default function PlaygroundPage() {
  return <PlaygroundClient />;
}
