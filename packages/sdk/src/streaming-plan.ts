/**
 * P22-F7: StreamingPlan / Plan Types
 */

export type StreamingPlanTaskStatus = 'pending' | 'in_progress' | 'complete' | 'error';

export interface StreamingPlanTask {
  id: string;
  status: StreamingPlanTaskStatus;
  title: string;
}

export interface StreamingPlanModel {
  tasks: StreamingPlanModelTask[];
  title: string;
}

export interface StreamingPlanModelTask {
  id: string;
  status: StreamingPlanTaskStatus;
  title: string;
  details?: string;
  output?: string;
}

export type StreamingPlanContent = string | string[];

export interface StartStreamingPlanOptions {
  /** Initial plan title and first task title */
  initialMessage: StreamingPlanContent;
}

export interface AddStreamingPlanTaskOptions {
  /** Task title */
  title: StreamingPlanContent;
  /** Task details/substeps */
  children?: StreamingPlanContent;
}

export interface UpdateStreamingPlanTaskInput {
  /** Task ID to update. If omitted, updates the last in_progress task */
  id?: string;
  /** Task output/results */
  output?: StreamingPlanContent;
  /** Optional status override */
  status?: StreamingPlanTaskStatus;
}

export interface CompleteStreamingPlanOptions {
  /** Final plan title shown when completed */
  completeMessage: StreamingPlanContent;
}

export interface StreamingPlanOptions {
  /** How to display tasks */
  groupTasks?: 'timeline' | 'grouped';
  /** Elements to append when stream completes */
  endWith?: any[];
  /** Min interval between plan updates */
  updateIntervalMs?: number;
}

export interface StreamingPlanApi {
  readonly $$typeof: symbol;
  readonly kind: string;
  isSupported(adapter: any): boolean;
  getPostData(): StreamingPlanModel;
  getFallbackText(): string;
  onPosted(context: { adapter: any; messageId: string; threadId: string; logger?: any }): void;
  readonly id: string;
  readonly threadId: string;
  readonly title: string;
  readonly tasks: StreamingPlanTask[];
  readonly currentTask: StreamingPlanTask | null;
  addTask(options: AddStreamingPlanTaskOptions): Promise<StreamingPlanTask | null>;
  updateTask(update?: UpdateStreamingPlanTaskInput | StreamingPlanContent): Promise<StreamingPlanTask | null>;
  reset(options: StartStreamingPlanOptions): Promise<StreamingPlanTask | null>;
  complete(options: CompleteStreamingPlanOptions): Promise<void>;
}

export interface StreamingPlanWrapper<T = any> {
  readonly options: StreamingPlanOptions;
  getPostData(): { stream: AsyncIterable<T>; options: StreamingPlanOptions };
}
