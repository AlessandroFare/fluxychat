export function toMinuteBucketIso(date) {
  const d = new Date(date);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const hour = String(d.getUTCHours()).padStart(2, "0");
  const minute = String(d.getUTCMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export async function incrementOperationalMetric(
  env,
  { metricName, projectId, value = 1 }
) {
  // P-8: a single round-trip D1 upsert using SQLite's `ON CONFLICT
  // DO UPDATE SET ... = excluded.metric_value + ...` clause. This is
  // atomic per row and removes the read-then-write race that the
  // previous implementation had (two concurrent calls could both
  // see `existing == null` and both INSERT, losing one increment).
  //
  // Skip when no project id is available (unauthenticated routes).
  // The caller explicitly passes null when the request has no
  // associated project and no fallback is configured.
  if (!projectId) return;
  const now = new Date();
  const bucketMinute = toMinuteBucketIso(now);
  const id = `${metricName}|${projectId}|${bucketMinute}`;
  const updatedAt = now.toISOString();
  const numericValue = Number(value);
  await env.DB.prepare(
    `INSERT INTO operational_metrics (id, metric_name, project_id, bucket_minute, metric_value, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       metric_value = metric_value + excluded.metric_value,
       updated_at = excluded.updated_at`
  )
    .bind(id, metricName, projectId, bucketMinute, numericValue, updatedAt)
    .run();
}
