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
      {error ? <Banner variant="error">Error: {error}</Banner> : null}
      {notice ? <Banner variant="success">{notice}</Banner> : null}
    </div>
  );
}
