/**
 * P22-F4: Modal Context Types
 */

export interface ModalStep {
  id: string;
  title: string;
  type: 'text' | 'select' | 'confirm' | 'file';
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
  data: Record<string, any>;
  status: 'active' | 'completed' | 'expired' | 'cancelled';
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;
}
