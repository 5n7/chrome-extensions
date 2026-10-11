export type Lanes = Float64Array;

export function createLanes(count: number): Lanes {
  return new Float64Array(count).fill(Number.NEGATIVE_INFINITY);
}

export function firstFreeLane(lanes: Lanes, at: number): number {
  for (let lane = 0; lane < lanes.length; lane++) {
    if (lanes[lane]! <= at) return lane;
  }
  return -1;
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
