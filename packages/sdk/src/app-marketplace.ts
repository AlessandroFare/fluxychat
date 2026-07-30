export type AppGrantScope = "read:messages" | "write:messages" | "read:users" | "read:channels" | "write:channels" | "read:files" | "write:files" | "admin:all";

export interface AppManifest {
  appId: string;
  name: string;
  version: string;
  description?: string;
  developer: string;
  homepageUrl?: string;
  permissions: AppGrantScope[];
  webhookUrl?: string;
  iconUrl?: string;
  signedBy?: string;
  signature?: string;
  createdAt: number;
}

export interface AppReview {
  status: "pending" | "approved" | "rejected" | "changes_requested";
  reviewer?: string;
  reviewedAt?: number;
  notes?: string;
}

export interface AppQuota {
  maxRequestsPerMinute: number;
  maxConcurrentInstalls: number;
  maxWebhookCallsPerDay: number;
}

export interface InstalledApp {
  manifest: AppManifest;
  review: AppReview;
  quota: AppQuota;
  installedAt: number;
  installedBy: string;
  tenantId: string;
  active: boolean;
  usage: { requestsToday: number; webhookCallsToday: number };
}

export interface AppMarketplace {
  submitManifest(manifest: AppManifest): AppReview;
  submitForReview(appId: string): AppReview;
  approveApp(appId: string, reviewer: string): AppReview;
  rejectApp(appId: string, reviewer: string, reason: string): AppReview;
  installApp(appId: string, tenantId: string, installedBy: string): InstalledApp;
  uninstallApp(appId: string, tenantId: string): boolean;
  revokeApp(appId: string, tenantId: string): boolean;
  getApp(appId: string): AppManifest | undefined;
  getInstalledApps(tenantId: string): InstalledApp[];
  getAppReview(appId: string): AppReview | undefined;
  checkQuota(appId: string, tenantId: string): boolean;
}

export function createAppMarketplace(): AppMarketplace {
  const manifests = new Map<string, AppManifest>();
  const reviews = new Map<string, AppReview>();
  const installs = new Map<string, InstalledApp>();

  function installKey(appId: string, tenantId: string) {
    return `${appId}:${tenantId}`;
  }

  return {
    submitManifest(manifest: AppManifest) {
      manifests.set(manifest.appId, manifest);
      const review: AppReview = { status: "pending" };
      reviews.set(manifest.appId, review);
      return { ...review };
    },

    submitForReview(appId: string) {
      const review = reviews.get(appId) ?? { status: "pending" };
      review.status = "pending";
      reviews.set(appId, review);
      return { ...review };
    },

    approveApp(appId: string, reviewer: string) {
      const review: AppReview = { status: "approved", reviewer, reviewedAt: Date.now() };
      reviews.set(appId, review);
      return { ...review };
    },

    rejectApp(appId: string, reviewer: string, reason: string) {
      const review: AppReview = { status: "rejected", reviewer, reviewedAt: Date.now(), notes: reason };
      reviews.set(appId, review);
      return { ...review };
    },

    installApp(appId: string, tenantId: string, installedBy: string) {
      const manifest = manifests.get(appId);
      if (!manifest) throw new Error(`App "${appId}" not found`);
      const review = reviews.get(appId);
      if (review?.status !== "approved") throw new Error(`App "${appId}" is not approved`);
      const key = installKey(appId, tenantId);
      if (installs.has(key)) throw new Error(`App "${appId}" already installed for tenant "${tenantId}"`);
      const app: InstalledApp = {
        manifest,
        review: { ...review! },
        quota: { maxRequestsPerMinute: 100, maxConcurrentInstalls: 10, maxWebhookCallsPerDay: 10000 },
        installedAt: Date.now(),
        installedBy,
        tenantId,
        active: true,
        usage: { requestsToday: 0, webhookCallsToday: 0 },
      };
      installs.set(key, app);
      return { ...app };
    },

    uninstallApp(appId: string, tenantId: string) {
      return installs.delete(installKey(appId, tenantId));
    },

    revokeApp(appId: string, tenantId: string) {
      const key = installKey(appId, tenantId);
      const app = installs.get(key);
      if (!app) return false;
      app.active = false;
      return true;
    },

    getApp(appId: string) {
      return manifests.get(appId);
    },

    getInstalledApps(tenantId: string) {
      return Array.from(installs.values()).filter((a) => a.tenantId === tenantId);
    },

    getAppReview(appId: string) {
      return reviews.get(appId);
    },

    checkQuota(appId: string, tenantId: string) {
      const key = installKey(appId, tenantId);
      const app = installs.get(key);
      if (!app || !app.active) return false;
      return app.usage.requestsToday < app.quota.maxRequestsPerMinute;
    },
  };
}
