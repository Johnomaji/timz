"use client";

import type { LucideIcon } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useMoney } from "@/lib/store";
import { cn } from "@/lib/utils";

const AXIS = { stroke: "#5a6a85", fontSize: 11 };

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value?: number | string; name?: string }[];
  label?: string | number;
}) {
  // Above the early return: hooks cannot sit behind a conditional.
  const money = useMoney();
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs shadow-xl">
      {label !== undefined && <p className="mb-1 text-faint">{label}</p>}
      {payload.map((entry, i) => (
        <p key={i} className="font-mono font-medium text-ink">
          {money(Number(entry.value ?? 0))}
        </p>
      ))}
    </div>
  );
}

export function EarningsChart({ data }: { data: { label: string; value: number }[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id="earningsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS} interval="preserveStartEnd" />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={AXIS}
            tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#1e2a41" }} />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#earningsFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function VolumeChart({ data }: { data: { label: string; value: number }[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS} />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={AXIS}
            tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "#131b2c" }} />
          <Bar dataKey="value" fill="#8b5cf6" radius={[6, 6, 0, 0]} maxBarSize={38} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const DONUT_COLORS = ["#10b981", "#8b5cf6", "#22d3ee", "#f59e0b", "#f43f5e"];

export function AllocationDonut({ data }: { data: { name: string; value: number }[] }) {
  const money = useMoney();
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <div className="relative h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              innerRadius={58}
              outerRadius={82}
              paddingAngle={2}
              stroke="none"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-faint">Allocated</span>
          <span className="font-mono text-lg font-semibold text-ink">
            {money(total, { compact: true })}
          </span>
        </div>
      </div>

      <ul className="w-full space-y-2.5">
        {data.map((entry, i) => (
          <li key={entry.name} className="flex items-center gap-2.5 text-sm">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}
            />
            <span className="flex-1 truncate text-muted">{entry.name}</span>
            <span className="font-mono text-ink">{money(entry.value, { compact: true })}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "brand",
}: {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  tone?: "brand" | "violet" | "cyan" | "warn" | "danger";
}) {
  const tones = {
    brand: "bg-brand/12 text-brand",
    violet: "bg-violet/12 text-violet",
    cyan: "bg-cyan/12 text-cyan",
    warn: "bg-warn/12 text-warn",
    danger: "bg-danger/12 text-danger",
  } as const;

  return (
    <div className="rounded-xl2 border border-line bg-surface/80 p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted">{label}</p>
        <span className={cn("flex size-8 items-center justify-center rounded-lg", tones[tone])}>
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-3 font-mono text-2xl font-semibold tracking-tight text-ink">{value}</p>
      {sub && <p className="mt-1 text-xs text-faint">{sub}</p>}
    </div>
  );
}
