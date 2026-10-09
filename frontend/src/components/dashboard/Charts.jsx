import { Bar, BarChart, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Panel } from "@/components/common/Panel";
import { C } from "@/lib/format";

const tip = { contentStyle: { background: C.surface2, border: `1px solid ${C.line}`, borderRadius: 10, fontSize: 12, color: C.text }, itemStyle: { color: C.text }, cursor: { fill: "rgba(255,255,255,0.03)" } };
const CAT_COLORS = { Secret: C.crit, "Dependency vulnerability": C.warn, "Dependency manifest": C.accent2, "Dependency analysis": C.muted, Other: C.line };

export function SeverityChart({ summary, className }) {
  const data = [{ name: "Critical", value: summary.critical, fill: C.crit }, { name: "Warning", value: summary.warnings, fill: C.warn }];
  return (
    <Panel title="Findings by severity" description="Engine severities: CRITICAL and WARNING" className={className} testId="chart-severity">
      <div className="h-[180px]">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 160 }}>
          <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16 }}>
            <XAxis type="number" allowDecimals={false} stroke={C.muted} fontSize={11} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="name" stroke={C.muted} fontSize={12} width={64} tickLine={false} axisLine={false} />
            <Tooltip {...tip} />
            <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={26} isAnimationActive={false}>
              {data.map((d) => <Cell key={d.name} fill={d.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

export function CategoryChart({ counts, className }) {
  const data = Object.entries(counts).map(([name, value]) => ({ name, value }));
  return (
    <Panel title="Findings by category" className={className} testId="chart-category">
      {data.length === 0 ? <p className="text-sm text-pg-muted py-10 text-center">No findings in the latest scan.</p> : (
        <div className="flex items-center gap-4 h-[180px]">
          <div className="h-full w-[150px] shrink-0">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 160 }}>
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={44} outerRadius={68} paddingAngle={2} stroke="none" isAnimationActive={false}>
                  {data.map((d) => <Cell key={d.name} fill={CAT_COLORS[d.name] || C.line} />)}
                </Pie>
                <Tooltip {...tip} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="space-y-2 text-sm min-w-0">
            {data.map((d) => (
              <li key={d.name} className="flex items-center gap-2" data-testid={`chart-category-${d.name.replace(/\s+/g, "-").toLowerCase()}`}>
                <span className="h-2 w-2 rounded-sm shrink-0" style={{ background: CAT_COLORS[d.name] }} />
                <span className="text-pg-muted truncate">{d.name}</span>
                <span className="ml-auto font-mono pl-3">{d.value}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

export function DependencyRisk({ scan, className }) {
  const ins = scan.dependencies.insights;
  const sev = {};
  scan.findings.filter((f) => f.category === "Dependency vulnerability").forEach((f) => {
    const k = f.advisory_severity || "UNKNOWN";
    sev[k] = (sev[k] || 0) + 1;
  });
  const order = ["CRITICAL", "HIGH", "MODERATE", "LOW", "UNKNOWN"];
  const colors = { CRITICAL: C.crit, HIGH: "#FF8A8F", MODERATE: C.warn, LOW: C.muted, UNKNOWN: C.line };
  const rows = [["Packages inventoried", ins.total], ["Vulnerable", ins.vulnerable], ["No known advisories", ins.no_known_advisories], ["Not checked", ins.not_checked], ["Lookup failed", ins.lookup_failed]];
  return (
    <Panel title="Dependency risk overview" description={ins.mode === "online" ? "Live OSV lookup" : "Offline — advisories not checked"} className={className} testId="chart-dependency-risk">
      <div className="flex h-2 rounded-full overflow-hidden bg-pg-surface2 mb-3">
        {order.filter((k) => sev[k]).map((k) => <div key={k} style={{ flex: sev[k], background: colors[k] }} title={`${k}: ${sev[k]}`} />)}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-pg-muted mb-3">
        {order.filter((k) => sev[k]).map((k) => <span key={k}><span style={{ color: colors[k] }}>●</span> {k.toLowerCase()} {sev[k]}</span>)}
        {!Object.keys(sev).length && <span>No advisories recorded.</span>}
      </div>
      <dl className="text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between py-1.5 border-b border-pg-line/40 last:border-0">
            <dt className="text-pg-muted">{k}</dt><dd className="font-mono">{v}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

export function HistoryTrend({ items }) {
  const data = [...items].reverse().slice(-15).map((h, i) => ({ i, score: h.score }));
  return (
    <Panel title="Score trend" description={`Last ${data.length} stored scans`} testId="chart-history-trend">
      <div className="h-[90px]">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 160 }}>
          <LineChart data={data}>
            <YAxis domain={[0, 100]} hide />
            <Tooltip {...tip} labelFormatter={() => ""} />
            <Line type="monotone" dataKey="score" stroke={C.accent} strokeWidth={2} dot={{ r: 2.5, fill: C.accent }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
