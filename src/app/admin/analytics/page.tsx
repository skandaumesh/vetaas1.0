"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import { useAdminAuth } from "@/components/admin/AdminGate";
import { AlertTriangle, Loader2 } from "lucide-react";

interface AnalyticsData {
  totals: { users: number; sessions: number; pageViews: number; avgSessionSeconds: number };
  timeseries: { date: string; users: number }[];
  pages: { path: string; views: number; avgSeconds: number }[];
  sources: { channel: string; sessions: number }[];
  countries: { country: string; code: string; users: number }[];
  cities: { city: string; users: number }[];
  hours: { hour: number; sessions: number }[];
  days: number;
}

// "IN" -> 🇮🇳 — regional-indicator letters sit 127397 above ASCII A-Z
const flagFor = (code: string) =>
  code && code.length === 2
    ? String.fromCodePoint(...[...code.toUpperCase()].map((c) => c.charCodeAt(0) + 127397))
    : "🌍";

const RANGES = [
  { days: 7, label: "7 days" },
  { days: 28, label: "28 days" },
  { days: 90, label: "90 days" },
];

const getSiteAnalytics = httpsCallable<{ days: number }, AnalyticsData>(
  functions,
  "getSiteAnalytics"
);

const fmtDuration = (s: number) => {
  if (!s) return "0s";
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
};

const fmtNum = (n: number) => n.toLocaleString("en-IN");

const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

/**
 * GA4 omits days with no traffic, so a 28-day range can come back with only a
 * handful of rows — which previously rendered as a few enormous bars with no
 * sense of the timeline. Pad the gaps back to zero so the chart spans the
 * whole period.
 */
function fillDays(rows: { date: string; users: number }[], days: number) {
  const seen = new Map(rows.map((r) => [r.date, r.users]));
  const today = new Date();
  const out: { date: string; users: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = isoDay(d);
    out.push({ date: key, users: seen.get(key) ?? 0 });
  }
  return out;
}

const fillHours = (rows: { hour: number; sessions: number }[]) => {
  const seen = new Map(rows.map((r) => [r.hour, r.sessions]));
  return Array.from({ length: 24 }, (_, h) => ({ hour: h, sessions: seen.get(h) ?? 0 }));
};

const hourLabel = (h: number) => `${h % 12 || 12}${h < 12 ? "am" : "pm"}`;

const shortDate = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });

/** Round the axis up to a round number so the gridlines read cleanly. */
function niceCeil(n: number) {
  if (n <= 5) return 5;
  const p = Math.pow(10, Math.floor(Math.log10(n)));
  for (const m of [1, 2, 2.5, 5]) if (m * p >= n) return m * p;
  return 10 * p;
}

/**
 * The chart draws in real pixels: the viewBox matches the measured container
 * width, so nothing is letterboxed. A fixed 760-wide viewBox scaled down to a
 * phone drew the plot only ~84px tall inside a 200px box, leaving most of the
 * card empty.
 *
 * Readout is pointer-driven rather than an SVG <title>, because title tooltips
 * need a hover and never appear on a touch screen.
 */
function VisitorsLineChart({ series }: { series: { date: string; users: number }[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(760);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(260, Math.round(entry.contentRect.width)))
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const H = 230;
  const padL = 34;
  const padR = 12;
  const padT = 16;
  const padB = 30;
  const innerW = Math.max(1, width - padL - padR);
  const innerH = H - padT - padB;

  const ceil = niceCeil(Math.max(...series.map((s) => s.users), 1));
  const x = (i: number) =>
    series.length <= 1 ? padL + innerW / 2 : padL + (i / (series.length - 1)) * innerW;
  const y = (v: number) => padT + innerH - (v / ceil) * innerH;

  const line = series.map((s, i) => `${x(i)},${y(s.users)}`).join(" ");
  const area = `${padL},${padT + innerH} ${line} ${x(series.length - 1)},${padT + innerH}`;
  const ticks = [0, ceil / 2, ceil];
  // Fewer date labels on a narrow screen, or they collide.
  const labelEvery = Math.max(1, Math.ceil(series.length / Math.max(3, Math.floor(width / 78))));

  const pick = (clientX: number) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || series.length === 0) return;
    const ratio = (clientX - rect.left - padL) / innerW;
    const i = Math.round(ratio * (series.length - 1));
    setActive(Math.max(0, Math.min(series.length - 1, i)));
  };

  const point = active !== null ? series[active] : null;

  return (
    <div ref={wrapRef} className="relative w-full select-none" style={{ height: H }}>
      <svg
        viewBox={`0 0 ${width} ${H}`}
        width={width}
        height={H}
        className="block touch-none"
        role="img"
        aria-label="Visitors per day"
        onPointerDown={(e) => pick(e.clientX)}
        onPointerMove={(e) => {
          if (e.pointerType === "mouse" || e.buttons > 0) pick(e.clientX);
        }}
        onPointerLeave={() => setActive(null)}
      >
        <defs>
          <linearGradient id="visitorsFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} stroke="#e2e8f0" strokeWidth="1" />
            <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#94a3b8">
              {t}
            </text>
          </g>
        ))}

        <polygon points={area} fill="url(#visitorsFill)" />
        <polyline
          points={line}
          fill="none"
          stroke="#7c3aed"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {series.length <= 31 &&
          series.map((s, i) => <circle key={s.date} cx={x(i)} cy={y(s.users)} r="2.5" fill="#7c3aed" />)}

        {point && active !== null && (
          <g>
            <line
              x1={x(active)}
              x2={x(active)}
              y1={padT}
              y2={padT + innerH}
              stroke="#7c3aed"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <circle cx={x(active)} cy={y(point.users)} r="5" fill="#7c3aed" stroke="#fff" strokeWidth="2" />
          </g>
        )}

        {series.map((s, i) =>
          i % labelEvery === 0 ? (
            <text key={`l-${s.date}`} x={x(i)} y={H - 9} textAnchor="middle" fontSize="11" fill="#94a3b8">
              {shortDate(s.date)}
            </text>
          ) : null
        )}
      </svg>

      {point && active !== null && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg bg-slate-900 px-2.5 py-1.5 text-center shadow-lg"
          style={{ left: Math.min(Math.max(x(active), 52), width - 52), top: y(point.users) - 10 }}
        >
          <p className="text-[11px] font-semibold text-white whitespace-nowrap tabular-nums">
            {point.users} visitor{point.users === 1 ? "" : "s"}
          </p>
          <p className="text-[10px] text-slate-400 whitespace-nowrap">{shortDate(point.date)}</p>
        </div>
      )}
    </div>
  );
}


export default function AdminAnalyticsPage() {
  const { user } = useAdminAuth();
  const [days, setDays] = useState(28);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Tapped hour bar — title tooltips never show on a touch screen.
  const [activeHour, setActiveHour] = useState<number | null>(null);

  const load = useCallback(async (range: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getSiteAnalytics({ days: range });
      setData(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load analytics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) load(days);
  }, [user, days, load]);

  const dailySeries = fillDays(data?.timeseries ?? [], data?.days ?? days);
  const busiestDay = dailySeries.reduce(
    (a, b) => (b.users > a.users ? b : a),
    dailySeries[0] ?? { date: isoDay(new Date()), users: 0 }
  );
  const hourSeries = fillHours(data?.hours ?? []);
  const peakHour = hourSeries.reduce((a, b) => (b.sessions > a.sessions ? b : a), hourSeries[0]);
  const peakHourSessions = Math.max(1, peakHour.sessions);
  const totalSourceSessions = (data?.sources ?? []).reduce((s, x) => s + x.sessions, 0) || 1;
  const topPageViews = Math.max(1, ...(data?.pages ?? []).map((p) => p.views));
  const topCountryUsers = Math.max(1, ...(data?.countries ?? []).map((c) => c.users));
  const topCityUsers = Math.max(1, ...(data?.cities ?? []).map((c) => c.users));

  return (
    <main className="min-h-screen py-8 md:py-10 px-4 md:px-10">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <header className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-[2.15rem] font-semibold tracking-[-0.02em] text-slate-900">
              Site <span className="text-slate-300">analytics</span>
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Visitors, time spent, popular pages, peak hours and traffic sources.
            </p>
          </div>
          <div className="inline-flex bg-slate-100 rounded-lg p-0.5">
            {RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => setDays(r.days)}
                className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors cursor-pointer ${
                  days === r.days
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </header>

        {error ? (
          <div className="glass-card rounded-xl p-6 flex gap-3">
            <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-slate-900 mb-1">
                Analytics isn&apos;t connected yet
              </p>
              <p className="text-[13px] text-slate-500 leading-relaxed mb-2">
                Tracking has been added to the site, but the dashboard still needs read
                access to the Google Analytics property. Until then this page stays empty.
              </p>
              <p className="text-[12px] font-mono text-slate-400 break-all">{error}</p>
            </div>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="animate-spin text-slate-300" size={24} />
          </div>
        ) : data ? (
          <>
            {/* Totals */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-200 border border-slate-200 rounded-xl overflow-hidden mb-8">
              {[
                { label: "Visitors", value: fmtNum(data.totals.users), sub: `last ${data.days} days` },
                { label: "Sessions", value: fmtNum(data.totals.sessions), sub: "visits in total" },
                { label: "Page views", value: fmtNum(data.totals.pageViews), sub: "pages opened" },
                {
                  label: "Avg. visit",
                  value: fmtDuration(data.totals.avgSessionSeconds),
                  sub: "time on site",
                },
              ].map((card) => (
                <div key={card.label} className="bg-white px-5 py-5">
                  <p className="text-[13px] font-medium text-slate-400 mb-3">{card.label}</p>
                  <p className="text-[2.5rem] font-semibold tabular-nums tracking-[-0.03em] leading-none mb-2 text-slate-900">
                    {card.value}
                  </p>
                  <p className="text-xs text-slate-300">{card.sub}</p>
                </div>
              ))}
            </div>

            {/* Visitors over time */}
            <div className="glass-solid rounded-xl p-6 mb-6">
              <div className="flex items-baseline justify-between gap-4 mb-4">
                <p className="text-[13px] font-medium text-slate-400">Visitors per day</p>
                <p className="text-[12px] text-slate-400 tabular-nums">
                  {fmtNum(busiestDay.users)} on {shortDate(busiestDay.date)} · best day
                </p>
              </div>
              {data.timeseries.length === 0 ? (
                <p className="text-sm text-slate-400 py-8 text-center">No data yet.</p>
              ) : (
                <VisitorsLineChart series={dailySeries} />
              )}
            </div>

            {/* Hour of day */}
            <div className="glass-solid rounded-xl p-6 mb-6">
              <div className="flex items-baseline justify-between gap-4 mb-5">
                <p className="text-[13px] font-medium text-slate-400">
                  When people visit
                </p>
                <p className="text-[12px] text-slate-400 tabular-nums">
                  {activeHour !== null
                    ? `${hourLabel(activeHour)} · ${fmtNum(
                        hourSeries[activeHour].sessions
                      )} visit${hourSeries[activeHour].sessions === 1 ? "" : "s"}`
                    : peakHour.sessions > 0
                      ? `Busiest around ${hourLabel(peakHour.hour)}`
                      : "No data yet"}
                </p>
              </div>
              <div className="flex items-end gap-[3px] h-28">
                {hourSeries.map((h) => {
                  const highlighted =
                    activeHour === h.hour ||
                    (activeHour === null && h.hour === peakHour.hour && peakHour.sessions > 0);
                  return (
                    <button
                      key={h.hour}
                      type="button"
                      onClick={() => setActiveHour(activeHour === h.hour ? null : h.hour)}
                      aria-label={`${hourLabel(h.hour)}: ${h.sessions} visits`}
                      className="flex-1 flex flex-col justify-end h-full cursor-pointer"
                    >
                      <span
                        className={`w-full rounded-t transition-colors min-h-[2px] ${
                          highlighted ? "bg-violet-600" : "bg-violet-500/35 hover:bg-violet-500/60"
                        }`}
                        style={{ height: `${(h.sessions / peakHourSessions) * 100}%` }}
                      />
                    </button>
                  );
                })}
              </div>
              <div className="flex justify-between mt-2 text-[11px] text-slate-400 tabular-nums">
                {[0, 6, 12, 18, 23].map((h) => (
                  <span key={h}>{hourLabel(h)}</span>
                ))}
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Top pages */}
              <div className="glass-solid rounded-xl p-6">
                <div className="flex items-baseline justify-between gap-4 mb-5">
                  <p className="text-[13px] font-medium text-slate-400">Most visited pages</p>
                  <p className="text-[11px] text-slate-400 uppercase tracking-wider">
                    Views · Time on page
                  </p>
                </div>
                {data.pages.length === 0 ? (
                  <p className="text-sm text-slate-400 py-6 text-center">No data yet.</p>
                ) : (
                  <div className="space-y-3">
                    {data.pages.map((p) => (
                      <div key={p.path}>
                        <div className="flex items-baseline justify-between gap-4 mb-1">
                          <span className="text-[13px] text-slate-700 truncate">{p.path}</span>
                          <span className="flex items-baseline gap-3 shrink-0">
                            <span className="text-[13px] font-medium text-slate-900 tabular-nums">
                              {fmtNum(p.views)}
                            </span>
                            <span className="text-[12px] text-slate-400 tabular-nums w-14 text-right">
                              {fmtDuration(p.avgSeconds)}
                            </span>
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-violet-500"
                            style={{ width: `${Math.max(2, (p.views / topPageViews) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Traffic sources */}
              <div className="glass-solid rounded-xl p-6">
                <p className="text-[13px] font-medium text-slate-400 mb-5">Where visitors came from</p>
                {data.sources.length === 0 ? (
                  <p className="text-sm text-slate-400 py-6 text-center">No data yet.</p>
                ) : (
                  <div className="space-y-3">
                    {data.sources.map((s) => (
                      <div key={s.channel} className="flex items-center gap-3">
                        <span className="text-[13px] text-slate-700 flex-1 truncate">
                          {s.channel}
                        </span>
                        <div className="w-28 bg-slate-100 rounded-full h-1.5 overflow-hidden shrink-0">
                          <div
                            className="h-full rounded-full bg-emerald-500"
                            style={{
                              width: `${Math.max(2, (s.sessions / totalSourceSessions) * 100)}%`,
                            }}
                          />
                        </div>
                        <span className="text-[13px] font-medium text-slate-900 tabular-nums w-10 text-right shrink-0">
                          {fmtNum(s.sessions)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Countries */}
              <div className="glass-solid rounded-xl p-6">
                <p className="text-[13px] font-medium text-slate-400 mb-5">Countries</p>
                {data.countries.length === 0 ? (
                  <p className="text-sm text-slate-400 py-6 text-center">No data yet.</p>
                ) : (
                  <div className="space-y-3">
                    {data.countries.map((c) => (
                      <div key={c.country} className="flex items-center gap-3">
                        <span className="text-base leading-none shrink-0">{flagFor(c.code)}</span>
                        <span className="text-[13px] text-slate-700 flex-1 truncate">
                          {c.country}
                        </span>
                        <div className="w-24 bg-slate-100 rounded-full h-1.5 overflow-hidden shrink-0">
                          <div
                            className="h-full rounded-full bg-violet-500"
                            style={{ width: `${Math.max(2, (c.users / topCountryUsers) * 100)}%` }}
                          />
                        </div>
                        <span className="text-[13px] font-medium text-slate-900 tabular-nums w-10 text-right shrink-0">
                          {fmtNum(c.users)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Cities */}
              <div className="glass-solid rounded-xl p-6">
                <p className="text-[13px] font-medium text-slate-400 mb-5">Cities</p>
                {data.cities.length === 0 ? (
                  <p className="text-sm text-slate-400 py-6 text-center">No data yet.</p>
                ) : (
                  <div className="space-y-3">
                    {data.cities.map((c) => (
                      <div key={c.city} className="flex items-center gap-3">
                        <span className="text-[13px] text-slate-700 flex-1 truncate">{c.city}</span>
                        <div className="w-24 bg-slate-100 rounded-full h-1.5 overflow-hidden shrink-0">
                          <div
                            className="h-full rounded-full bg-amber-500"
                            style={{ width: `${Math.max(2, (c.users / topCityUsers) * 100)}%` }}
                          />
                        </div>
                        <span className="text-[13px] font-medium text-slate-900 tabular-nums w-10 text-right shrink-0">
                          {fmtNum(c.users)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
