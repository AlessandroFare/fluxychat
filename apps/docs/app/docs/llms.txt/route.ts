import { fluxyChatLlmsResponse } from "@/lib/llms-txt";

export const revalidate = false;

export function GET() {
  return fluxyChatLlmsResponse();
}
