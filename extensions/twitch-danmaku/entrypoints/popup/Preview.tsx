import { useEffect, useRef } from "react";

import { DEFAULT_SETTINGS } from "@/utils/settings";
import { createStage, type Stage, type StageConfig } from "@/utils/stage";

import { demoComment } from "./demo-feed";

const RATE_PER_LANE = 0.55;

export function Preview({ config, on }: { config: StageConfig; on: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const stage = useRef<Stage>(undefined);
  const { area, crossingTime, laneCount } = config;

  useEffect(() => {
    const created = createStage(DEFAULT_SETTINGS);
    host.current?.append(created.element);
    stage.current = created;
    return () => {
      created.destroy();
      stage.current = undefined;
    };
  }, []);

  // Runs before the refill below, so a relayout's clear never wipes the fresh Comments.
  useEffect(() => stage.current?.configure(config));

  useEffect(() => {
    const preview = stage.current;
    if (!preview) return;
    preview.clear();
    if (!on) return;
    const ages = Array.from(
      { length: Math.round(laneCount * 1.6) },
      () => Math.random() * crossingTime,
    );
    for (const age of ages.sort((a, b) => b - a))
      preview.offer(age, () => demoComment(Math.random));
    let timer: ReturnType<typeof setTimeout>;
    const arrive = () => {
      preview.offer(0, () => demoComment(Math.random));
      timer = setTimeout(arrive, (Math.random() * 2000) / (laneCount * RATE_PER_LANE));
    };
    arrive();
    return () => clearTimeout(timer);
  }, [on, area, crossingTime, laneCount]);

  return (
    <div className="mini" data-off={on ? undefined : ""}>
      <div className="scene" />
      <div className="areaband" style={{ height: `${area}%` }} />
      <div aria-hidden className="absolute inset-0">
        {Array.from({ length: laneCount - 1 }, (_, index) => (
          <span
            key={index}
            className="lane-guide"
            style={{ top: `${((index + 1) * area) / laneCount}%` }}
          />
        ))}
      </div>
      <div ref={host} className="absolute inset-0" />
    </div>
  );
}
