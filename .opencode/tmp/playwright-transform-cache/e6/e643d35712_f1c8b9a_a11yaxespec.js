"use strict";

var _test = require("@playwright/test");
var _playwright = _interopRequireDefault(require("@axe-core/playwright"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
/**
 * Audit D — axe-core a11y suite for FluxyChat dashboard.
 *
 * Runs against the 5 onboarding steps + 2 core pages and asserts zero
 * Critical/Serious WCAG violations. Moderate/Minor are logged but not
 * blocking (they're speculative without real user testing).
 *
 * Auth: mirrors the smoke spec pattern. We do NOT require Clerk auth —
 * the test uses the `fc_console_ack=1` cookie to bypass the
 * "first-time acknowledgement" gate, which lets the page render
 * unauthenticated. For pages that redirect to /sign-in without
 * Clerk, the test is skipped at runtime.
 */

const ONBOARDING_STEPS = [{
  name: "step-1-welcome",
  path: "/onboarding?step=1"
}, {
  name: "step-2-project",
  path: "/onboarding?step=2"
}, {
  name: "step-3-keys",
  path: "/onboarding?step=3"
}, {
  name: "step-4-rooms",
  path: "/onboarding?step=4"
}, {
  name: "step-5-done",
  path: "/onboarding?step=5"
}];
const CORE_PAGES = [{
  name: "landing",
  path: "/"
}, {
  name: "status",
  path: "/status"
}];
async function attachConsoleAckCookie(context) {
  await context.addCookies([{
    name: "fc_console_ack",
    value: "1",
    url: "http://127.0.0.1:3000"
  }]);
}
_test.test.describe("axe a11y — onboarding", () => {
  for (const step of ONBOARDING_STEPS) {
    (0, _test.test)(`${step.name} has no Critical or Serious violations`, async ({
      page,
      context
    }) => {
      await attachConsoleAckCookie(context);
      const response = await page.goto(step.path, {
        waitUntil: "domcontentloaded"
      });
      if (!response || response.status() >= 400) {
        var _response$status;
        _test.test.skip(true, `page returned ${(_response$status = response === null || response === void 0 ? void 0 : response.status()) !== null && _response$status !== void 0 ? _response$status : "no response"} — page not reachable in smoke mode`);
      }
      const results = await new _playwright.default({
        page
      }).analyze();
      // Log every violation (Moderate/Minor included) so the report
      // surfaces the full picture, not just the blocking ones.
      for (const v of results.violations) {
        var _v$nodes$0$target$joi, _v$nodes$, _v$nodes$0$html$slice, _v$nodes$2, _v$impact;
        const nodeCount = v.nodes.length;
        const firstNode = (_v$nodes$0$target$joi = (_v$nodes$ = v.nodes[0]) === null || _v$nodes$ === void 0 || (_v$nodes$ = _v$nodes$.target) === null || _v$nodes$ === void 0 ? void 0 : _v$nodes$.join(" ")) !== null && _v$nodes$0$target$joi !== void 0 ? _v$nodes$0$target$joi : "(no selector)";
        const html = (_v$nodes$0$html$slice = (_v$nodes$2 = v.nodes[0]) === null || _v$nodes$2 === void 0 || (_v$nodes$2 = _v$nodes$2.html) === null || _v$nodes$2 === void 0 ? void 0 : _v$nodes$2.slice(0, 200)) !== null && _v$nodes$0$html$slice !== void 0 ? _v$nodes$0$html$slice : "(no html)";
        console.log(`[a11y] ${(_v$impact = v.impact) !== null && _v$impact !== void 0 ? _v$impact : "unknown"} ${v.id}: ${v.help} (${nodeCount} node(s); first: ${firstNode}) html=${html}`);
      }
      const criticalOrSerious = results.violations.filter(v => v.impact === "critical" || v.impact === "serious");
      (0, _test.expect)(criticalOrSerious).toHaveLength(0);
    });
  }
});
_test.test.describe("axe a11y — core pages", () => {
  for (const p of CORE_PAGES) {
    (0, _test.test)(`${p.name} has no Critical or Serious violations`, async ({
      page,
      context
    }) => {
      await attachConsoleAckCookie(context);
      const response = await page.goto(p.path, {
        waitUntil: "domcontentloaded"
      });
      if (!response || response.status() >= 400) {
        var _response$status2;
        _test.test.skip(true, `page returned ${(_response$status2 = response === null || response === void 0 ? void 0 : response.status()) !== null && _response$status2 !== void 0 ? _response$status2 : "no response"} — page not reachable in smoke mode`);
      }
      const results = await new _playwright.default({
        page
      }).analyze();
      for (const v of results.violations) {
        var _v$nodes$0$target$joi2, _v$nodes$3, _v$impact2;
        const nodeCount = v.nodes.length;
        const firstNode = (_v$nodes$0$target$joi2 = (_v$nodes$3 = v.nodes[0]) === null || _v$nodes$3 === void 0 || (_v$nodes$3 = _v$nodes$3.target) === null || _v$nodes$3 === void 0 ? void 0 : _v$nodes$3.join(" ")) !== null && _v$nodes$0$target$joi2 !== void 0 ? _v$nodes$0$target$joi2 : "(no selector)";
        console.log(`[a11y] ${(_v$impact2 = v.impact) !== null && _v$impact2 !== void 0 ? _v$impact2 : "unknown"} ${v.id}: ${v.help} (${nodeCount} node(s); first: ${firstNode})`);
      }
      const criticalOrSerious = results.violations.filter(v => v.impact === "critical" || v.impact === "serious");
      (0, _test.expect)(criticalOrSerious).toHaveLength(0);
    });
  }
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfdGVzdCIsInJlcXVpcmUiLCJfcGxheXdyaWdodCIsIl9pbnRlcm9wUmVxdWlyZURlZmF1bHQiLCJlIiwiX19lc01vZHVsZSIsImRlZmF1bHQiLCJPTkJPQVJESU5HX1NURVBTIiwibmFtZSIsInBhdGgiLCJDT1JFX1BBR0VTIiwiYXR0YWNoQ29uc29sZUFja0Nvb2tpZSIsImNvbnRleHQiLCJhZGRDb29raWVzIiwidmFsdWUiLCJ1cmwiLCJ0ZXN0IiwiZGVzY3JpYmUiLCJzdGVwIiwicGFnZSIsInJlc3BvbnNlIiwiZ290byIsIndhaXRVbnRpbCIsInN0YXR1cyIsIl9yZXNwb25zZSRzdGF0dXMiLCJza2lwIiwicmVzdWx0cyIsIkF4ZUJ1aWxkZXIiLCJhbmFseXplIiwidiIsInZpb2xhdGlvbnMiLCJfdiRub2RlcyQwJHRhcmdldCRqb2kiLCJfdiRub2RlcyQiLCJfdiRub2RlcyQwJGh0bWwkc2xpY2UiLCJfdiRub2RlcyQyIiwiX3YkaW1wYWN0Iiwibm9kZUNvdW50Iiwibm9kZXMiLCJsZW5ndGgiLCJmaXJzdE5vZGUiLCJ0YXJnZXQiLCJqb2luIiwiaHRtbCIsInNsaWNlIiwiY29uc29sZSIsImxvZyIsImltcGFjdCIsImlkIiwiaGVscCIsImNyaXRpY2FsT3JTZXJpb3VzIiwiZmlsdGVyIiwiZXhwZWN0IiwidG9IYXZlTGVuZ3RoIiwicCIsIl9yZXNwb25zZSRzdGF0dXMyIiwiX3Ykbm9kZXMkMCR0YXJnZXQkam9pMiIsIl92JG5vZGVzJDMiLCJfdiRpbXBhY3QyIl0sInNvdXJjZXMiOlsiYTExeS5heGUuc3BlYy50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEF1ZGl0IEQg4oCUIGF4ZS1jb3JlIGExMXkgc3VpdGUgZm9yIEZsdXh5Q2hhdCBkYXNoYm9hcmQuXG4gKlxuICogUnVucyBhZ2FpbnN0IHRoZSA1IG9uYm9hcmRpbmcgc3RlcHMgKyAyIGNvcmUgcGFnZXMgYW5kIGFzc2VydHMgemVyb1xuICogQ3JpdGljYWwvU2VyaW91cyBXQ0FHIHZpb2xhdGlvbnMuIE1vZGVyYXRlL01pbm9yIGFyZSBsb2dnZWQgYnV0IG5vdFxuICogYmxvY2tpbmcgKHRoZXkncmUgc3BlY3VsYXRpdmUgd2l0aG91dCByZWFsIHVzZXIgdGVzdGluZykuXG4gKlxuICogQXV0aDogbWlycm9ycyB0aGUgc21va2Ugc3BlYyBwYXR0ZXJuLiBXZSBkbyBOT1QgcmVxdWlyZSBDbGVyayBhdXRoIOKAlFxuICogdGhlIHRlc3QgdXNlcyB0aGUgYGZjX2NvbnNvbGVfYWNrPTFgIGNvb2tpZSB0byBieXBhc3MgdGhlXG4gKiBcImZpcnN0LXRpbWUgYWNrbm93bGVkZ2VtZW50XCIgZ2F0ZSwgd2hpY2ggbGV0cyB0aGUgcGFnZSByZW5kZXJcbiAqIHVuYXV0aGVudGljYXRlZC4gRm9yIHBhZ2VzIHRoYXQgcmVkaXJlY3QgdG8gL3NpZ24taW4gd2l0aG91dFxuICogQ2xlcmssIHRoZSB0ZXN0IGlzIHNraXBwZWQgYXQgcnVudGltZS5cbiAqL1xuaW1wb3J0IHsgdGVzdCwgZXhwZWN0IH0gZnJvbSBcIkBwbGF5d3JpZ2h0L3Rlc3RcIjtcbmltcG9ydCBBeGVCdWlsZGVyIGZyb20gXCJAYXhlLWNvcmUvcGxheXdyaWdodFwiO1xuXG5jb25zdCBPTkJPQVJESU5HX1NURVBTID0gW1xuICB7IG5hbWU6IFwic3RlcC0xLXdlbGNvbWVcIiwgcGF0aDogXCIvb25ib2FyZGluZz9zdGVwPTFcIiB9LFxuICB7IG5hbWU6IFwic3RlcC0yLXByb2plY3RcIiwgcGF0aDogXCIvb25ib2FyZGluZz9zdGVwPTJcIiB9LFxuICB7IG5hbWU6IFwic3RlcC0zLWtleXNcIiwgcGF0aDogXCIvb25ib2FyZGluZz9zdGVwPTNcIiB9LFxuICB7IG5hbWU6IFwic3RlcC00LXJvb21zXCIsIHBhdGg6IFwiL29uYm9hcmRpbmc/c3RlcD00XCIgfSxcbiAgeyBuYW1lOiBcInN0ZXAtNS1kb25lXCIsIHBhdGg6IFwiL29uYm9hcmRpbmc/c3RlcD01XCIgfSxcbl07XG5cbmNvbnN0IENPUkVfUEFHRVMgPSBbXG4gIHsgbmFtZTogXCJsYW5kaW5nXCIsIHBhdGg6IFwiL1wiIH0sXG4gIHsgbmFtZTogXCJzdGF0dXNcIiwgcGF0aDogXCIvc3RhdHVzXCIgfSxcbl07XG5cbmFzeW5jIGZ1bmN0aW9uIGF0dGFjaENvbnNvbGVBY2tDb29raWUoY29udGV4dDogaW1wb3J0KFwiQHBsYXl3cmlnaHQvdGVzdFwiKS5Ccm93c2VyQ29udGV4dCkge1xuICBhd2FpdCBjb250ZXh0LmFkZENvb2tpZXMoW1xuICAgIHtcbiAgICAgIG5hbWU6IFwiZmNfY29uc29sZV9hY2tcIixcbiAgICAgIHZhbHVlOiBcIjFcIixcbiAgICAgIHVybDogXCJodHRwOi8vMTI3LjAuMC4xOjMwMDBcIixcbiAgICB9LFxuICBdKTtcbn1cblxudGVzdC5kZXNjcmliZShcImF4ZSBhMTF5IOKAlCBvbmJvYXJkaW5nXCIsICgpID0+IHtcbiAgZm9yIChjb25zdCBzdGVwIG9mIE9OQk9BUkRJTkdfU1RFUFMpIHtcbiAgICB0ZXN0KGAke3N0ZXAubmFtZX0gaGFzIG5vIENyaXRpY2FsIG9yIFNlcmlvdXMgdmlvbGF0aW9uc2AsIGFzeW5jICh7IHBhZ2UsIGNvbnRleHQgfSkgPT4ge1xuICAgICAgYXdhaXQgYXR0YWNoQ29uc29sZUFja0Nvb2tpZShjb250ZXh0KTtcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgcGFnZS5nb3RvKHN0ZXAucGF0aCwgeyB3YWl0VW50aWw6IFwiZG9tY29udGVudGxvYWRlZFwiIH0pO1xuICAgICAgaWYgKCFyZXNwb25zZSB8fCByZXNwb25zZS5zdGF0dXMoKSA+PSA0MDApIHtcbiAgICAgICAgdGVzdC5za2lwKHRydWUsIGBwYWdlIHJldHVybmVkICR7cmVzcG9uc2U/LnN0YXR1cygpID8/IFwibm8gcmVzcG9uc2VcIn0g4oCUIHBhZ2Ugbm90IHJlYWNoYWJsZSBpbiBzbW9rZSBtb2RlYCk7XG4gICAgICB9XG4gICAgICBjb25zdCByZXN1bHRzID0gYXdhaXQgbmV3IEF4ZUJ1aWxkZXIoeyBwYWdlIH0pLmFuYWx5emUoKTtcbiAgICAgIC8vIExvZyBldmVyeSB2aW9sYXRpb24gKE1vZGVyYXRlL01pbm9yIGluY2x1ZGVkKSBzbyB0aGUgcmVwb3J0XG4gICAgICAvLyBzdXJmYWNlcyB0aGUgZnVsbCBwaWN0dXJlLCBub3QganVzdCB0aGUgYmxvY2tpbmcgb25lcy5cbiAgICAgIGZvciAoY29uc3QgdiBvZiByZXN1bHRzLnZpb2xhdGlvbnMpIHtcbiAgICAgICAgY29uc3Qgbm9kZUNvdW50ID0gdi5ub2Rlcy5sZW5ndGg7XG4gICAgICAgIGNvbnN0IGZpcnN0Tm9kZSA9IHYubm9kZXNbMF0/LnRhcmdldD8uam9pbihcIiBcIikgPz8gXCIobm8gc2VsZWN0b3IpXCI7XG4gICAgICAgIGNvbnN0IGh0bWwgPSB2Lm5vZGVzWzBdPy5odG1sPy5zbGljZSgwLCAyMDApID8/IFwiKG5vIGh0bWwpXCI7XG4gICAgICAgIGNvbnNvbGUubG9nKFxuICAgICAgICAgIGBbYTExeV0gJHt2LmltcGFjdCA/PyBcInVua25vd25cIn0gJHt2LmlkfTogJHt2LmhlbHB9ICgke25vZGVDb3VudH0gbm9kZShzKTsgZmlyc3Q6ICR7Zmlyc3ROb2RlfSkgaHRtbD0ke2h0bWx9YCxcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGNyaXRpY2FsT3JTZXJpb3VzID0gcmVzdWx0cy52aW9sYXRpb25zLmZpbHRlcihcbiAgICAgICAgKHYpID0+IHYuaW1wYWN0ID09PSBcImNyaXRpY2FsXCIgfHwgdi5pbXBhY3QgPT09IFwic2VyaW91c1wiLFxuICAgICAgKTtcbiAgICAgIGV4cGVjdChjcml0aWNhbE9yU2VyaW91cykudG9IYXZlTGVuZ3RoKDApO1xuICAgIH0pO1xuICB9XG59KTtcblxudGVzdC5kZXNjcmliZShcImF4ZSBhMTF5IOKAlCBjb3JlIHBhZ2VzXCIsICgpID0+IHtcbiAgZm9yIChjb25zdCBwIG9mIENPUkVfUEFHRVMpIHtcbiAgICB0ZXN0KGAke3AubmFtZX0gaGFzIG5vIENyaXRpY2FsIG9yIFNlcmlvdXMgdmlvbGF0aW9uc2AsIGFzeW5jICh7IHBhZ2UsIGNvbnRleHQgfSkgPT4ge1xuICAgICAgYXdhaXQgYXR0YWNoQ29uc29sZUFja0Nvb2tpZShjb250ZXh0KTtcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgcGFnZS5nb3RvKHAucGF0aCwgeyB3YWl0VW50aWw6IFwiZG9tY29udGVudGxvYWRlZFwiIH0pO1xuICAgICAgaWYgKCFyZXNwb25zZSB8fCByZXNwb25zZS5zdGF0dXMoKSA+PSA0MDApIHtcbiAgICAgICAgdGVzdC5za2lwKHRydWUsIGBwYWdlIHJldHVybmVkICR7cmVzcG9uc2U/LnN0YXR1cygpID8/IFwibm8gcmVzcG9uc2VcIn0g4oCUIHBhZ2Ugbm90IHJlYWNoYWJsZSBpbiBzbW9rZSBtb2RlYCk7XG4gICAgICB9XG4gICAgICBjb25zdCByZXN1bHRzID0gYXdhaXQgbmV3IEF4ZUJ1aWxkZXIoeyBwYWdlIH0pLmFuYWx5emUoKTtcbiAgICAgIGZvciAoY29uc3QgdiBvZiByZXN1bHRzLnZpb2xhdGlvbnMpIHtcbiAgICAgICAgY29uc3Qgbm9kZUNvdW50ID0gdi5ub2Rlcy5sZW5ndGg7XG4gICAgICAgIGNvbnN0IGZpcnN0Tm9kZSA9IHYubm9kZXNbMF0/LnRhcmdldD8uam9pbihcIiBcIikgPz8gXCIobm8gc2VsZWN0b3IpXCI7XG4gICAgICAgIGNvbnNvbGUubG9nKFxuICAgICAgICAgIGBbYTExeV0gJHt2LmltcGFjdCA/PyBcInVua25vd25cIn0gJHt2LmlkfTogJHt2LmhlbHB9ICgke25vZGVDb3VudH0gbm9kZShzKTsgZmlyc3Q6ICR7Zmlyc3ROb2RlfSlgLFxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgY29uc3QgY3JpdGljYWxPclNlcmlvdXMgPSByZXN1bHRzLnZpb2xhdGlvbnMuZmlsdGVyKFxuICAgICAgICAodikgPT4gdi5pbXBhY3QgPT09IFwiY3JpdGljYWxcIiB8fCB2LmltcGFjdCA9PT0gXCJzZXJpb3VzXCIsXG4gICAgICApO1xuICAgICAgZXhwZWN0KGNyaXRpY2Fs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