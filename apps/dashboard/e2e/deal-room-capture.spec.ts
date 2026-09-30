import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { expect, test } from "@playwright/test";

const origin = process.env.DEAL_ROOM_ORIGIN?.replace(/\/$/, "") ?? "";

test.describe("deal-room two-tab capture", () => {
  test.skip(
    !origin,
    "Set DEAL_ROOM_ORIGIN to the vite deal-room URL (public guest room, not a shared member JWT)",
  );

  test.use({ baseURL: origin || "http://127.0.0.1:5173" });

  test("counsel whisper stays off the buyer tab", async ({ browser }) => {
    const outDir = join(process.cwd(), "..", "..", "docs", "marketing", "assets", "deal-room");
    mkdirSync(outDir, { recursive: true });

    const buyerCtx = await browser.newContext();
    const counselCtx = await browser.newContext();
    const buyer = await buyerCtx.newPage();
    const counsel = await counselCtx.newPage();

    await buyer.goto("/");
    await counsel.goto("/?seat=counsel");

    await expect(buyer.getByTestId("deal-status")).toContainText("live", { timeout: 30_000 });
    await expect(counsel.getByTestId("deal-status")).toContainText("live", { timeout: 30_000 });

    await counsel.getByTestId("counsel-note").click();
    await expect(counsel.getByTestId("deal-log")).toContainText("redlines on section 4", {
      timeout: 15_000,
    });
    await expect(buyer.getByTestId("deal-log")).not.toContainText("redlines on section 4");

    await buyer.getByTestId("propose").click();
    await expect(buyer.getByTestId("deal-log")).toContainText("quorum", { timeout: 15_000 });
    await buyer.getByTestId("ack-decision").click();
    await counsel.getByTestId("ack-decision").click();
    await expect(buyer.getByTestId("deal-log")).toContainText("met", { timeout: 15_000 });

    await buyer.getByTestId("ask-agent").click();

    const buyerPng = join(outDir, "buyer.png");
    const counselPng = join(outDir, "counsel.png");
    const refreshPng = join(outDir, "counsel-after-refresh.png");
    await buyer.screenshot({ path: buyerPng, fullPage: true });
    await counsel.screenshot({ path: counselPng, fullPage: true });

    await counsel.reload();
    await expect(counsel.getByTestId("deal-status")).toContainText("live", { timeout: 30_000 });
    await expect(counsel.getByTestId("deal-log")).toContainText("quorum", { timeout: 15_000 });
    await counsel.screenshot({ path: refreshPng, fullPage: true });

    const gif = join(outDir, "two-tab.gif");
    spawnSync(
      "ffmpeg",
      [
        "-y",
        "-loop",
        "1",
        "-t",
        "1.2",
        "-i",
        buyerPng,
        "-loop",
        "1",
        "-t",
        "1.2",
        "-i",
        counselPng,
        "-loop",
        "1",
        "-t",
        "1.2",
        "-i",
        refreshPng,
        "-filter_complex",
        "[0][1][2]concat=n=3:v=1:a=0,fps=4,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse",
        gif,
      ],
      { stdio: "ignore" },
    );

    await buyerCtx.close();
    await counselCtx.close();
  });
});
