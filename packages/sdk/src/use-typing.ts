"use client";

import React from "react";
import type { FluxyBoundRoom } from "./fluxy-room";
import { useBoundRoom } from "./use-bound-room";

/** Ably `useTyping`: currentlyTyping set + keystroke/stop on a bound room. */
export function useTyping(room?: FluxyBoundRoom) {
  const bound = useBoundRoom(room);
  const [currentlyTyping, setCurrentlyTyping] = React.useState<Set<string>>(
    () => bound.typing.current(),
  );

  React.useEffect(() => {
    setCurrentlyTyping(bound.typing.current());
    return bound.typing.subscribe((event) => {
      setCurrentlyTyping(event.currentlyTyping);
    });
  }, [bound]);

  const keystroke = React.useCallback(() => {
    bound.typing.keystroke();
  }, [bound]);

  const stop = React.useCallback(() => {
    bound.typing.stop();
  }, [bound]);

  return { currentlyTyping, keystroke, start: keystroke, stop };
}
