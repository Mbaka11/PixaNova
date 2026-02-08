"use client";

import { useEffect } from "react";

import { usePreviewStore } from "@/lib/preview-store";

const toneClass = {
  info: "border-cyan-300/35",
  success: "border-emerald-300/45",
  warning: "border-amber-300/45"
};

export function ToastStack() {
  const toasts = usePreviewStore((state) => state.toasts);
  const dismissToast = usePreviewStore((state) => state.dismissToast);

  useEffect(() => {
    const timers = toasts.map((toast) =>
      window.setTimeout(() => {
        dismissToast(toast.id);
      }, 2800)
    );

    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [dismissToast, toasts]);

  return (
    <div className="pointer-events-none fixed right-5 top-5 z-[70] flex w-80 flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`panel rounded-xl border px-3 py-2 text-sm text-slate-100 shadow-panel ${toneClass[toast.tone]}`}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
