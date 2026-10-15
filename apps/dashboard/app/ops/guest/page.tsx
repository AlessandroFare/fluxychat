"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import { ConsoleShell } from "../../components/console-shell";
import { ConsolePageHeader } from "../../components/console-page-header";
import { Banner, Button, Section } from "../../components/ui";
import { messageFromUnknown } from "@/lib/error-message";
import { opsRedeemGuest } from "@/lib/ops-client";

function OpsGuestInner() {
  const params = useSearchParams();
  const projectId = params.get("projectId") || params.get("p") || "";
  const token = params.get("token") || params.get("t") || "";
  const [status, setStatus] = useState<"idle" | "ok" | "err">("idle");
  const [detail, setDetail] = useState<string>("");
  const [busy, setBusy] = useState(false);

  return (
    <ConsoleShell>
      <ConsolePageHeader
        icon={ClipboardCheck}
        title="External review"
        description="This link is scoped. You can only do what the invite listed (usually upload a file or leave a comment). You cannot change the process or approve a write."
      />
      {!projectId || !token ? (
        <Banner variant="warn">Open the invite you received. The link includes a project and a one-time token.</Banner>
      ) : null}
      {status === "ok" ? <Banner variant="success">Invite accepted. {detail}</Banner> : null}
      {status === "err" ? <Banner variant="error">{detail}</Banner> : null}
      <Section title="Continue">
        <p className="mb-3 text-sm text-muted-foreground">
          Confirming the invite records your access. If it is expired or for another company, it will be refused.
        </p>
        <Button
          type="button"
          disabled={busy || !projectId || !token}
          onClick={async () => {
            setBusy(true);
            try {
              const redeemed = await opsRedeemGuest(projectId, token);
              if (!redeemed.ok) {
                setStatus("err");
                setDetail(redeemed.error || "Invite refused");
                return;
              }
              setStatus("ok");
              setDetail(redeemed.can?.length ? `Allowed: ${redeemed.can.join(", ")}.` : "");
            } catch (err) {
              setStatus("err");
              setDetail(messageFromUnknown(err, "Invite refused"));
            } finally {
              setBusy(false);
            }
          }}
        >
          Confirm invite
        </Button>
      </Section>
    </ConsoleShell>
  );
}

export default function OpsGuestPage() {
  return (
    <Suspense
      fallback={
        <ConsoleShell>
          <p className="text-sm text-muted-foreground">Opening invite…</p>
        </ConsoleShell>
      }
    >
      <OpsGuestInner />
    </Suspense>
  );
}
