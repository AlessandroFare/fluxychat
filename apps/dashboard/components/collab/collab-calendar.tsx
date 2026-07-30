"use client";

import React, { useState } from "react";
import { useNextCalendarApp, ScheduleXCalendar } from "@schedule-x/react";
import {
  createViewDay, createViewWeek, createViewMonthGrid,
  createViewMonthAgenda, createViewWeekAgenda,
} from "@schedule-x/calendar";
import { createEventsServicePlugin } from "@schedule-x/events-service";
import "temporal-polyfill/global";
import "@schedule-x/theme-default/dist/index.css";
import { useDashboardSession } from "@/app/components/dashboard-session";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";

const WORKER_URL = getPublicWorkerUrl();

interface CollabEvent {
  id: string; title: string; description: string | null;
  start_time: string; end_time: string; all_day: number; color: string | null;
  created_by: string;
}

function toSxEvent(e: CollabEvent) {
  const isAllDay = !!e.all_day || e.start_time.length <= 10;
  return {
    id: e.id,
    title: e.title,
    start: isAllDay ? e.start_time.slice(0, 10) : e.start_time.slice(0, 16).replace("T", " "),
    end: isAllDay ? e.end_time.slice(0, 10) : e.end_time.slice(0, 16).replace("T", " "),
    backgroundColor: e.color || "#6366f1",
    description: e.description || undefined,
  };
}

export default function CollabCalendar({ roomId }: { roomId: string }) {
  const { adminJwt, memberJwt } = useDashboardSession();
  const token = adminJwt.trim() || memberJwt.trim();
  const [events, setEvents] = useState<CollabEvent[]>([]);
  const eventsService = useState(() => createEventsServicePlugin())[0];

  const calendar = useNextCalendarApp({
    views: [
      createViewDay(), createViewWeek(), createViewMonthGrid(),
      createViewMonthAgenda(), createViewWeekAgenda(),
    ],
    events: events.map(toSxEvent),
    plugins: [eventsService],
    callbacks: {
      onRender: async () => {
        if (!token) return;
        try {
          const res = await fetch(`${WORKER_URL}/collab/events?roomId=${encodeURIComponent(roomId)}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json();
          setEvents(data.events || []);
          eventsService.set(data.events?.map(toSxEvent) || []);
        } catch { /* ignore */ }
      },
    },
  });

  return (
    <div className="flex h-full flex-col bg-white dark:bg-gray-900">
      <div className="sx-react-calendar-wrapper flex-1 p-2 [&_.sx-react-calendar-wrapper]:!h-full">
        <ScheduleXCalendar calendarApp={calendar} />
      </div>
    </div>
  );
}
