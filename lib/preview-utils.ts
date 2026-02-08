import type { Group, MediaAsset, PlaybackState, Screen, TransformState } from "@/lib/preview-types";

export const SCREEN_WIDTH = 1.9;
export const SCREEN_HEIGHT = 1.1;
export const SCREEN_DEPTH = 0.1;

export const DEFAULT_SCREEN_SCALE: [number, number, number] = [1, 1, 1];

export function makePlaybackState(): PlaybackState {
  return {
    isPlaying: true,
    currentTime: 0,
    muted: true,
    lastUpdatedAt: Date.now()
  };
}

export function cloneMedia(media: MediaAsset | null): MediaAsset | null {
  if (!media) {
    return null;
  }

  return {
    ...media,
    id: `M-${Math.random().toString(36).slice(2, 9)}`,
    createdAt: Date.now()
  };
}

export function effectivePlaybackTime(playback: PlaybackState): number {
  if (!playback.isPlaying) {
    return playback.currentTime;
  }

  const elapsed = (Date.now() - playback.lastUpdatedAt) / 1000;
  return Math.max(0, playback.currentTime + elapsed);
}

export function snapshotPlayback(playback: PlaybackState): PlaybackState {
  return {
    ...playback,
    currentTime: effectivePlaybackTime(playback),
    lastUpdatedAt: Date.now()
  };
}

export function togglePlayback(playback: PlaybackState): PlaybackState {
  const snapshot = snapshotPlayback(playback);
  return {
    ...snapshot,
    isPlaying: !playback.isPlaying,
    lastUpdatedAt: Date.now()
  };
}

export function restartPlayback(playback: PlaybackState): PlaybackState {
  return {
    ...playback,
    isPlaying: true,
    currentTime: 0,
    lastUpdatedAt: Date.now()
  };
}

export function setMuted(playback: PlaybackState, muted: boolean): PlaybackState {
  return {
    ...snapshotPlayback(playback),
    muted,
    lastUpdatedAt: Date.now()
  };
}

export function rotateY(
  point: [number, number, number],
  angle: number
): [number, number, number] {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return [point[0] * cos - point[2] * sin, point[1], point[0] * sin + point[2] * cos];
}

export function toWorldPosition(
  local: [number, number, number],
  groupTransform: TransformState
): [number, number, number] {
  const rotated = rotateY(local, groupTransform.rotation[1]);
  return [
    groupTransform.position[0] + rotated[0],
    groupTransform.position[1] + rotated[1],
    groupTransform.position[2] + rotated[2]
  ];
}

export function toLocalPosition(
  world: [number, number, number],
  groupTransform: TransformState
): [number, number, number] {
  const dx: [number, number, number] = [
    world[0] - groupTransform.position[0],
    world[1] - groupTransform.position[1],
    world[2] - groupTransform.position[2]
  ];

  return rotateY(dx, -groupTransform.rotation[1]);
}

export function worldTransformForScreen(
  screen: Screen,
  groups: Record<string, Group>
): TransformState {
  if (!screen.groupId) {
    return screen.transform;
  }

  const group = groups[screen.groupId];
  if (!group) {
    return screen.transform;
  }

  const worldPosition = toWorldPosition(screen.transform.position, group.transform);

  return {
    position: worldPosition,
    rotation: [
      screen.transform.rotation[0] + group.transform.rotation[0],
      screen.transform.rotation[1] + group.transform.rotation[1],
      screen.transform.rotation[2] + group.transform.rotation[2]
    ],
    scale: screen.transform.scale
  };
}

export function makeScreen(
  id: string,
  x: number,
  y: number,
  z: number
): Screen {
  return {
    id,
    transform: {
      position: [x, y, z],
      rotation: [0, 0, 0],
      scale: DEFAULT_SCREEN_SCALE
    },
    groupId: null,
    media: null,
    playback: makePlaybackState()
  };
}
