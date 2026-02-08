"use client";

import { FormEvent, useState } from "react";

interface AccessCodeModalProps {
  open: boolean;
  onSubmit: (code: string, name: string) => void;
}

export function AccessCodeModal({ open, onSubmit }: AccessCodeModalProps) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("Mark");

  if (!open) {
    return null;
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!code.trim()) {
      return;
    }

    onSubmit(code.trim(), name.trim() || "Mark");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="panel w-full max-w-md rounded-2xl border p-6 shadow-panel"
      >
        <h2 className="font-display text-4xl text-white">Accedez a votre apercu</h2>
        <p className="mt-2 text-sm text-slate-200/85">Entrez votre code de location recu par e-mail.</p>

        <label className="mt-6 block text-xs uppercase tracking-[0.12em] text-slate-200/85">
          Code de location
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-400/30 bg-slate-950/40 px-3 py-2 text-sm text-white outline-none ring-accent/50 transition focus:ring"
            placeholder="Ex: PXN-2026-APR-001"
          />
        </label>

        <label className="mt-4 block text-xs uppercase tracking-[0.12em] text-slate-200/85">
          Nom (optionnel)
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-400/30 bg-slate-950/40 px-3 py-2 text-sm text-white outline-none ring-accent/50 transition focus:ring"
            placeholder="Mark"
          />
        </label>

        <button
          type="submit"
          className="mt-6 w-full rounded-xl bg-accent px-4 py-2 text-sm font-semibold uppercase tracking-[0.12em] text-ink transition hover:brightness-110"
        >
          Entrer
        </button>
      </form>
    </div>
  );
}
