/**
 * Firefox throws DOMException "Canvas exceeds max size" on
 * CanvasRenderingContext2D.setTransform when the backing store (or the
 * store after the transform scale) is larger than the GPU/browser cap.
 * Excalidraw sets canvas.width = offsetWidth * dpr then setTransform(dpr).
 */

export const MAX_CANVAS_DIM = 8192;
export const MAX_CANVAS_AREA = 16_777_216;

let installCount = 0;
let widthDesc: PropertyDescriptor | undefined;
let heightDesc: PropertyDescriptor | undefined;
let originalSetTransform: typeof CanvasRenderingContext2D.prototype.setTransform | undefined;

export function clampBackingStoreSize(width: number, height: number): { width: number; height: number } {
  let w = Number.isFinite(width) && width > 0 ? Math.floor(width) : 1;
  let h = Number.isFinite(height) && height > 0 ? Math.floor(height) : 1;
  w = Math.min(w, MAX_CANVAS_DIM);
  h = Math.min(h, MAX_CANVAS_DIM);
  const area = w * h;
  if (area > MAX_CANVAS_AREA) {
    const scale = Math.sqrt(MAX_CANVAS_AREA / area);
    w = Math.max(1, Math.floor(w * scale));
    h = Math.max(1, Math.floor(h * scale));
  }
  return { width: w, height: h };
}

export function maxCssBox(dpr: number): { maxWidth: number; maxHeight: number } {
  const scale = Math.max(dpr || 1, 1);
  const maxWidth = Math.max(320, Math.floor(MAX_CANVAS_DIM / scale));
  const maxHeight = Math.max(240, Math.floor(MAX_CANVAS_DIM / scale));
  const maxAreaCss = Math.floor(MAX_CANVAS_AREA / (scale * scale));
  if (maxWidth * maxHeight <= maxAreaCss) return { maxWidth, maxHeight };
  const side = Math.max(240, Math.floor(Math.sqrt(maxAreaCss)));
  return { maxWidth: Math.min(maxWidth, side), maxHeight: Math.min(maxHeight, side) };
}

function patchCanvasDim(
  prop: "width" | "height",
  desc: PropertyDescriptor,
  otherDesc: PropertyDescriptor | undefined,
) {
  Object.defineProperty(HTMLCanvasElement.prototype, prop, {
    configurable: true,
    enumerable: desc.enumerable,
    get: desc.get,
    set(this: HTMLCanvasElement, value: number) {
      const next = clampBackingStoreSize(
        prop === "width" ? value : this.width,
        prop === "height" ? value : this.height,
      );
      desc.set?.call(this, prop === "width" ? next.width : next.height);
      if (prop === "width" && otherDesc?.set && otherDesc.get && otherDesc.get.call(this) !== next.height) {
        otherDesc.set.call(this, next.height);
      }
      if (prop === "height" && otherDesc?.set && otherDesc.get && otherDesc.get.call(this) !== next.width) {
        otherDesc.set.call(this, next.width);
      }
    },
  });
}

export function installCanvasMaxSizeGuard(): () => void {
  if (typeof window === "undefined" || typeof HTMLCanvasElement === "undefined") {
    return () => undefined;
  }

  installCount += 1;
  if (installCount > 1) {
    return () => {
      installCount = Math.max(0, installCount - 1);
    };
  }

  widthDesc = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, "width");
  heightDesc = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, "height");
  if (widthDesc?.set && widthDesc.get) patchCanvasDim("width", widthDesc, heightDesc);
  if (heightDesc?.set && heightDesc.get) patchCanvasDim("height", heightDesc, widthDesc);

  originalSetTransform = CanvasRenderingContext2D.prototype.setTransform;
  const setTransform = originalSetTransform;
  CanvasRenderingContext2D.prototype.setTransform = function patchedSetTransform(
    this: CanvasRenderingContext2D,
    a?: number | DOMMatrix2DInit,
    b?: number,
    c?: number,
    d?: number,
    e?: number,
    f?: number,
  ) {
    try {
      if (
        typeof a === "number" &&
        typeof b === "number" &&
        typeof c === "number" &&
        typeof d === "number"
      ) {
        return Reflect.apply(setTransform, this, [a, b, c, d, e ?? 0, f ?? 0]);
      }
      if (a && typeof a === "object") return Reflect.apply(setTransform, this, [a]);
      return Reflect.apply(setTransform, this, []);
    } catch (err) {
      if (!(err instanceof DOMException)) throw err;
      const clamped = clampBackingStoreSize(this.canvas.width, this.canvas.height);
      if (widthDesc?.set) widthDesc.set.call(this.canvas, clamped.width);
      if (heightDesc?.set) heightDesc.set.call(this.canvas, clamped.height);
      return Reflect.apply(setTransform, this, [1, 0, 0, 1, 0, 0]);
    }
  } as typeof CanvasRenderingContext2D.prototype.setTransform;

  return () => {
    installCount = Math.max(0, installCount - 1);
    if (installCount > 0) return;
    if (widthDesc) Object.defineProperty(HTMLCanvasElement.prototype, "width", widthDesc);
    if (heightDesc) Object.defineProperty(HTMLCanvasElement.prototype, "height", heightDesc);
    if (originalSetTransform) {
      CanvasRenderingContext2D.prototype.setTransform = originalSetTransform;
    }
    widthDesc = undefined;
    heightDesc = undefined;
    originalSetTransform = undefined;
  };
}
