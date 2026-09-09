# Outbound — founder who is about to glue three vendors

Goal: they open a public room this week. Not a 15-minute demo calendar.

Cadence: 4 emails over ~12 days. One link per email: https://fluxychat.com (or a gallery URL once you have a stable one).

Voice: engineer writing to an engineer. Hosted is beta. Do not name competing hosted chat SDKs in public copy.

---

## Email 1 — first contact

Subject: your in-app chat is about to become three invoices

Preview: pk_ in the browser, MIT if you want the Worker

Hi [Name],

I saw [company] shipping [deal rooms / a classroom / a dispatch map / a copilot]. Most teams in that spot buy a socket vendor, a collab vendor, and a bot SDK, then spend a quarter making them look like one product.

FluxyChat is one Durable Object per room. Chat, presence, a Yjs document, and invokeAgent share that object. Public rooms take a pk_ in the client. Private rooms use a member JWT you mint. Hosted is open beta. The Worker is MIT if you want it on your Cloudflare account.

Free is 200k persisted messages and 5k agent invokes a month, no card.

If that matches what you are building, try it on fluxychat.com. If the room holds, Starter is $20.

[Your name]

P.S. If you already bought Stream or Liveblocks and you are happy, ignore this.

---

## Email 2 — mechanism

Subject: two sockets, one object

Hi [Name],

Quick map, in case email 1 was too compressed.

JSON WebSocket: messages, presence, the agent writing the timeline.
Binary socket: Yjs. Tiptap or Excalidraw stay in your app.
HTTP ingest if you have devices or GPS: the room fans out iot.reading or fleet.gps_update. Not MQTT.

I am not asking for a call. If you want the 20-line React snippet it is on the homepage.

[Your name]

---

## Email 3 — objection

Subject: hosted is still beta

Hi [Name],

Fair pushback: we do not have a public uptime SLO, there is no HIPAA BAA, and I will not pretend IoT is MQTT.

What you do get: DPA at fluxychat.com/dpa, MIT self-host of the same Worker, and the kernel (chat + Yjs + invokeAgent) as the thing we actually operate.

If procurement will not touch a beta host, self-host on your Cloudflare account and keep the SDK.

[Your name]

---

## Email 4 — close

Subject: I'll stop pinging

Hi [Name],

Last one. If in-app rooms are not on the roadmap, that is fine.

If they are, the free path is still open. I would rather you try the room than book a call you do not need.

[Your name]

---

## Italian variant (same facts)

Subject: la chat in-app sta per diventare tre fatture

Ciao [Name],

Ho visto che [company] sta mettendo su [stanze / aula / dispatch / copilot]. Di solito a quel punto si compra un vendor per i socket, uno per il documento, e un SDK per il bot.

FluxyChat è una Durable Object per stanza. Chat, presence, documento Yjs, e invokeAgent stanno lì. Stanza pubblica: pk_ nel browser. Privata: JWT che minti tu. Hosted è open beta. Il Worker è MIT.

Free: 200k messaggi e 5k invoke agente al mese, senza carta. Se la stanza regge, Starter è 20$.

Prova su fluxychat.com.

[Your name]

P.S. Se Stream o Liveblocks già vi stanno bene, ignora pure.
