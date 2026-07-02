/**
 * P22-F4: Modal Context Serialization
 * Adapted from Vercel Chat SDK's modals.ts + StateAdapter.
 *
 * Server-side modal state storage with TTL for multi-step forms.
 * Context survives page refreshes and can be resumed across sessions.
 *
 * Usage:
 *   const modal = await createModal(env, { title: 'Support Ticket', steps: [...] });
 *   await updateModalState(env, modal.id, { currentStep: 1, data: {...} });
 *   const state = await getModalState(env, modal.id);
 */

// =============================================================================
// Modal Types
// =============================================================================

/**
 * @typedef {Object} ModalStep
 * @property {string} id
 * @property {string} title
 * @property {'text' | 'select' | 'confirm' | 'file'} type
 * @property {string} [placeholder]
 * @property {Array<{ label: string, value: string }>} [options]
 * @property {boolean} [required]
 */

/**
 * @typedef {Object} ModalDefinition
 * @property {string} id
 * @property {string} title
 * @property {string} [description]
 * @property {ModalStep[]} steps
 * @property {number} createdAt
 * @property {number} [expiresAt]
 */

/**
 * @typedef {Object} ModalState
 * @property {string} id
 * @property {string} modalId
 * @property {string} userId
 * @property {number} currentStep
 * @property {Record<string, any>} data
 * @property {'active' | 'completed' | 'expired' | 'cancelled'} status
 * @property {number} createdAt
 * @property {number} updatedAt
 * @property {number} [expiresAt]
 */

// =============================================================================
// Modal Context Manager
// =============================================================================

export class ModalContextManager {
  /**
   * @param {import('./types.js').Env} env
   * @param {{ defaultTtl?: number }} options
   */
  constructor(env, options = {}) {
    /** @type {import('./types.js').Env} */
    this.env = env;
    /** @type {number} */
    this.defaultTtl = options.defaultTtl || 3600000; // 1 hour
  }

  /**
   * Create a new modal definition.
   * @param {Omit<ModalDefinition, 'id' | 'createdAt'>} definition
   * @returns {Promise<ModalDefinition>}
   */
  async create(definition) {
    const modal = {
      id: crypto.randomUUID(),
      ...definition,
      createdAt: Date.now(),
    };

    // Store in D1
    await this.env.DB.prepare(
      `INSERT INTO modal_definitions (id, title, description, steps, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(
        modal.id,
        modal.title,
        modal.description || '',
        JSON.stringify(modal.steps),
        modal.createdAt,
        modal.expiresAt || null
      )
      .run();

    return modal;
  }

  /**
   * Get a modal definition by ID.
   * @param {string} modalId
   * @returns {Promise<ModalDefinition | null>}
   */
  async getDefinition(modalId) {
    const result = await this.env.DB.prepare(
      `SELECT * FROM modal_definitions WHERE id = ?`
    )
      .bind(modalId)
      .first();

    if (!result) {
      return null;
    }

    return {
      id: result.id,
      title: result.title,
      description: result.description,
      steps: JSON.parse(result.steps),
      createdAt: result.created_at,
      expiresAt: result.expires_at,
    };
  }

  /**
   * Create a new modal state for a user.
   * @param {string} modalId
   * @param {string} userId
   * @param {Record<string, any>} [initialData]
   * @returns {Promise<ModalState>}
   */
  async createState(modalId, userId, initialData = {}) {
    const state = {
      id: crypto.randomUUID(),
      modalId,
      userId,
      currentStep: 0,
      data: initialData,
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      expiresAt: Date.now() + this.defaultTtl,
    };

    // Store in D1
    await this.env.DB.prepare(
      `INSERT INTO modal_states (id, modal_id, user_id, current_step, data, status, created_at, updated_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        state.id,
        state.modalId,
        state.userId,
        state.currentStep,
        JSON.stringify(state.data),
        state.status,
        state.createdAt,
        state.updatedAt,
        state.expiresAt
      )
      .run();

    return state;
  }

  /**
   * Get a modal state by ID.
   * @param {string} stateId
   * @returns {Promise<ModalState | null>}
   */
  async getState(stateId) {
    const result = await this.env.DB.prepare(
      `SELECT * FROM modal_states WHERE id = ?`
    )
      .bind(stateId)
      .first();

    if (!result) {
      return null;
    }

    // Check expiration
    if (result.expires_at && result.expires_at < Date.now()) {
      await this.updateState(stateId, { status: 'expired' });
      return null;
    }

    return {
      id: result.id,
      modalId: result.modal_id,
      userId: result.user_id,
      currentStep: result.current_step,
      data: JSON.parse(result.data),
      status: result.status,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
      expiresAt: result.expires_at,
    };
  }

  /**
   * Update a modal state.
   * @param {string} stateId
   * @param {Partial<Pick<ModalState, 'currentStep' | 'data' | 'status'>>} updates
   * @returns {Promise<ModalState | null>}
   */
  async updateState(stateId, updates) {
    const state = await this.getState(stateId);
    if (!state) {
      return null;
    }

    const updated = {
      ...state,
      ...updates,
      data: updates.data ? { ...state.data, ...updates.data } : state.data,
      updatedAt: Date.now(),
    };

    // Update in D1
    await this.env.DB.prepare(
      `UPDATE modal_states
       SET current_step = ?, data = ?, status = ?, updated_at = ?
       WHERE id = ?`
    )
      .bind(
        updated.currentStep,
        JSON.stringify(updated.data),
        updated.status,
        updated.updatedAt,
        stateId
      )
      .run();

    return updated;
  }

  /**
   * Complete a modal state.
   * @param {string} stateId
   * @returns {Promise<ModalState | null>}
   */
  async complete(stateId) {
    return this.updateState(stateId, { status: 'completed' });
  }

  /**
   * Cancel a modal state.
   * @param {string} stateId
   * @returns {Promise<ModalState | null>}
   */
  async cancel(stateId) {
    return this.updateState(stateId, { status: 'cancelled' });
  }

  /**
   * Get all active modal states for a user.
   * @param {string} userId
   * @returns {Promise<ModalState[]>}
   */
  async getUserModals(userId) {
    const result = await this.env.DB.prepare(
      `SELECT * FROM modal_states WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC`
    )
      .bind(userId)
      .all();

    return result.results
      .map((row) => ({
        id: row.id,
        modalId: row.modal_id,
        userId: row.user_id,
        currentStep: row.current_step,
        data: JSON.parse(row.data),
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        expiresAt: row.expires_at,
      }))
      .filter((state) => !state.expiresAt || state.expiresAt > Date.now());
  }

  /**
   * Clean up expired modal states.
   * @returns {Promise<number>} Number of cleaned up states
   */
  async cleanup() {
    const result = await this.env.DB.prepare(
      `DELETE FROM modal_states WHERE expires_at < ? OR status IN ('completed', 'cancelled')`
    )
      .bind(Date.now())
      .run();

    return result.meta?.changes || 0;
  }
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Create a new modal definition.
 * @param {import('./types.js').Env} env
 * @param {Omit<ModalDefinition, 'id' | 'createdAt'>} definition
 * @returns {Promise<ModalDefinition>}
 */
export async function createModal(env, definition) {
  const manager = new ModalContextManager(env);
  return manager.create(definition);
}

/**
 * Create a new modal state for a user.
 * @param {import('./types.js').Env} env
 * @param {string} modalId
 * @param {string} userId
 * @param {Record<string, any>} [initialData]
 * @returns {Promise<ModalState>}
 */
export async function createModalState(env, modalId, userId, initialData) {
  const manager = new ModalContextManager(env);
  return manager.createState(modalId, userId, initialData);
}

/**
 * Get a modal state by ID.
 * @param {import('./types.js').Env} env
 * @param {string} stateId
 * @returns {Promise<ModalState | null>}
 */
export async function getModalState(env, stateId) {
  const manager = new ModalContextManager(env);
  return manager.getState(stateId);
}

/**
 * Update a modal state.
 * @param {import('./types.js').Env} env
 * @param {string} stateId
 * @param {Partial<Pick<ModalState, 'currentStep' | 'data' | 'status'>>} updates
 * @returns {Promise<ModalState | null>}
 */
export async function updateModalState(env, stateId, updates) {
  const manager = new ModalContextManager(env);
  return manager.updateState(stateId, updates);
}

// =============================================================================
// Predefined Modals
// =============================================================================

/**
 * Create a support ticket modal.
 * @param {import('./types.js').Env} env
 */
export async function createSupportTicketModal(env) {
  return createModal(env, {
    title: 'Create Support Ticket',
    description: 'Submit a support request',
    steps: [
      {
        id: 'subject',
        title: 'Subject',
        type: 'text',
        placeholder: 'Brief description of your issue',
        required: true,
      },
      {
        id: 'category',
        title: 'Category',
        type: 'select',
        options: [
          { label: 'Bug Report', value: 'bug' },
          { label: 'Feature Request', value: 'feature' },
          { label: 'Question', value: 'question' },
          { label: 'Other', value: 'other' },
        ],
        required: true,
      },
      {
        id: 'description',
        title: 'Description',
        type: 'text',
        placeholder: 'Detailed description of your issue',
        required: true,
      },
      {
        id: 'confirm',
        title: 'Confirm Submission',
        type: 'confirm',
      },
    ],
  });
}

/**
 * Create a feedback modal.
 * @param {import('./types.js').Env} env
 */
export async function createFeedbackModal(env) {
  return createModal(env, {
    title: 'Send Feedback',
    description: 'Help us improve',
    steps: [
      {
        id: 'rating',
        title: 'Rating',
        type: 'select',
        options: [
          { label: 'Excellent', value: '5' },
          { label: 'Good', value: '4' },
          { label: 'Average', value: '3' },
          { label: 'Poor', value: '2' },
          { label: 'Terrible', value: '1' },
        ],
        required: true,
      },
      {
        id: 'comment',
        title: 'Comment',
        type: 'text',
        placeholder: 'Tell us more...',
        required: false,
      },
    ],
  });
}
