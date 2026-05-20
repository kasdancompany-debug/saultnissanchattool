"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { buildInboxHref } from "@/components/inbox/inbox-params";
import type { DealershipAnalyticsSnapshot } from "@/lib/analytics/types";
import type { ExecutiveLeadSourceRow, ExecutiveSalesFunnel } from "@/lib/analytics/executive-metrics";
import { cn } from "@/lib/utils";

function fadeInClass(delayMs: number): string {
  return cn(
    "animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-700 ease-out motion-reduce:animate-none",
    delayMs === 0 && "delay-0",
    delayMs === 75 && "delay-75",
    delayMs === 150 && "delay-150",
    delayMs === 225 && "delay-[225ms]",
    delayMs === 300 && "delay-300",
    delayMs === 375 && "delay-[375ms]",
    delayMs === 450 && "delay-[450ms]",
    delayMs === 525 && "delay-[525ms]"
  );
}

function WarRoomShell({
  children,
  className,
  delayMs = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/50 bg-card/80 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_24px_48px_-24px_rgba(15,23,42,0.18)] backdrop-blur-sm dark:bg-card/40 dark:shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_32px_64px_-24px_rgba(0,0,0,0.55)]",
        fadeInClass(delayMs),
        className
      )}
    >
      {children}
    </div>
  );
}

function HeroMetric({
  icon,
  label,
  value,
  sub,
  href,
  delayMs,
  accent,
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  href?: string;
  delayMs: number;
  accent?: "emerald" | "amber" | "sky" | "rose" | "violet" | "slate";
}) {
  const accentRing = {
    emerald: "from-emerald-500/12 via-transparent to-transparent",
    amber: "from-amber-500/12 via-transparent to-transparent",
    sky: "from-sky-500/12 via-transparent to-transparent",
    rose: "from-rose-500/12 via-transparent to-transparent",
    violet: "from-violet-500/12 via-transparent to-transparent",
    slate: "from-primary/10 via-transparent to-transparent",
  }[accent ?? "slate"];

  const inner = (
    <WarRoomShell
      delayMs={delayMs}
      className={cn(
        "group relative overflow-hidden p-5 sm:p-6",
        href && "transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-lg"
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80",
          accentRing
        )}
        aria-hidden
      />
      <div className="relative flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xl leading-none" aria-hidden>
            {icon}
          </span>
          <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.18em] uppercase">
            {label}
          </p>
        </div>
        <p className="text-foreground font-black tabular-nums tracking-[-0.05em] text-[clamp(2rem,4.5vw,3.25rem)] leading-[0.92]">
          {value}
        </p>
        {sub ? (
          <p className="text-muted-foreground/90 text-[11px] font-medium leading-snug">{sub}</p>
        ) : null}
      </div>
    </WarRoomShell>
  );

  if (href) {
    return (
      <Link href={href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55 rounded-xl">
        {inner}
      </Link>
    );
  }
  return inner;
}

function LeadSourcesRow({
  sources,
  delayMs,
}: {
  sources: ExecutiveLeadSourceRow[];
  delayMs: number;
}) {
  const total = sources.reduce((a, s) => a + s.count, 0) || 1;
  const max = Math.max(...sources.map((s) => s.count), 1);

  return (
    <WarRoomShell delayMs={delayMs} className="p-6 sm:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-primary text-[10px] font-bold tracking-[0.22em] uppercase">Attribution</p>
          <h2 className="text-foreground mt-1 text-xl font-bold tracking-[-0.04em] sm:text-2xl">
            Lead sources
          </h2>
        </div>
        <p className="text-muted-foreground text-[11px] font-medium tabular-nums">
          {total} conversations attributed
        </p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sources.map((src) => {
          const pct = Math.round((src.count / total) * 100);
          const widthPct = Math.max(8, Math.round((src.count / max) * 100));
          return (
            <li key={src.key} className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-foreground text-sm font-semibold tracking-tight">
                  {src.label}
                </span>
                <span className="text-muted-foreground text-xs font-bold tabular-nums">
                  {src.count}
                  <span className="text-muted-foreground/70 font-medium"> · {pct}%</span>
                </span>
              </div>
              <div className="bg-muted/40 h-1.5 overflow-hidden rounded-full">
                <div
                  className="bg-primary/70 h-full rounded-full transition-[width] duration-1000 ease-out motion-reduce:transition-none"
                  style={{ width: `${widthPct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </WarRoomShell>
  );
}

function FunnelStage({
  label,
  value,
  isLast,
  delayMs,
}: {
  label: string;
  value: number;
  isLast?: boolean;
  delayMs: number;
}) {
  return (
    <div
      className={cn("flex min-w-0 flex-1 flex-col items-center", fadeInClass(delayMs))}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <div className="relative flex w-full flex-col items-center">
        <div className="border-border/80 bg-background/90 text-foreground flex size-16 items-center justify-center rounded-2xl border text-2xl font-black tabular-nums tracking-tighter shadow-sm sm:size-[4.5rem] sm:text-3xl">
          {value}
        </div>
        <p className="text-muted-foreground mt-3 max-w-[7rem] text-center text-[10px] font-semibold tracking-[0.12em] uppercase sm:text-[11px]">
          {label}
        </p>
        {!isLast ? (
          <div
            className="bg-border/60 absolute top-8 left-[calc(50%+2.5rem)] hidden h-px w-[calc(100%-5rem)] sm:block"
            aria-hidden
          />
        ) : null}
      </div>
    </div>
  );
}

function FunnelConnector() {
  return (
    <div
      className="text-muted-foreground/40 hidden min-w-[2rem] flex-1 items-center gap-0.5 sm:flex"
      aria-hidden
    >
      <div className="from-border h-px flex-1 bg-gradient-to-r to-transparent" />
      <ChevronRight className="size-4 shrink-0 opacity-50" />
    </div>
  );
}

function SalesFunnelRow({ funnel, delayMs }: { funnel: ExecutiveSalesFunnel; delayMs: number }) {
  const stages: { label: string; value: number }[] = [
    { label: "Visitors", value: funnel.visitors },
    { label: "Conversations", value: funnel.conversations },
    { label: "Qualified leads", value: funnel.qualifiedLeads },
    { label: "Appointments", value: funnel.appointments },
    { label: "Sold vehicles", value: funnel.soldVehicles },
  ];

  return (
    <WarRoomShell delayMs={delayMs} className="p-6 sm:p-10">
      <div className="mb-8 sm:mb-10">
        <p className="text-primary text-[10px] font-bold tracking-[0.22em] uppercase">Pipeline</p>
        <h2 className="text-foreground mt-1 text-xl font-bold tracking-[-0.04em] sm:text-2xl">
          Sales funnel
        </h2>
        <p className="text-muted-foreground mt-2 max-w-lg text-[11px] leading-relaxed">
          End-to-end progression for the reporting window. Visitors are modeled from chat
          engagement; sold units reflect closed sales threads.
        </p>
      </div>
      <div className="flex flex-col items-stretch gap-6 overflow-x-auto pb-1 sm:flex-row sm:items-center sm:gap-0">
        {stages.map((stage, i) => (
          <div key={stage.label} className="flex min-w-0 flex-1 items-center">
            <FunnelStage
              label={stage.label}
              value={stage.value}
              isLast={i === stages.length - 1}
              delayMs={delayMs + 80 * i}
            />
            {i < stages.length - 1 ? <FunnelConnector /> : null}
          </div>
        ))}
      </div>
    </WarRoomShell>
  );
}

export function ExecutiveOverviewDashboard({
  data,
}: {
  data: DealershipAnalyticsSnapshot;
}) {
  const { executive, reportingPeriod } = data;
  const { hero } = executive;

  return (
    <div className="space-y-6 sm:space-y-8">
      <header className={cn("space-y-1", fadeInClass(0))}>
        <p className="text-primary text-[10px] font-bold tracking-[0.24em] uppercase">
          Executive overview
        </p>
        <h1 className="text-foreground text-[clamp(1.75rem,4vw,2.75rem)] font-black tracking-[-0.045em]">
          War room
        </h1>
        <p className="text-muted-foreground max-w-2xl text-sm font-medium">
          {reportingPeriod.label} · Updated{" "}
          {new Date(data.generatedAtIso).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
      </header>

      <section
        className="grid auto-rows-fr gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3 2xl:grid-cols-6"
        aria-label="Hero metrics"
      >
        <HeroMetric
          icon="🚗"
          label="Appointments booked"
          value={String(hero.appointmentsBooked)}
          sub="Threads with booking intent or scheduled visit"
          delayMs={75}
          accent="emerald"
        />
        <HeroMetric
          icon="💰"
          label="Est. gross influenced"
          value={hero.estimatedGrossLabel}
          sub="Modeled from qualified leads in period"
          delayMs={150}
          accent="amber"
        />
        <HeroMetric
          icon="📈"
          label="Lead conversion rate"
          value={hero.leadConversionRateLabel}
          sub="Qualified leads ÷ new conversations"
          delayMs={225}
          accent="violet"
        />
        <HeroMetric
          icon="⏱"
          label="Average first response"
          value={hero.avgFirstResponseLabel ?? "—"}
          sub={
            data.period.conversationsWithMeasuredFirstReply > 0
              ? `${data.period.conversationsWithMeasuredFirstReply} threads measured`
              : "Reply in inbox to unlock benchmark"
          }
          delayMs={300}
          accent="sky"
        />
        <HeroMetric
          icon="🔥"
          label="Hot leads active"
          value={String(hero.hotLeadsActive)}
          sub="Open threads scored 80+ opportunity"
          href={buildInboxHref("all_open", { sort: "highest_score" })}
          delayMs={375}
          accent="rose"
        />
        <HeroMetric
          icon="📞"
          label="Active conversations"
          value={String(hero.activeConversations)}
          sub="Open, pending, or awaiting human"
          href={buildInboxHref("all_open")}
          delayMs={450}
          accent="slate"
        />
      </section>

      <LeadSourcesRow sources={executive.leadSources} delayMs={525} />

      <SalesFunnelRow funnel={executive.funnel} delayMs={600} />
    </div>
  );
}
