import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col items-start justify-center gap-8 px-6 py-16 md:px-10">
      <p className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.22em] text-cyan-100/90">
        Location d'ecrans LED
      </p>
      <h1 className="font-display text-6xl leading-none text-white md:text-8xl">
        Configurez votre mur LED en 3D avant l'evenement.
      </h1>
      <p className="max-w-2xl text-lg text-slate-200/90">
        Proof of concept Pixanova: assemblez des ecrans, chargez vos contenus et visualisez
        le rendu en temps reel.
      </p>
      <Link
        href="/preview"
        className="rounded-xl bg-accent px-6 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-ink transition hover:brightness-110"
      >
        Ouvrir l'apercu 3D
      </Link>
    </main>
  );
}
