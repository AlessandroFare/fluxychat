import { describe, expect, it } from "vitest";
import {
  handleFetchThrownError,
  mergeCorsHeadersOntoResponse,
} from "./http-cors.js";

describe("http-cors", () => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "https://www.fluxychat.com",
    "X-Trace-Id": "trace-1",
  };

  it("merges CORS headers onto thrown Response", async () => {
    const thrown = new Response("Unauthorized", { status: 401 });
    const res = mergeCorsHeadersOntoResponse(thrown, corsHeaders);
    expect(res.status).toBe(401);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://www.fluxychat.com",
    );
    expect(await res.text()).toBe("Unauthorized");
  });

  it("handleFetchThrownError returns JSON 500 with CORS for generic errors", async () => {
    const res = handleFetchThrownError(new Error("db blew up"), {
      corsHeaders,
      traceId: "trace-1",
      logError: () => {},
      requestLogCtx: {},
    });
    expect(res.status).toBe(500);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://www.fluxychat.com",
    );
    const body = await res.json();
    expect(body.error).toBe("Internal server error");
    expect(body.traceId).toBe("trace-1");
  });
});
