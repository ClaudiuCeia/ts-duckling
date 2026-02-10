import type { ReactNode } from "react";

type Props = {
  segments: (string | ReactNode)[];
};

export function AnnotatedText({ segments }: Props) {
  return (
    <div className="min-h-30 rounded-2xl border border-slate-200 bg-white p-4 font-mono text-sm leading-relaxed text-slate-900 whitespace-pre-wrap">
      {segments}
    </div>
  );
}
