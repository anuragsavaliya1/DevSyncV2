/** The Google-only login entry for DevSync v2. */
import { Activity, ArrowRight, Chrome, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-[#0b1c28] p-12 text-white lg:flex lg:flex-col xl:p-16">
        {/* Atmospheric layers */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_0%_0%,rgba(13,143,129,0.38),transparent_55%),radial-gradient(ellipse_90%_70%_at_100%_100%,rgba(126,215,203,0.14),transparent_50%),linear-gradient(165deg,#102a3a_0%,#0b1c28_48%,#08151e_100%)]" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(126,215,203,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(126,215,203,0.12) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage:
              "radial-gradient(ellipse at 30% 40%, black 20%, transparent 75%)",
          }}
        />
        <div className="login-glow pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-[#0d8f81]/25 blur-3xl" />
        <div className="login-sweep pointer-events-none absolute bottom-28 right-[-10%] h-40 w-[70%] rounded-full bg-[#7ed7cb]/20 blur-3xl" />

        {/* Signal waveform visual */}
        <svg
          className="login-signal pointer-events-none absolute bottom-[-4%] right-[-8%] h-[58%] w-[78%] text-[#7ed7cb]"
          viewBox="0 0 640 360"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M20 220 C80 220, 90 80, 150 80 S220 280, 280 280 S350 40, 410 40 S480 300, 540 300 S600 160, 640 160"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.55"
          />
          <path
            d="M20 240 C90 240, 100 140, 160 140 S230 260, 290 260 S360 90, 420 90 S490 250, 550 250 S610 190, 640 190"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.22"
          />
          <circle cx="410" cy="40" r="6" fill="#7ed7cb" opacity="0.9" />
          <circle
            cx="410"
            cy="40"
            r="16"
            stroke="#7ed7cb"
            strokeWidth="1.5"
            opacity="0.35"
          />
          <circle cx="280" cy="280" r="4" fill="#0d8f81" opacity="0.8" />
        </svg>

        <div className="relative flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/95 text-[#0d8f81] shadow-[0_10px_30px_rgba(13,143,129,0.35)]">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <p className="font-display text-[26px] font-bold tracking-[-0.045em] text-white">
              devsync
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7ed7cb]/75">
              Daily operating system
            </p>
          </div>
        </div>

        <div className="relative my-auto max-w-xl">
          <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7ed7cb]">
            Secure team operations
          </p>
          <h1 className="font-display text-[52px] font-bold leading-[1.06] tracking-[-0.045em] text-white xl:text-[58px]">
            The day starts with a{" "}
            <span className="bg-gradient-to-r from-white via-[#d8f5f0] to-[#7ed7cb] bg-clip-text text-transparent">
              clear signal.
            </span>
          </h1>
          <p className="mt-6 max-w-md text-[16px] font-medium leading-7 text-white/72">
            Attendance, daily work, blockers, and accountability — one
            controlled workspace for your engineering team.
          </p>

          <div className="mt-10 grid max-w-md gap-3">
            {[
              { label: "Punch", detail: "On-time presence, recorded" },
              { label: "Update", detail: "Daily work in one place" },
              { label: "Align", detail: "Managers see the signal" },
            ].map(item => (
              <div
                key={item.label}
                className="flex items-center gap-4 border-l-2 border-[#7ed7cb]/45 pl-4"
              >
                <span className="w-16 shrink-0 text-[11px] font-bold uppercase tracking-[0.16em] text-[#7ed7cb]">
                  {item.label}
                </span>
                <span className="text-[14px] font-medium text-white/65">
                  {item.detail}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center justify-between gap-4">
          <p className="text-[12px] font-medium tracking-wide text-white/40">
            Xitij Infotech · Internal workspace
          </p>
          <div className="hidden items-center gap-2 xl:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-[#7ed7cb] shadow-[0_0_12px_rgba(126,215,203,0.8)]" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">
              Live ops ready
            </span>
          </div>
        </div>
      </section>

      <section className="flex items-center justify-center bg-[#eef2f5] p-5 sm:p-10">
        <div className="w-full max-w-[420px] rounded-[28px] border border-[#e4ecef] bg-white p-8 shadow-[0_18px_50px_rgba(16,42,58,0.08)] sm:p-10">
          <div className="mb-8 lg:hidden">
            <p className="font-display text-[26px] font-bold tracking-[-0.04em] text-[#102a3a]">
              devsync
            </p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#0d8f81]">
              Daily operating system
            </p>
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#0d8f81]">
            Welcome back
          </p>
          <h2 className="mt-3 font-display text-[32px] font-bold tracking-[-0.04em] text-[#102a3a]">
            Sign in to your workspace
          </h2>
          <p className="mt-3 text-[15px] font-medium leading-6 text-[#617687]">
            Use your approved Google account to continue.
          </p>
          <a
            href="/login/native"
            className="group mt-8 flex w-full items-center justify-center gap-3 rounded-2xl bg-[#0d8f81] px-5 py-3.5 text-[15px] font-semibold text-white shadow-[0_12px_28px_rgba(13,143,129,0.28)] transition hover:bg-[#0a7267] active:scale-[0.99]"
          >
            <Chrome className="h-4 w-4" />
            Continue with Google
            <ArrowRight className="h-4 w-4 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
          </a>
          <div className="mt-6 flex gap-3 rounded-2xl border border-[#e7eef1] bg-[#f7fafb] p-4">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#0d8f81]" />
            <p className="text-[13px] font-medium leading-5 text-[#617687]">
              Google identity is verified server-side before DevSync creates a
              session or reads team data.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
