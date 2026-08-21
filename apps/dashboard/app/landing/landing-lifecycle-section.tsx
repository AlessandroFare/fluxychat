import dynamic from "next/dynamic";

const MessageLifecycleSection = dynamic(
  () =>
    import("~/components/marketing/message-lifecycle-section").then((m) => ({
      default: m.MessageLifecycleSection,
    })),
  {
    loading: () => (
      <section
        id="lifecycle"
        className="scroll-mt-20 border-b border-[var(--mkt-border)] px-4 py-16 sm:px-6"
        aria-busy="true"
      />
    ),
  },
);

export function LandingLifecycleSection() {
  return <MessageLifecycleSection />;
}
