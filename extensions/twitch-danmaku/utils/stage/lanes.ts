export type Lanes = Float64Array;

export function createLanes(count: number): Lanes {
  return new Float64Array(count).fill(Number.NEGATIVE_INFINITY);
}

export function firstFreeLane(lanes: Lanes, at: number): number {
  return lanes.findIndex((busyUntil) => busyUntil <= at);
}

export function occupyLane(
  lanes: Lanes,
  lane: number,
  spawn: number,
  length: number,
  crossingTime: number,
): void {
  lanes[lane] = Math.max(lanes[lane]!, spawn + crossingTime * length);
}

export function travelTime(length: number, crossingTime: number): number {
  return crossingTime * (1 + length);
}
