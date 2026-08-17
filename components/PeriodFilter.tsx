import { MetricPeriod } from "../services/metrics";

const options: Array<{ value: MetricPeriod; label: string }> = [
  { value: 7, label: "7 dias" },
  { value: 30, label: "30 dias" },
  { value: 90, label: "90 dias" },
  { value: "all", label: "Geral" },
];

export const PeriodFilter = ({
  value,
  onChange,
}: {
  value: MetricPeriod;
  onChange: (period: MetricPeriod) => void;
}) => (
  <div
    className="inline-flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1"
    aria-label="Período das métricas"
  >
    {options.map((option) => (
      <button
        key={String(option.value)}
        type="button"
        aria-pressed={value === option.value}
        onClick={() => onChange(option.value)}
        className={`rounded-lg px-3 py-2 text-[9px] font-black uppercase tracking-wider transition ${
          value === option.value
            ? "bg-slate-900 text-white"
            : "text-slate-500 hover:bg-slate-50"
        }`}
      >
        {option.label}
      </button>
    ))}
  </div>
);
