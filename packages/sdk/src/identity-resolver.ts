/**
 * P22-F6: Identity Resolver Types
 */

export interface PlatformIdentity {
  platform: string;
  platformUserId: string;
  platformUsername?: string;
  platformData?: Record<string, any>;
}

export interface UnifiedIdentity {
  fluxyUserId: string;
  clerkUserId?: string;
  platforms: PlatformIdentity[];
  metadata?: Record<string, any>;
}
