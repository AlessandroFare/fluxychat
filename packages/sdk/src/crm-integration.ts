export type CrmProvider = "salesforce" | "zendesk" | "hubspot" | "intercom";

export type CrmEntityType = "contact" | "ticket" | "deal" | "lead" | "conversation";

export interface CrmConfig {
  provider: CrmProvider;
  apiKey: string;
  instanceUrl?: string;
  webhookSecret?: string;
  syncIntervalMs?: number;
}

export interface CrmContact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  externalId?: string;
  metadata?: Record<string, unknown>;
  lastSyncedAt: number;
}

export interface CrmTicket {
  id: string;
  subject: string;
  description: string;
  status: "open" | "pending" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "urgent";
  assignee?: string;
  contactId?: string;
  externalId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface SyncResult {
  provider: CrmProvider;
  contactsSynced: number;
  ticketsSynced: number;
  errors: string[];
  syncedAt: number;
}

export interface CrmIntegration {
  getConfig(): CrmConfig;
  updateConfig(updates: Partial<CrmConfig>): void;
  lookupContact(query: { email?: string; name?: string; externalId?: string }): Promise<CrmContact | undefined>;
  createContact(contact: Omit<CrmContact, "id" | "lastSyncedAt">): Promise<CrmContact>;
  getTickets(contactId: string): Promise<CrmTicket[]>;
  createTicket(ticket: Omit<CrmTicket, "id" | "createdAt" | "updatedAt">): Promise<CrmTicket>;
  updateTicket(id: string, updates: Partial<CrmTicket>): Promise<CrmTicket>;
  sync(direction: "in" | "out" | "bidirectional"): Promise<SyncResult>;
  getSyncHistory(): SyncResult[];
}

export function createCrmIntegration(config: CrmConfig): CrmIntegration {
  const contacts = new Map<string, CrmContact>();
  const tickets = new Map<string, CrmTicket>();
  const syncHistory: SyncResult[] = [];
  let currentConfig = { ...config };
  let contactCounter = 0;
  let ticketCounter = 0;

  return {
    getConfig() {
      return { ...currentConfig };
    },

    updateConfig(updates: Partial<CrmConfig>) {
      currentConfig = { ...currentConfig, ...updates };
    },

    async lookupContact(query) {
      const all = Array.from(contacts.values());
      if (query.email) return all.find((c) => c.email === query.email);
      if (query.externalId) return all.find((c) => c.externalId === query.externalId);
      if (query.name) return all.find((c) => c.name.toLowerCase().includes(query.name!.toLowerCase()));
      return undefined;
    },

    async createContact(contact) {
      const id = `crm-contact-${++contactCounter}`;
      const newContact: CrmContact = { ...contact, id, lastSyncedAt: Date.now() };
      contacts.set(id, newContact);
      return { ...newContact };
    },

    async getTickets(contactId: string) {
      return Array.from(tickets.values()).filter((t) => t.contactId === contactId);
    },

    async createTicket(ticket) {
      const id = `crm-ticket-${++ticketCounter}`;
      const newTicket: CrmTicket = {
        ...ticket,
        id,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      tickets.set(id, newTicket);
      return { ...newTicket };
    },

    async updateTicket(id: string, updates: Partial<CrmTicket>) {
      const existing = tickets.get(id);
      if (!existing) throw new Error(`Ticket "${id}" not found`);
      const updated = { ...existing, ...updates, updatedAt: Date.now() };
      tickets.set(id, updated);
      return { ...updated };
    },

    async sync(direction) {
      const errors: string[] = [];
      const result: SyncResult = {
        provider: currentConfig.provider,
        contactsSynced: contacts.size,
        ticketsSynced: tickets.size,
        errors,
        syncedAt: Date.now(),
      };
      syncHistory.push(result);
      return { ...result };
    },

    getSyncHistory() {
      return [...syncHistory];
    },
  };
}
