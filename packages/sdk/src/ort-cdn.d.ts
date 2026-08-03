declare module "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/ort.min.mjs" {
  export const InferenceSession: {
    create: (
      url: string,
      options?: Record<string, unknown>,
    ) => Promise<{
      run: (feeds: Record<string, unknown>) => Promise<{ output?: { data: Float32Array } }>;
    }>;
  };
}
