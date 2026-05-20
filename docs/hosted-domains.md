# Hosted domains: Cloudflare + Vercel + Worker API

Step-by-step reference for **`fluxychat.com`** (dashboard on Vercel) and **`api.fluxychat.com`** (Cloudflare Worker).

---

## 1. End state (what you are aiming for)

| Hostname | Serves | Where it is configured |
|----------|--------|-------------------------|
| `https://www.fluxychat.com` | Next.js dashboard (primary URL users open) | Vercel project → Domains |
| `https://fluxychat.com` | Redirect to `www` (optional but common) | Vercel → Domains → redirect |
| `https://api.fluxychat.com` | Cloudflare Worker (REST + WebSocket) | Wrangler custom domain + Workers Routes / DNS |

Canonical marketing URL: pick **either** apex **or** `www` and stick to it for `NEXT_PUBLIC_SITE_URL` and Clerk.

---

## 2. Vercel (dashboard)

1. **Project** → **Settings** → **Domains**
   - Add `fluxychat.com` and `www.fluxychat.com`.
   - Follow Vercel’s DNS instructions (CNAME targets like `cname.vercel-dns.com` or the host they show, e.g. `*.vercel-dns-*.com`).

2. **Cloudflare DNS** (zone `fluxychat.com`):
   - **`www`**: CNAME → target Vercel gives you. Proxy **DNS only** (grey cloud) is usual for Vercel so Vercel issues TLS for the hostname; **or** orange cloud with SSL mode **Full (strict)** if you proxy through Cloudflare (see §5).
   - **Apex (`@`)**: Either the same CNAME flattening Cloudflare offers for apex → Vercel, **or** Vercel’s **A** records for apex if you prefer (Vercel docs list IPs such as `76.76.21.21` — always confirm in the Vercel UI).

3. Wait until Vercel shows **Valid Configuration** for both hostnames.

4. **Environment variables** (Production + Preview if needed):

   | Variable | Purpose |
   |----------|---------|
   | `NEXT_PUBLIC_SITE_URL` | Canonical site URL, e.g. `https://www.fluxychat.com` (must match how users land after redirects). |
   | `NEXT_PUBLIC_FLUXYCHAT_CLOUD_URL` | **Preferred** public Worker URL: `https://api.fluxychat.com`. Browser and server use this for API/WebSocket. |
   | `NEXT_PUBLIC_FLUXYCHAT_WORKER_URL` | Fallback if `CLOUD_URL` unset; for prod set one of them to `https://api.fluxychat.com`. |
   | Clerk keys | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` |
   | Clerk redirect envs | `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` (e.g. `/` and `/onboarding`) |

5. **Redeploy** the dashboard after changing env vars (Vercel does not always apply old builds).

---

## 3. Cloudflare Worker (`api.fluxychat.com`)

1. **Wrangler** (or Cloudflare dashboard): attach custom domain **`api.fluxychat.com`** to the Worker `fluxychat-worker` (or your worker name).

2. **Workers Routes** (your screenshot): route `api.fluxychat.com` → that Worker. This defines *which Worker* handles the hostname.

3. **DNS**: you need a record so `api.fluxychat.com` resolves. Common patterns:
   - **Worker-only DNS** (Cloudflare “Worker” record type) pointing to the worker, **Proxied** (orange), or  
   - **AAAA/CNAME** as Cloudflare suggests when adding the custom domain in the Worker settings.

4. **`ALLOWED_ORIGINS` (or equivalent) on the Worker** must include the real dashboard origins, e.g.:
   - `https://www.fluxychat.com`
   - `https://fluxychat.com` (if you use apex without always redirecting before first request)

   Without this, the browser blocks `fetch`/WebSocket with CORS errors even if DNS is perfect.

5. Deploy the Worker after changing secrets/vars: `pnpm --filter @fluxychat/worker deploy` (from repo root).

---

## 4. Clerk

In **Clerk Dashboard** → your application:

- **Domains / authorized origins**: add `https://www.fluxychat.com` and `https://fluxychat.com` (and preview URLs if you use them).
- **Redirect URLs**: allow sign-in/sign-up and post-auth redirects for those same origins + paths (`/sign-in`, `/sign-up`, `/onboarding`, etc.).

Mismatch here causes infinite redirects, “invalid redirect”, or auth working only on `*.vercel.app`.

---

## 5. Cloudflare proxy (orange cloud) vs DNS only (grey)

- **DNS only (grey)** on `www` / apex: clients connect **directly** to Vercel for the dashboard; Vercel’s certificate covers the hostname. Simple and common.
- **Proxied (orange)** on records pointing to Vercel: traffic goes **through Cloudflare**. Then set SSL/TLS to **Full** or **Full (strict)** so Cloudflare → Vercel is HTTPS. Wrong mode (**Flexible**) can break HTTPS or cause redirect loops.

For **`api.fluxychat.com`** on Workers, proxied is normal; ensure SSL mode is compatible with Workers/custom host.

---

## 6. Quick verification checklist

1. `dig www.fluxychat.com` / browser: opens dashboard, valid HTTPS.
2. `dig api.fluxychat.com` → Cloudflare; `curl -sI https://api.fluxychat.com/health` → `200` (or your worker health response).
3. Open dashboard → browser **Network** tab: API calls go to `https://api.fluxychat.com`, no CORS errors.
4. Sign in with Clerk on the custom domain once end-to-end.

---

## 7. Common failures

| Symptom | Likely cause |
|---------|----------------|
| DNS_PROBE_FINISHED_NXDOMAIN | No/incorrect DNS record for that hostname. |
| SSL error on `www` | Certificate still provisioning; wait or fix CNAME/A at registrar/Cloudflare. |
| Dashboard loads, chat/API broken | `NEXT_PUBLIC_FLUXYCHAT_CLOUD_URL` / `WORKER_URL` still old; or Worker CORS `ALLOWED_ORIGINS` missing `https://www.fluxychat.com`. |
| Clerk loop / blank auth | Clerk allowed domains / redirect URLs missing new host. |

---

## 8. Optional: single canonical host

If Vercel is set to **307 apex → www**, use:

- `NEXT_PUBLIC_SITE_URL=https://www.fluxychat.com`
- Bookmarks and marketing links → `https://www.fluxychat.com`

This avoids duplicate SEO and cookie edge cases between apex and `www`.
