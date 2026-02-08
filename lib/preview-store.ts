"use client";

import { create } from "zustand";

import type {
  FitMode,
  Group,
  MediaAsset,
  PlaybackState,
  Screen,
  Toast,
  TransformMode,
  TransformState,
  ViewPreset
} from "@/lib/preview-types";
import {
  cloneMedia,
  effectivePlaybackTime,
  makePlaybackState,
  makeScreen,
  restartPlayback,
  setMuted,
  snapshotPlayback,
  togglePlayback,
  worldTransformForScreen
} from "@/lib/preview-utils";

const RENTED_SCREENS = 3;

type SelectScreenOptions = {
  append?: boolean;
  forceSingle?: boolean;
};

interface PreviewStore {
  rentedScreens: number;
  screens: Record<string, Screen>;
  groups: Record<string, Group>;
  selectedScreenIds: string[];
  activeScreenId: string | null;
  selectedGroupId: string | null;
  focusedScreenId: string | null;
  hoveredScreenId: string | null;
  transformMode: TransformMode;
  cameraView: ViewPreset;
  cameraRevision: number;
  accessCode: string | null;
  customerName: string;
  accessUnlocked: boolean;
  toasts: Toast[];
  nextScreenIndex: number;
  nextGroupIndex: number;
  setAccess: (code: string, name?: string) => void;
  clearAccess: () => void;
  addToast: (message: string, tone?: Toast["tone"]) => void;
  dismissToast: (id: string) => void;
  setHoveredScreen: (screenId: string | null) => void;
  setTransformMode: (mode: TransformMode) => void;
  setViewPreset: (view: ViewPreset) => void;
  selectScreen: (screenId: string, options?: SelectScreenOptions) => void;
  selectGroup: (groupId: string, focusedScreenId?: string | null) => void;
  clearSelection: () => void;
  addScreen: () => void;
  removeSelected: () => void;
  connectSelected: () => void;
  ungroupSelection: () => void;
  detachScreen: (screenId: string) => void;
  setScreenTransform: (screenId: string, transform: TransformState) => void;
  setGroupTransform: (groupId: string, transform: TransformState) => void;
  assignMediaToScreen: (screenId: string, media: MediaAsset) => void;
  assignMediaToGroup: (groupId: string, media: MediaAsset) => void;
  setFitModeForScreen: (screenId: string, fitMode: FitMode) => void;
  setFitModeForGroup: (groupId: string, fitMode: FitMode) => void;
  togglePlaybackForScreen: (screenId: string) => void;
  togglePlaybackForGroup: (groupId: string) => void;
  setMutedForScreen: (screenId: string, muted: boolean) => void;
  setMutedForGroup: (groupId: string, muted: boolean) => void;
  restartPlaybackForScreen: (screenId: string) => void;
  restartPlaybackForGroup: (groupId: string) => void;
  removeMediaFromScreen: (screenId: string) => void;
  removeMediaFromGroup: (groupId: string) => void;
}

function initialScreens(): Record<string, Screen> {
  return {
    "S-1": makeScreen("S-1", -2.2, 1.2, 0),
    "S-2": makeScreen("S-2", 0, 1.2, 0),
    "S-3": makeScreen("S-3", 2.2, 1.2, 0)
  };
}

function makeToast(message: string, tone: Toast["tone"] = "info"): Toast {
  return {
    id: `T-${Math.random().toString(36).slice(2, 9)}`,
    message,
    tone
  };
}

function dissolveGroupIfNeeded(
  groupId: string,
  screens: Record<string, Screen>,
  groups: Record<string, Group>
): void {
  const group = groups[groupId];
  if (!group || group.screenIds.length >= 2) {
    return;
  }

  if (group.screenIds.length === 1) {
    const remaining = screens[group.screenIds[0]];
    if (remaining) {
      const world = worldTransformForScreen(remaining, groups);
      const playback = group.media ? snapshotPlayback(group.playback) : remaining.playback;
      screens[remaining.id] = {
        ...remaining,
        groupId: null,
        transform: world,
        media: group.media ? cloneMedia(group.media) : remaining.media,
        playback
      };
    }
  }

  delete groups[groupId];
}

function detachScreenInternal(
  screenId: string,
  screens: Record<string, Screen>,
  groups: Record<string, Group>
): string | null {
  const screen = screens[screenId];
  if (!screen || !screen.groupId) {
    return null;
  }

  const groupId = screen.groupId;
  const group = groups[groupId];
  if (!group) {
    screens[screenId] = { ...screen, groupId: null };
    return null;
  }

  const world = worldTransformForScreen(screen, groups);
  const detachedPlayback = group.media ? snapshotPlayback(group.playback) : snapshotPlayback(screen.playback);

  screens[screenId] = {
    ...screen,
    groupId: null,
    transform: world,
    media: group.media ? cloneMedia(group.media) : screen.media,
    playback: detachedPlayback
  };

  groups[groupId] = {
    ...group,
    screenIds: group.screenIds.filter((id) => id !== screenId)
  };

  dissolveGroupIfNeeded(groupId, screens, groups);
  return groupId;
}

function removeScreensById(
  ids: string[],
  screens: Record<string, Screen>,
  groups: Record<string, Group>
): void {
  const idSet = new Set(ids);
  for (const id of ids) {
    const screen = screens[id];
    if (!screen) {
      continue;
    }

    const groupId = screen.groupId;
    delete screens[id];

    if (groupId && groups[groupId]) {
      groups[groupId] = {
        ...groups[groupId],
        screenIds: groups[groupId].screenIds.filter((memberId) => memberId !== id)
      };
      dissolveGroupIfNeeded(groupId, screens, groups);
    }
  }

  for (const [groupId, group] of Object.entries(groups)) {
    const filtered = group.screenIds.filter((screenId) => !idSet.has(screenId));
    if (filtered.length !== group.screenIds.length) {
      groups[groupId] = { ...group, screenIds: filtered };
      dissolveGroupIfNeeded(groupId, screens, groups);
    }
  }
}

function nextPlaybackState(playback: PlaybackState): PlaybackState {
  return {
    ...playback,
    currentTime: effectivePlaybackTime(playback),
    lastUpdatedAt: Date.now()
  };
}

export const usePreviewStore = create<PreviewStore>((set) => ({
  rentedScreens: RENTED_SCREENS,
  screens: initialScreens(),
  groups: {},
  selectedScreenIds: [],
  activeScreenId: null,
  selectedGroupId: null,
  focusedScreenId: null,
  hoveredScreenId: null,
  transformMode: "translate",
  cameraView: "reset",
  cameraRevision: 0,
  accessCode: null,
  customerName: "Mark",
  accessUnlocked: false,
  toasts: [],
  nextScreenIndex: 4,
  nextGroupIndex: 1,

  setAccess: (code, name) => {
    const trimmedCode = code.trim();
    if (!trimmedCode) {
      return;
    }

    set((state) => ({
      accessCode: trimmedCode,
      customerName: (name || state.customerName || "Mark").trim() || "Mark",
      accessUnlocked: true,
      toasts: [...state.toasts, makeToast(`Bienvenue, ${(name || state.customerName || "Mark").trim() || "Mark"} - 3 ecrans loues`, "success")]
    }));
  },

  clearAccess: () => {
    set(() => ({
      accessCode: null,
      accessUnlocked: false
    }));
  },

  addToast: (message, tone = "info") => {
    set((state) => ({ toasts: [...state.toasts, makeToast(message, tone)] }));
  },

  dismissToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
  },

  setHoveredScreen: (screenId) => {
    set(() => ({ hoveredScreenId: screenId }));
  },

  setTransformMode: (mode) => {
    set(() => ({ transformMode: mode }));
  },

  setViewPreset: (view) => {
    set((state) => ({
      cameraView: view,
      cameraRevision: state.cameraRevision + 1
    }));
  },

  selectScreen: (screenId, options) => {
    set((state) => {
      const screen = state.screens[screenId];
      if (!screen) {
        return state;
      }

      if (screen.groupId && !options?.forceSingle) {
        return {
          selectedGroupId: screen.groupId,
          selectedScreenIds: [],
          activeScreenId: null,
          focusedScreenId: screenId
        };
      }

      if (options?.append) {
        const exists = state.selectedScreenIds.includes(screenId);
        const selectedScreenIds = exists
          ? state.selectedScreenIds.filter((id) => id !== screenId)
          : [...state.selectedScreenIds, screenId];

        return {
          selectedScreenIds,
          activeScreenId: screenId,
          selectedGroupId: null,
          focusedScreenId: screenId
        };
      }

      return {
        selectedScreenIds: [screenId],
        activeScreenId: screenId,
        selectedGroupId: null,
        focusedScreenId: screenId
      };
    });
  },

  selectGroup: (groupId, focusedScreenId) => {
    set((state) => {
      if (!state.groups[groupId]) {
        return state;
      }

      return {
        selectedGroupId: groupId,
        selectedScreenIds: [],
        activeScreenId: null,
        focusedScreenId: focusedScreenId ?? state.focusedScreenId
      };
    });
  },

  clearSelection: () => {
    set(() => ({
      selectedScreenIds: [],
      activeScreenId: null,
      selectedGroupId: null,
      focusedScreenId: null
    }));
  },

  addScreen: () => {
    set((state) => {
      const id = `S-${state.nextScreenIndex}`;
      const worldPositions = Object.values(state.screens).map((screen) =>
        worldTransformForScreen(screen, state.groups).position
      );
      const rightMostX = worldPositions.length
        ? Math.max(...worldPositions.map((position) => position[0]))
        : 0;
      const y = worldPositions.length ? worldPositions[0][1] : 1.2;

      const screen = makeScreen(id, rightMostX + 2.2, y, 0);

      return {
        screens: {
          ...state.screens,
          [id]: screen
        },
        nextScreenIndex: state.nextScreenIndex + 1,
        selectedScreenIds: [id],
        activeScreenId: id,
        selectedGroupId: null,
        focusedScreenId: id,
        toasts: [
          ...state.toasts,
          makeToast(`Ecran ${id} ajoute${Object.keys(state.screens).length + 1 > state.rentedScreens ? " (virtuel)" : ""}`, "info")
        ]
      };
    });
  },

  removeSelected: () => {
    set((state) => {
      const screens = { ...state.screens };
      const groups = { ...state.groups };
      let removedCount = 0;

      if (state.selectedGroupId && groups[state.selectedGroupId]) {
        const ids = [...groups[state.selectedGroupId].screenIds];
        removedCount = ids.length;
        removeScreensById(ids, screens, groups);
      } else if (state.activeScreenId) {
        removedCount = screens[state.activeScreenId] ? 1 : 0;
        removeScreensById([state.activeScreenId], screens, groups);
      } else if (state.selectedScreenIds.length) {
        const uniqueIds = Array.from(new Set(state.selectedScreenIds));
        removedCount = uniqueIds.filter((id) => screens[id]).length;
        removeScreensById(uniqueIds, screens, groups);
      }

      if (!removedCount) {
        return state;
      }

      return {
        screens,
        groups,
        selectedScreenIds: [],
        activeScreenId: null,
        selectedGroupId: null,
        focusedScreenId: null,
        toasts: [...state.toasts, makeToast(`${removedCount} ecran(s) supprime(s)`, "warning")]
      };
    });
  },

  connectSelected: () => {
    set((state) => {
      const selectedIds = state.selectedScreenIds.filter((id) => {
        const screen = state.screens[id];
        return Boolean(screen && !screen.groupId);
      });

      if (selectedIds.length < 2) {
        return {
          toasts: [...state.toasts, makeToast("Selectionnez au moins 2 ecrans solo pour connecter", "warning")]
        };
      }

      const screens = { ...state.screens };
      const groups = { ...state.groups };
      const worldPositions = selectedIds.map((id) => screens[id].transform.position);
      const centroid: [number, number, number] = [
        worldPositions.reduce((sum, value) => sum + value[0], 0) / worldPositions.length,
        worldPositions.reduce((sum, value) => sum + value[1], 0) / worldPositions.length,
        worldPositions.reduce((sum, value) => sum + value[2], 0) / worldPositions.length
      ];

      const groupId = `G-${state.nextGroupIndex}`;
      groups[groupId] = {
        id: groupId,
        screenIds: selectedIds,
        transform: {
          position: centroid,
          rotation: [0, 0, 0],
          scale: [1, 1, 1]
        },
        media: null,
        playback: makePlaybackState()
      };

      for (const id of selectedIds) {
        const screen = screens[id];
        screens[id] = {
          ...screen,
          groupId,
          transform: {
            ...screen.transform,
            position: [
              screen.transform.position[0] - centroid[0],
              screen.transform.position[1] - centroid[1],
              screen.transform.position[2] - centroid[2]
            ]
          }
        };
      }

      return {
        screens,
        groups,
        selectedScreenIds: [],
        activeScreenId: null,
        selectedGroupId: groupId,
        focusedScreenId: selectedIds[0],
        nextGroupIndex: state.nextGroupIndex + 1,
        toasts: [...state.toasts, makeToast(`Groupe ${groupId} cree`, "success")]
      };
    });
  },

  ungroupSelection: () => {
    set((state) => {
      const screens = { ...state.screens };
      const groups = { ...state.groups };
      let disconnectedCount = 0;

      if (state.selectedGroupId && groups[state.selectedGroupId]) {
        const group = groups[state.selectedGroupId];
        const playbackSnapshot = snapshotPlayback(group.playback);

        for (const screenId of group.screenIds) {
          const screen = screens[screenId];
          if (!screen) {
            continue;
          }

          const world = worldTransformForScreen(screen, groups);
          screens[screenId] = {
            ...screen,
            groupId: null,
            transform: world,
            media: group.media ? cloneMedia(group.media) : screen.media,
            playback: group.media ? { ...playbackSnapshot } : nextPlaybackState(screen.playback)
          };
          disconnectedCount += 1;
        }

        delete groups[state.selectedGroupId];
      } else if (state.activeScreenId) {
        const screen = screens[state.activeScreenId];
        if (screen?.groupId) {
          detachScreenInternal(state.activeScreenId, screens, groups);
          disconnectedCount = 1;
        }
      }

      if (!disconnectedCount) {
        return {
          toasts: [...state.toasts, makeToast("Aucun groupe selectionne", "warning")]
        };
      }

      return {
        screens,
        groups,
        selectedScreenIds: [],
        selectedGroupId: null,
        activeScreenId: null,
        focusedScreenId: null,
        toasts: [...state.toasts, makeToast("Groupe deconnecte", "success")]
      };
    });
  },

  detachScreen: (screenId) => {
    set((state) => {
      const screen = state.screens[screenId];
      if (!screen?.groupId) {
        return state;
      }

      const screens = { ...state.screens };
      const groups = { ...state.groups };
      detachScreenInternal(screenId, screens, groups);

      return {
        screens,
        groups,
        selectedScreenIds: [screenId],
        activeScreenId: screenId,
        selectedGroupId: null,
        focusedScreenId: screenId,
        toasts: [...state.toasts, makeToast(`Ecran ${screenId} detache`, "success")]
      };
    });
  },

  setScreenTransform: (screenId, transform) => {
    set((state) => {
      const screen = state.screens[screenId];
      if (!screen) {
        return state;
      }

      return {
        screens: {
          ...state.screens,
          [screenId]: {
            ...screen,
            transform
          }
        }
      };
    });
  },

  setGroupTransform: (groupId, transform) => {
    set((state) => {
      const group = state.groups[groupId];
      if (!group) {
        return state;
      }

      return {
        groups: {
          ...state.groups,
          [groupId]: {
            ...group,
            transform
          }
        }
      };
    });
  },

  assignMediaToScreen: (screenId, media) => {
    set((state) => {
      const screen = state.screens[screenId];
      if (!screen) {
        return state;
      }

      return {
        screens: {
          ...state.screens,
          [screenId]: {
            ...screen,
            media,
            playback: makePlaybackState()
          }
        },
        toasts: [...state.toasts, makeToast(`Media applique sur ${screenId}`, "success")]
      };
    });
  },

  assignMediaToGroup: (groupId, media) => {
    set((state) => {
      const group = state.groups[groupId];
      if (!group) {
        return state;
      }

      return {
        groups: {
          ...state.groups,
          [groupId]: {
            ...group,
            media,
            playback: makePlaybackState()
          }
        },
        toasts: [...state.toasts, makeToast(`Media applique au groupe ${groupId}`, "success")]
      };
    });
  },

  setFitModeForScreen: (screenId, fitMode) => {
    set((state) => {
      const screen = state.screens[screenId];
      if (!screen?.media) {
        return state;
      }

      return {
        screens: {
          ...state.screens,
          [screenId]: {
            ...screen,
            media: {
              ...screen.media,
              fitMode
            }
          }
        }
      };
    });
  },

  setFitModeForGroup: (groupId, fitMode) => {
    set((state) => {
      const group = state.groups[groupId];
      if (!group?.media) {
        return state;
      }

      return {
        groups: {
          ...state.groups,
          [groupId]: {
            ...group,
            media: {
              ...group.media,
              fitMode
            }
          }
        }
      };
    });
  },

  togglePlaybackForScreen: (screenId) => {
    set((state) => {
      const screen = state.screens[screenId];
      if (!screen) {
        return state;
      }

      return {
        screens: {
          ...state.screens,
          [screenId]: {
            ...screen,
            playback: togglePlayback(screen.playback)
          }
        }
      };
    });
  },

  togglePlaybackForGroup: (groupId) => {
    set((state) => {
      const group = state.groups[groupId];
      if (!group) {
        return state;
      }

      return {
        groups: {
          ...state.groups,
          [groupId]: {
            ...group,
            playback: togglePlayback(group.playback)
          }
        }
      };
    });
  },

  setMutedForScreen: (screenId, muted) => {
    set((state) => {
      const screen = state.screens[screenId];
      if (!screen) {
        return state;
      }

      return {
        screens: {
          ...state.screens,
          [screenId]: {
            ...screen,
            playback: setMuted(screen.playback, muted)
          }
        }
      };
    });
  },

  setMutedForGroup: (groupId, muted) => {
    set((state) => {
      const group = state.groups[groupId];
      if (!group) {
        return state;
      }

      return {
        groups: {
          ...state.groups,
          [groupId]: {
            ...group,
            playback: setMuted(group.playback, muted)
          }
        }
      };
    });
  },

  restartPlaybackForScreen: (screenId) => {
    set((state) => {
      const screen = state.screens[screenId];
      if (!screen) {
        return state;
      }

      return {
        screens: {
          ...state.screens,
          [screenId]: {
            ...screen,
            playback: restartPlayback(screen.playback)
          }
        }
      };
    });
  },

  restartPlaybackForGroup: (groupId) => {
    set((state) => {
      const group = state.groups[groupId];
      if (!group) {
        return state;
      }

      return {
        groups: {
          ...state.groups,
          [groupId]: {
            ...group,
            playback: restartPlayback(group.playback)
          }
        }
      };
    });
  },

  removeMediaFromScreen: (screenId) => {
    set((state) => {
      const screen = state.screens[screenId];
      if (!screen) {
        return state;
      }

      return {
        screens: {
          ...state.screens,
          [screenId]: {
            ...screen,
            media: null,
            playback: makePlaybackState()
          }
        }
      };
    });
  },

  removeMediaFromGroup: (groupId) => {
    set((state) => {
      const group = state.groups[groupId];
      if (!group) {
        return state;
      }

      return {
        groups: {
          ...state.groups,
          [groupId]: {
            ...group,
            media: null,
            playback: makePlaybackState()
          }
        }
      };
    });
  }
}));
