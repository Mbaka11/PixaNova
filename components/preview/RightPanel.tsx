"use client";

import { ChangeEvent, useRef, useState } from "react";

import { createMediaAsset } from "@/lib/media";
import { usePreviewStore } from "@/lib/preview-store";
import type { FitMode, PlaybackState } from "@/lib/preview-types";

const fitModes: FitMode[] = ["contain", "cover", "stretch"];

function PlaybackButtons(props: {
  playback: PlaybackState;
  hasMedia: boolean;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onRestart: () => void;
  onRemove: () => void;
}) {
  const { playback, hasMedia, onTogglePlay, onToggleMute, onRestart, onRemove } = props;

  return (
    <div className="mt-4 grid grid-cols-2 gap-2">
      <button
        disabled={!hasMedia}
        onClick={onTogglePlay}
        className="rounded-lg border border-slate-300/25 bg-slate-900/45 px-2 py-2 text-xs uppercase tracking-[0.1em] text-slate-100 disabled:opacity-50"
      >
        {playback.isPlaying ? "Pause" : "Play"}
      </button>
      <button
        disabled={!hasMedia}
        onClick={onToggleMute}
        className="rounded-lg border border-slate-300/25 bg-slate-900/45 px-2 py-2 text-xs uppercase tracking-[0.1em] text-slate-100 disabled:opacity-50"
      >
        {playback.muted ? "Unmute" : "Mute"}
      </button>
      <button
        disabled={!hasMedia}
        onClick={onRestart}
        className="rounded-lg border border-slate-300/25 bg-slate-900/45 px-2 py-2 text-xs uppercase tracking-[0.1em] text-slate-100 disabled:opacity-50"
      >
        Restart
      </button>
      <button
        disabled={!hasMedia}
        onClick={onRemove}
        className="rounded-lg border border-rose-300/40 bg-rose-500/15 px-2 py-2 text-xs uppercase tracking-[0.1em] text-rose-100 disabled:opacity-50"
      >
        Remove media
      </button>
    </div>
  );
}

export function RightPanel() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [target, setTarget] = useState<{ kind: "screen" | "group"; id: string } | null>(null);

  const screens = usePreviewStore((state) => state.screens);
  const groups = usePreviewStore((state) => state.groups);
  const selectedGroupId = usePreviewStore((state) => state.selectedGroupId);
  const activeScreenId = usePreviewStore((state) => state.activeScreenId);
  const focusedScreenId = usePreviewStore((state) => state.focusedScreenId);

  const assignMediaToScreen = usePreviewStore((state) => state.assignMediaToScreen);
  const assignMediaToGroup = usePreviewStore((state) => state.assignMediaToGroup);
  const setFitModeForScreen = usePreviewStore((state) => state.setFitModeForScreen);
  const setFitModeForGroup = usePreviewStore((state) => state.setFitModeForGroup);
  const togglePlaybackForScreen = usePreviewStore((state) => state.togglePlaybackForScreen);
  const togglePlaybackForGroup = usePreviewStore((state) => state.togglePlaybackForGroup);
  const setMutedForScreen = usePreviewStore((state) => state.setMutedForScreen);
  const setMutedForGroup = usePreviewStore((state) => state.setMutedForGroup);
  const restartPlaybackForScreen = usePreviewStore((state) => state.restartPlaybackForScreen);
  const restartPlaybackForGroup = usePreviewStore((state) => state.restartPlaybackForGroup);
  const removeMediaFromScreen = usePreviewStore((state) => state.removeMediaFromScreen);
  const removeMediaFromGroup = usePreviewStore((state) => state.removeMediaFromGroup);
  const detachScreen = usePreviewStore((state) => state.detachScreen);
  const selectGroup = usePreviewStore((state) => state.selectGroup);
  const addToast = usePreviewStore((state) => state.addToast);

  const selectedGroup = selectedGroupId ? groups[selectedGroupId] : null;
  const selectedScreen = activeScreenId ? screens[activeScreenId] : null;
  const focusedScreen = focusedScreenId ? screens[focusedScreenId] : null;

  const openUpload = (nextTarget: { kind: "screen" | "group"; id: string }) => {
    setTarget(nextTarget);
    inputRef.current?.click();
  };

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !target) {
      return;
    }

    try {
      const media = await createMediaAsset(file);
      if (target.kind === "screen") {
        assignMediaToScreen(target.id, media);
      } else {
        assignMediaToGroup(target.id, media);
      }
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Upload impossible", "warning");
    } finally {
      event.currentTarget.value = "";
      setTarget(null);
    }
  };

  return (
    <aside className="panel scrollbar-thin h-full overflow-y-auto rounded-2xl p-4 shadow-panel">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept="video/mp4,video/quicktime,image/png,image/jpeg,image/gif"
        onChange={handleUpload}
      />

      {selectedGroup ? (
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-slate-300/85">Groupe selectionne</p>
          <h3 className="mt-1 text-xl font-semibold text-white">{selectedGroup.id}</h3>
          <p className="text-sm text-slate-200/80">{selectedGroup.screenIds.length} ecrans connectes</p>

          <button
            onClick={() => openUpload({ kind: "group", id: selectedGroup.id })}
            className="mt-4 w-full rounded-xl bg-accent px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink"
          >
            Upload media to group
          </button>

          <label className="mt-4 block text-xs uppercase tracking-[0.1em] text-slate-300/85">
            Fit mode
            <select
              value={selectedGroup.media?.fitMode ?? "contain"}
              disabled={!selectedGroup.media}
              onChange={(event) => setFitModeForGroup(selectedGroup.id, event.target.value as FitMode)}
              className="mt-2 w-full rounded-lg border border-slate-300/25 bg-slate-900/45 px-2 py-2 text-sm text-slate-100 disabled:opacity-50"
            >
              {fitModes.map((fit) => (
                <option key={fit} value={fit}>
                  {fit}
                </option>
              ))}
            </select>
          </label>

          <PlaybackButtons
            playback={selectedGroup.playback}
            hasMedia={Boolean(selectedGroup.media)}
            onTogglePlay={() => togglePlaybackForGroup(selectedGroup.id)}
            onToggleMute={() => setMutedForGroup(selectedGroup.id, !selectedGroup.playback.muted)}
            onRestart={() => restartPlaybackForGroup(selectedGroup.id)}
            onRemove={() => removeMediaFromGroup(selectedGroup.id)}
          />

          <button
            disabled={!focusedScreen || focusedScreen.groupId !== selectedGroup.id}
            onClick={() => focusedScreen && detachScreen(focusedScreen.id)}
            className="mt-4 w-full rounded-xl border border-amber-300/40 bg-amber-500/15 px-3 py-2 text-xs uppercase tracking-[0.12em] text-amber-100 disabled:opacity-50"
          >
            Detach selected screen
          </button>
          <p className="mt-2 text-xs text-slate-300/75">
            Astuce: cliquez un ecran du groupe pour le cibler, puis detachez-le.
          </p>
        </div>
      ) : selectedScreen ? (
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-slate-300/85">Ecran selectionne</p>
          <h3 className="mt-1 text-xl font-semibold text-white">{selectedScreen.id}</h3>
          <p className="text-sm text-slate-200/80">
            Statut: {selectedScreen.groupId ? `Dans ${selectedScreen.groupId}` : "Solo"}
          </p>

          {selectedScreen.groupId && (
            <button
              onClick={() => selectGroup(selectedScreen.groupId as string, selectedScreen.id)}
              className="mt-3 w-full rounded-xl border border-cyan-300/40 bg-cyan-500/15 px-3 py-2 text-xs uppercase tracking-[0.12em] text-cyan-100"
            >
              Selectionner le groupe
            </button>
          )}

          <button
            onClick={() => openUpload({ kind: "screen", id: selectedScreen.id })}
            className="mt-4 w-full rounded-xl bg-accent px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink"
          >
            Upload media
          </button>

          <label className="mt-4 block text-xs uppercase tracking-[0.1em] text-slate-300/85">
            Fit mode
            <select
              value={selectedScreen.media?.fitMode ?? "contain"}
              disabled={!selectedScreen.media}
              onChange={(event) => setFitModeForScreen(selectedScreen.id, event.target.value as FitMode)}
              className="mt-2 w-full rounded-lg border border-slate-300/25 bg-slate-900/45 px-2 py-2 text-sm text-slate-100 disabled:opacity-50"
            >
              {fitModes.map((fit) => (
                <option key={fit} value={fit}>
                  {fit}
                </option>
              ))}
            </select>
          </label>

          <PlaybackButtons
            playback={selectedScreen.playback}
            hasMedia={Boolean(selectedScreen.media)}
            onTogglePlay={() => togglePlaybackForScreen(selectedScreen.id)}
            onToggleMute={() => setMutedForScreen(selectedScreen.id, !selectedScreen.playback.muted)}
            onRestart={() => restartPlaybackForScreen(selectedScreen.id)}
            onRemove={() => removeMediaFromScreen(selectedScreen.id)}
          />

          {selectedScreen.groupId && (
            <button
              onClick={() => detachScreen(selectedScreen.id)}
              className="mt-4 w-full rounded-xl border border-amber-300/40 bg-amber-500/15 px-3 py-2 text-xs uppercase tracking-[0.12em] text-amber-100"
            >
              Detach this screen
            </button>
          )}
        </div>
      ) : (
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-slate-300/85">Proprietes</p>
          <h3 className="mt-1 text-xl font-semibold text-white">Aucune selection</h3>
          <p className="mt-2 text-sm text-slate-200/80">
            Cliquez un ecran (Shift+click pour multi-selection). Alt+click sur un ecran groupe pour
            le selectionner individuellement.
          </p>
        </div>
      )}
    </aside>
  );
}
