export function StatTile({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-ink-800 bg-ink-900/60 p-5">
      <div
        className={`font-mono text-2xl font-bold ${
          accent ? "text-lime" : "text-white"
        }`}
      >
        {value}
      </div>
      <div className="mt-1 text-xs text-zinc-500">{label}</div>
    </div>
  );
}
