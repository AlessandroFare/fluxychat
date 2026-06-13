import { describe, it, expect } from "vitest";

function makeEnv() {
  const rows = { live_events: [], event_qa: [], event_speakers: [], event_reactions: [] };
  return {
    DB: {
      prepare(sql) {
        let boundParams = [];
        return {
          bind(...params) { boundParams = params; return this; },
          async run() {
            if (sql.includes("INSERT INTO live_events")) {
              rows.live_events.push({ id: boundParams[0], project_id: boundParams[1], room_id: boundParams[2], event_type: boundParams[3], title: boundParams[4], description: boundParams[5], status: "draft", max_participants: boundParams[6], started_at: null, ended_at: null, settings: boundParams[7], created_at: "2026-01-10T00:00:00Z" });
              return { meta: { changes: 1 } };
            }
            if (sql.includes("INSERT INTO event_qa")) {
              rows.event_qa.push({ id: boundParams[0], event_id: boundParams[1], project_id: boundParams[2], user_id: boundParams[3], question: boundParams[4], status: "pending", upvotes: 0, answer: null, answered_by: null, answered_at: null, created_at: "2026-01-10T00:00:00Z" });
              return { meta: { changes: 1 } };
            }
            if (sql.includes("INSERT INTO event_speakers")) {
              rows.event_speakers.push({ id: boundParams[0], event_id: boundParams[1], user_id: boundParams[2], role: boundParams[3], status: "invited", joined_at: null, left_at: null, created_at: "2026-01-10T00:00:00Z" });
              return { meta: { changes: 1 } };
            }
            if (sql.includes("INSERT INTO event_reactions")) {
              rows.event_reactions.push({ id: boundParams[0], event_id: boundParams[1], user_id: boundParams[2], emoji: boundParams[3], timestamp: "2026-01-10T00:00:00Z", created_at: "2026-01-10T00:00:00Z" });
              return { meta: { changes: 1 } };
            }
            if (sql.includes("UPDATE live_events SET status = 'live'")) {
              const idx = rows.live_events.findIndex(r => r.project_id === boundParams[0] && r.id === boundParams[1] && r.status === "draft");
              if (idx >= 0) { rows.live_events[idx].status = "live"; rows.live_events[idx].started_at = "2026-01-10T00:00:00Z"; }
              return { meta: { changes: idx >= 0 ? 1 : 0 } };
            }
            if (sql.includes("UPDATE live_events SET status = 'ended'")) {
              const idx = rows.live_events.findIndex(r => r.project_id === boundParams[0] && r.id === boundParams[1] && r.status === "live");
              if (idx >= 0) { rows.live_events[idx].status = "ended"; rows.live_events[idx].ended_at = "2026-01-10T01:00:00Z"; }
              return { meta: { changes: idx >= 0 ? 1 : 0 } };
            }
            if (sql.includes("UPDATE event_qa SET upvotes")) {
              const idx = rows.event_qa.findIndex(r => r.project_id === boundParams[0] && r.id === boundParams[1]);
              if (idx >= 0) rows.event_qa[idx].upvotes++;
              return { meta: { changes: idx >= 0 ? 1 : 0 } };
            }
            if (sql.includes("UPDATE event_qa SET status = 'approved'")) {
              const idx = rows.event_qa.findIndex(r => r.project_id === boundParams[0] && r.id === boundParams[1] && r.status === "pending");
              if (idx >= 0) rows.event_qa[idx].status = "approved";
              return { meta: { changes: idx >= 0 ? 1 : 0 } };
            }
            if (sql.includes("UPDATE event_qa SET status = 'answered'")) {
              const idx = rows.event_qa.findIndex(r => r.project_id === boundParams[2] && r.id === boundParams[3]);
              if (idx >= 0) { rows.event_qa[idx].status = "answered"; rows.event_qa[idx].answer = boundParams[0]; rows.event_qa[idx].answered_by = boundParams[1]; }
              return { meta: { changes: idx >= 0 ? 1 : 0 } };
            }
            if (sql.includes("UPDATE event_qa SET status = 'dismissed'")) {
              const idx = rows.event_qa.findIndex(r => r.project_id === boundParams[0] && r.id === boundParams[1]);
              if (idx >= 0) rows.event_qa[idx].status = "dismissed";
              return { meta: { changes: idx >= 0 ? 1 : 0 } };
            }
            if (sql.includes("UPDATE event_speakers SET status = 'accepted'")) {
              const idx = rows.event_speakers.findIndex(r => r.id === boundParams[0] && r.status === "invited");
              if (idx >= 0) rows.event_speakers[idx].status = "accepted";
              return { meta: { changes: idx >= 0 ? 1 : 0 } };
            }
            if (sql.includes("UPDATE event_speakers SET status = 'joined'")) {
              const idx = rows.event_speakers.findIndex(r => r.id === boundParams[0] && ["invited", "accepted"].includes(r.status));
              if (idx >= 0) { rows.event_speakers[idx].status = "joined"; rows.event_speakers[idx].joined_at = "2026-01-10T00:00:00Z"; }
              return { meta: { changes: idx >= 0 ? 1 : 0 } };
            }
            if (sql.includes("UPDATE event_speakers SET status = 'left'")) {
              const idx = rows.event_speakers.findIndex(r => r.id === boundParams[0] && r.status === "joined");
              if (idx >= 0) { rows.event_speakers[idx].status = "left"; rows.event_speakers[idx].left_at = "2026-01-10T00:30:00Z"; }
              return { meta: { changes: idx >= 0 ? 1 : 0 } };
            }
            if (sql.includes("DELETE FROM event_reactions")) {
              const before = rows.event_reactions.length;
              rows.event_reactions = rows.event_reactions.filter(r => r.event_id !== boundParams[0]);
              return { meta: { changes: before - rows.event_reactions.length } };
            }
            return { meta: { changes: 1 } };
          },
          async first() {
            if (sql.includes("FROM live_events")) {
              return rows.live_events.find(r => r.project_id === boundParams[0] && r.id === boundParams[1]) || null;
            }
            if (sql.includes("COUNT(*) as total FROM event_reactions")) {
              return { total: rows.event_reactions.filter(r => r.event_id === boundParams[0]).length };
            }
            return null;
          },
          async all() {
            if (sql.includes("FROM live_events")) {
              let results = rows.live_events.filter(r => r.project_id === boundParams[0]);
              if (sql.includes("status = ?")) results = results.filter(r => r.status === boundParams[1]);
              return { results };
            }
            if (sql.includes("FROM event_qa")) {
              if (sql.includes("GROUP BY status")) {
                const map = {};
                for (const r of rows.event_qa.filter(r => r.project_id === boundParams[0] && r.event_id === boundParams[1])) {
                  map[r.status] = (map[r.status] || 0) + 1;
                }
                return { results: Object.entries(map).map(([status, count]) => ({ status, count })) };
              }
              let results = rows.event_qa.filter(r => r.project_id === boundParams[0] && r.event_id === boundParams[1]);
              if (sql.includes("status = ?")) results = results.filter(r => r.status === boundParams[2]);
              return { results: results.sort((a, b) => b.upvotes - a.upvotes) };
            }
            if (sql.includes("FROM event_speakers")) {
              let results = rows.event_speakers.filter(r => r.event_id === boundParams[0]);
              if (sql.includes("status = ?")) results = results.filter(r => r.status === boundParams[1]);
              if (sql.includes("status = 'joined'")) results = results.filter(r => r.status === "joined");
              return { results };
            }
            if (sql.includes("GROUP BY status") && sql.includes("event_speakers")) {
              const map = {};
              for (const r of rows.event_speakers.filter(r => r.event_id === boundParams[0])) {
                map[r.status] = (map[r.status] || 0) + 1;
              }
              return { results: Object.entries(map).map(([status, count]) => ({ status, count })) };
            }
            if (sql.includes("GROUP BY emoji")) {
              const map = {};
              for (const r of rows.event_reactions.filter(r => r.event_id === boundParams[0])) {
                map[r.emoji] = (map[r.emoji] || 0) + 1;
              }
              return { results: Object.entries(map).map(([emoji, count]) => ({ emoji, count })) };
            }
            return { results: [] };
          },
        };
      },
    },
  };
}

import {
  createEvent, getEvent, listEvents, startEvent, endEvent,
  submitQuestion, upvoteQuestion, approveQuestion, answerQuestion, dismissQuestion,
  listQuestions, getQaStats,
  inviteSpeaker, acceptSpeakerInvite, joinAsSpeaker, leaveSpeaker,
  listSpeakers, getSpeakerQueue,
  addReaction, getReactionSummary, getEventStats,
} from "./live-events.js";

describe("P19-B: Live Event Interactions", () => {
  const projectId = "proj_event_1";

  it("creates and starts event", async () => {
    const env = makeEnv();
    const event = await createEvent(env, { projectId, roomId: "r1", eventType: "webinar", title: "AI Chat Workshop" });
    expect(event.id).toBeDefined();
    expect(event.status).toBe("draft");
    const live = await startEvent(env, { projectId, eventId: event.id });
    expect(live.status).toBe("live");
  });

  it("ends live event", async () => {
    const env = makeEnv();
    const event = await createEvent(env, { projectId, roomId: "r1", eventType: "ama", title: "AMA" });
    await startEvent(env, { projectId, eventId: event.id });
    const ended = await endEvent(env, { projectId, eventId: event.id });
    expect(ended.status).toBe("ended");
  });

  it("submits and upvotes question", async () => {
    const env = makeEnv();
    const event = await createEvent(env, { projectId, roomId: "r1", eventType: "ama", title: "Q&A" });
    const q = await submitQuestion(env, { projectId, eventId: event.id, userId: "u1", question: "How does it work?" });
    expect(q.status).toBe("pending");
    await upvoteQuestion(env, { projectId, questionId: q.id });
    await upvoteQuestion(env, { projectId, questionId: q.id });
    const questions = await listQuestions(env, { projectId, eventId: event.id });
    expect(questions[0].upvotes).toBe(2);
  });

  it("approves and answers question", async () => {
    const env = makeEnv();
    const event = await createEvent(env, { projectId, roomId: "r1", eventType: "ama", title: "Q&A" });
    const q = await submitQuestion(env, { projectId, eventId: event.id, userId: "u1", question: "What?" });
    await approveQuestion(env, { projectId, questionId: q.id });
    await answerQuestion(env, { projectId, questionId: q.id, answer: "Like this.", answeredBy: "host1" });
    const questions = await listQuestions(env, { projectId, eventId: event.id, status: "answered" });
    expect(questions[0].answer).toBe("Like this.");
  });

  it("invites and joins speaker", async () => {
    const env = makeEnv();
    const event = await createEvent(env, { projectId, roomId: "r1", eventType: "workshop", title: "WS" });
    const sp = await inviteSpeaker(env, { projectId, eventId: event.id, userId: "speaker1", role: "speaker" });
    expect(sp.status).toBe("invited");
    await acceptSpeakerInvite(env, { projectId, speakerId: sp.id });
    await joinAsSpeaker(env, { projectId, speakerId: sp.id });
    const queue = await getSpeakerQueue(env, { projectId, eventId: event.id });
    expect(queue.length).toBe(1);
    expect(queue[0].userId).toBe("speaker1");
  });

  it("adds reactions", async () => {
    const env = makeEnv();
    const event = await createEvent(env, { projectId, roomId: "r1", eventType: "webinar", title: "Live" });
    await addReaction(env, { projectId, eventId: event.id, userId: "u1", emoji: "🔥" });
    await addReaction(env, { projectId, eventId: event.id, userId: "u2", emoji: "🔥" });
    await addReaction(env, { projectId, eventId: event.id, userId: "u3", emoji: "👏" });
    const summary = await getReactionSummary(env, { projectId, eventId: event.id });
    expect(summary.length).toBe(2);
    expect(summary[0].emoji).toBe("🔥");
    expect(summary[0].count).toBe(2);
  });

  it("returns event stats", async () => {
    const env = makeEnv();
    const event = await createEvent(env, { projectId, roomId: "r1", eventType: "webinar", title: "Stats" });
    await submitQuestion(env, { projectId, eventId: event.id, userId: "u1", question: "Q1" });
    await inviteSpeaker(env, { projectId, eventId: event.id, userId: "s1" });
    await addReaction(env, { projectId, eventId: event.id, userId: "u1", emoji: "👍" });
    const stats = await getEventStats(env, { projectId, eventId: event.id });
    expect(stats.qa.total).toBe(1);
    expect(stats.totalReactions).toBe(1);
  });

  it("returns null for unknown event", async () => {
    const env = makeEnv();
    const event = await getEvent(env, { projectId, eventId: "unknown" });
    expect(event).toBeNull();
  });
});
