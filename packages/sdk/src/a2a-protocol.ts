export type A2AStatus = "pending" | "working" | "completed" | "failed" | "cancelled";

export interface A2AEnvelope {
  id: string;
  source: string;
  target: string;
  taskId: string;
  status: A2AStatus;
  extensions: Record<string, unknown>;
}

export interface A2ATask {
  id: string;
  title: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  status: A2AStatus;
  artifacts: A2AArtifact[];
  createdAt: number;
  updatedAt: number;
}

export interface A2AArtifact {
  id: string;
  name: string;
  mimeType: string;
  data: unknown;
  extensions: Record<string, unknown>;
}

export interface A2AClient {
  createTask(task: Pick<A2ATask, "title" | "input">): A2ATask;
  getTask(taskId: string): A2ATask | undefined;
  listTasks(): A2ATask[];
  sendEnvelope(envelope: Omit<A2AEnvelope, "id">): A2AEnvelope;
  receiveEnvelope(agentId: string): A2AEnvelope[];
  acknowledgeTask(taskId: string): A2ATask;
  completeTask(taskId: string, output: Record<string, unknown>, artifacts?: A2AArtifact[]): A2ATask;
  failTask(taskId: string, error: string): A2ATask;
  cancelTask(taskId: string): A2ATask;
  addArtifact(taskId: string, artifact: Omit<A2AArtifact, "id">): A2AArtifact;
  preserveExtensions(taskId: string, extensions: Record<string, unknown>): void;
}

export function createA2AClient(): A2AClient {
  const tasks = new Map<string, A2ATask>();
  const envelopes = new Map<string, A2AEnvelope[]>();
  let taskCounter = 0;
  let envelopeCounter = 0;
  let artifactCounter = 0;

  return {
    createTask(input) {
      const id = `task-${++taskCounter}`;
      const task: A2ATask = {
        id, title: input.title, input: input.input,
        status: "pending", artifacts: [],
        createdAt: Date.now(), updatedAt: Date.now(),
      };
      tasks.set(id, task);
      return { ...task, artifacts: [...task.artifacts] };
    },

    getTask(taskId) {
      const t = tasks.get(taskId);
      return t ? { ...t, artifacts: [...t.artifacts] } : undefined;
    },

    listTasks() {
      return Array.from(tasks.values()).map((t) => ({ ...t, artifacts: [...t.artifacts] }));
    },

    sendEnvelope(input) {
      const envelope: A2AEnvelope = {
        ...input, id: `env-${++envelopeCounter}`,
      };
      if (!envelopes.has(envelope.target)) envelopes.set(envelope.target, []);
      envelopes.get(envelope.target)!.push(envelope);
      return { ...envelope };
    },

    receiveEnvelope(agentId) {
      const msgs = envelopes.get(agentId) ?? [];
      envelopes.set(agentId, []);
      return msgs.map((e) => ({ ...e }));
    },

    acknowledgeTask(taskId) {
      const task = tasks.get(taskId);
      if (!task) throw new Error(`Task "${taskId}" not found`);
      task.status = "working";
      task.updatedAt = Date.now();
      return { ...task, artifacts: [...task.artifacts] };
    },

    completeTask(taskId, output, artifacts = []) {
      const task = tasks.get(taskId);
      if (!task) throw new Error(`Task "${taskId}" not found`);
      task.status = "completed";
      task.output = output;
      task.updatedAt = Date.now();
      for (const a of artifacts) {
        task.artifacts.push({ ...a, id: `art-${++artifactCounter}` });
      }
      return { ...task, artifacts: [...task.artifacts] };
    },

    failTask(taskId, error) {
      const task = tasks.get(taskId);
      if (!task) throw new Error(`Task "${taskId}" not found`);
      task.status = "failed";
      task.output = { error };
      task.updatedAt = Date.now();
      return { ...task, artifacts: [...task.artifacts] };
    },

    cancelTask(taskId) {
      const task = tasks.get(taskId);
      if (!task) throw new Error(`Task "${taskId}" not found`);
      task.status = "cancelled";
      task.updatedAt = Date.now();
      return { ...task, artifacts: [...task.artifacts] };
    },

    addArtifact(taskId, input) {
      const task = tasks.get(taskId);
      if (!task) throw new Error(`Task "${taskId}" not found`);
      const artifact: A2AArtifact = { ...input, id: `art-${++artifactCounter}` };
      task.artifacts.push(artifact);
      task.updatedAt = Date.now();
      return { ...artifact };
    },

    preserveExtensions(taskId, extensions) {
      const task = tasks.get(taskId);
      if (!task) throw new Error(`Task "${taskId}" not found`);
      task.artifacts.push({
        id: `art-${++artifactCounter}`,
        name: "_extensions", mimeType: "application/json",
        data: extensions, extensions: {},
      });
    },
  };
}
