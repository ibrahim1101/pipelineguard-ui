export function MetricCard({ label, value, sub, icon: Icon, tone, children, testId }) {
  const color = { crit: "text-pg-crit", warn: "text-pg-warn", ok: "text-pg-accent" }[tone] || "text-pg-text";
  return (
    <div className="pg-panel pg-metal p-4 flex flex-col justify-between min-h-[124px] hover:border-pg-line transition-colors" data-testid={testId}>
      <div className="flex items-center justify-between text-xs text-pg-muted">
        <span>{label}</span>
        {Icon && <Icon className="h-4 w-4" strokeWidth={1.7} />}
      </div>
      <div className="mt-3">
        {children || <div className={`text-3xl font-semibold tabular-nums tracking-tight ${color}`} data-testid={testId && `${testId}-value`}>{value}</div>}
        {sub && <div className="text-xs text-pg-muted mt-1.5">{sub}</div>}
      </div>
    </div>
  );
}

export function ScoreRing({ score, status, size = 64 }) {
  const color = status === "SAFE" ? "#A4D65E" : status === "WARNING" ? "#F0B65C" : "#FF5964";
  const r = size / 2 - 5;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="-rotate-90" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} stroke="#252C2B" strokeWidth="5" fill="none" />
      <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth="5" fill="none" strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - (score || 0) / 100)} style={{ transition: "stroke-dashoffset .6s ease" }} />
    </svg>
  );
}
