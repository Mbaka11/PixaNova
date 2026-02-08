"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo } from "react";

import { AccessCodeModal } from "@/components/preview/AccessCodeModal";
import { LeftSidebar } from "@/components/preview/LeftSidebar";
import { RightPanel } from "@/components/preview/RightPanel";
import { ToastStack } from "@/components/preview/ToastStack";
import { TopBar } from "@/components/preview/TopBar";
import { usePreviewStore } from "@/lib/preview-store";

const PreviewCanvas = dynamic(() => import("@/components/preview/PreviewCanvas"), {
  ssr: false
});

const CODE_KEY = "pixanova_preview_code";
const NAME_KEY = "pixanova_preview_name";

export function PreviewWorkspace() {
  const accessUnlocked = usePreviewStore((state) => state.accessUnlocked);
  const customerName = usePreviewStore((state) => state.customerName);
  const rentedScreens = usePreviewStore((state) => state.rentedScreens);

  const setAccess = usePreviewStore((state) => state.setAccess);
  const clearAccess = usePreviewStore((state) => state.clearAccess);
  const connectSelected = usePreviewStore((state) => state.connectSelected);
  const ungroupSelection = usePreviewStore((state) => state.ungroupSelection);
  const removeSelected = usePreviewStore((state) => state.removeSelected);
  const setViewPreset = usePreviewStore((state) => state.setViewPreset);

  useEffect(() => {
    const savedCode = window.localStorage.getItem(CODE_KEY);
    if (!savedCode) {
      return;
    }

    const savedName = window.localStorage.getItem(NAME_KEY) || "Mark";
    setAccess(savedCode, savedName);
  }, [setAccess]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.getAttribute("contenteditable") === "true";

      if (isTyping) {
        return;
      }

      if (event.key.toLowerCase() === "g") {
        connectSelected();
      }

      if (event.key.toLowerCase() === "u") {
        ungroupSelection();
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        if (window.confirm("Supprimer la selection ?")) {
          removeSelected();
        }
      }

      if (event.key.toLowerCase() === "r") {
        setViewPreset("reset");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [connectSelected, removeSelected, setViewPreset, ungroupSelection]);

  const welcomeText = useMemo(
    () => `Bienvenue, ${customerName || "Mark"} - ${rentedScreens} ecrans loues`,
    [customerName, rentedScreens]
  );

  const handleSubmitCode = (code: string, name: string) => {
    setAccess(code, name);
    window.localStorage.setItem(CODE_KEY, code);
    window.localStorage.setItem(NAME_KEY, name || "Mark");
  };

  const handleChangeCode = () => {
    clearAccess();
    window.localStorage.removeItem(CODE_KEY);
    window.localStorage.removeItem(NAME_KEY);
  };

  return (
    <div className="min-h-screen p-4 md:p-6">
      <ToastStack />
      <AccessCodeModal open={!accessUnlocked} onSubmit={handleSubmitCode} />

      <div className={`${!accessUnlocked ? "pointer-events-none blur-sm" : ""} mx-auto flex max-w-[1600px] flex-col gap-4`}>
        <TopBar />

        <div className="panel rounded-2xl px-4 py-3 text-sm text-slate-100 shadow-panel">
          {welcomeText}
        </div>

        <div className="grid h-[calc(100vh-190px)] grid-cols-1 gap-4 xl:grid-cols-[280px_1fr_320px]">
          <LeftSidebar onChangeCode={handleChangeCode} />

          <section className="panel relative overflow-hidden rounded-2xl shadow-panel">
            <PreviewCanvas />
          </section>

          <RightPanel />
        </div>
      </div>
    </div>
  );
}
