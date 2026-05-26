import { beforeEach, describe, expect, it, vi } from "vitest";
import worker from "./worker.js";
import { RoomDurableObject } from "./durable-objects/room-do.js";

class FakeDB {
  constructor() {
    this.messages = [];
    this.messageReactions = [];
    this.readReceipts = [];
    this.moderationEvents = [];
    this.rooms = [];
    this.roomMembers = [];
    this.webhooks = [];
    this.webhookDeliveries = [];
    this.projectSecrets = [];
    this.apiKeys = [];
    this.projects = [];
    this.auditEvents = [];
    this.projectUsageMonthly = [];
    this.projectPlans = [];
    this.agentRuns = [];
    this.bots = [];
    this.messageMentions = [];
    this.automationEvents = [];
    this.messageTemplates = [];
    this.attachments = [];
    this.stripeWebhookEvents = [];
    this.lastMessageId = 0;
    this.lastModerationEventId = 0;
    this.lastAutomationEventId = 0;
  }

  prepare(sql) {
    const db = this;
    let bound = [];
    return {
      bind(...args) {
        bound = args;
        return this;
      },
      async run() {
        return db.#run(sql, bound);
      },
      async first() {
        return db.#first(sql, bound);
      },
      async all() {
        return db.#all(sql, bound);
      },
    };
  }

  async batch(statements) {
    const results = [];
    for (const s of statements) results.push(await s.run());
    return results;
  }

  async #run(sql, args) {
    if (sql.includes("INSERT OR IGNORE INTO stripe_webhook_events")) {
      const [id, eventType, createdAt] = args;
      const exists = this.stripeWebhookEvents.some((e) => e.id === id);
      if (exists) return { meta: { changes: 0 } };
      this.stripeWebhookEvents.push({ id, event_type: eventType, created_at: createdAt });
      return { meta: { changes: 1 } };
    }

    if (sql.includes("INSERT INTO messages")) {
      const hasClientMessageId = sql.includes("client_message_id");
      const [
        projectId,
        roomId,
        userId,
        content,
        createdAt,
        parentId,
        mentions,
        ogTitle,
        ogDescription,
        ogImage,
        ogUrl,
        clientMessageId,
      ] = hasClientMessageId
        ? args
        : [...args, null];
      const id = ++this.lastMessageId;
      this.messages.push({
        id,
        project_id: projectId,
        room_id: roomId,
        user_id: userId,
        content,
        created_at: createdAt,
        parent_id: parentId,
        edited_at: null,
        deleted_at: null,
        mentions,
        og_title: ogTitle,
        og_description: ogDescription,
        og_image: ogImage,
        og_url: ogUrl,
        client_message_id: clientMessageId ?? null,
      });
      return { meta: { last_row_id: id, changes: 1 } };
    }

    if (sql.includes("INSERT INTO message_templates")) {
      const [id, projectId, name, body, createdAt, updatedAt] = args;
      this.messageTemplates.push({
        id,
        project_id: projectId,
        name,
        body,
        created_at: createdAt,
        updated_at: updatedAt,
      });
      return { meta: { changes: 1 } };
    }

    if (sql.includes("UPDATE message_templates SET")) {
      const [name, body, updatedAt, id, projectId] = args;
      const row = this.messageTemplates.find(
        (t) => t.id === id && t.project_id === projectId
      );
      if (!row) return { meta: { changes: 0 } };
      row.name = name;
      row.body = body;
      row.updated_at = updatedAt;
      return { meta: { changes: 1 } };
    }

    if (sql.includes("DELETE FROM message_templates WHERE id = ?")) {
      const [id, projectId] = args;
      const before = this.messageTemplates.length;
      this.messageTemplates = this.messageTemplates.filter(
        (t) => !(t.id === id && t.project_id === projectId)
      );
      return { meta: { changes: before - this.messageTemplates.length } };
    }

    if (
      sql.includes("UPDATE messages SET content = ?, edited_at = ?") &&
      sql.includes("AND project_id = ?")
    ) {
      const [content, editedAt, id, projectId] = args;
      const row = this.messages.find(
        (m) => String(m.id) === String(id) && m.project_id === projectId
      );
      if (!row) return { meta: { changes: 0 } };
      row.content = content;
      row.edited_at = editedAt;
      return { meta: { changes: 1 } };
    }

    if (
      sql.includes("UPDATE messages SET content = ?, edited_at = ?") &&
      sql.includes("AND room_id = ? AND user_id = ?")
    ) {
      const [content, editedAt, id, roomId, userId] = args;
      const row = this.messages.find(
        (m) =>
          String(m.id) === String(id) &&
          m.room_id === roomId &&
          m.user_id === userId
      );
      if (!row) return { meta: { changes: 0 } };
      row.content = content;
      row.edited_at = editedAt;
      return { meta: { changes: 1 } };
    }

    if (sql.includes("UPDATE messages SET deleted_at = ?, content = ?")) {
      const [deletedAt, content, id, projectId, userId] = args;
      const row = this.messages.find(
        (m) =>
          String(m.id) === String(id) &&
          m.project_id === projectId &&
          m.user_id === userId
      );
      if (!row) return { meta: { changes: 0 } };
      row.deleted_at = deletedAt;
      row.content = content;
      return { meta: { changes: 1 } };
    }

    if (sql.includes("DELETE FROM messages WHERE id = ? AND project_id = ?")) {
      const [id, projectId] = args;
      const idx = this.messages.findIndex(
        (m) => String(m.id) === String(id) && m.project_id === projectId
      );
      if (idx < 0) return { meta: { changes: 0 } };
      this.messages.splice(idx, 1);
      return { meta: { changes: 1 } };
    }

    if (sql.includes("INSERT INTO message_reactions")) {
      const [projectId, messageId, roomId, userId, emoji, createdAt] = args;
      this.messageReactions.push({
        project_id: projectId,
        message_id: Number(messageId),
        room_id: roomId,
        user_id: userId,
        emoji,
        created_at: createdAt,
      });
      return { meta: { changes: 1 } };
    }

    if (sql.includes("INSERT INTO attachments")) {
      const [
        projectId,
        roomId,
        messageId,
        kind,
        url,
        name,
        sizeBytes,
        contentType,
        createdAt,
      ] = args;
      this.attachments.push({
        project_id: projectId,
        room_id: roomId,
        message_id: Number(messageId),
        kind,
        url,
        name,
        size_bytes: sizeBytes,
        content_type: contentType,
        created_at: createdAt,
      });
      return { meta: { changes: 1 } };
    }

    if (sql.includes("INSERT INTO message_mentions")) {
      const [projectId, roomId, messageId, mentionedUserId, createdAt] = args;
      this.messageMentions.push({
        project_id: projectId,
        room_id: roomId,
        message_id: Number(messageId),
        mentioned_user_id: mentionedUserId,
        created_at: createdAt,
      });
      return { meta: { changes: 1 } };
    }

    if (sql.includes("INSERT OR IGNORE INTO read_receipts")) {
      const [projectId, roomId, userId, messageId, createdAt] = args;
      const exists = this.readReceipts.some(
        (r) =>
          r.project_id === projectId &&
          r.room_id === roomId &&
          r.user_id === userId &&
          String(r.message_id) === String(messageId)
      );
      if (!exists) {
        this.readReceipts.push({
          project_id: projectId,
          room_id: roomId,
          user_id: userId,
          message_id: Number(messageId),
          created_at: createdAt,
        });
      }
      return { meta: { changes: exists ? 0 : 1 } };
    }

    if (sql.includes("INSERT INTO moderation_events")) {
      const [projectId, roomId, userId, action, reason, createdAt, messageId] =
        args;
      const id = ++this.lastModerationEventId;
      this.moderationEvents.push({
        id,
        project_id: projectId,
        room_id: roomId,
        user_id: userId,
        action,
        reason,
        created_at: createdAt,
        target_message_id: messageId ?? null,
      });
      return { meta: { last_row_id: id, changes: 1 } };
    }

    if (sql.includes("INSERT INTO operational_audit_events")) {
      const [
        id,
        projectId,
        actorUserId,
        actorRoles,
        action,
        targetType,
        targetId,
        traceId,
        metadataJson,
        createdAt,
      ] = args;
      this.auditEvents.push({
        id,
        project_id: projectId,
        actor_user_id: actorUserId,
        actor_roles: actorRoles,
        action,
        target_type: targetType,
        target_id: targetId,
        trace_id: traceId,
        metadata_json: metadataJson,
        created_at: createdAt,
      });
      return { meta: { changes: 1 } };
    }

    if (sql.includes("INSERT OR IGNORE INTO project_usage_monthly")) {
      const [id, projectId, monthKey, metricName, updatedAt] = args;
      const exists = this.projectUsageMonthly.some((r) => r.id === id);
      if (exists) return { meta: { changes: 0 } };
      this.projectUsageMonthly.push({
        id,
        project_id: projectId,
        month_key: monthKey,
        metric_name: metricName,
        used_value: 0,
        updated_at: updatedAt,
      });
      return { meta: { changes: 1 } };
    }

    if (sql.includes("INSERT INTO project_usage_monthly")) {
      const [id, projectId, monthKey, metricName, usedValue, updatedAt] = args;
      this.projectUsageMonthly.push({
        id,
        project_id: projectId,
        month_key: monthKey,
        metric_name: metricName,
        used_value: Number(usedValue),
        updated_at: updatedAt,
      });
      return { meta: { changes: 1 } };
    }

    if (
      sql.includes("INSERT INTO project_plans") &&
      sql.includes("stripe_customer_id") &&
      sql.includes("stripe_subscription_id")
    ) {
      const [
        projectId,
        planName,
        billingStatus,
        stripeCustomerId,
        stripeSubscriptionId,
        messageLimitMonthly,
        agentInvokeLimitMonthly,
        webhookDeliveryLimitMonthly,
        pricingVersion,
        updatedAt,
        createdAt,
      ] = args;
      this.projectPlans = this.projectPlans.filter((plan) => plan.project_id !== projectId);
      this.projectPlans.push({
        project_id: projectId,
        plan_name: planName,
        billing_status: billingStatus,
        stripe_customer_id: stripeCustomerId || null,
        stripe_subscription_id: stripeSubscriptionId || null,
        message_limit_monthly: Number(messageLimitMonthly),
        agent_invoke_limit_monthly: Number(agentInvokeLimitMonthly),
        webhook_delivery_limit_monthly: Number(webhookDeliveryLimitMonthly),
        pricing_version: pricingVersion,
        updated_at: updatedAt,
        created_at: createdAt,
      });
      return { meta: { changes: 1 } };
    }

    if (sql.includes("INSERT INTO project_plans")) {
      const [
        projectId,
        planName,
        billingStatus,
        messageLimitMonthly,
        agentInvokeLimitMonthly,
        webhookDeliveryLimitMonthly,
        pricingVersion,
        updatedAt,
        createdAt,
      ] = args;
      this.projectPlans = this.projectPlans.filter((plan) => plan.project_id !== projectId);
      this.projectPlans.push({
        project_id: projectId,
        plan_name: planName,
        billing_status: billingStatus,
        message_limit_monthly: Number(messageLimitMonthly),
        agent_invoke_limit_monthly: Number(agentInvokeLimitMonthly),
        webhook_delivery_limit_monthly: Number(webhookDeliveryLimitMonthly),
        pricing_version: pricingVersion,
        updated_at: updatedAt,
        created_at: createdAt,
      });
      return { meta: { changes: 1 } };
    }

    if (
      sql.includes("UPDATE project_plans SET plan_name = ?") &&
      sql.includes("message_limit_monthly = ?")
    ) {
      const [
        planName,
        billingStatus,
        stripeCustomerId,
        stripeSubscriptionId,
        messageLimitMonthly,
        agentInvokeLimitMonthly,
        webhookDeliveryLimitMonthly,
        updatedAt,
        projectId,
      ] = args;
      const row = this.projectPlans.find((p) => p.project_id === projectId);
      if (!row) return { meta: { changes: 0 } };
      row.plan_name = planName;
      row.billing_status = billingStatus;
      if (stripeCustomerId) row.stripe_customer_id = stripeCustomerId;
      if (stripeSubscriptionId) row.stripe_subscription_id = stripeSubscriptionId;
      row.message_limit_monthly = Number(messageLimitMonthly);
      row.agent_invoke_limit_monthly = Number(agentInvokeLimitMonthly);
      row.webhook_delivery_limit_monthly = Number(webhookDeliveryLimitMonthly);
      row.updated_at = updatedAt;
      return { meta: { changes: 1 } };
    }

    if (sql.includes("UPDATE project_plans SET plan_name = ?")) {
      const [
        planName,
        billingStatus,
        stripeCustomerId,
        stripeSubscriptionId,
        updatedAt,
        projectId,
      ] = args;
      const row = this.projectPlans.find((p) => p.project_id === projectId);
      if (!row) return { meta: { changes: 0 } };
      row.plan_name = planName;
      row.billing_status = billingStatus;
      if (stripeCustomerId) row.stripe_customer_id = stripeCustomerId;
      if (stripeSubscriptionId) row.stripe_subscription_id = stripeSubscriptionId;
      row.updated_at = updatedAt;
      return { meta: { changes: 1 } };
    }

    if (
      sql.includes("manually_overridden = 0") &&
      sql.includes("webhook_delivery_limit_monthly = ?")
    ) {
      const [
        planName,
        messageLimitMonthly,
        agentInvokeLimitMonthly,
        webhookDeliveryLimitMonthly,
        updatedAt,
        projectId,
      ] = args;
      const row = this.projectPlans.find((p) => p.project_id === projectId);
      if (!row) return { meta: { changes: 0 } };
      row.plan_name = planName;
      row.message_limit_monthly = Number(messageLimitMonthly);
      row.agent_invoke_limit_monthly = Number(agentInvokeLimitMonthly);
      row.webhook_delivery_limit_monthly = Number(webhookDeliveryLimitMonthly);
      row.manually_overridden = 0;
      row.updated_at = updatedAt;
      return { meta: { changes: 1 } };
    }

    if (sql.includes("UPDATE project_plans SET billing_status = 'manual'")) {
      const [projectId] = args;
      const row = this.projectPlans.find((p) => p.project_id === projectId);
      if (!row) return { meta: { changes: 0 } };
      row.billing_status = "manual";
      return { meta: { changes: 1 } };
    }

    if (sql.includes("INSERT OR REPLACE INTO project_plans")) {
      const [
        projectId,
        planName,
        billingStatus,
        messageLimitMonthly,
        agentInvokeLimitMonthly,
        webhookDeliveryLimitMonthly,
        pricingVersion,
        manuallyOverridden,
        updatedAt,
        _existingProjectId,
        createdAt,
      ] = args;
      const existing = this.projectPlans.find((plan) => plan.project_id === projectId);
      this.projectPlans = this.projectPlans.filter((plan) => plan.project_id !== projectId);
      this.projectPlans.push({
        project_id: projectId,
        plan_name: planName,
        billing_status: billingStatus,
        stripe_customer_id: existing?.stripe_customer_id || null,
        stripe_subscription_id: existing?.stripe_subscription_id || null,
        message_limit_monthly: Number(messageLimitMonthly),
        agent_invoke_limit_monthly: Number(agentInvokeLimitMonthly),
        webhook_delivery_limit_monthly: Number(webhookDeliveryLimitMonthly),
        pricing_version: pricingVersion || existing?.pricing_version || "v1",
        manually_overridden: Number(manuallyOverridden) ? 1 : 0,
        updated_at: updatedAt,
        created_at: existing?.created_at || createdAt,
      });
      return { meta: { changes: 1 } };
    }

    if (
      sql.includes("UPDATE project_usage_monthly") &&
      sql.includes("used_value = used_value + ?")
    ) {
      const [amount, updatedAt, id, amountGuard, limit] = args;
      const row = this.projectUsageMonthly.find((r) => r.id === id);
      if (!row) return { meta: { changes: 0 } };
      if (Number(amount) !== Number(amountGuard)) return { meta: { changes: 0 } };
      const next = Number(row.used_value) + Number(amount);
      if (next > Number(limit)) return { meta: { changes: 0 } };
      row.used_value = next;
      row.updated_at = updatedAt;
      return { meta: { changes: 1 } };
    }

    if (sql.includes("UPDATE project_usage_monthly SET used_value = ?")) {
      const [usedValue, updatedAt, id] = args;
      const row = this.projectUsageMonthly.find((r) => r.id === id);
      if (!row) return { meta: { changes: 0 } };
      row.used_value = Number(usedValue);
      row.updated_at = updatedAt;
      return { meta: { changes: 1 } };
    }

    if (
      sql.includes(
        "INSERT INTO automation_events (project_id, event_type, room_id, payload, created_at)"
      )
    ) {
      const [projectId, eventType, roomId, payload, createdAt] = args;
      const id = ++this.lastAutomationEventId;
      this.automationEvents.push({
        id,
        project_id: projectId,
        event_type: eventType,
        room_id: roomId,
        payload,
        created_at: createdAt,
      });
      return { meta: { changes: 1, last_row_id: id } };
    }

    if (sql.includes("INSERT INTO webhook_deliveries")) {
      const [
        id,
        projectId,
        webhookId,
        webhookUrl,
        webhookSecret,
        eventType,
        payload,
        nextAttemptAt,
        createdAt,
        updatedAt,
      ] = args;
      this.webhookDeliveries.push({
        id,
        project_id: projectId,
        webhook_id: webhookId,
        webhook_url: webhookUrl,
        webhook_secret: webhookSecret,
        event_type: eventType,
        payload,
        status: "pending",
        attempt_count: 0,
        next_attempt_at: nextAttemptAt,
        last_http_status: null,
        last_error: null,
        delivered_at: null,
        created_at: createdAt,
        updated_at: updatedAt,
      });
      return { meta: { changes: 1 } };
    }

    if (
      sql.includes(
        "UPDATE webhook_deliveries SET status = 'delivered', attempt_count = ?"
      )
    ) {
      const [attemptCount, statusCode, deliveredAt, updatedAt, id] = args;
      const row = this.webhookDeliveries.find((d) => d.id === id);
      if (!row) return { meta: { changes: 0 } };
      row.status = "delivered";
      row.attempt_count = Number(attemptCount);
      row.last_http_status = statusCode;
      row.last_error = null;
      row.delivered_at = deliveredAt;
      row.updated_at = updatedAt;
      return { meta: { changes: 1 } };
    }

    if (
      sql.includes("UPDATE webhook_deliveries SET status = 'failed', last_error = ?") &&
      sql.includes("WHERE webhook_id = ?")
    ) {
      const [lastError, updatedAt, webhookId] = args;
      let changes = 0;
      for (const d of this.webhookDeliveries) {
        if (d.webhook_id === webhookId && d.status === "pending") {
          d.status = "failed";
          d.last_error = lastError;
          d.updated_at = updatedAt;
          changes += 1;
        }
      }
      return { meta: { changes } };
    }

    if (sql.includes("UPDATE webhook_deliveries SET status = 'failed'")) {
      const [attemptCount, statusCode, error, updatedAt, id] = args;
      const row = this.webhookDeliveries.find((d) => d.id === id);
      if (!row) return { meta: { changes: 0 } };
      row.status = "failed";
      row.attempt_count = Number(attemptCount);
      row.last_http_status = statusCode;
      row.last_error = error;
      row.updated_at = updatedAt;
      return { meta: { changes: 1 } };
    }

    if (sql.includes("UPDATE webhook_deliveries SET attempt_count = ?")) {
      const [attemptCount, retryAt, statusCode, error, updatedAt, id] = args;
      const row = this.webhookDeliveries.find((d) => d.id === id);
      if (!row) return { meta: { changes: 0 } };
      row.attempt_count = Number(attemptCount);
      row.next_attempt_at = retryAt;
      row.last_http_status = statusCode;
      row.last_error = error;
      row.updated_at = updatedAt;
      return { meta: { changes: 1 } };
    }

    if (
      sql.includes(
        "UPDATE webhook_deliveries SET status = 'pending', attempt_count = 0"
      )
    ) {
      const [nextAttemptAt, updatedAt, id] = args;
      const row = this.webhookDeliveries.find((d) => d.id === id);
      if (!row) return { meta: { changes: 0 } };
      row.status = "pending";
      row.attempt_count = 0;
      row.next_attempt_at = nextAttemptAt;
      row.last_http_status = null;
      row.last_error = null;
      row.delivered_at = null;
      row.updated_at = updatedAt;
      return { meta: { changes: 1 } };
    }

    if (sql.includes("UPDATE api_keys SET revoked_at = ?")) {
      const [revokedAt, projectId] = args;
      for (const k of this.apiKeys) {
        if (k.project_id === projectId && !k.revoked_at) k.revoked_at = revokedAt;
      }
      return { meta: { changes: 1 } };
    }

    if (sql.includes("INSERT OR REPLACE INTO bots")) {
      const [id, projectId, name, webhookUrl, handle, provider, model, capabilities, config, systemPrompt, contextFetchUrl, toolExecuteUrl, toolsSchema, rateLimitRpm, existingId, createdAt] = args;
      this.bots = this.bots.filter((b) => b.id !== id);
      this.bots.push({
        id, project_id: projectId, name, webhook_url: webhookUrl,
        handle, provider, model, capabilities, config,
        system_prompt: systemPrompt, context_fetch_url: contextFetchUrl,
        tool_execute_url: toolExecuteUrl, tools_schema: toolsSchema,
        rate_limit_rpm: rateLimitRpm,
        created_at: this.bots.find((b) => b.id === id)?.created_at || createdAt,
      });
      return { meta: { changes: 1 } };
    }

    if (sql.includes("INSERT INTO agent_runs")) {
      const [id, projectId, agentId, roomId, status, latencyMs, inputTokens, outputTokens, estimatedCost, error, toolCallsJson, contextFetched, iterations, createdAt] = args;
      this.agentRuns.push({
        id, project_id: projectId, agent_id: agentId, room_id: roomId,
        status, latency_ms: latencyMs, input_tokens: inputTokens,
        output_tokens: outputTokens, estimated_cost: estimatedCost,
        error, tool_calls_json: toolCallsJson,
        context_fetched: contextFetched, iterations, created_at: createdAt,
      });
      return { meta: { changes: 1 } };
    }

    if (sql.includes("DELETE FROM message_reactions WHERE project_id = ? AND room_id = ?")) {
      const [projectId, roomId] = args;
      const before = this.messageReactions.length;
      this.messageReactions = this.messageReactions.filter(
        (r) => !(r.project_id === projectId && r.room_id === roomId)
      );
      return { meta: { changes: before - this.messageReactions.length } };
    }

    if (sql.includes("DELETE FROM read_receipts WHERE project_id = ? AND room_id = ?")) {
      const [projectId, roomId] = args;
      const before = this.readReceipts.length;
      this.readReceipts = this.readReceipts.filter(
        (r) => !(r.project_id === projectId && r.room_id === roomId)
      );
      return { meta: { changes: before - this.readReceipts.length } };
    }

    if (sql.includes("DELETE FROM message_mentions WHERE project_id = ? AND room_id = ?")) {
      const [projectId, roomId] = args;
      const before = this.messageMentions.length;
      this.messageMentions = this.messageMentions.filter(
        (m) => !(m.project_id === projectId && m.room_id === roomId)
      );
      return { meta: { changes: before - this.messageMentions.length } };
    }

    if (sql.includes("DELETE FROM attachments WHERE project_id = ? AND room_id = ?")) {
      const [projectId, roomId] = args;
      const before = this.attachments.length;
      this.attachments = this.attachments.filter(
        (a) => !(a.project_id === projectId && a.room_id === roomId)
      );
      return { meta: { changes: before - this.attachments.length } };
    }

    if (sql.includes("DELETE FROM messages WHERE project_id = ? AND room_id = ?")) {
      const [projectId, roomId] = args;
      const before = this.messages.length;
      this.messages = this.messages.filter(
        (m) => !(m.project_id === projectId && m.room_id === roomId)
      );
      return { meta: { changes: before - this.messages.length } };
    }

    if (sql.includes("DELETE FROM moderation_events WHERE project_id = ? AND room_id = ?")) {
      const [projectId, roomId] = args;
      const before = this.moderationEvents.length;
      this.moderationEvents = this.moderationEvents.filter(
        (e) => !(e.project_id === projectId && e.room_id === roomId)
      );
      return { meta: { changes: before - this.moderationEvents.length } };
    }

    if (sql.includes("DELETE FROM automation_events WHERE project_id = ? AND room_id = ?")) {
      const [projectId, roomId] = args;
      const before = this.automationEvents.length;
      this.automationEvents = this.automationEvents.filter(
        (e) => !(e.project_id === projectId && e.room_id === roomId)
      );
      return { meta: { changes: before - this.automationEvents.length } };
    }

    if (sql.includes("DELETE FROM agent_runs WHERE project_id = ? AND room_id = ?")) {
      const [projectId, roomId] = args;
      const before = this.agentRuns.length;
      this.agentRuns = this.agentRuns.filter(
        (r) => !(r.project_id === projectId && r.room_id === roomId)
      );
      return { meta: { changes: before - this.agentRuns.length } };
    }

    if (sql.includes("DELETE FROM room_members WHERE room_id = ?")) {
      const [roomId] = args;
      const before = this.roomMembers.length;
      this.roomMembers = this.roomMembers.filter((m) => m.room_id !== roomId);
      return { meta: { changes: before - this.roomMembers.length } };
    }

    if (sql.includes("DELETE FROM rooms WHERE id = ? AND project_id = ?")) {
      const [roomId, projectId] = args;
      const before = this.rooms.length;
      this.rooms = this.rooms.filter(
        (r) => !(r.id === roomId && r.project_id === projectId)
      );
      return { meta: { changes: before - this.rooms.length } };
    }

    return { meta: { changes: 0 } };
  }

  async #first(sql, args) {
    if (sql.includes("SELECT project_id FROM project_plans WHERE stripe_subscription_id = ?")) {
      const [subscriptionId] = args;
      const row = this.projectPlans.find((p) => p.stripe_subscription_id === subscriptionId);
      return row ? { project_id: row.project_id } : null;
    }

    if (sql.includes("SELECT project_id FROM project_plans WHERE stripe_customer_id = ?")) {
      const [customerId] = args;
      const row = this.projectPlans.find((p) => p.stripe_customer_id === customerId);
      return row ? { project_id: row.project_id } : null;
    }

    if (sql.includes("SELECT project_id FROM project_plans WHERE project_id = ? LIMIT 1")) {
      const [projectId] = args;
      const row = this.projectPlans.find((p) => p.project_id === projectId);
      return row ? { project_id: row.project_id } : null;
    }

    if (sql.includes("SELECT jwt_secret FROM project_secrets WHERE project_id = ?")) {
      const [projectId] = args;
      const row = this.projectSecrets.find((r) => r.project_id === projectId);
      return row ? { jwt_secret: row.jwt_secret } : null;
    }

    if (sql.includes("SELECT id, room_id, user_id FROM messages WHERE id = ? AND project_id = ?")) {
      const [id, projectId] = args;
      const row = this.messages.find(
        (m) => String(m.id) === String(id) && m.project_id === projectId
      );
      return row
        ? { id: row.id, room_id: row.room_id, user_id: row.user_id }
        : null;
    }

    if (
      sql.includes(
        "SELECT id, user_id FROM messages WHERE id = ? AND project_id = ? AND room_id = ? AND deleted_at IS NULL"
      )
    ) {
      const [id, projectId, roomId] = args;
      const row = this.messages.find(
        (m) =>
          String(m.id) === String(id) &&
          m.project_id === projectId &&
          m.room_id === roomId &&
          !m.deleted_at
      );
      return row ? { id: row.id, user_id: row.user_id } : null;
    }

    if (sql.includes("SELECT room_id FROM messages WHERE id = ? AND project_id = ?")) {
      const [id, projectId] = args;
      const row = this.messages.find(
        (m) => String(m.id) === String(id) && m.project_id === projectId
      );
      return row ? { room_id: row.room_id } : null;
    }

    if (
      sql.includes(
        "SELECT 1 as ok FROM room_members WHERE room_id = ? AND user_id = ? LIMIT 1"
      )
    ) {
      const [roomId, userId] = args;
      const row = this.roomMembers.find(
        (m) => m.room_id === roomId && m.user_id === userId
      );
      return row ? { ok: 1 } : null;
    }

    if (sql.includes("SELECT used_value FROM project_usage_monthly WHERE id = ?")) {
      const [id] = args;
      const row = this.projectUsageMonthly.find((r) => r.id === id);
      return row ? { used_value: row.used_value } : null;
    }

    if (
      sql.includes(
        "project_plans WHERE project_id = ? LIMIT 1"
      )
    ) {
      const [projectId] = args;
      const row = this.projectPlans.find((plan) => plan.project_id === projectId);
      return row || null;
    }

    if (
      sql.includes(
        "SELECT id, type FROM rooms WHERE id = ? AND project_id = ? LIMIT 1"
      )
    ) {
      const [roomId, projectId] = args;
      const row = this.rooms.find(
        (r) => r.id === roomId && r.project_id === projectId
      );
      return row ? { id: row.id, type: row.type } : null;
    }

    if (sql.includes("SELECT id FROM rooms WHERE id = ? AND project_id = ? LIMIT 1")) {
      const [roomId, projectId] = args;
      const row = this.rooms.find(
        (r) => r.id === roomId && r.project_id === projectId
      );
      return row ? { id: row.id } : null;
    }

    if (sql.includes("SELECT COUNT(*) as c FROM room_members WHERE room_id = ?")) {
      const [roomId] = args;
      const count = this.roomMembers.filter((m) => m.room_id === roomId).length;
      return { c: count };
    }

    if (
      sql.includes("SELECT project_id FROM api_keys WHERE key_hash = ?") ||
      sql.includes("SELECT project_id FROM api_keys WHERE secret = ?")
    ) {
      return null;
    }

    if (
      sql.includes("FROM bots WHERE id = ? AND project_id = ?") &&
      sql.includes("tool_execute_url")
    ) {
      const [agentId, projectId] = args;
      const row = this.bots.find((b) => b.id === agentId && b.project_id === projectId);
      return row || null;
    }

    if (sql.includes("SELECT id FROM bots WHERE id = ? AND project_id = ?")) {
      const [agentId, projectId] = args;
      const row = this.bots.find((b) => b.id === agentId && b.project_id === projectId);
      return row ? { id: row.id } : null;
    }

    if (
      sql.includes("SELECT 1 AS ok FROM moderation_events WHERE project_id = ? AND target_message_id = ? AND action = 'auto_flag' LIMIT 1")
    ) {
      const [projectId, targetMessageId] = args;
      const exists = this.moderationEvents.some(
        (e) =>
          e.project_id === projectId &&
          String(e.target_message_id) === String(targetMessageId) &&
          e.action === "auto_flag"
      );
      return exists ? { ok: 1 } : null;
    }

    if (
      sql.includes(
        "SELECT CAST(COUNT(*) AS INTEGER) AS c FROM messages WHERE project_id = ? AND room_id = ? AND deleted_at IS NULL"
      )
    ) {
      const [projectId, roomId] = args;
      const c = this.messages.filter(
        (m) => m.project_id === projectId && m.room_id === roomId && !m.deleted_at
      ).length;
      return { c };
    }

    if (
      sql.includes("SELECT created_at FROM automation_events WHERE project_id = ? AND room_id = ?") &&
      sql.includes("room_summary_auto")
    ) {
      const [projectId, roomId] = args;
      const row = this.automationEvents
        .filter(
          (e) =>
            e.project_id === projectId &&
            e.room_id === roomId &&
            ["room_summary_auto", "room_summary"].includes(e.event_type)
        )
        .sort((a, b) => b.id - a.id)[0];
      return row ? { created_at: row.created_at } : null;
    }

    if (sql.includes("SELECT COUNT(*) AS c FROM projects")) {
      return { c: this.projects.length };
    }

    if (sql.includes("SELECT id, name, created_at FROM projects WHERE id = ?")) {
      const [id] = args;
      const row = this.projects.find((p) => p.id === id);
      return row || null;
    }

    if (sql.includes("SELECT body FROM message_templates WHERE id = ?")) {
      const [id, projectId] = args;
      const row = this.messageTemplates.find(
        (t) => t.id === id && t.project_id === projectId
      );
      return row ? { body: row.body } : null;
    }

    if (
      sql.includes("client_message_id") &&
      sql.includes("FROM messages") &&
      sql.includes("project_id = ?") &&
      sql.includes("room_id = ?") &&
      sql.includes("client_message_id = ?")
    ) {
      const [projectId, roomId, clientMessageId] = args;
      const row = this.messages.find(
        (m) =>
          m.project_id === projectId &&
          m.room_id === roomId &&
          m.client_message_id === clientMessageId &&
          !m.deleted_at
      );
      return row || null;
    }

    if (sql.includes("FROM message_templates WHERE id = ? AND project_id = ?")) {
      const [id, projectId] = args;
      const row = this.messageTemplates.find(
        (t) => t.id === id && t.project_id === projectId
      );
      return row || null;
    }

    return null;
  }

  async #all(sql, args) {
    if (sql.includes("SELECT id, name, created_at FROM projects WHERE id = ?")) {
      const [id] = args;
      const row = this.projects.find((p) => p.id === id);
      return { results: row ? [row] : [] };
    }

    if (sql.includes("SELECT id, name, created_at FROM projects ORDER BY created_at DESC")) {
      const results = this.projects
        .slice()
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
      return { results };
    }

    if (
      sql.includes("FROM message_templates") &&
      sql.includes("WHERE project_id = ?")
    ) {
      const [projectId] = args;
      const results = this.messageTemplates
        .filter((t) => t.project_id === projectId)
        .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
      return { results };
    }

    if (sql.includes("FROM automation_events") && sql.includes("WHERE project_id = ?")) {
      const [projectId, roomId, limit] = args.length === 3 ? args : [args[0], null, args[1]];
      let rows = this.automationEvents.filter((e) => e.project_id === projectId);
      if (roomId) rows = rows.filter((e) => e.room_id === roomId);
      rows = rows
        .slice()
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
        .slice(0, Number(limit));
      return { results: rows };
    }

    if (
      sql.includes("FROM webhook_deliveries") &&
      sql.includes("WHERE project_id = ?") &&
      sql.includes("ORDER BY created_at DESC")
    ) {
      const [projectId, limit] = args;
      const results = this.webhookDeliveries
        .filter((d) => d.project_id === projectId)
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
        .slice(0, Number(limit));
      return { results };
    }

    if (
      sql.includes("FROM agent_runs") &&
      sql.includes("WHERE project_id = ?") &&
      sql.includes("ORDER BY created_at DESC LIMIT ?") &&
      !sql.includes("AND agent_id = ?")
    ) {
      const [projectId, roomId, limit] = args.length === 3 ? args : [args[0], null, args[1]];
      let rows = this.agentRuns.filter((r) => r.project_id === projectId);
      if (roomId) rows = rows.filter((r) => r.room_id === roomId);
      rows = rows
        .slice()
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
        .slice(0, Number(limit));
      return { results: rows };
    }

    if (sql.includes("SELECT id, url, secret, secret_ciphertext, secret_iv, event_types FROM webhooks WHERE project_id = ?")) {
      const [projectId] = args;
      return {
        results: this.webhooks
          .filter((w) => w.project_id === projectId)
          .map((w) => ({
            id: w.id,
            url: w.url,
            secret: w.secret,
            secret_ciphertext: w.secret_ciphertext ?? null,
            secret_iv: w.secret_iv ?? null,
            event_types: w.event_types,
          })),
      };
    }

    if (sql.includes("FROM webhooks WHERE id IN")) {
      const ids = args;
      return {
        results: this.webhooks
          .filter((w) => ids.includes(w.id))
          .map((w) => ({
            id: w.id,
            secret: w.secret,
            secret_ciphertext: w.secret_ciphertext ?? null,
            secret_iv: w.secret_iv ?? null,
          })),
      };
    }

    if (
      sql.includes("webhook_deliveries WHERE status = 'pending' AND next_attempt_at <= ?")
    ) {
      const [nowIso, limit] = args;
      const nowMs = Date.parse(nowIso);
      const rows = this.webhookDeliveries
        .filter(
          (d) =>
            d.status === "pending" && Date.parse(d.next_attempt_at) <= nowMs
        )
        .slice(0, Number(limit))
        .map((d) => ({
          id: d.id,
          project_id: d.project_id,
          webhook_id: d.webhook_id,
          webhook_url: d.webhook_url,
          webhook_secret: d.webhook_secret,
          payload: d.payload,
          attempt_count: d.attempt_count,
        }));
      return { results: rows };
    }

    if (
      sql.includes(
        "SELECT id, project_id, webhook_id, event_type, status, attempt_count, next_attempt_at"
      )
    ) {
      const [limit] = args;
      return {
        results: this.webhookDeliveries
          .slice()
          .reverse()
          .slice(0, Number(limit)),
      };
    }

    if (
      sql.includes(
        "FROM moderation_events WHERE project_id = ? AND action IN ('report', 'auto_flag') ORDER BY created_at DESC LIMIT ?"
      )
    ) {
      const [projectId, limit] = args;
      return {
        results: this.moderationEvents
          .filter((e) =>
            e.project_id === projectId && ["report", "auto_flag"].includes(e.action)
          )
          .slice()
          .reverse()
          .slice(0, Number(limit)),
      };
    }

    if (
      sql.includes(
        "SELECT metric_name, used_value FROM project_usage_monthly WHERE project_id = ? AND month_key = ?"
      )
    ) {
      const [projectId, monthKey] = args;
      return {
        results: this.projectUsageMonthly.filter(
          (row) => row.project_id === projectId && row.month_key === monthKey
        ),
      };
    }

    if (sql.includes("FROM operational_audit_events WHERE project_id = ?")) {
      const [projectId, maybeAction, maybeLimit] = args;
      let action = null;
      let limit = 100;
      if (typeof maybeLimit === "undefined") {
        // args: [projectId, limit]
        limit = Number(maybeAction);
      } else {
        // args: [projectId, action, limit]
        action = maybeAction;
        limit = Number(maybeLimit);
      }
      const rows = this.auditEvents
        .filter((e) => e.project_id === projectId)
        .filter((e) => (action ? e.action === action : true))
        .slice()
        .reverse()
        .slice(0, limit);
      return { results: rows };
    }

    if (sql.includes("FROM bots WHERE project_id = ?")) {
      const [projectId] = args;
      return { results: this.bots.filter((b) => b.project_id === projectId) };
    }

    if (sql.includes("FROM agent_runs WHERE project_id = ? AND agent_id = ?")) {
      const [projectId, agentId, limit] = args;
      return {
        results: this.agentRuns
          .filter((r) => r.project_id === projectId && r.agent_id === agentId)
          .slice()
          .reverse()
          .slice(0, Number(limit)),
      };
    }

    if (sql.includes("FROM project_plans") && sql.includes("ORDER BY project_id")) {
      const [limit] = args;
      const cap = Number(limit) || 10_000;
      return { results: this.projectPlans.slice(0, cap) };
    }

    if (
      sql.includes(
        "SELECT user_id, content, created_at FROM messages WHERE project_id = ? AND room_id = ?"
      ) &&
      sql.includes("ORDER BY created_at DESC LIMIT 50")
    ) {
      const [projectId, roomId] = args;
      const results = this.messages
        .filter((m) => m.project_id === projectId && m.room_id === roomId && !m.deleted_at)
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
        .slice(0, 50)
        .map((m) => ({
          user_id: m.user_id,
          content: m.content,
          created_at: m.created_at,
        }));
      return { results };
    }

    return { results: [] };
  }
}

function createEnv(db) {
  return {
    DB: db,
    DEFAULT_PROJECT_ID: "default",
    REQUIRE_ADMIN_AUTH: "true",
    WEBHOOK_MAX_ATTEMPTS: "5",
    RATE_LIMIT_FALLBACK_ALLOW: "true",
    QUOTAS_ENABLED: "true",
    QUOTA_MESSAGES_PER_MONTH: "50000",
    ROOM: {
      idFromName(name) {
        return `room:${name}`;
      },
      get() {
        return {
          async fetch() {
            return new Response(JSON.stringify({ ok: true }), {
              headers: { "Content-Type": "application/json" },
            });
          },
        };
      },
    },
    ATTACHMENTS: {
      async put(key, data, options) {
        return { key, size: data?.byteLength || 0 };
      },
      async get(key) {
        return null;
      },
    },
  };
}

async function makeJwt(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const headerB64 = base64urlEncode(JSON.stringify(header));
  const payloadB64 = base64urlEncode(JSON.stringify(payload));
  const data = `${headerB64}.${payloadB64}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  const sigB64 = base64urlEncode(new Uint8Array(sig));
  return `${data}.${sigB64}`;
}

function base64urlEncode(input) {
  const bytes =
    typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function callWorker({ env, url, method = "GET", body, token, headers }) {
  const waitUntilPromises = [];
  const request = new Request(url, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let response;
  try {
    response = await worker.fetch(request, env, {
      waitUntil(promise) {
        waitUntilPromises.push(promise);
      },
    });
  } catch (err) {
    if (err instanceof Response) {
      response = err;
    } else {
      throw err;
    }
  }
  await Promise.all(waitUntilPromises);
  return response;
}

describe("worker integration flows", () => {
  let db;
  let env;
  const projectId = "proj_1";
  const userId = "user_1";
  const roomId = "room_1";
  const jwtSecret = "test-secret";

  beforeEach(() => {
    db = new FakeDB();
    db.projectSecrets.push({ project_id: projectId, jwt_secret: jwtSecret });
    env = createEnv(db);
  });

  it("covers core flow: send/edit/delete/reaction/read/report", async () => {
    const token = await makeJwt(
      { sub: userId, tid: projectId, roles: ["member"], exp: Math.floor(Date.now() / 1000) + 3600 },
      jwtSecret
    );

    const createRes = await callWorker({
      env,
      url: "https://fluxy.local/messages",
      method: "POST",
      body: { roomId, content: "hello world" },
      token,
    });
    expect(createRes.status).toBe(200);
    const created = await createRes.json();
    const messageId = created.message.id;
    expect(db.messages).toHaveLength(1);

    const editRes = await callWorker({
      env,
      url: `https://fluxy.local/messages/${messageId}`,
      method: "PATCH",
      body: { content: "hello edited" },
      token,
    });
    expect(editRes.status).toBe(200);
    expect(db.messages[0].content).toBe("hello edited");
    expect(db.messages[0].edited_at).toBeTruthy();

    const reactionRes = await callWorker({
      env,
      url: `https://fluxy.local/messages/${messageId}/reactions`,
      method: "POST",
      body: { emoji: "👍" },
      token,
    });
    expect(reactionRes.status).toBe(200);
    expect(db.messageReactions).toHaveLength(1);

    const readRes = await callWorker({
      env,
      url: `https://fluxy.local/rooms/${roomId}/read`,
      method: "POST",
      body: { messageId },
      token,
    });
    expect(readRes.status).toBe(200);
    expect(db.readReceipts).toHaveLength(1);

    const reportRes = await callWorker({
      env,
      url: "https://fluxy.local/reports",
      method: "POST",
      body: { messageId, roomId, reason: "spam" },
      token,
    });
    expect(reportRes.status).toBe(200);
    expect(db.moderationEvents).toHaveLength(1);

    const deleteRes = await callWorker({
      env,
      url: `https://fluxy.local/messages/${messageId}`,
      method: "DELETE",
      token,
    });
    expect(deleteRes.status).toBe(200);
    expect(db.messages[0].deleted_at).toBeTruthy();
    expect(db.messages[0].content).toBe("[deleted]");
  });

  it("message templates CRUD + render + POST /messages with templateId", async () => {
    const adminToken = await makeJwt(
      { sub: "admin_1", tid: projectId, roles: ["admin"], exp: Math.floor(Date.now() / 1000) + 3600 },
      jwtSecret
    );
    const memberToken = await makeJwt(
      { sub: userId, tid: projectId, roles: ["member"], exp: Math.floor(Date.now() / 1000) + 3600 },
      jwtSecret
    );

    const createTpl = await callWorker({
      env,
      url: "https://fluxy.local/templates",
      method: "POST",
      body: { name: "welcome", body: "Hello {{name}} in {{roomId}}" },
      token: adminToken,
    });
    expect(createTpl.status).toBe(200);
    const tplJson = await createTpl.json();
    const templateId = tplJson.template.id;
    expect(db.messageTemplates).toHaveLength(1);

    const renderRes = await callWorker({
      env,
      url: "https://fluxy.local/templates/render",
      method: "POST",
      body: { templateId, vars: { name: "Ada", roomId } },
      token: adminToken,
    });
    expect(renderRes.status).toBe(200);
    expect((await renderRes.json()).content).toBe(`Hello Ada in ${roomId}`);

    const msgRes = await callWorker({
      env,
      url: "https://fluxy.local/messages",
      method: "POST",
      body: {
        roomId,
        templateId,
        templateVars: { name: "Ada", roomId },
        clientMessageId: "cmsg_e2e_template_01",
      },
      token: memberToken,
    });
    expect(msgRes.status).toBe(200);
    const msgJson = await msgRes.json();
    expect(msgJson.message.content).toBe(`Hello Ada in ${roomId}`);
    expect(msgJson.message.clientMessageId).toBe("cmsg_e2e_template_01");

    const dupRes = await callWorker({
      env,
      url: "https://fluxy.local/messages",
      method: "POST",
      body: {
        roomId,
        templateId,
        templateVars: { name: "Ignored", roomId },
        clientMessageId: "cmsg_e2e_template_01",
      },
      token: memberToken,
    });
    expect(dupRes.status).toBe(200);
    const dupJson = await dupRes.json();
    expect(dupJson.message.id).toBe(msgJson.message.id);
    expect(db.messages).toHaveLength(1);
  });

  it("GET /activities merges automation, webhooks, and agent runs", async () => {
    const adminToken = await makeJwt(
      { sub: "admin_1", tid: projectId, roles: ["admin"], exp: Math.floor(Date.now() / 1000) + 3600 },
      jwtSecret
    );
    const now = new Date().toISOString();

    db.automationEvents.push({
      id: ++db.lastAutomationEventId,
      project_id: projectId,
      event_type: "mention",
      room_id: roomId,
      payload: JSON.stringify({ messageId: 1 }),
      created_at: now,
    });
    db.webhookDeliveries.push({
      id: "whd_1",
      project_id: projectId,
      webhook_id: "wh_1",
      webhook_url: "https://example.com/hook",
      event_type: "message.created",
      payload: JSON.stringify({ roomId }),
      status: "delivered",
      attempt_count: 1,
      next_attempt_at: now,
      created_at: now,
      updated_at: now,
    });
    db.agentRuns.push({
      id: "run_1",
      project_id: projectId,
      agent_id: "agent_1",
      room_id: roomId,
      status: "completed",
      latency_ms: 120,
      created_at: now,
    });

    const res = await callWorker({
      env,
      url: `https://fluxy.local/activities?roomId=${encodeURIComponent(roomId)}&limit=10`,
      method: "GET",
      token: adminToken,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.activities.length).toBeGreaterThanOrEqual(3);
    const kinds = new Set(body.activities.map((a) => a.kind));
    expect(kinds.has("automation")).toBe(true);
    expect(kinds.has("webhook")).toBe(true);
    expect(kinds.has("agent_run")).toBe(true);
  });

  it("persists outbound attachments + @mention rows on POST /messages (REST parity)", async () => {
    const token = await makeJwt(
      { sub: userId, tid: projectId, roles: ["member"], exp: Math.floor(Date.now() / 1000) + 3600 },
      jwtSecret
    );

    const createRes = await callWorker({
      env,
      url: "https://fluxy.local/messages",
      method: "POST",
      body: {
        roomId,
        content: "hello @charlie attached",
        attachments: [
          {
            kind: "file",
            url: "https://cdn.example/proj/docs.pdf",
            name: "docs.pdf",
            sizeBytes: 1200,
            contentType: "application/pdf",
          },
        ],
      },
      token,
    });
    expect(createRes.status).toBe(200);
    const created = await createRes.json();
    expect(created.message.attachments?.length).toBe(1);
    expect(db.attachments).toHaveLength(1);
    expect(db.attachments[0].url).toContain("cdn.example");

    expect(db.messageMentions.length).toBeGreaterThanOrEqual(1);
    const mm = db.messageMentions.find(
      (m) => String(m.message_id) === String(created.message.id) && m.mentioned_user_id === "charlie"
    );
    expect(mm).toBeTruthy();
  });

  it("covers webhook retry + replay flow", async () => {
    db.webhooks.push({
      id: "wh_1",
      project_id: projectId,
      url: "https://webhook.example/fail-first",
      secret: "wh-secret",
      event_types: "message.created,report.created",
    });

    const memberToken = await makeJwt(
      { sub: userId, tid: projectId, roles: ["member"], exp: Math.floor(Date.now() / 1000) + 3600 },
      jwtSecret
    );
    const adminToken = await makeJwt(
      { sub: "admin_1", tid: projectId, roles: ["admin"], exp: Math.floor(Date.now() / 1000) + 3600 },
      jwtSecret
    );

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementationOnce(async () => new Response("fail", { status: 500 }))
      .mockImplementationOnce(async () => new Response("ok", { status: 200 }));

    const createRes = await callWorker({
      env,
      url: "https://fluxy.local/messages",
      method: "POST",
      body: { roomId, content: "trigger webhook" },
      token: memberToken,
    });
    expect(createRes.status).toBe(200);
    expect(db.webhookDeliveries).toHaveLength(1);
    expect(db.webhookDeliveries[0].attempt_count).toBe(1);
    expect(db.webhookDeliveries[0].status).toBe("pending");
    expect(db.webhookDeliveries[0].last_http_status).toBe(500);

    const replayRes = await callWorker({
      env,
      url: `https://fluxy.local/admin/webhooks/deliveries/${db.webhookDeliveries[0].id}/replay`,
      method: "POST",
      token: adminToken,
    });
    expect(replayRes.status).toBe(200);
    expect(db.webhookDeliveries[0].status).toBe("delivered");
    expect(db.webhookDeliveries[0].attempt_count).toBe(1);
    expect(db.webhookDeliveries[0].last_http_status).toBe(200);

    fetchSpy.mockRestore();
  });

  it("does not retry webhook before cooldown window", async () => {
    db.webhooks.push({
      id: "wh_cooldown",
      project_id: projectId,
      url: "https://webhook.example/cooldown",
      secret: "wh-secret",
      event_types: "message.created",
    });
    const memberToken = await makeJwt(
      {
        sub: userId,
        tid: projectId,
        roles: ["member"],
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      jwtSecret
    );
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => new Response("fail", { status: 500 }));

    const createRes = await callWorker({
      env,
      url: "https://fluxy.local/messages",
      method: "POST",
      body: { roomId, content: "trigger cooldown test" },
      token: memberToken,
    });
    expect(createRes.status).toBe(200);
    expect(db.webhookDeliveries).toHaveLength(1);
    expect(db.webhookDeliveries[0].attempt_count).toBe(1);
    expect(db.webhookDeliveries[0].status).toBe("pending");
    const nextAttemptAtAfterFailure = db.webhookDeliveries[0].next_attempt_at;

    const healthRes = await callWorker({
      env,
      url: "https://fluxy.local/health",
      method: "GET",
    });
    expect(healthRes.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(db.webhookDeliveries[0].attempt_count).toBe(1);
    expect(db.webhookDeliveries[0].status).toBe("pending");
    expect(db.webhookDeliveries[0].next_attempt_at).toBe(nextAttemptAtAfterFailure);

    fetchSpy.mockRestore();
  });

  it("marks webhook as failed after max retry attempts", async () => {
    env.WEBHOOK_MAX_ATTEMPTS = "2";
    db.webhooks.push({
      id: "wh_max_attempts",
      project_id: projectId,
      url: "https://webhook.example/permanent-fail",
      secret: "wh-secret",
      event_types: "message.created",
    });
    const memberToken = await makeJwt(
      {
        sub: userId,
        tid: projectId,
        roles: ["member"],
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      jwtSecret
    );
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => new Response("fail", { status: 500 }));

    const createRes = await callWorker({
      env,
      url: "https://fluxy.local/messages",
      method: "POST",
      body: { roomId, content: "trigger permanent failure" },
      token: memberToken,
    });
    expect(createRes.status).toBe(200);
    expect(db.webhookDeliveries).toHaveLength(1);
    expect(db.webhookDeliveries[0].attempt_count).toBe(1);
    expect(db.webhookDeliveries[0].status).toBe("pending");

    db.webhookDeliveries[0].next_attempt_at = new Date(Date.now() - 1000).toISOString();
    const processRes = await callWorker({
      env,
      url: "https://fluxy.local/health",
      method: "GET",
    });
    expect(processRes.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(db.webhookDeliveries[0].attempt_count).toBe(2);
    expect(db.webhookDeliveries[0].status).toBe("failed");
    expect(db.webhookDeliveries[0].last_http_status).toBe(500);
    expect(db.webhookDeliveries[0].last_error).toBe("http_500");

    const healthResAfterFailure = await callWorker({
      env,
      url: "https://fluxy.local/health",
      method: "GET",
    });
    expect(healthResAfterFailure.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    fetchSpy.mockRestore();
  });

  it("rejects expired JWT tokens", async () => {
    const expiredToken = await makeJwt(
      {
        sub: userId,
        tid: projectId,
        roles: ["member"],
        exp: Math.floor(Date.now() / 1000) - 10,
      },
      jwtSecret
    );
    const res = await callWorker({
      env,
      url: "https://fluxy.local/messages",
      method: "POST",
      body: { roomId, content: "should fail" },
      token: expiredToken,
    });
    expect(res.status).toBe(401);
  });

  it("rejects member role on admin-only endpoints", async () => {
    const memberToken = await makeJwt(
      {
        sub: userId,
        tid: projectId,
        roles: ["member"],
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      jwtSecret
    );
    const res = await callWorker({
      env,
      url: "https://fluxy.local/admin/reports",
      method: "GET",
      token: memberToken,
    });
    expect(res.status).toBe(403);
  });

  it("rejects websocket connect when user is not room member", async () => {
    db.rooms.push({
      id: roomId,
      project_id: projectId,
      type: "group",
    });
    const token = await makeJwt(
      {
        sub: userId,
        tid: projectId,
        roles: ["member"],
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      jwtSecret
    );
    const res = await callWorker({
      env,
      url: `https://fluxy.local/ws/room/${roomId}?token=${encodeURIComponent(token)}`,
      method: "GET",
      headers: {
        Upgrade: "websocket",
      },
    });
    expect(res.status).toBe(403);
  });

  it("forbids member from deleting a room", async () => {
    db.rooms.push({
      id: roomId,
      project_id: projectId,
      type: "group",
      name: "r",
      created_at: new Date().toISOString(),
    });
    const token = await makeJwt(
      {
        sub: userId,
        tid: projectId,
        roles: ["member"],
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      jwtSecret
    );
    const res = await callWorker({
      env,
      url: `https://fluxy.local/rooms/${roomId}`,
      method: "DELETE",
      token,
    });
    expect(res.status).toBe(403);
  });

  it("allows admin to delete a room and cascade related rows", async () => {
    const adminToken = await makeJwt(
      {
        sub: "admin_1",
        tid: projectId,
        roles: ["admin"],
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      jwtSecret
    );
    db.rooms.push({
      id: roomId,
      project_id: projectId,
      type: "group",
      name: "Test room",
      created_at: new Date().toISOString(),
    });
    db.roomMembers.push({
      room_id: roomId,
      user_id: userId,
      role: "member",
      joined_at: new Date().toISOString(),
    });
    db.messages.push({
      id: 1,
      project_id: projectId,
      room_id: roomId,
      user_id: userId,
      content: "x",
      created_at: new Date().toISOString(),
      parent_id: null,
      edited_at: null,
      deleted_at: null,
      mentions: null,
      og_title: null,
      og_description: null,
      og_image: null,
      og_url: null,
    });

    const res = await callWorker({
      env,
      url: `https://fluxy.local/rooms/${roomId}`,
      method: "DELETE",
      token: adminToken,
    });
    expect(res.status).toBe(200);
    expect(db.rooms).toHaveLength(0);
    expect(db.roomMembers).toHaveLength(0);
    expect(db.messages).toHaveLength(0);
  });

  it("scopes GET /admin/projects to tenant JWT in hosted multi-tenant mode", async () => {
    const platformId = "platform_proj";
    const tenantId = "tenant_proj";
    db.projects.push(
      { id: platformId, name: "Platform", created_at: "2026-01-01T00:00:00.000Z" },
      { id: tenantId, name: "Tenant A", created_at: "2026-01-02T00:00:00.000Z" },
    );
    db.projectSecrets.push(
      { project_id: platformId, jwt_secret: jwtSecret },
      { project_id: tenantId, jwt_secret: jwtSecret },
    );
    env.HOSTED_MULTI_TENANT = "true";
    env.FLUXY_PLATFORM_PROJECT_ID = platformId;

    const tenantToken = await makeJwt(
      {
        sub: "tenant_admin",
        tid: tenantId,
        roles: ["admin"],
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      jwtSecret,
    );
    const tenantRes = await callWorker({
      env,
      url: "https://fluxy.local/admin/projects",
      token: tenantToken,
    });
    expect(tenantRes.status).toBe(200);
    const tenantBody = await tenantRes.json();
    expect(tenantBody.projects).toHaveLength(1);
    expect(tenantBody.projects[0].id).toBe(tenantId);

    const tenantCreate = await callWorker({
      env,
      url: "https://fluxy.local/admin/projects",
      method: "POST",
      body: { name: "should-fail" },
      token: tenantToken,
    });
    expect(tenantCreate.status).toBe(403);
    expect((await tenantCreate.json()).reason).toBe("tenant_cannot_create_projects");

    const platformToken = await makeJwt(
      {
        sub: "platform_admin",
        tid: platformId,
        roles: ["admin"],
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      jwtSecret,
    );
    const platformRes = await callWorker({
      env,
      url: "https://fluxy.local/admin/projects",
      token: platformToken,
    });
    const platformBody = await platformRes.json();
    expect(platformBody.projects.length).toBe(2);
  });

  it("denies hosted tenant plan mutation (open-beta abuse guard)", async () => {
    const platformId = "platform_plan_guard";
    const tenantId = "tenant_plan_guard";
    db.projects.push(
      { id: platformId, name: "Platform", created_at: "2026-01-01T00:00:00.000Z" },
      { id: tenantId, name: "Tenant", created_at: "2026-01-02T00:00:00.000Z" },
    );
    db.projectSecrets.push(
      { project_id: platformId, jwt_secret: jwtSecret },
      { project_id: tenantId, jwt_secret: jwtSecret },
    );
    db.projectPlans.push({
      project_id: tenantId,
      plan_name: "free",
      billing_status: "manual",
      message_limit_monthly: 50_000,
      agent_invoke_limit_monthly: 1_000,
      webhook_delivery_limit_monthly: 10_000,
      pricing_version: "v1",
      manually_overridden: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    env.HOSTED_MULTI_TENANT = "true";
    env.FLUXY_PLATFORM_PROJECT_ID = platformId;

    const tenantToken = await makeJwt(
      {
        sub: "tenant_admin",
        tid: tenantId,
        roles: ["admin"],
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      jwtSecret,
    );
    const denyRes = await callWorker({
      env,
      url: `https://fluxy.local/admin/projects/${tenantId}/plan`,
      method: "POST",
      token: tenantToken,
      body: {
        planName: "pro",
        messageLimitMonthly: 9_999_999_999,
        agentInvokeLimitMonthly: 9_999_999_999,
        webhookDeliveryLimitMonthly: 9_999_999_999,
      },
    });
    expect(denyRes.status).toBe(403);
    const denyBody = await denyRes.json();
    expect(denyBody.reason).toBe("platform_operator_required");
    expect(db.projectPlans.find((p) => p.project_id === tenantId).plan_name).toBe("free");

    const platformToken = await makeJwt(
      {
        sub: "platform_admin",
        tid: platformId,
        roles: ["admin"],
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      jwtSecret,
    );
    const setRes = await callWorker({
      env,
      url: `https://fluxy.local/admin/projects/${tenantId}/plan`,
      method: "POST",
      token: platformToken,
      body: {
        planName: "pro",
        messageLimitMonthly: 9_999_999_999,
        agentInvokeLimitMonthly: 9_999_999_999,
        webhookDeliveryLimitMonthly: 9_999_999_999,
      },
    });
    expect(setRes.status).toBe(200);
    const row = db.projectPlans.find((p) => p.project_id === tenantId);
    expect(row.plan_name).toBe("pro");
    expect(row.message_limit_monthly).toBe(5_000_000);
    expect(row.agent_invoke_limit_monthly).toBe(100_000);
    expect(row.webhook_delivery_limit_monthly).toBe(1_000_000);
    expect(row.manually_overridden).toBe(0);
  });

  it("sanitizes inflated project_plans via platform endpoint", async () => {
    const tenantId = "tenant_sanitize";
    db.projects.push({
      id: tenantId,
      name: "Tenant",
      created_at: "2026-01-01T00:00:00.000Z",
    });
    db.projectPlans.push({
      project_id: tenantId,
      plan_name: "pro",
      billing_status: "manual",
      message_limit_monthly: 9_999_999,
      agent_invoke_limit_monthly: 9_999_999,
      webhook_delivery_limit_monthly: 9_999_999,
      pricing_version: "v1",
      manually_overridden: 1,
      stripe_subscription_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    env.PLATFORM_BOOTSTRAP_SECRET = "sanitize-test-secret";
    env.HOSTED_MULTI_TENANT = "true";
    env.FLUXY_PLATFORM_PROJECT_ID = "platform_sanitize";

    const dryRes = await callWorker({
      env,
      url: "https://fluxy.local/platform/sanitize-plans?dryRun=true",
      method: "POST",
      headers: { "X-Fluxy-Bootstrap-Secret": "sanitize-test-secret" },
    });
    expect(dryRes.status).toBe(200);
    const dryBody = await dryRes.json();
    expect(dryBody.updated).toBe(1);
    expect(db.projectPlans[0].message_limit_monthly).toBe(9_999_999);

    const applyRes = await callWorker({
      env,
      url: "https://fluxy.local/platform/sanitize-plans",
      method: "POST",
      headers: { "X-Fluxy-Bootstrap-Secret": "sanitize-test-secret" },
    });
    expect(applyRes.status).toBe(200);
    const row = db.projectPlans.find((p) => p.project_id === tenantId);
    expect(row.plan_name).toBe("free");
    expect(row.message_limit_monthly).toBe(50_000);
    expect(row.manually_overridden).toBe(0);
  });

  it("writes audit events for admin actions and exposes them via /admin/audit/events", async () => {
    const adminToken = await makeJwt(
      { sub: "admin_1", tid: projectId, roles: ["admin"], exp: Math.floor(Date.now() / 1000) + 3600 },
      jwtSecret
    );

    const createRes = await callWorker({
      env,
      url: "https://fluxy.local/admin/projects",
      method: "POST",
      body: { name: "new-project" },
      token: adminToken,
    });
    expect(createRes.status).toBe(200);

    const auditRes = await callWorker({
      env,
      url: "https://fluxy.local/admin/audit/events?limit=50",
      method: "GET",
      token: adminToken,
    });
    expect(auditRes.status).toBe(200);
    const auditBody = await auditRes.json();
    expect(Array.isArray(auditBody.events)).toBe(true);
    expect(auditBody.events.some((e) => e.action === "admin.project.create")).toBe(
      true
    );
  });

  it("enforces monthly message quota (REST)", async () => {
    env.QUOTA_MESSAGES_PER_MONTH = "1";
    const token = await makeJwt(
      { sub: userId, tid: projectId, roles: ["member"], exp: Math.floor(Date.now() / 1000) + 3600 },
      jwtSecret
    );

    const first = await callWorker({
      env,
      url: "https://fluxy.local/messages",
      method: "POST",
      body: { roomId, content: "one" },
      token,
    });
    expect(first.status).toBe(200);

    const second = await callWorker({
      env,
      url: "https://fluxy.local/messages",
      method: "POST",
      body: { roomId, content: "two" },
      token,
    });
    expect(second.status).toBe(402);
    const body = await second.json();
    expect(body.error).toBe("quota_exceeded");
    expect(body.metric).toBe("messages_created");
  });

  it("uses project-specific plan limits for quota enforcement", async () => {
    db.projectPlans.push({
      project_id: projectId,
      plan_name: "starter",
      billing_status: "manual",
      message_limit_monthly: 2,
      agent_invoke_limit_monthly: 100,
      webhook_delivery_limit_monthly: 100,
      pricing_version: "v1",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    const token = await makeJwt(
      { sub: "user_a", tid: projectId, roles: ["member"], exp: Math.floor(Date.now() / 1000) + 3600 },
      jwtSecret
    );

    for (let i = 0; i < 2; i += 1) {
      const okRes = await callWorker({
        env,
        url: "https://fluxy.local/messages",
        method: "POST",
        token,
        body: { roomId, content: `plan limited ${i}` },
      });
      expect(okRes.status).toBe(200);
    }

    const blockedRes = await callWorker({
      env,
      url: "https://fluxy.local/messages",
      method: "POST",
      token,
      body: { roomId, content: "plan limited final" },
    });
    expect(blockedRes.status).toBe(402);
  });

  it("requires JWT for room message history", async () => {
    const res = await callWorker({
      env,
      url: `https://fluxy.local/api/messages?roomId=${roomId}`,
      method: "GET",
    });
    expect(res.status).toBe(401);
  });

  it("scopes admin reports to the authenticated project", async () => {
    db.moderationEvents.push({
      id: 1,
      project_id: projectId,
      room_id: roomId,
      user_id: "user_a",
      action: "report",
      reason: "spam",
      created_at: new Date().toISOString(),
      target_message_id: 10,
    });
    db.moderationEvents.push({
      id: 2,
      project_id: "proj_other",
      room_id: "room_other",
      user_id: "user_b",
      action: "report",
      reason: "abuse",
      created_at: new Date().toISOString(),
      target_message_id: 20,
    });
    const adminToken = await makeJwt(
      { sub: "admin_1", tid: projectId, roles: ["admin"], exp: Math.floor(Date.now() / 1000) + 3600 },
      jwtSecret
    );

    const res = await callWorker({
      env,
      url: "https://fluxy.local/admin/reports?limit=50",
      method: "GET",
      token: adminToken,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reports).toHaveLength(1);
    expect(body.reports[0].project_id).toBe(projectId);
  });

  it("creates an agent with tool calling configuration", async () => {
    const token = await makeJwt(
      { sub: userId, tid: projectId, roles: ["admin"], exp: Math.floor(Date.now() / 1000) + 3600 },
      jwtSecret
    );
    const res = await callWorker({
      env,
      url: "https://fluxy.local/agents",
      method: "POST",
      token,
      body: {
        name: "tool-agent",
        handle: "assistant",
        provider: "openai",
        model: "gpt-4o-mini",
        systemPrompt: "You are a helpful assistant.",
        contextFetchUrl: "https://myapp.com/api/context",
        toolExecuteUrl: "https://myapp.com/api/tools",
        toolsSchema: [
          {
            type: "function",
            function: {
              name: "get_ticket",
              description: "Get ticket status",
              parameters: { type: "object", properties: { ticket_id: { type: "string" } } },
            },
          },
        ],
        rateLimitRpm: 30,
      },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.agent.systemPrompt).toBe("You are a helpful assistant.");
    expect(body.agent.contextFetchUrl).toBe("https://myapp.com/api/context");
    expect(body.agent.toolExecuteUrl).toBe("https://myapp.com/api/tools");
    expect(body.agent.toolsSchema).toHaveLength(1);
    expect(body.agent.rateLimitRpm).toBe(30);
  });

  it("returns 404 when invoking a non-existent agent", async () => {
    const token = await makeJwt(
      { sub: userId, tid: projectId, roles: ["admin"], exp: Math.floor(Date.now() / 1000) + 3600 },
      jwtSecret
    );
    const res = await callWorker({
      env,
      url: "https://fluxy.local/agents/nonexistent-agent/invoke",
      method: "POST",
      token,
      body: { roomId, content: "hello agent" },
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("agent not found");
    expect(db.agentRuns).toHaveLength(1);
    expect(db.agentRuns[0].status).toBe("failed");
    expect(db.agentRuns[0].error).toBe("agent_not_found");
  });

  it("rejects agent invoke with invalid content", async () => {
    const token = await makeJwt(
      { sub: userId, tid: projectId, roles: ["admin"], exp: Math.floor(Date.now() / 1000) + 3600 },
      jwtSecret
    );
    db.bots.push({
      id: "test-agent",
      project_id: projectId,
      name: "Test Agent",
      provider: "openai",
      model: "gpt-4o-mini",
      system_prompt: null,
      context_fetch_url: null,
      tool_execute_url: null,
      tools_schema: null,
      rate_limit_rpm: 60,
    });
    const res = await callWorker({
      env,
      url: "https://fluxy.local/agents/test-agent/invoke",
      method: "POST",
      token,
      body: { roomId, content: "" },
    });
    expect(res.status).toBe(400);
  });

  it("lists agents with tool calling fields", async () => {
    const token = await makeJwt(
      { sub: userId, tid: projectId, roles: ["admin"], exp: Math.floor(Date.now() / 1000) + 3600 },
      jwtSecret
    );
    db.bots.push({
      id: "listed-agent",
      project_id: projectId,
      name: "Listed Agent",
      handle: "helper",
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      system_prompt: "Be helpful",
      context_fetch_url: null,
      tool_execute_url: "https://example.com/tools",
      tools_schema: JSON.stringify([{ type: "function", function: { name: "search" } }]),
      rate_limit_rpm: 10,
    });
    const res = await callWorker({
      env,
      url: "https://fluxy.local/agents",
      method: "GET",
      token,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    const agent = body.agents.find((a) => a.id === "listed-agent");
    expect(agent).toBeDefined();
    expect(agent.systemPrompt).toBe("Be helpful");
    expect(agent.toolExecuteUrl).toBe("https://example.com/tools");
    expect(agent.toolsSchema).toHaveLength(1);
    expect(agent.rateLimitRpm).toBe(10);
  });

  it("rejects agent create with SSRF contextFetchUrl", async () => {
    const token = await makeJwt(
      { sub: userId, tid: projectId, roles: ["admin"], exp: Math.floor(Date.now() / 1000) + 3600 },
      jwtSecret
    );
    const res = await callWorker({
      env,
      url: "https://fluxy.local/agents",
      method: "POST",
      token,
      body: { name: "EvilAgent", contextFetchUrl: "http://127.0.0.1:8080/internal" },
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("private");
  });

  it("rejects agent create with SSRF toolExecuteUrl", async () => {
    const token = await makeJwt(
      { sub: userId, tid: projectId, roles: ["admin"], exp: Math.floor(Date.now() / 1000) + 3600 },
      jwtSecret
    );
    const res = await callWorker({
      env,
      url: "https://fluxy.local/agents",
      method: "POST",
      token,
      body: { name: "EvilAgent", toolExecuteUrl: "http://169.254.169.254/metadata" },
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("private");
  });

  it("agent invoke runs tools end-to-end (mock LLM tool_calls + toolExecuteUrl)", async () => {
    const toolExecuteUrl = "https://tools.mock.example/execute";
    const announced = [];
    let llmCalls = 0;
    let toolExecuteCalls = 0;

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      const u = String(url);
      if (u.startsWith(toolExecuteUrl)) {
        toolExecuteCalls += 1;
        const body = JSON.parse(String(init?.body || "{}"));
        expect(body.tool_name).toBe("search_docs");
        expect(body.tool_call_id).toBe("call_e2e_1");
        return new Response(JSON.stringify({ hits: ["doc-1"] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (u.includes("/v1/chat/completions")) {
        llmCalls += 1;
        if (llmCalls === 1) {
          return new Response(
            JSON.stringify({
              choices: [
                {
                  message: {
                    content: null,
                    tool_calls: [
                      {
                        id: "call_e2e_1",
                        type: "function",
                        function: { name: "search_docs", arguments: '{"q":"beta"}' },
                      },
                    ],
                  },
                  finish_reason: "tool_calls",
                },
              ],
              usage: { prompt_tokens: 10, completion_tokens: 5 },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: { content: "Answer after tool round." },
                finish_reason: "stop",
              },
            ],
            usage: { prompt_tokens: 8, completion_tokens: 12 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("not found", { status: 404 });
    });

    db.rooms.push({
      id: roomId,
      project_id: projectId,
      type: "group",
      name: "Tool room",
    });
    db.roomMembers.push({
      room_id: roomId,
      user_id: userId,
      role: "member",
      joined_at: new Date().toISOString(),
    });
    db.bots.push({
      id: "tool-agent",
      project_id: projectId,
      name: "Tool Agent",
      provider: "openai",
      model: "gpt-4o-mini",
      system_prompt: "You are a test agent.",
      context_fetch_url: null,
      tool_execute_url: toolExecuteUrl,
      tools_schema: JSON.stringify([
        {
          type: "function",
          function: {
            name: "search_docs",
            description: "Search documentation",
            parameters: {
              type: "object",
              properties: { q: { type: "string" } },
            },
          },
        },
      ]),
      rate_limit_rpm: 60,
    });

    const baseEnv = createEnv(db);
    const envTools = {
      ...baseEnv,
      AI_BASE_URL: "http://llm.mock",
      AI_API_KEY: "test-key",
      ROOM: {
        idFromName(name) {
          return `room:${name}`;
        },
        get() {
          return {
            async fetch(target, init) {
              const path = String(target);
              if (path.includes("/announce") && init?.body) {
                try {
                  announced.push(JSON.parse(String(init.body)));
                } catch {
                  /* ignore */
                }
              }
              if (path.includes("/stream")) {
                return new Response(JSON.stringify({ ok: true, id: 9001 }), {
                  headers: { "Content-Type": "application/json" },
                });
              }
              return new Response(JSON.stringify({ ok: true }), {
                headers: { "Content-Type": "application/json" },
              });
            },
          };
        },
      },
    };

    const token = await makeJwt(
      { sub: userId, tid: projectId, roles: ["admin"], exp: Math.floor(Date.now() / 1000) + 3600 },
      jwtSecret,
    );

    const invokeRes = await callWorker({
      env: envTools,
      url: "https://fluxy.local/agents/tool-agent/invoke",
      method: "POST",
      token,
      body: { roomId, content: "Find docs about beta" },
    });
    expect(invokeRes.status).toBe(200);
    const invokeBody = await invokeRes.json();
    expect(invokeBody.run.status).toBe("completed");
    expect(invokeBody.run.toolCalls).toHaveLength(1);
    expect(invokeBody.run.toolCalls[0].name).toBe("search_docs");
    expect(invokeBody.run.toolCalls[0].success).toBe(true);
    expect(invokeBody.run.toolCalls[0].result).toEqual({ hits: ["doc-1"] });
    expect(invokeBody.message?.content).toContain("Answer after tool");

    expect(llmCalls).toBe(2);
    expect(toolExecuteCalls).toBe(1);

    const storedRun = db.agentRuns.find((r) => r.agent_id === "tool-agent");
    expect(storedRun?.status).toBe("completed");
    const storedTools = JSON.parse(storedRun.tool_calls_json);
    expect(storedTools[0].success).toBe(true);
    expect(storedTools[0].name).toBe("search_docs");

    expect(announced.some((e) => e.type === "tool_call" && e.name === "search_docs")).toBe(true);
    expect(announced.some((e) => e.type === "tool_result" && e.name === "search_docs")).toBe(true);
    expect(announced.some((e) => e.type === "agentRun" && e.run?.status === "completed")).toBe(
      true,
    );

    const runsRes = await callWorker({
      env: envTools,
      url: "https://fluxy.local/agents/tool-agent/runs?limit=5",
      method: "GET",
      token,
    });
    expect(runsRes.status).toBe(200);
    const runsBody = await runsRes.json();
    expect(runsBody.runs[0].tool_calls[0].name).toBe("search_docs");
    expect(runsBody.runs[0].tool_calls[0].success).toBe(true);

    fetchSpy.mockRestore();
  });

  it("returns billing plan and usage", async () => {
    db.projectPlans.push({
      project_id: projectId,
      plan_name: "starter",
      billing_status: "active",
      message_limit_monthly: 500,
      agent_invoke_limit_monthly: 100,
      webhook_delivery_limit_monthly: 200,
      pricing_version: "v1",
      stripe_customer_id: "cus_test123",
      stripe_subscription_id: "sub_test123",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    const token = await makeJwt(
      { sub: userId, tid: projectId, roles: ["admin"], exp: Math.floor(Date.now() / 1000) + 3600 },
      jwtSecret
    );
    const res = await callWorker({
      env,
      url: "https://fluxy.local/billing/plan",
      method: "GET",
      token,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.plan.planName).toBe("starter");
    expect(body.plan.billingStatus).toBe("active");
  });

  it("processes Stripe webhooks and keeps quota limits intact", async () => {
    db.projectPlans.push({
      project_id: projectId,
      plan_name: "starter",
      billing_status: "active",
      message_limit_monthly: 123,
      agent_invoke_limit_monthly: 45,
      webhook_delivery_limit_monthly: 67,
      pricing_version: "v1",
      manually_overridden: 1,
      stripe_customer_id: "cus_abc",
      stripe_subscription_id: "sub_abc",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const envStripe = createEnv(db);

    const updateRes = await callWorker({
      env: envStripe,
      url: "https://fluxy.local/webhooks/stripe",
      method: "POST",
      body: {
        id: "evt_subscription_updated_1",
        type: "customer.subscription.updated",
        data: {
          object: {
            id: "sub_abc",
            customer: "cus_abc",
            status: "past_due",
            metadata: { project_id: projectId, plan_name: "pro" },
          },
        },
      },
    });
    expect(updateRes.status).toBe(200);
    expect(db.projectPlans[0].plan_name).toBe("pro");
    expect(db.projectPlans[0].billing_status).toBe("past_due");
    expect(db.projectPlans[0].message_limit_monthly).toBe(123);
    expect(db.projectPlans[0].agent_invoke_limit_monthly).toBe(45);
    expect(db.projectPlans[0].webhook_delivery_limit_monthly).toBe(67);

    const duplicateRes = await callWorker({
      env: envStripe,
      url: "https://fluxy.local/webhooks/stripe",
      method: "POST",
      body: {
        id: "evt_subscription_updated_1",
        type: "customer.subscription.updated",
        data: {
          object: {
            id: "sub_abc",
            customer: "cus_abc",
            status: "active",
            metadata: { project_id: projectId, plan_name: "starter" },
          },
        },
      },
    });
    expect(duplicateRes.status).toBe(200);
    const duplicateBody = await duplicateRes.json();
    expect(duplicateBody.duplicate).toBe(true);
    // Ensure duplicate event did not mutate plan state.
    expect(db.projectPlans[0].plan_name).toBe("pro");
    expect(db.projectPlans[0].billing_status).toBe("past_due");

    const deleteRes = await callWorker({
      env: envStripe,
      url: "https://fluxy.local/webhooks/stripe",
      method: "POST",
      body: {
        id: "evt_subscription_deleted_1",
        type: "customer.subscription.deleted",
        data: {
          object: {
            id: "sub_abc",
            customer: "cus_abc",
            status: "canceled",
            metadata: { project_id: projectId, plan_name: "pro" },
          },
        },
      },
    });
    expect(deleteRes.status).toBe(200);
    expect(db.projectPlans[0].plan_name).toBe("free");
    expect(db.projectPlans[0].billing_status).toBe("cancelled");
    // Quota limits remain unchanged (the quota system reads limits from plan row fields).
    expect(db.projectPlans[0].message_limit_monthly).toBe(123);
    expect(db.projectPlans[0].agent_invoke_limit_monthly).toBe(45);
    expect(db.projectPlans[0].webhook_delivery_limit_monthly).toBe(67);
  });

  it("fires auto room_summary on every N messages when AUTO_ROOM_SUMMARY_ENABLED", async () => {
    let aiCalls = 0;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes("/v1/chat/completions")) {
        aiCalls += 1;
        return new Response(
          JSON.stringify({ choices: [{ message: { content: "- Auto summary line" } }] }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("{}", { status: 200 });
    });

    const baseEnv = createEnv(db);
    const envAuto = {
      ...baseEnv,
      AI_BASE_URL: "http://ai.test",
      AI_API_KEY: "test-key",
      AUTO_ROOM_SUMMARY_ENABLED: "true",
      AUTO_ROOM_SUMMARY_EVERY_N: "2",
      AUTO_ROOM_SUMMARY_COOLDOWN_MINUTES: "0",
    };

    const token = await makeJwt(
      { sub: userId, tid: projectId, roles: ["member"], exp: Math.floor(Date.now() / 1000) + 3600 },
      jwtSecret
    );

    const r1 = await callWorker({
      env: envAuto,
      url: "https://fluxy.local/messages",
      method: "POST",
      body: { roomId, content: "one" },
      token,
    });
    expect(r1.status).toBe(200);
    expect(aiCalls).toBe(0);

    const r2 = await callWorker({
      env: envAuto,
      url: "https://fluxy.local/messages",
      method: "POST",
      body: { roomId, content: "two" },
      token,
    });
    expect(r2.status).toBe(200);
    expect(aiCalls).toBe(1);
    expect(db.automationEvents.some((e) => e.event_type === "room_summary_auto")).toBe(true);

    fetchSpy.mockRestore();
  });

  it("builtin moderation emits auto_flag when blocked substring matches", async () => {
    const envMod = {
      ...createEnv(db),
      BUILTIN_MODERATION_ENABLED: "true",
      BUILTIN_MODERATION_BLOCKED_SUBSTRINGS: "forbidden-token",
    };
    const token = await makeJwt(
      { sub: userId, tid: projectId, roles: ["member"], exp: Math.floor(Date.now() / 1000) + 3600 },
      jwtSecret
    );
    const res = await callWorker({
      env: envMod,
      url: "https://fluxy.local/messages",
      method: "POST",
      body: { roomId, content: "hello forbidden-token in text" },
      token,
    });
    expect(res.status).toBe(200);
    const flags = db.moderationEvents.filter((e) => e.action === "auto_flag");
    expect(flags).toHaveLength(1);
    expect(flags[0].user_id).toBe("builtin");
    expect(flags[0].reason).toContain("forbidden-token");
    expect(db.automationEvents.some((e) => e.event_type === "moderation_builtin_flag")).toBe(true);
  });

  it("writes audit event with correct camelCase on GDPR export", async () => {
    const adminToken = await makeJwt(
      { sub: userId, tid: projectId, roles: ["owner"], exp: Math.floor(Date.now() / 1000) + 3600 },
      jwtSecret
    );
    const res = await callWorker({
      env,
      url: "https://fluxy.local/gdpr/export",
      method: "GET",
      token: adminToken,
    });
    expect(res.status).toBe(200);
    const auditEvent = db.auditEvents.find((e) => e.action === "gdpr.export");
    expect(auditEvent).toBeDefined();
    expect(auditEvent.project_id).toBe(projectId);
    expect(auditEvent.actor_user_id).toBe(userId);
  });
});

describe("RoomDurableObject WebSocket message handlers", () => {
  const projectId = "proj_do_ws";
  const userId = "user_do_ws";
  const roomId = "room_do_ws";

  function seedRoomAndMessage(db) {
    db.projectSecrets.push({ project_id: projectId, jwt_secret: "unused" });
    db.rooms.push({
      id: roomId,
      project_id: projectId,
      type: "group",
    });
    db.roomMembers.push({
      room_id: roomId,
      user_id: userId,
      role: "member",
      joined_at: new Date().toISOString(),
    });
    db.messages.push({
      id: 1,
      project_id: projectId,
      room_id: roomId,
      user_id: userId,
      content: "ws hello",
      created_at: new Date().toISOString(),
      parent_id: null,
      edited_at: null,
      deleted_at: null,
      mentions: null,
      og_title: null,
      og_description: null,
      og_image: null,
      og_url: null,
    });
  }

  function createMockWebSocket() {
    const sent = [];
    return {
      sent,
      accept() {},
      addEventListener() {},
      send(data) {
        sent.push(typeof data === "string" ? data : String(data));
      },
    };
  }

  it("soft-deletes the author's message on WS delete using socket-bound userId", async () => {
    const db = new FakeDB();
    seedRoomAndMessage(db);
    const env = { DB: db, RATE_LIMIT_WS_MESSAGES_PER_MINUTE: "60" };
    const state = { id: { toString: () => roomId } };
    const roomDo = new RoomDurableObject(state, env);
    roomDo.projectId = projectId;
    const ws = createMockWebSocket();
    roomDo.clients.add(ws);
    roomDo.userIds.set(ws, userId);

    await roomDo.onMessage(ws, {
      data: JSON.stringify({ type: "delete", messageId: 1 }),
    });

    expect(db.messages[0].content).toBe("[deleted]");
    expect(db.messages[0].deleted_at).toBeTruthy();
    const broadcast = ws.sent.map((s) => JSON.parse(s)).find((p) => p.type === "delete");
    expect(broadcast).toMatchObject({
      type: "delete",
      id: 1,
      roomId,
      userId,
    });
  });

  it("updates message content on WS edit", async () => {
    const db = new FakeDB();
    seedRoomAndMessage(db);
    const env = { DB: db, RATE_LIMIT_WS_MESSAGES_PER_MINUTE: "60" };
    const state = { id: { toString: () => roomId } };
    const roomDo = new RoomDurableObject(state, env);
    roomDo.projectId = projectId;
    const ws = createMockWebSocket();
    roomDo.clients.add(ws);
    roomDo.userIds.set(ws, userId);

    await roomDo.onMessage(ws, {
      data: JSON.stringify({
        type: "edit",
        userId,
        messageId: 1,
        content: "edited via ws",
      }),
    });

    expect(db.messages[0].content).toBe("edited via ws");
    expect(db.messages[0].edited_at).toBeTruthy();
  });
});

