import { ParserCheckbox } from "./ParserCheckbox";
import { ALL_IDS, PARSER_REGISTRY, PII_IDS } from "../registry";

type Props = {
  selected: Set<string>;
  onSelectionChange: (next: Set<string>) => void;
};

export function ParserSidebar({ selected, onSelectionChange }: Props) {
  const toggle = (id: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    onSelectionChange(next);
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold tracking-wide text-slate-900">
          Parsers
        </h2>
        <div className="text-sm text-slate-500">
          {selected.size} selected
        </div>
      </div>
      <div className="p-4">
        <div className="flex flex-wrap gap-2 pb-3">
          <QuickBtn
            label="All"
            onClick={() => onSelectionChange(new Set(ALL_IDS))}
          />
          <QuickBtn label="None" onClick={() => onSelectionChange(new Set())} />
          <QuickBtn
            label="PII"
            onClick={() => onSelectionChange(new Set(PII_IDS))}
          />
          <QuickBtn
            label="Default"
            onClick={() => onSelectionChange(new Set(ALL_IDS))}
            active
          />
        </div>
        <div className="space-y-2" role="list">
          {PARSER_REGISTRY.map((p) => (
            <ParserCheckbox
              key={p.id}
              id={p.id}
              label={p.label}
              desc={p.desc}
              checked={selected.has(p.id)}
              onChange={(on) => toggle(p.id, on)}
            />
          ))}
        </div>
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Tip: for large articles, start with PII or a smaller max-chars limit.
          Full extraction is intentionally naive and can be slow.
        </div>
      </div>
    </section>
  );
}

function QuickBtn(
  { label, onClick, active }: {
    label: string;
    onClick: () => void;
    active?: boolean;
  },
) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-sm font-semibold text-slate-900 hover:border-slate-300 ${
        active ? "border-slate-200 bg-slate-50" : "border-slate-200 bg-white"
      }`}
    >
      {label}
    </button>
  );
}
