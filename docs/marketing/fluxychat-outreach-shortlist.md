# FluxyChat — chi scrivere, e i messaggi

2026-09-18 · Base: `docs/marketing/fluxychat-ricerca-mercato.md` + check sui siti, non sui % di traffico.

## Una cosa

Il tool ha ragione sul **pattern** (non vendere a chi *è* già chat) e torto sulla **shortlist**. I ▲800–999% con 1–2K visite sono rumore SimilarWeb su siti nuovi o morti. PlugHub (`cmsplughub.com`) non è un cliente: è un dominio usato come C2 in plugin WordPress malevoli. Non scrivergli.

Clienti = SaaS il cui prodotto è task / workshop / DAM / portale, e a cui manca una **room** tenant-scoped (umani + agente sulla stessa timeline). Non = “collaboration platform” che ha già discussion/chat.

Decision maker nel file: rumore LinkedIn A–B. Match reale solo **Ben Bourdin / Superthread**. Superthread ha già commenti, presence, docs live e @agent: non è un buyer. Non è in questa wave.

Email: **nessun indirizzo personale verificato**. Usare form/contact pubblici o LinkedIn. Non usare `audra@pti.com`. Firma: il tuo nome + `founder@…`. Hosted detto beta. Zero clienti inventati. Non nominare Portal.

---

## Drop dalla shortlist da 10

| Nome | Perché no |
|---|---|
| PlugHub | Dominio associato a backdoor WP. Stop. |
| Nontion, dv2, NavHub | Landing generiche / bookmark dashboard. “Crescita 999%” ≠ budget. |
| Causeway | Prodotto collab per associazioni (VTM/Omnia), mailing list + discussion già dentro, blog ~2015. |
| Sosius | UCC legacy + white-label. Competitor, non embed. |
| Teczo | Homepage ferma al 2010. |
| Sosius / Superthread | Hanno già la messaging layer. Superthread: peer, non deal. |
| Resotic | Software accounting CERFRANCE / CRM rivenduto. Non un PM tool che embedda rooms. |

Support-software segment: affollato (tawk, LiveAgent). Lasciare.

Agenti: **nella lista da 95 quasi non ci sono**. Captain / Kylon / Vokal / OneTab *sono* la chat+agenti. Non comprano un layer. Serve una ricerca a parte su “SaaS with a copilot sidebar, no shared room” (Effie è già in quella forma).

---

## Wave 1 — 6 da scrivere (in ordine)

1. **Effie** (tryeffie.com, KABI) — PSA: task, time, invoice, **client portal**, Ask Effie AI in pannello. Nessuna room di progetto visibile. Fit più pulito.
2. **Fasplat** (fasplat.fi) — workshop live. Presence + thread nella sessione è additivo, non un fork del loro SWOT.
3. **Freelo** (freelo.io) — PM ceco vero (centinaia di migliaia visite, `info@freelo.io`). Hanno discussion-on-task; l’angolo è **stanza live col cliente**, non “rimpiazza i commenti”.
4. **factro** (factro.de) — PM tedesco, GDPR. Angolo MIT / self-host sul loro account, non “chat widget”.
5. **Workzone** (workzone.com) — PM marketing 20+ anni. Oggi: task comment + Slack. Angolo: room sul job di proofing così il cliente non esce dal prodotto.
6. **FACE2FACES / Face Collectivité** — già *messagerie* sovrana per PA. Solo se l’angolo è “kernel MIT che operate voi”, ciclo lungo. Non è un embed da tre giorni.

Fuori wave, se avanza tempo: **MarcomCentral** (DAM + customization — ICP giusto, contatto tool sbagliato), **Flowgres** (construction PM).

---

## Come spedirle

Una mail, una CTA: risposta sì/no. Poi LinkedIn se non aprono. Follow-up a 5–7 giorni, 4 righe. Dominio `founder@` già warm, non blastare 50 in un giorno.

---

# Messaggi (EN, da incollare)

Segnaposto: `[Nome]`.

---

## 1. Effie

**Trova:** LinkedIn “Effie” + KABI, o Contact Sales su tryeffie.com. Non Effie.pro (app di writing diversa). Non effiekli.com.

**LinkedIn (chi: Head of Product / CTO / founder KABI)**

Hi — saw Effie puts projects, time, clients, and Ask Effie AI in one workspace. What’s missing from the outside is a room on the engagement itself: the team, the client, and the assistant on one timeline instead of the model answering in a side panel nobody else sees.

I work on FluxyChat. MIT room layer on a Cloudflare Durable Object: chat, presence, and `invokeAgent` in the same object. Hosted is beta; you can also run it on your own account.

If a project/client room is on the roadmap, happy to sketch it against your portal. If you’ve already built that, ignore this.

**Email**

Subject: project room for Effie (not another sidebar)
Alt: Ask Effie on the same timeline as the team
Preview: client + team + assistant in one room on the engagement

Hi,

Effie’s loop is clear: project → hours → invoice. Ask Effie already sits on that data. From the marketing site it still looks like the assistant lives in a panel, not in a room the client can see.

We make that room. One Durable Object per engagement: messages, who’s there, and agent invokes on the same timeline. Browser SDK. MIT self-host on Cloudflare, or our hosted beta.

I’m not pitching a helpdesk. If you want the human handoff and the model in the same thread as the work, reply and I’ll send a 10-line sketch against the client portal. If chat isn’t something you’ll ship, no need to answer.

[Nome]
FluxyChat

**Follow-up (day 6)**

Hi — short bump. Only useful if you want a room on the client engagement, not a support widget. If that’s a no, I’ll drop it.

---

## 2. Fasplat

**Trova:** form / email sul sito fasplat.fi (team piccolo, FI).

**LinkedIn**

Hi — Fasplat is built for live workshops, not another Kanban. The gap I keep seeing on facilitation tools is the session itself: sticky notes and SWOT are there, the side conversation still leaks to Zoom chat or WhatsApp.

FluxyChat is a room you can drop into a session: presence, thread, optional agent on the same Durable Object. MIT or hosted beta.

If a live room inside the workshop is interesting, I can describe the join path (publishable key vs member JWT). If you already solved that in-module, all good.

**Email**

Subject: live room inside the Fasplat session
Alt: keep workshop talk off WhatsApp
Preview: presence + thread in the same session as the SWOT

Hi,

Fasplat is for people running the room, not tracking tickets. Remote workshops still lose the talk to Zoom chat or a private WhatsApp.

We have a room kernel you can embed in a session: who’s in the workshop, the thread, nested replies. Same Cloudflare Durable Object if you later want an agent on that timeline. MIT self-host or hosted beta.

Not a community product and not a support bubble. If you want that thread inside Fasplat instead of next to it, reply. I’ll keep it to how a participant joins without a FluxyChat account.

[Nome]
FluxyChat

**Follow-up**

Hi — bumping once. Useful only if the workshop needs an in-product thread. Otherwise I’ll leave you alone.

---

## 3. Freelo

**A:** info@freelo.io (pubblico). Meglio: founder/CTO su LinkedIn in parallelo.

**LinkedIn**

Hi — Freelo already does the right thing on tasks (discussion, mentions, share with clients). The piece I don’t see is a live room when the client is in the project: everyone still falls back to email or Messenger the moment it’s not a comment on a to-do.

FluxyChat is the room layer (SDK, MIT on Cloudflare, hosted beta). Humans and an agent can share that timeline. I’m not asking you to rip out task comments.

If a client room is a 2026 item, I can send a tiny embed sketch. If comments-on-tasks is the whole collab story, ignore me.

**Email**

Subject: client room next to Freelo task comments
Alt: live thread when the client is in the project
Preview: don’t replace discussions — add a room for the people

Hi,

You already have discussions on tasks, @mentions, and sharing with external people. That should stay. The hole is when the client is actually in the project and the talk isn’t about one to-do.

FluxyChat is a room you can hang off a project: WebSocket SDK, presence, optional `invokeAgent` on the same Durable Object. MIT self-host on Cloudflare, or hosted beta. We don’t sell a helpdesk.

If a project room is useful, reply and I’ll send how a Freelo client would join without creating a second login. If you’re happy with comments-only, that’s a clean no.

[Nome]
FluxyChat

**Follow-up**

Hi — one bump on a project-level room for clients, not replacing task discussions. Happy to drop it if that’s off-roadmap.

---

## 4. factro

**Trova:** factro.de / contact. Ruolo: CTO o Head of Product (DE).

**LinkedIn**

Hi — factro is PM with a GDPR story, not a chat company. Teams in that market often still bolt on Slack or a US widget and then fail procurement.

FluxyChat is MIT: one Durable Object per room, D1 history, you can run it on your own Cloudflare account. Hosted is beta. Chat, presence, agent invoke in that object.

If “messaging we operate” is a requirement you keep hearing, I can walk through self-host vs hosted. If you already have an in-house layer, no pitch.

**Email**

Subject: MIT room layer you can run yourselves
Alt: factro + a room that isn’t a US helpdesk
Preview: Durable Object per project, D1 history, your Cloudflare account

Hi,

factro’s buyers care where the data sits. A lot of PM tools solve “talk to the team” by pointing at Slack or embedding a US chat SKU, then stall in procurement.

We sell the room, not a desk. MIT license, one Cloudflare Durable Object per room, history in D1. Same SDK if you self-host or use our hosted beta.

If you want that as a factro feature instead of a third-party widget, reply. I’ll send the self-host path first, not a pricing page.

[Nome]
FluxyChat

**Follow-up**

Hi — bumping the self-host room angle only. If Slack is the collab answer for factro, I’ll stop.

---

## 5. Workzone

**Trova:** workzone.com contact / Philadelphia. Head of Product, not sales@ blast.

**LinkedIn**

Hi — Workzone already ties comments to tasks and sends people to Slack. The painful case is still proofing: the client, the designer, and the PM, and half the thread lives in email because the client isn’t in Slack.

FluxyChat is an embeddable room (SDK). Same object can take an agent later. MIT or hosted beta.

If an in-product room on a job/request is interesting, I can sketch it against request forms + proofing. If Slack is the decision, all good.

**Email**

Subject: room on the Workzone job, not another Slack
Alt: client + creative on the same thread as the proof
Preview: keep the approval talk inside the project

Hi,

Workzone is built for marketing ops: requests, proofs, approvals. Slack is fine for the internal team. Clients usually aren’t there, so the real thread leaves the job.

We make a room you can attach to a request or campaign: presence, messages, nested replies. Browser SDK. MIT self-host on Cloudflare, or hosted beta. Not Intercom.

If you want that talk on the Workzone record, reply. I’ll keep the note to how an external reviewer joins. If the product decision is “Slack + comments”, no need to reply.

[Nome]
FluxyChat

**Follow-up**

Hi — one bump. Only if you want the client on a room inside Workzone. Otherwise I’ll close this out.

---

## 6. FACE2FACES / Face Collectivité

**Trova:** FACE2FACES, SIREN 802613810, facecollectivite.com. Fondatore / CTO. Francese ok se preferisci; sotto è EN. Versione FR in coda.

**LinkedIn**

Hi — Face Collectivité is already the collab surface for communes, not a prospect for a support widget. The only reason I’m writing is the kernel: MIT room on infrastructure you operate (Cloudflare Durable Object + D1), humans and later an agent on the same timeline.

If you are tired of maintaining messaging yourselves, that’s the conversation. If messagerie is core IP you’ll never replace, please ignore.

**Email**

Subject: MIT room kernel, not another SaaS chat
Alt: operate the room yourselves (Face Collectivité)
Preview: Durable Object + D1, license is MIT, hosted is only beta

Hi,

You’re already selling collaborative messaging to French public bodies (UGAP / Banque des Territoires). I’m not going to pitch a hosted American inbox.

FluxyChat is the room implementation: one Durable Object per room, history in D1, MIT, same Worker shape if you run it. Hosted exists and is beta; for you the interesting path is self-host.

If replacing or backing your messagerie with a kernel you fork is a live idea, reply. If that layer is yours for good, this email is easy to delete.

[Nome]
FluxyChat

**Follow-up**

Hi — last note, self-host / MIT only. No hosted-beta push for collectivités.

**FR (stesso contenuto)**

Objet: noyau de room MIT, pas un autre SaaS de chat

Bonjour,

Face Collectivité est déjà la couche de communication pour les collectivités. Je ne vends pas un widget d’assistance.

FluxyChat, c’est l’implémentation de la room: un Durable Object Cloudflare par room, historique D1, licence MIT, même forme Worker en self-host. L’hébergé existe, encore en bêta — pour vous le chemin utile est de l’opérer.

Si forker ce noyau vous évite d’entretenir le messaging, répondez. Si la messagerie est votre IP, ignorez.

[Nome]
FluxyChat

---

## Extra se avanza: MarcomCentral

ICP ok (DAM + customization, chat non è il prodotto). **Non** `audra@pti.com` finché non trovi la persona su LinkedIn (product / engineering, PTI / MarcomCentral).

Subject: in-app room on the MarcomCentral job
Preview: DAM + customization already; the thread still lives in email

Hi,

MarcomCentral already combines DAM, customization, and sales tools. The missing piece on products like that is usually the thread on a specific job: brand, agency, and sales, still happening in email.

FluxyChat is a room you embed: SDK, one Durable Object, MIT self-host or hosted beta. Not a support desk.

If an in-product room on an asset/job is on the list, reply and I’ll sketch the join. If that’s a never, all good.

---

## Superthread — non mandare sales

Ben Bourdin è l’unico nome matchato. Loro hanno già commenti, presence, docs, @agent. Un pitch “add chat” è insultante. Se vuoi un messaggio da pari, è questo e basta:

Hi Ben — Superthread already has the collab surface. Not selling you a chat box. We put humans and `invokeAgent` on the same Cloudflare Durable Object (MIT). Only writing if you ever want that shape under comments instead of a separate bot channel. Otherwise mute.

---

## Flag

- Nessun email personale verificato tranne `info@freelo.io` e `contact@resotic.fr` (Resotic **non** è in wave).
- Non citare volumi, gzip, o clienti.
- Agenti: seconda passata su product con copilot sidebar (tipo Effie), non su “AI agent OS”.
- Dopo i primi invii, loggare in `memory/` chi ha risposto.
