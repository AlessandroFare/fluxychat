/**
 * P24-8: Image Generation
 * AI image generation via tool or preset.
 */

export type ImageSize = "256x256" | "512x512" | "1024x1024" | "1024x1792" | "1792x1024";
export type ImageQuality = "standard" | "hd";
export type ImageStyle = "vivid" | "natural";

export interface ImageGenerationConfig {
  provider?: "openai" | "stability" | "replicate" | "flux";
  apiKey?: string;
  model?: string;
  defaultSize?: ImageSize;
  defaultQuality?: ImageQuality;
  defaultStyle?: ImageStyle;
}

export interface ImageGenerationRequest {
  prompt: string;
  negativePrompt?: string;
  size?: ImageSize;
  quality?: ImageQuality;
  style?: ImageStyle;
  n?: number;
  /** URL of an image to edit (for inpainting/editing) */
  image?: string;
  /** Mask for inpainting */
  mask?: string;
}

export interface ImageGenerationResult {
  images: Array<{ url: string; revisedPrompt?: string }>;
  usage?: { input: number; output: number };
}

export interface ImageGenerator {
  generate(request: ImageGenerationRequest): Promise<ImageGenerationResult>;
}

export declare function createImageGenerator(config?: ImageGenerationConfig): ImageGenerator;

/**
 * Tool definition for image generation.
 */
export declare const IMAGE_GENERATION_TOOL: {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: Record<string, unknown>) => Promise<ImageGenerationResult>;
};
