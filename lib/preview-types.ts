export type FitMode = "contain" | "cover" | "stretch";

export type MediaType = "video" | "image";

export type TransformMode = "translate" | "rotate" | "scale";

export type ViewPreset = "front" | "left" | "right" | "top" | "reset";

export interface TransformState {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  muted: boolean;
  lastUpdatedAt: number;
}

export interface MediaAsset {
  id: string;
  type: MediaType;
  url: string;
  name: string;
  mime: string;
  width: number;
  height: number;
  duration?: number;
  fitMode: FitMode;
  createdAt: number;
}

export interface Screen {
  id: string;
  transform: TransformState;
  groupId: string | null;
  media: MediaAsset | null;
  playback: PlaybackState;
}

export interface Group {
  id: string;
  screenIds: string[];
  transform: TransformState;
  media: MediaAsset | null;
  playback: PlaybackState;
}

export interface Toast {
  id: string;
  message: string;
  tone: "info" | "success" | "warning";
}
