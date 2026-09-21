import Link from "next/link";

export default function HomePage() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#F5F0E8]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(184, 83, 4,0.18)_0%,_transparent_55%)]"
      />
      <svg
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 h-64 w-64 text-[#B85304]/25"
        viewBox="0 0 200 200"
        fill="none"
      >
        <path
          d="M100 40c8 18 28 28 28 28s-10 20-8 38c2 18-20 34-20 34s-22-16-20-34c2-18-8-38-8-38s20-10 28-28z"
          stroke="currentColor"
          strokeWidth="1.2"
        />
      </svg>

      <header className="relative z-10 px-6 py-6 sm:px-10">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.4em] text-[#B85304]">
          Elite Travel Experiences
        </p>
      </header>

      <main className="relative z-10 flex flex-1 flex-col justify-center px-6 pb-20 sm:px-10">
        <h1 className="max-w-3xl font-display text-5xl leading-[1.1] text-[#0B1F3A] sm:text-7xl animate-fade-up">
          Build Your
          <br />
          Japan Journey
        </h1>
        <p
          className="mt-6 max-w-md text-base leading-relaxed text-[#5C6570] sm:text-lg animate-fade-up"
          style={{ animationDelay: "0.1s" }}
        >
          A mobile-first trip builder powered by live admin configuration —
          hotels, cities, tours, and transfers curated in PocketBase.
        </p>
        <div
          className="mt-10 flex flex-wrap gap-3 animate-fade-up"
          style={{ animationDelay: "0.2s" }}
        >
          <Link
            href="/builder"
            className="rounded-full bg-[#0B1F3A] px-8 py-3.5 text-sm font-semibold tracking-[0.12em] text-white uppercase transition hover:bg-[#143052]"
          >
            Open Trip Builder
          </Link>
          <Link
            href="/admin"
            className="rounded-full border border-[#0B1F3A]/30 px-8 py-3.5 text-sm font-semibold tracking-[0.12em] text-[#0B1F3A] uppercase transition hover:border-[#B85304] hover:text-[#B85304]"
          >
            Team Access
          </Link>
        </div>
      </main>
    </div>
  );
}
