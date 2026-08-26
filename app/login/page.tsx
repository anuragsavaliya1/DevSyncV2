/** The Google-only login entry for DevSync v2. */
import { Activity, ShieldCheck } from "lucide-react";
import { GoogleSignIn } from "@/components/auth/google-sign-in";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen bg-[#F6F8FB] lg:grid-cols-[1.1fr_0.9fr]">
      <section className="relative hidden overflow-hidden bg-[#173247] p-14 text-white lg:flex lg:flex-col">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full border border-white/10" /><div className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-[#0E9384]/15 blur-3xl" />
        <div className="relative flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF7F4] text-[#0E9384]"><Activity className="h-5 w-5" /></div><div><p className="font-display text-xl font-extrabold tracking-[-0.05em]">devsync</p><p className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-white/45">daily operating system</p></div></div>
        <div className="relative my-auto max-w-md"><p className="mb-4 text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#69D4C4]">Secure team operations</p><h1 className="font-display text-5xl font-extrabold leading-[1.02] tracking-[-0.065em]">The day starts with a clear signal.</h1><p className="mt-6 text-sm font-medium leading-7 text-white/60">DevSync connects attendance, daily work, blockers, and team accountability in one controlled workspace.</p></div>
        <p className="relative text-xs font-semibold text-white/40">Xitij Infotech · Internal workspace</p>
      </section>
      <section className="flex items-center justify-center p-5 sm:p-10"><div className="w-full max-w-md rounded-[24px] border border-[#E4ECEF] bg-white p-7 shadow-[0_20px_60px_rgba(25,55,75,0.09)] sm:p-10"><div className="mb-9 lg:hidden"><p className="font-display text-2xl font-extrabold tracking-[-0.06em] text-[#173247]">devsync</p><p className="mt-1 text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#0E9384]">daily operating system</p></div><div className="mb-7"><p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#0E9384]">Welcome back</p><h2 className="mt-3 font-display text-3xl font-extrabold tracking-[-0.055em] text-[#173247]">Sign in to your workspace.</h2><p className="mt-3 text-sm font-medium leading-6 text-[#758696]">Use your approved Google account to access DevSync.</p></div><GoogleSignIn /><div className="mt-7 flex gap-3 rounded-xl border border-[#E3EDF0] bg-[#F8FBFB] p-3"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#0E9384]" /><p className="text-[11px] font-semibold leading-5 text-[#6E8190]">Google identity is verified server-side before DevSync creates a secure session or reads any team data.</p></div></div></section>
    </main>
  );
}
