"use client";

import { useState } from "react";
import { Check, Cloud, Server, Copy, ChevronRight } from "lucide-react";
import { OnboardingAuthStep } from "../components/onboarding-auth-step";
import { Button, Input } from "../components/ui";
import { isClerkClientConfigured } from "@/lib/hosted-product";
import { cn } from "@/lib/utils";
import type { OnboardingWizard } from "./use-onboarding-wizard";
import { OnboardingCliImportCard } from "./onboarding-cli-import-card";

interface CreateProjectStepProps {
  wizard: OnboardingWizard;
}

export function CreateProjectStep({ wizard: w }: CreateProjectStepProps) {
  const [copied, setCopied] = useState(false);

  function handleCopyToken() {
    if (w.memberJwt) {
      void navigator.clipboard.writeText(w.memberJwt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="mx-auto space-y-6">
      <OnboardingCliImportCard wizard={w} defaultOpen={w.cliImportOpen} />

      {/* Auth section — shown only if not yet authenticated */}
      {!w.adminJwt.trim() && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Connect your account</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Authenticate with Clerk (hosted cloud) or paste your admin JWT if you are self-hosting.
            </p>
          </div>
          <OnboardingAuthStep
            adminJwt={w.adminJwt}
            onAdminJwtChange={w.setAdminJwt}
            onContinue={() => {}}
          />
          {w.error && <p className="text-xs text-red-500">{w.error}</p>}
        </div>
      )}

      {/* Project creation */}
      {w.adminJwt.trim() && (
        <div className="space-y-5" data-tour="create-project">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Project name</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              One name. Then you can try an agent that asks before it spends money.
            </p>
          </div>

          {w.project?.id ? (
            <div className="space-y-4">
              {/* Success card */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-5">
                <div className="flex items-center gap-2.5 text-emerald-700">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white">
                    <Check className="h-4 w-4" strokeWidth={2.5} />
                  </div>
                  <span className="font-semibold">{w.project.name}</span>
                </div>
              </div>

              <details className="rounded-lg border border-border bg-muted/20 p-3 text-left">
                <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                  Developer details
                </summary>
                <p className="mt-2 font-mono text-[11px] text-muted-foreground">Project id: {w.project.id}</p>
                {w.memberJwt ? (
                  <div className="mt-2 flex items-center gap-2">
                    <pre className="max-h-16 flex-1 overflow-auto rounded border bg-[#0d1117] p-2 font-mono text-[10px] text-[#e6edf3]">
                      {w.memberJwt.slice(0, 48)}…
                    </pre>
                    <button
                      type="button"
                      onClick={handleCopyToken}
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded border",
                        copied
                          ? "border-emerald-300 text-emerald-600"
                          : "border-border text-muted-foreground",
                      )}
                      title="Copy JWT"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                ) : null}
              </details>

              {w.notice && (
                <p className="text-xs text-emerald-600">{w.notice}</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Mode badge */}
              <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                {isClerkClientConfigured() && w.clerkSignedIn ? (
                  <>
                    <Cloud className="h-3 w-3" aria-hidden />
                    Hosted cloud: provisions via Clerk
                  </>
                ) : (
                  <>
                    <Server className="h-3 w-3" aria-hidden />
                    Self-host: creates via Worker admin API
                  </>
                )}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Input
                  data-testid="project-name-input"
                  ref={w.projectNameInputRef}
                  value={w.projectName}
                  onChange={(e) => w.setProjectName(e.target.value)}
                  placeholder="My first project"
                  className="sm:flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && w.projectName.trim()) {
                      if (isClerkClientConfigured() && w.clerkSignedIn) {
                        void w.provisionHostedProject();
                      } else {
                        void w.createProject();
                      }
                    }
                  }}
                />
                <Button
                  variant="primary"
                  data-testid="create-project-btn"
                  onClick={() => {
                    if (isClerkClientConfigured() && w.clerkSignedIn) {
                      void w.provisionHostedProject();
                    } else {
                      void w.createProject();
                    }
                  }}
                  disabled={w.creatingProject || w.provisioningCloud || !w.projectName.trim()}
                >
                  {w.creatingProject || w.provisioningCloud ? "Creating..." : "Create and try it"}
                </Button>
              </div>

              <button
                type="button"
                className="self-start text-xs text-muted-foreground underline underline-offset-2 disabled:opacity-50"
                onClick={() => {
                  w.setProjectName("My first project");
                  w.projectNameInputRef.current?.focus();
                }}
                disabled={w.projectName === "My first project"}
              >
                Use default name
              </button>

              {w.error && <p className="text-xs text-red-500">{w.error}</p>}
            </div>
          )}
        </div>
      )}

      {/* Auto-provisioning status */}
      {w.mintingJwt && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          Minting your member token...
        </p>
      )}
      {w.creatingRoom && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          Setting up your chat room...
        </p>
      )}
    </div>
  );
}
