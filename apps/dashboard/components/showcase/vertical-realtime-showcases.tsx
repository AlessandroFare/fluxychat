"use client";

import React from "react";
import {
  FeatureCodePanel,
  FeaturePreviewFrame,
} from "./feature-code-panel";
import { ShowcaseSessionGate } from "./showcase-session-gate";
import {
  getRealtimeFeature,
  type RealtimeFeatureId,
} from "./realtime-feature-content";
import type { ShowcaseSession } from "./use-showcase-session";
import { CollabShowcasePanel } from "./panels/collab-showcase-panel";
import { FluxyStreamShowcasePanel } from "./panels/fluxy-stream-showcase-panel";
import { GameShowcasePanel } from "./panels/game-showcase-panel";
import { IoTShowcasePanel } from "./panels/iot-showcase-panel";
import { FleetShowcasePanel } from "./panels/fleet-showcase-panel";
import { SpatialShowcasePanel } from "./panels/spatial-showcase-panel";
import { OmnichannelShowcasePanel } from "./panels/omnichannel-showcase-panel";
import { EduShowcasePanel } from "./panels/edu-showcase-panel";

const PANELS: Partial<
  Record<RealtimeFeatureId, React.ComponentType<{ session: ShowcaseSession }>>
> = {
  collab: CollabShowcasePanel,
  "fluxy-stream": FluxyStreamShowcasePanel,
  game: GameShowcasePanel,
  iot: IoTShowcasePanel,
  fleet: FleetShowcasePanel,
  spatial: SpatialShowcasePanel,
  "edu-live": EduShowcasePanel,
  omnichannel: OmnichannelShowcasePanel,
};

export function VerticalRealtimeShowcase({
  featureId,
  session,
}: {
  featureId: RealtimeFeatureId;
  session: ShowcaseSession;
}) {
  const feature = getRealtimeFeature(featureId);
  const Panel = PANELS[featureId];

  return (
    <div className="grid min-w-0 gap-8 overflow-x-hidden lg:grid-cols-2 lg:items-start">
      <FeatureCodePanel feature={feature} />

      <FeaturePreviewFrame label={`${feature.label} preview`} className="min-h-[28rem]">
        <ShowcaseSessionGate session={session}>
          {Panel ? <Panel session={session} /> : null}
        </ShowcaseSessionGate>
      </FeaturePreviewFrame>
    </div>
  );
}
