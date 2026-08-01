/**
 * Vanilla IIFE served at GET /embed.js (P12-A).
 * Kept as a template string so the Worker can serve it without a bundler step.
 */
export const EMBED_LOADER_SOURCE = `(function () {
  "use strict";
  var script = document.currentScript;
  if (!script || typeof document === "undefined") return;

  var apiUrl = script.getAttribute("data-fluxy-api-url");
  if (!apiUrl) {
    try {
      apiUrl = new URL(script.src).origin;
    } catch (e) {
      return;
    }
  }
  apiUrl = apiUrl.replace(/\\/$/, "");

  var roomId = script.getAttribute("data-room-id") || "";
  var zIndex = script.getAttribute("data-z-index") || "2147483000";
  var position = script.getAttribute("data-position") || "bottom-right";
  var launcherTitle = script.getAttribute("data-launcher-title") || "Chat";
  var primaryColor = script.getAttribute("data-primary-color") || "#2563eb";

  if (document.querySelector("[data-fluxy-embed-root]")) return;

  var root = document.createElement("div");
  root.setAttribute("data-fluxy-embed-root", "1");
  var horizontal =
    position === "bottom-left" ? "left:20px;right:auto;" : "right:20px;left:auto;";
  root.style.cssText =
    "position:fixed;bottom:20px;" +
    horizontal +
    "z-index:" +
    zIndex +
    ";font-family:system-ui,-apple-system,sans-serif;line-height:1.4;";

  var open = false;
  var panel = null;
  var iframe = null;
  var closeBtn = null;

  function isMobile() {
    return window.matchMedia("(max-width: 640px)").matches;
  }

  function applyLayout() {
    if (!panel) return;
    if (isMobile() && open) {
      panel.style.cssText =
        "display:block;position:fixed;inset:0;width:100%;max-width:100%;height:100%;max-height:100%;border-radius:0;overflow:hidden;box-shadow:none;background:#fff;z-index:1;";
      if (closeBtn) closeBtn.style.display = "flex";
      btn.style.display = "none";
    } else if (open) {
      var panelHorizontal =
        position === "bottom-left" ? "left:0;right:auto;" : "right:0;left:auto;";
      panel.style.cssText =
        "display:block;position:absolute;bottom:72px;" +
        panelHorizontal +
        "width:380px;max-width:calc(100vw - 40px);height:520px;max-height:calc(100vh - 100px);border-radius:12px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,.2);background:#fff;";
      if (closeBtn) closeBtn.style.display = "none";
      btn.style.display = "flex";
    }
  }

  var btn = document.createElement("button");
  btn.type = "button";
  btn.setAttribute("aria-label", launcherTitle);
  btn.setAttribute("aria-expanded", "false");
  btn.style.cssText =
    "width:56px;height:56px;border-radius:50%;border:none;background:" +
    primaryColor +
    ";color:#fff;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.22);font-size:22px;display:flex;align-items:center;justify-content:center;";
  btn.innerHTML = "&#128172;";

  function buildPanel() {
    panel = document.createElement("div");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", launcherTitle);
    var panelHorizontal =
      position === "bottom-left" ? "left:0;right:auto;" : "right:0;left:auto;";
    panel.style.cssText =
      "display:none;position:absolute;bottom:72px;" +
      panelHorizontal +
      "width:380px;max-width:calc(100vw - 40px);height:520px;max-height:calc(100vh - 100px);border-radius:12px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,.2);background:#fff;";

    iframe = document.createElement("iframe");
    var params = new URLSearchParams();
    params.set("parentOrigin", window.location.origin);
    if (roomId) params.set("roomId", roomId);
    iframe.src = apiUrl + "/embed/frame?" + params.toString();
    iframe.title = launcherTitle;
    iframe.style.cssText = "width:100%;height:100%;border:none;display:block;";
    iframe.setAttribute(
      "sandbox",
      "allow-scripts allow-same-origin allow-forms allow-popups",
    );
    panel.appendChild(iframe);
    closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close chat");
    closeBtn.textContent = "\\u00d7";
    closeBtn.style.cssText =
      "display:none;position:absolute;top:10px;right:10px;z-index:2;width:36px;height:36px;border:none;border-radius:50%;background:rgba(15,23,42,.65);color:#fff;font-size:22px;line-height:1;cursor:pointer;align-items:center;justify-content:center;";
    closeBtn.addEventListener("click", function () { setOpen(false); });
    panel.appendChild(closeBtn);
    root.appendChild(panel);
  }

  function setOpen(next) {
    open = next;
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    if (!panel && open) buildPanel();
    if (panel) {
      panel.style.display = open ? "block" : "none";
      applyLayout();
    }
  }

  window.addEventListener("resize", function () {
    if (open) applyLayout();
  });

  btn.addEventListener("click", function () {
    setOpen(!open);
  });

  root.appendChild(btn);
  (document.body || document.documentElement).appendChild(root);
})();`;
