export type VideoGenerationStatus = "pending" | "processing" | "completed" | "failed" | "cancelled";

export interface VideoGenerationRequest {
  prompt: string;
  size?: string;
  duration?: number;
  style?: string;
  negativePrompt?: string;
}

export interface VideoAsset {
  url: string;
  contentType: string;
  width: number;
  height: number;
  durationMs: number;
  sizeBytes: number;
}

export interface VideoProgress {
  status: VideoGenerationStatus;
  progress: number;
  stage?: string;
  etaMs?: number;
  output?: VideoAsset;
  error?: string;
}

export interface VideoGenerationJob {
  id: string;
  request: VideoGenerationRequest;
  progress: VideoProgress;
  createdAt: string;
  updatedAt: string;
}

export interface VideoGenerator {
  generate(request: VideoGenerationRequest): Promise<string>;
  getProgress(jobId: string): VideoProgress;
  pollProgress(jobId: string, intervalMs?: number, onProgress?: (progress: VideoProgress) => void): Promise<VideoAsset>;
  cancel(jobId: string): Promise<void>;
  listJobs(): VideoGenerationJob[];
}

function simulateProgress(): VideoProgress {
  const p = Math.random();
  if (p < 0.3) return { status: "processing", progress: Math.round(Math.random() * 50), stage: "generating_frames" };
  if (p < 0.6) return { status: "processing", progress: Math.round(Math.random() * 50 + 50), stage: "compositing" };
  return {
    status: "completed",
    progress: 100,
    output: {
      url: `https://storage.example.com/video/${Date.now()}.mp4`,
      contentType: "video/mp4",
      width: 1920,
      height: 1080,
      durationMs: Math.round(Math.random() * 10000 + 2000),
      sizeBytes: Math.round(Math.random() * 50_000_000 + 1_000_000),
    },
  };
}

export function createVideoGenerator(): VideoGenerator {
  const jobs = new Map<string, VideoGenerationJob>();
  const intervals = new Map<string, ReturnType<typeof setInterval>>();

  return {
    async generate(request: VideoGenerationRequest): Promise<string> {
      const id = `video-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const job: VideoGenerationJob = {
        id,
        request,
        progress: { status: "pending", progress: 0 },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      jobs.set(id, job);

      setTimeout(() => {
        const j = jobs.get(id);
        if (j) {
          j.progress = { status: "processing", progress: 5, stage: "initializing" };
          j.updatedAt = new Date().toISOString();
        }
      }, 100);

      return id;
    },

    getProgress(jobId: string): VideoProgress {
      const job = jobs.get(jobId);
      if (!job) return { status: "failed", progress: 0, error: "Job not found" };
      return { ...job.progress };
    },

    pollProgress(
      jobId: string,
      intervalMs: number = 1000,
      onProgress?: (progress: VideoProgress) => void,
    ): Promise<VideoAsset> {
      return new Promise((resolve, reject) => {
        const id = setInterval(() => {
          const job = jobs.get(jobId);
          if (!job) {
            clearInterval(id);
            intervals.delete(jobId);
            reject(new Error("Job not found"));
            return;
          }

          const progress = simulateProgress();
          job.progress = progress;
          job.updatedAt = new Date().toISOString();
          onProgress?.(progress);

          if (progress.status === "completed" && progress.output) {
            clearInterval(id);
            intervals.delete(jobId);
            resolve(progress.output);
          } else if (progress.status === "failed") {
            clearInterval(id);
            intervals.delete(jobId);
            reject(new Error(progress.error ?? "Generation failed"));
          } else if (progress.status === "cancelled") {
            clearInterval(id);
            intervals.delete(jobId);
            reject(new Error("Generation cancelled"));
          }
        }, intervalMs);

        intervals.set(jobId, id);
      });
    },

    async cancel(jobId: string): Promise<void> {
      const id = intervals.get(jobId);
      if (id) {
        clearInterval(id);
        intervals.delete(jobId);
      }
      const job = jobs.get(jobId);
      if (job) {
        job.progress = { status: "cancelled", progress: 0 };
        job.updatedAt = new Date().toISOString();
      }
    },

    listJobs(): VideoGenerationJob[] {
      return [...jobs.values()];
    },
  };
}
