import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";

export function ErrorState({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-[#F0C9C4] bg-[#FFF8F7] px-4 py-3 text-xs font-semibold leading-5 text-[#A64D43] shadow-sm"
    >
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#FFF1EF] text-[#A64D43]">
        <AlertCircle className="h-3.5 w-3.5" />
      </span>
      <p className="min-w-0 flex-1 pt-0.5">{message}</p>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  detail,
}: {
  icon: (props: { className?: string }) => ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-[#E8EEF1] bg-gradient-to-b from-[#FBFCFD] to-white px-5 py-10 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EAF7F4] text-[#0E9384] ring-1 ring-[#D7EEE9]">
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-3.5 text-sm font-extrabold text-[#173247]">{title}</p>
      <p className="mx-auto mt-1.5 max-w-sm text-xs font-medium leading-5 text-[#718494]">
        {detail}
      </p>
    </div>
  );
}
