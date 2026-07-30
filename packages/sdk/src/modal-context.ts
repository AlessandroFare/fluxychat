export type ModalStepType = "text" | "select" | "confirm" | "file";

export interface ModalStep {
  id: string;
  title: string;
  type: ModalStepType;
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
  required?: boolean;
}

export interface ModalDefinition {
  id: string;
  title: string;
  description?: string;
  steps: ModalStep[];
  createdAt: number;
  expiresAt?: number;
}

export interface ModalState {
  id: string;
  modalId: string;
  userId: string;
  currentStep: number;
  data: Record<string, unknown>;
  status: "active" | "completed" | "expired" | "cancelled";
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;
}

export interface ModalBuilder {
  id: string;
  title: string;
  description?: string;
  addStep(step: ModalStep): ModalBuilder;
  build(): ModalDefinition;
}

export interface ModalManager {
  open(modal: ModalDefinition, userId: string): ModalState;
  submit(stateId: string, userId: string, value: unknown, done?: boolean): ModalState;
  cancel(stateId: string, userId: string): boolean;
  getState(stateId: string): ModalState | undefined;
  getUserModals(userId: string): ModalState[];
  cleanup(): number;
}

export function createModal(id: string, title: string, description?: string): ModalBuilder {
  const steps: ModalStep[] = [];

  return {
    id,
    title,
    description,
    addStep(step) {
      steps.push(step);
      return this;
    },
    build(): ModalDefinition {
      return { id, title, description, steps, createdAt: Date.now() };
    },
  };
}

export function createTextStep(id: string, title: string, placeholder?: string, required?: boolean): ModalStep {
  return { id, title, type: "text", placeholder, required };
}

export function createSelectStep(
  id: string,
  title: string,
  options: Array<{ label: string; value: string }>,
  required?: boolean,
): ModalStep {
  return { id, title, type: "select", options, required };
}

export function createConfirmStep(id: string, title: string, required?: boolean): ModalStep {
  return { id, title, type: "confirm", required };
}

export function createFileStep(id: string, title: string, placeholder?: string, required?: boolean): ModalStep {
  return { id, title, type: "file", placeholder, required };
}

export function createModalManager(): ModalManager {
  const states = new Map<string, ModalState>();
  let counter = 0;

  return {
    open(modal, userId) {
      const state: ModalState = {
        id: `${modal.id}-${userId}-${Date.now()}-${++counter}`,
        modalId: modal.id,
        userId,
        currentStep: 0,
        data: {},
        status: "active",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        expiresAt: modal.expiresAt,
      };
      states.set(state.id, state);
      return state;
    },

    submit(stateId, userId, value, done) {
      const state = states.get(stateId);
      if (!state || state.userId !== userId) throw new Error("Modal state not found");
      if (state.status !== "active") throw new Error("Modal is not active");

      state.data[`step-${state.currentStep}`] = value;
      state.updatedAt = Date.now();

      if (done) {
        state.status = "completed";
      } else {
        state.currentStep++;
      }
      return state;
    },

    cancel(stateId, userId) {
      const state = states.get(stateId);
      if (!state || state.userId !== userId) return false;
      state.status = "cancelled";
      state.updatedAt = Date.now();
      return true;
    },

    getState(stateId) {
      const state = states.get(stateId);
      if (!state) return undefined;
      if (state.expiresAt && Date.now() > state.expiresAt) {
        state.status = "expired";
      }
      return state;
    },

    getUserModals(userId) {
      return Array.from(states.values()).filter((s) => s.userId === userId && s.status === "active");
    },

    cleanup() {
      let count = 0;
      const now = Date.now();
      for (const [id, state] of states) {
        if (state.expiresAt && now > state.expiresAt) {
          state.status = "expired";
          count++;
        }
      }
      return count;
    },
  };
}
