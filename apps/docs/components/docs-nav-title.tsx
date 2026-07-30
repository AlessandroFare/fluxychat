export function DocsNavTitle() {
  return (
    <span className="inline-flex items-center gap-2.5 font-semibold tracking-tight">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/fluxychat-icon.svg"
        alt=""
        width={26}
        height={26}
        className="rounded-md shadow-sm"
      />
      FluxyChat
    </span>
  );
}
