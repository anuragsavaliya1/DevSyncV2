export function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "teal" | "amber" | "blue" | "rose" | "slate";
}) {
  const valueClass =
    tone === "teal"
      ? "text-[#0E9384]"
      : tone === "amber"
        ? "text-[#A87532]"
        : tone === "blue"
          ? "text-[#2F6B9A]"
          : tone === "rose"
            ? "text-[#A64D43]"
            : tone === "slate"
              ? "text-[#486170]"
              : "text-[#173247]";

  return (
    <div className="rounded-xl border border-[#E1EAED] bg-gradient-to-b from-white to-[#F8FAFB] px-3.5 py-3 shadow-sm">
      <p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#8B9BA6]">
        {label}
      </p>
      <p className={`mt-1.5 text-base font-extrabold tracking-tight ${valueClass}`}>
        {value}
      </p>
    </div>
  );
}
