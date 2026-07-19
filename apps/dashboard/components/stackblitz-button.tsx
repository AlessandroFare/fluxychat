"use client";

import { useCallback, useState } from "react";
import { Code2, ExternalLink, Loader2, Zap } from "lucide-react";
import { STACKBLITZ_TEMPLATES } from "@/lib/stackblitz-templates";

export function StackBlitzButton({
  templateId,
  label,
}: {
  templateId: string;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  const template = STACKBLITZ_TEMPLATES.find((t) => t.id === templateId);

  const handleClick = useCallback(() => {
    if (!template) return;
    setLoading(true);

    const p = template.project;

    // Build form HTML as a string
    let inputs = "";
    const addField = (name: string, val: string) => {
      const safe = val.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      inputs += `<input type="hidden" name="${name}" value="${safe}" />`;
    };

    addField("project[title]", p.title);
    if (p.description) addField("project[description]", p.description);
    addField("project[template]", p.template);
    if (p.dependencies) addField("project[dependencies]", JSON.stringify(p.dependencies));

    Object.entries(p.files).forEach(([path, contents]) => {
      const encodedPath = path.replace(/\[/g, "%5B").replace(/\]/g, "%5D");
      addField(`project[files][${encodedPath}]`, contents);
    });

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Loading StackBlitz...</title>
<style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0f172a;color:#94a3b8;font-size:14px}</style>
</head>
<body>Loading project...<form id="f" action="https://stackblitz.com/run" method="POST">
${inputs}
</form>
<script>document.getElementById("f").submit()<\/script>
</body>
</html>`;

    // Use a Blob URL to avoid Next.js Turbopack injecting scripts into the new window
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");

    setTimeout(() => {
      URL.revokeObjectURL(url);
      setLoading(false);
    }, 1500);
  }, [template]);

  if (!template) return null;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="group inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-600 transition-all hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : template.icon === "Zap" ? (
        <Zap className="size-4 text-blue-500 transition-transform group-hover:scale-110" />
      ) : (
        <Code2 className="size-4 text-purple-500 transition-transform group-hover:scale-110" />
      )}
      {label || `Open in StackBlitz`}
      <ExternalLink className="size-3 text-slate-400 transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}
