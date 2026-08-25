/** Sticky chapter bar — locks while realtime / collab / stream scroll past. */
export function LandingPinBar() {
  return (
    <div className="mkt-pin-bar">
      <p className="shrink-0 font-heading text-sm font-semibold tracking-tight text-white sm:text-base">
        Chat, collab, live
      </p>
      <div className="mkt-pin-meter" aria-hidden>
        <span className="mkt-pin-fill" />
      </div>
      <p className="hidden shrink-0 text-xs text-zinc-400 sm:block">Same room kernel</p>
    </div>
  );
}
