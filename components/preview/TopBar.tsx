"use client";

import Link from "next/link";

const navItems = ["Accueil", "Realisations", "A propos", "Obtenir un devis", "Apercu 3D"];

export function TopBar() {
  return (
    <header className="panel z-20 flex h-16 items-center justify-between rounded-2xl px-4 shadow-panel md:px-6">
      <div className="font-display text-3xl leading-none text-white">PIXANOVA</div>
      <nav className="hidden items-center gap-5 text-xs uppercase tracking-[0.14em] text-slate-200/90 md:flex">
        {navItems.map((item, index) => (
          <Link
            key={item}
            href={index === navItems.length - 1 ? "/preview" : "#"}
            className="transition hover:text-accent"
          >
            {item}
          </Link>
        ))}
      </nav>
    </header>
  );
}
