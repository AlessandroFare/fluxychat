/**
 * P22-F6: Plan/task tracking for multi-step operations.
 * Used by AI agents to track progress on complex tasks.
 */

export type TaskStatus = "pending" | "in_progress" | "complete" | "error";

export interface PlanTask {
  id: string;
  title: string;
  status: TaskStatus;
  details?: string;
  output?: string;
}

export interface Plan {
  id: string;
  title: string;
  tasks: PlanTask[];
  createdAt: Date;
  updatedAt: Date;
}

export function createPlan(title: string): Plan {
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    title,
    tasks: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function addTask(plan: Plan, title: string): PlanTask {
  const task: PlanTask = {
    id: crypto.randomUUID(),
    title,
    status: "pending",
  };
  plan.tasks.push(task);
  plan.updatedAt = new Date();
  return task;
}

export function updateTaskStatus(
  plan: Plan,
  taskId: string,
  status: TaskStatus,
  options?: { details?: string; output?: string },
): PlanTask | null {
  const task = plan.tasks.find((t) => t.id === taskId);
  if (!task) return null;
  task.status = status;
  if (options?.details !== undefined) task.details = options.details;
  if (options?.output !== undefined) task.output = options.output;
  plan.updatedAt = new Date();
  return task;
}

export function getPlanProgress(plan: Plan): {
  total: number;
  complete: number;
  inProgress: number;
  pending: number;
  errors: number;
} {
  return {
    total: plan.tasks.length,
    complete: plan.tasks.filter((t) => t.status === "complete").length,
    inProgress: plan.tasks.filter((t) => t.status === "in_progress").length,
    pending: plan.tasks.filter((t) => t.status === "pending").length,
    errors: plan.tasks.filter((t) => t.status === "error").length,
  };
}
