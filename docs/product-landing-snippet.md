# Snippet positioning / landing (copia da SPEC)

Fonte primaria: `SPEC.md` §1–2. Prezzi e limiti numerici: **`apps/dashboard/lib/plan-catalog.ts`** (`PUBLIC_PLAN_CATALOG`) — tenerli allineati tra dashboard e qualsiasi landing pubblica.

## One-liner

> La chat real-time più economica del mercato per prodotti SaaS — WebSocket serverless, self-serve, senza DevOps.

## Tre messaggi per hero / pricing section

1. **Costo:** edge su Cloudflare (Workers + Durable Objects + D1); free tier generoso; piani paganti con limiti chiari su messaggi / agent / webhook.  
2. **Integrazione:** JWT per-tenant, SDK TypeScript (`useChat`), REST per automazioni e dashboard.  
3. **AI opzionale:** agenti menzionabili (`@handle`) come upgrade, non prerequisito per la prima integrazione.

## ICP (testo breve)

- **Primario:** team 1–10, stack moderno (Next.js / TypeScript), bisogno di chat in-app senza gestire WebSocket né vendor enterprise.  
- **Secondario (6–18 mesi):** team mid-market che sostituiscono chat legacy o aggiungono real-time a tool interni.

## CTA suggerite

- “Panoramica prodotto” (share link) → route dashboard **`/landing`** (marketing entry; stesso deploy dell’app).  
- “Inizia gratis” → onboarding dashboard o documentazione `docs/README.md`.  
- “Prezzi” → tabella da `PUBLIC_PLAN_CATALOG` + link policy overage `docs/billing-overage-policy.md`.
