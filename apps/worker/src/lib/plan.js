/**
 * P22-F6: Plan/Task Tracking for Worker
 * In-memory plan objects for multi-step AI operations.
 * Updated P26-A-3: Implements PostableObject interface.
 */

import { POSTABLE_OBJECT } from "./postable-object.js";

export function createPlan(title) {
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    title,
    tasks: [],
    createdAt: now,
    updatedAt: now,
    $$typeof: POSTABLE_OBJECT,
    kind: "plan",
    isSupported(adapter) {
      return true;
    },
    getFallbackText() {
      const progress = getPlanProgress(this);
      return `${this.title} (${progress.complete}/${progress.total} tasks complete)`;
    },
    getPostData() {
      return { id: this.id, title: this.title, tasks: this.tasks };
    },
    onPosted(context) {
      this.messageId = context.messageId;
      this.threadId = context.threadId;
    },
  };
}

export function addTask(plan, title) {
  const task = {
    id: crypto.randomUUID(),
    title,
    status: "pending",
  };
  plan.tasks.push(task);
  plan.updatedAt = new Date();
  return task;
}

export function updateTaskStatus(plan, taskId, status, options = {}) {
  const task = plan.tasks.find((t) => t.id === taskId);
  if (!task) return null;
  task.status = status;
  if (options.details !== undefined) task.details = options.details;
  if (options.output !== undefined) task.output = options.output;
  plan.updatedAt = new Date();
  return task;
}

export function getPlanProgress(plan) {
  return {
    total: plan.tasks.length,
    complete: plan.tasks.filter((t) => t.status === "complete").length,
    inProgress: plan.tasks.filter((t) => t.status === "in_progress").length,
    pending: plan.tasks.filter((t) => t.status === "pending").length,
    errors: plan.tasks.filter((t) => t.status === "error").length,
  };
}
