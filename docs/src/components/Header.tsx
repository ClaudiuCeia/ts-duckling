type Props = {
  children: React.ReactNode;
};

export function Header({ children }: Props) {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-slate-50/80 backdrop-blur">
      <div className="mx-auto max-w-7xl px-6 py-4">
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <img
              src="logo.png"
              alt="ts-duckling logo"
              className="h-14 w-14 rounded-2xl border border-slate-200 bg-white shadow-sm"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                  ts-duckling
                </h1>
                <a
                  href="https://github.com/ClaudiuCeia/ts-duckling"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-medium text-slate-700 hover:border-slate-300 hover:text-slate-900"
                >
                  <svg
                    viewBox="0 0 16 16"
                    width="16"
                    height="16"
                    aria-hidden="true"
                  >
                    <path
                      fill="currentColor"
                      d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
                    />
                  </svg>
                  Repo
                </a>
              </div>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
                A tiny, deterministic entity extractor for TypeScript/Deno,
                inspired by Duckling. This version uses parser-combinator
                grammars (no ML).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {children}
          </div>
        </div>
      </div>
    </header>
  );
}
