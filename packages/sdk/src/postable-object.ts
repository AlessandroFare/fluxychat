/**
 * CP-062: PostableObject formal interface (Vercel Chat SDK parity).
 */

export const POSTABLE_OBJECT = Symbol.for("fluxy.postable");

export interface PostableObjectContext {
  adapter: { slug?: string; postObject?: (threadId: string, kind: string, data: unknown) => Promise<{ id: string; threadId?: string }> } | null;
  messageId: string;
  threadId: string;
  logger?: { info?: (msg: string, meta?: unknown) => void };
}

export interface PostableObject {
  readonly $$typeof: symbol;
  readonly kind: string;
  isSupported(adapter: PostableObjectContext["adapter"]): boolean;
  getFallbackText(): string;
  getPostData(): unknown;
  onPosted(context: PostableObjectContext): void;
}

export function isPostableObject(value: unknown): value is PostableObject {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as PostableObject).$$typeof === POSTABLE_OBJECT
  );
}

export async function postPostableObject(
  obj: PostableObject,
  adapter: PostableObjectContext["adapter"],
  threadId: string,
  postFn: (threadId: string, message: string) => Promise<{ id: string; threadId?: string }>,
  logger?: PostableObjectContext["logger"],
): Promise<void> {
  const createContext = (raw: { id: string; threadId?: string }): PostableObjectContext => ({
    adapter,
    logger,
    messageId: raw.id,
    threadId: raw.threadId ?? threadId,
  });

  if (obj.isSupported(adapter) && adapter?.postObject) {
    const raw = await adapter.postObject(threadId, obj.kind, obj.getPostData());
    obj.onPosted(createContext(raw));
  } else {
    const raw = await postFn(threadId, obj.getFallbackText());
    obj.onPosted(createContext(raw));
  }
}

export function withPostable<T extends abstract new (...args: any[]) => object>(Base: T) {
  abstract class PostableMixin extends Base implements PostableObject {
    get $$typeof() {
      return POSTABLE_OBJECT;
    }

    abstract get kind(): string;

    isSupported(_adapter: PostableObjectContext["adapter"]): boolean {
      return true;
    }

    getFallbackText(): string {
      return "[unsupported object]";
    }

    getPostData(): unknown {
      return {};
    }

    onPosted(_context: PostableObjectContext): void {
      // override in subclass
    }
  }
  return PostableMixin;
}
