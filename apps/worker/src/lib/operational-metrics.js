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
  const now = new Date();
  const bucketMinute = toMinuteBucketIso(now);
  const id = `${metricName}|${projectId}|${bucketMinute}`;
  const updatedAt = now.toISOString();
  const existing = await env.DB.prepare(
    "SELECT metric_value FROM operational_metrics WHERE id = ?"
  )
    .bind(id)
    .first();
  if (!existing) {
    await env.DB.prepare(
      "INSERT INTO operational_metrics (id, metric_name, project_id, bucket_minute, metric_value, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
      .bind(id, metricName, projectId, bucketMinute, Number(value), updatedAt)
      .run();
    return;
  }
  await env.DB.prepare(
    "UPDATE operational_metrics SET metric_value = metric_value + ?, updated_at = ? WHERE id = ?"
  )
    .bind(Number(value), updatedAt, id)
    .run();
}
