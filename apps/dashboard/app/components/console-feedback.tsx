import { Banner } from "./ui";

interface ConsoleFeedbackProps {
  error?: string | null;
  notice?: string | null;
  className?: string;
}

export function ConsoleFeedback({ error, notice, className }: ConsoleFeedbackProps) {
  if (!error && !notice) return null;
  return (
    <div className={className}>
      {error ? (
        <div role="alert" aria-live="assertive">
          <Banner variant="error">Error: {error}</Banner>
        </div>
      ) : null}
      {notice ? (
        <div role="status" aria-live="polite">
          <Banner variant="success">{notice}</Banner>
        </div>
      ) : null}
    </div>
  );
}
