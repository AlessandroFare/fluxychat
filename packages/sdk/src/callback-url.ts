/**
 * P22-F3: Callback URL Types
 */

export interface StoredCallback {
  url: string;
  originalValue?: string;
}

export interface ProcessedButton {
  type: 'button';
  id?: string;
  label: string;
  style?: string;
  disabled?: boolean;
  value: string;
  actionType?: string;
}

export interface CallbackUrlApi {
  processCardCallbackUrls(card: any): Promise<any>;
  resolveCallbackUrl(token: string): Promise<StoredCallback | null>;
  postToCallbackUrl(url: string, payload: Record<string, unknown>): Promise<{ error?: unknown; status?: number }>;
  cleanupCallbackTokens(): Promise<number>;
}
