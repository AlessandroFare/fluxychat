/**
 * P22-F7: StreamingPlan / Plan
 * Adapted from Vercel Chat SDK's Plan + StreamingPlan classes.
 *
 * A Plan represents a task list that can be posted to a thread.
 * After posting, use methods like addTask(), updateTask(), and complete() to update it.
 *
 * Usage:
 *   const plan = new Plan({ initialMessage: "Starting task..." });
 *   await thread.post(plan);
 *   await plan.addTask({ title: "Fetch data" });
 *   await plan.updateTask("Got 42 results");
 *   await plan.complete({ completeMessage: "Done!" });
 */

// =============================================================================
// Plan Types
// =============================================================================

/** @typedef {'pending' | 'in_progress' | 'complete' | 'error'} PlanTaskStatus */

/**
 * @typedef {Object} PlanTask
 * @property {string} id
 * @property {PlanTaskStatus} status
 * @property {string} title
 */

/**
 * @typedef {Object} PlanModel
 * @property {PlanModelTask[]} tasks
 * @property {string} title
 */

/**
 * @typedef {Object} PlanModelTask
 * @property {string} id
 * @property {PlanTaskStatus} status
 * @property {string} title
 * @property {string} [details]
 * @property {string} [output]
 */

/**
 * @typedef {string | string[]} PlanContent
 */

/**
 * @typedef {Object} StartPlanOptions
 * @property {PlanContent} initialMessage - Initial plan title and first task title
 */

/**
 * @typedef {Object} AddTaskOptions
 * @property {PlanContent} title - Task title
 * @property {PlanContent} [children] - Task details/substeps
 */

/**
 * @typedef {Object} UpdateTaskInput
 * @property {string} [id] - Task ID to update. If omitted, updates the last in_progress task
 * @property {PlanContent} [output] - Task output/results
 * @property {PlanTaskStatus} [status] - Optional status override
 */

/**
 * @typedef {Object} CompletePlanOptions
 * @property {PlanContent} completeMessage - Final plan title shown when completed
 */

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Convert PlanContent to plain text for titles/labels.
 * @param {PlanContent | undefined} content
 * @returns {string}
 */
function contentToPlainText(content) {
  if (!content) {
    return "";
  }
  if (Array.isArray(content)) {
    return content.join(" ").trim();
  }
  if (typeof content === "string") {
    return content;
  }
  return "";
}

// =============================================================================
// Plan Implementation
// =============================================================================

import { POSTABLE_OBJECT as NEW_POSTABLE_OBJECT } from "./postable-object.js";

export const POSTABLE_OBJECT = NEW_POSTABLE_OBJECT;

/**
 * A Plan represents a task list that can be posted to a thread.
 *
 * Create a plan with `new Plan({ initialMessage: "..." })` and post it with `thread.post(plan)`.
 * After posting, use methods like `addTask()`, `updateTask()`, and `complete()` to update it.
 *
 * @example
 * ```javascript
 * const plan = new Plan({ initialMessage: "Starting task..." });
 * await thread.post(plan);
 * await plan.addTask({ title: "Fetch data" });
 * await plan.updateTask("Got 42 results");
 * await plan.complete({ completeMessage: "Done!" });
 * ```
 */
export class Plan {
  /** @type {typeof POSTABLE_OBJECT} */
  $$typeof = POSTABLE_OBJECT;
  /** @type {string} */
  kind = "plan";

  /** @type {PlanModel} */
  #model;
  /** @type {{ adapter: any, fallback: boolean, logger?: any, messageId: string, threadId: string, updateChain: Promise<void> } | null} */
  #bound = null;

  /**
   * @param {StartPlanOptions} options
   */
  constructor(options) {
    const title = contentToPlainText(options.initialMessage) || "Plan";
    const firstTask = {
      id: crypto.randomUUID(),
      title,
      status: "in_progress",
    };
    this.#model = { title, tasks: [firstTask] };
  }

  /**
   * Check if plan is supported by adapter.
   * @param {any} adapter
   * @returns {boolean}
   */
  isSupported(adapter) {
    return !!(adapter.postObject && adapter.editObject);
  }

  /**
   * Get plan data for posting.
   * @returns {PlanModel}
   */
  getPostData() {
    return this.#model;
  }

  /**
   * Get fallback text for adapters that don't support plans.
   * @returns {string}
   */
  getFallbackText() {
    const lines = [];
    lines.push(`📋 ${this.#model.title || "Plan"}`);
    for (const task of this.#model.tasks) {
      const statusIcons = {
        complete: "✅",
        in_progress: "🔄",
        error: "❌",
      };
      const statusIcon = statusIcons[task.status] ?? "⬜";
      lines.push(`${statusIcon} ${task.title}`);
    }
    return lines.join("\n");
  }

  /**
   * Called when plan is posted to a thread.
   * @param {{ adapter: any, messageId: string, threadId: string, logger?: any }} context
   */
  onPosted(context) {
    this.#bound = {
      adapter: context.adapter,
      fallback: !this.isSupported(context.adapter),
      logger: context.logger,
      messageId: context.messageId,
      threadId: context.threadId,
      updateChain: Promise.resolve(),
    };
  }

  /** @returns {string} */
  get id() {
    return this.#bound?.messageId ?? "";
  }

  /** @returns {string} */
  get threadId() {
    return this.#bound?.threadId ?? "";
  }

  /** @returns {string} */
  get title() {
    return this.#model.title;
  }

  /** @returns {PlanTask[]} */
  get tasks() {
    return this.#model.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
    }));
  }

  /**
   * Get the current in-progress task.
   * @returns {PlanTask | null}
   */
  get currentTask() {
    let current;
    for (let i = this.#model.tasks.length - 1; i >= 0; i--) {
      if (this.#model.tasks[i].status === "in_progress") {
        current = this.#model.tasks[i];
        break;
      }
    }
    current ??= this.#model.tasks.at(-1);
    if (!current) {
      return null;
    }
    return { id: current.id, title: current.title, status: current.status };
  }

  /**
   * Add a new task to the plan.
   * @param {AddTaskOptions} options
   * @returns {Promise<PlanTask | null>}
   */
  async addTask(options) {
    if (!this.#canMutate()) {
      return null;
    }
    const title = contentToPlainText(options.title) || "Task";
    for (const task of this.#model.tasks) {
      if (task.status === "in_progress") {
        task.status = "complete";
      }
    }
    const nextTask = {
      id: crypto.randomUUID(),
      title,
      status: "in_progress",
      details: options.children ? contentToPlainText(options.children) : undefined,
    };
    this.#model.tasks.push(nextTask);
    this.#model.title = title;

    await this.#enqueueEdit();
    return { id: nextTask.id, title: nextTask.title, status: nextTask.status };
  }

  /**
   * Update a task in the plan.
   * @param {UpdateTaskInput | PlanContent} [update]
   * @returns {Promise<PlanTask | null>}
   */
  async updateTask(update) {
    if (!this.#canMutate()) {
      return null;
    }
    let current;
    if (
      typeof update === "object" &&
      update !== null &&
      "id" in update &&
      update.id
    ) {
      current = this.#model.tasks.find((t) => t.id === update.id);
    } else {
      for (let i = this.#model.tasks.length - 1; i >= 0; i--) {
        if (this.#model.tasks[i].status === "in_progress") {
          current = this.#model.tasks[i];
          break;
        }
      }
      current ??= this.#model.tasks.at(-1);
    }

    if (!current) {
      return null;
    }
    if (update !== undefined) {
      if (typeof update === "object" && update !== null && "output" in update) {
        if (update.output !== undefined) {
          current.output = contentToPlainText(update.output);
        }
        if (update.status) {
          current.status = update.status;
        }
      } else {
        current.output = contentToPlainText(update);
      }
    }
    await this.#enqueueEdit();
    return { id: current.id, title: current.title, status: current.status };
  }

  /**
   * Reset the plan to initial state.
   * @param {StartPlanOptions} options
   * @returns {Promise<PlanTask | null>}
   */
  async reset(options) {
    if (!this.#canMutate()) {
      return null;
    }

    const title = contentToPlainText(options.initialMessage) || "Plan";
    const firstTask = {
      id: crypto.randomUUID(),
      title,
      status: "in_progress",
    };
    this.#model = { title, tasks: [firstTask] };

    await this.#enqueueEdit();
    return {
      id: firstTask.id,
      title: firstTask.title,
      status: firstTask.status,
    };
  }

  /**
   * Complete the plan.
   * @param {CompletePlanOptions} options
   * @returns {Promise<void>}
   */
  async complete(options) {
    if (!this.#canMutate()) {
      return;
    }
    for (const task of this.#model.tasks) {
      if (task.status === "in_progress") {
        task.status = "complete";
      }
    }
    this.#model.title =
      contentToPlainText(options.completeMessage) || this.#model.title;
    await this.#enqueueEdit();
  }

  /**
   * Check if plan can be mutated.
   * @returns {boolean}
   */
  #canMutate() {
    return !!this.#bound;
  }

  /**
   * Enqueue an edit operation.
   * @returns {Promise<void>}
   */
  async #enqueueEdit() {
    if (!this.#bound) {
      return;
    }
    const bound = this.#bound;
    const doEdit = async () => {
      if (bound.fallback) {
        await bound.adapter.editMessage(
          bound.threadId,
          bound.messageId,
          this.getFallbackText()
        );
      } else {
        const editObject = bound.adapter.editObject;
        if (!editObject) {
          return;
        }
        await editObject.call(
          bound.adapter,
          bound.threadId,
          bound.messageId,
          this.kind,
          this.#model
        );
      }
    };
    const chained = bound.updateChain.then(doEdit, doEdit);
    bound.updateChain = chained.then(
      () => undefined,
      (err) => {
        bound.logger?.warn("Failed to edit plan", err);
      }
    );
    return chained;
  }
}

// =============================================================================
// StreamingPlan (simplified wrapper for streaming)
// =============================================================================

/**
 * @typedef {Object} StreamingPlanOptions
 * @property {'timeline' | 'grouped'} [groupTasks] - How to display tasks
 * @property {any[]} [endWith] - Elements to append when stream completes
 * @property {number} [updateIntervalMs] - Min interval between plan updates
 */

/**
 * A StreamingPlan wraps an async iterable with platform-specific streaming options.
 * Used for streaming with live task progress updates.
 */
export class StreamingPlan {
  /** @type {AsyncIterable<any>} */
  #stream;
  /** @type {StreamingPlanOptions} */
  #options;

  /**
   * @param {AsyncIterable<any>} stream
   * @param {StreamingPlanOptions} [options]
   */
  constructor(stream, options = {}) {
    this.#stream = stream;
    this.#options = options;
  }

  /** @returns {StreamingPlanOptions} */
  get options() {
    return this.#options;
  }

  /**
   * Get post data for streaming.
   * @returns {{ stream: AsyncIterable<any>, options: StreamingPlanOptions }}
   */
  getPostData() {
    return {
      stream: this.#stream,
      options: this.#options,
    };
  }
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Create a new plan.
 * @param {StartPlanOptions} options
 * @returns {Plan}
 */
export function createPlan(options) {
  return new Plan(options);
}

/**
 * Add a task to a plan.
 * @param {Plan} plan
 * @param {AddTaskOptions} options
 * @returns {Promise<PlanTask | null>}
 */
export async function addTask(plan, options) {
  return plan.addTask(options);
}

/**
 * Update a task in a plan.
 * @param {Plan} plan
 * @param {UpdateTaskInput} [update]
 * @returns {Promise<PlanTask | null>}
 */
export async function updateTaskStatus(plan, update) {
  return plan.updateTask(update);
}

/**
 * Get plan progress (0-100).
 * @param {Plan} plan
 * @returns {number}
 */
export function getPlanProgress(plan) {
  const tasks = plan.tasks;
  if (tasks.length === 0) {
    return 0;
  }
  const completed = tasks.filter((t) => t.status === "complete").length;
  return Math.round((completed / tasks.length) * 100);
}
