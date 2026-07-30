import { permanentRedirect } from "next/navigation";

/** Legacy URL — marketing homepage lives at `/`. */
export default function LegacyLandingRedirect() {
  permanentRedirect("/");
}
