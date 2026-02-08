"use client";

import { useMemo } from "react";

import { usePreviewStore } from "@/lib/preview-store";
import type { ViewPreset } from "@/lib/preview-types";

const viewButtons: Array<{ key: ViewPreset; label: string }> = [
  { key: "front", label: "Front" },
  { key: "left", label: "Left" },
  { key: "right", label: "Right" },
  { key: "top", label: "Top" },
  { key: "reset", label: "Reset" }
];

const modeButtons = [
  { key: "translate", label: "Move" },
  { key: "rotate", label: "Rotate" },
  { key: "scale", label: "Scale" }
] as const;

interface LeftSidebarProps {
  onChangeCode: () => void;
}

export function LeftSidebar({ onChangeCode }: LeftSidebarProps) {
  const rented = usePreviewStore((state) => state.rentedScreens);
  const screens = usePreviewStore((state) => state.screens);
  const transformMode = usePreviewStore((state) => state.transformMode);
  const addScreen = usePreviewStore((state) => state.addScreen);
  const removeSelected = usePreviewStore((state) => state.removeSelected);
  const connectSelected = usePreviewStore((state) => state.connectSelected);
  const ungroupSelection = usePreviewStore((state) => state.ungroupSelection);
  const setViewPreset = usePreviewStore((state) => state.setViewPreset);
  const setTransformMode = usePreviewStore((state) => state.setTransformMode);
  const addToast = usePreviewStore((state) => state.addToast);

  const count = Object.keys(screens).length;
  const extraCount = Math.max(0, count - rented);

  const stats = useMemo(
    () => ({ count, extraCount }),
    [count, extraCount]
  );

  return (
    <aside className="panel scrollbar-thin flex h-full flex-col gap-4 overflow-y-auto rounded-2xl p-4 shadow-panel">
      <div>
        <p className="text-xs uppercase tracking-[0.12em] text-slate-300/85">Configuration</p>
        <p className="mt-1 text-sm text-slate-100">Ecrans loues: {rented}</p>
        <p className="text-sm text-slate-100">Ecrans dans la scene: {stats.count}</p>
        {stats.extraCount > 0 && (
          <p className="mt-2 rounded-lg border border-amber-300/35 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
            Vous avez loue {rented} ecrans. Pour des ecrans supplementaires, contactez-nous.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <button
          onClick={addScreen}
          className="w-full rounded-xl bg-accent px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink transition hover:brightness-110"
        >
          Add screen
        </button>
        <button
          onClick={() => {
            if (window.confirm("Supprimer la selection ?")) {
              removeSelected();
            }
          }}
          className="w-full rounded-xl border border-slate-300/30 bg-slate-900/40 px-3 py-2 text-xs uppercase tracking-[0.12em] text-slate-100"
        >
          Remove selected
        </button>
        <button
          onClick={connectSelected}
          className="w-full rounded-xl border border-emerald-200/40 bg-emerald-400/15 px-3 py-2 text-xs uppercase tracking-[0.12em] text-emerald-100"
        >
          Connect selected
        </button>
        <button
          onClick={ungroupSelection}
          className="w-full rounded-xl border border-slate-300/30 bg-slate-900/40 px-3 py-2 text-xs uppercase tracking-[0.12em] text-slate-100"
        >
          Disconnect / Ungroup
        </button>
      </div>

      <div>
        <p className="mb-2 text-xs uppercase tracking-[0.12em] text-slate-300/85">Transform</p>
        <div className="grid grid-cols-3 gap-2">
          {modeButtons.map((mode) => (
            <button
              key={mode.key}
              onClick={() => setTransformMode(mode.key)}
              className={`rounded-lg px-2 py-2 text-xs uppercase tracking-[0.1em] transition ${
                transformMode === mode.key
                  ? "bg-cyan-400/25 text-cyan-100"
                  : "bg-slate-900/45 text-slate-200"
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs uppercase tracking-[0.12em] text-slate-300/85">Vues guidees</p>
        <div className="grid grid-cols-2 gap-2">
          {viewButtons.map((view) => (
            <button
              key={view.key}
              onClick={() => setViewPreset(view.key)}
              className="rounded-lg border border-slate-300/25 bg-slate-900/45 px-2 py-2 text-xs uppercase tracking-[0.1em] text-slate-100"
            >
              {view.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-auto space-y-2">
        <button
          onClick={() => addToast("Coming soon", "info")}
          className="w-full rounded-xl bg-gold px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink"
        >
          Ask for a live preview
        </button>
        <button
          onClick={onChangeCode}
          className="w-full rounded-xl border border-slate-300/30 bg-slate-900/40 px-3 py-2 text-xs uppercase tracking-[0.12em] text-slate-100"
        >
          Change code
        </button>
      </div>
    </aside>
  );
}
