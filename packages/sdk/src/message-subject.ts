export type SubjectResourceType = "github-issue" | "github-pr" | "linear-issue" | "jira-ticket" | "url";

export interface MessageSubject {
  type: SubjectResourceType;
  id: string;
  title?: string;
  url?: string;
  status?: string;
  metadata?: Record<string, unknown>;
}

export function createSubject(type: SubjectResourceType, id: string, data?: Partial<MessageSubject>): MessageSubject {
  return { type, id, title: data?.title, url: data?.url, status: data?.status, metadata: data?.metadata };
}

export function subjectToString(subject: MessageSubject): string {
  const prefix = subject.type === "github-issue" ? "#" : subject.type === "github-pr" ? "!" :
    subject.type === "linear-issue" ? "LIN-" : subject.type === "jira-ticket" ? "JIRA-" : "";
  return `${prefix}${subject.id}${subject.title ? `: ${subject.title}` : ""}`;
}

export function subjectToUrl(subject: MessageSubject): string | null {
  if (subject.url) return subject.url;
  if (subject.type === "github-issue") return `https://github.com/issues/${subject.id}`;
  if (subject.type === "github-pr") return `https://github.com/pulls/${subject.id}`;
  return null;
}
