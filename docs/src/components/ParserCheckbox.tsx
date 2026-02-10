type Props = {
  id: string;
  label: string;
  desc: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export function ParserCheckbox({ label, desc, checked, onChange }: Props) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 hover:border-slate-300">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 accent-teal-600"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <div>
          <div className="text-sm font-semibold text-slate-900">{label}</div>
          <div className="text-sm text-slate-600">{desc}</div>
        </div>
      </label>
    </div>
  );
}
