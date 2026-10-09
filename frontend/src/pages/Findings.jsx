import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, ShieldAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useApp } from "@/context/AppContext";
import { EmptyState, PageHeader } from "@/components/common/Panel";
import { SeverityBadge } from "@/components/common/Badges";
import { VirtualTable } from "@/components/common/VirtualTable";
import FindingInspector from "@/components/findings/FindingInspector";
import ViewingBanner from "@/components/common/ViewingBanner";
import { SEV_RANK, location } from "@/lib/format";

const effSev = (f) => (f.category === "Dependency vulnerability" && f.advisory_severity && f.advisory_severity !== "UNKNOWN" ? f.advisory_severity : f.severity);
const SORTERS = {
  severity: (a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity] || SEV_RANK[effSev(a)] - SEV_RANK[effSev(b)],
  category: (a, b) => a.category.localeCompare(b.category),
  rule: (a, b) => (a.advisory_id || a.rule).localeCompare(b.advisory_id || b.rule),
  target: (a, b) => (a.file || a.package || "").localeCompare(b.file || b.package || ""),
};

const COLUMNS = [
  { key: "severity", label: "Severity", width: "110px", sortable: true, render: (f) => <SeverityBadge value={f.severity} /> },
  { key: "category", label: "Category", width: "170px", sortable: true, render: (f) => <span className="text-pg-muted">{f.category}</span> },
  { key: "rule", label: "Rule / finding", width: "minmax(200px,1.4fr)", sortable: true, render: (f) => <span>{f.rule}{f.advisory_id && <span className="text-pg-muted font-mono text-xs ml-2">{f.advisory_id}</span>}</span> },
  { key: "target", label: "File or package", width: "minmax(160px,1fr)", sortable: true, render: (f) => <span className="font-mono text-xs">{f.file || f.package || "—"}</span> },
  { key: "location", label: "Location", width: "120px", render: (f) => <span className="font-mono text-xs text-pg-muted">{f.line ? `line ${f.line}` : f.version ? `v${f.version}` : "—"}</span> },
  { key: "status", label: "Status", width: "130px", render: (f) => <span className={`text-xs ${f.status === "Detected" ? "text-pg-text" : "text-pg-warn"}`}>{f.status}</span> },
];

export default function Findings() {
  const { currentScan: scan } = useApp();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [qText, setQ] = useState("");
  const [sev, setSev] = useState("all");
  const [cat, setCat] = useState("all");
  const [group, setGroup] = useState("all");
  const [sort, setSort] = useState({ key: "severity", dir: "desc" });
  const [selected, setSelected] = useState(params.get("f"));

  const rows = useMemo(() => {
    if (!scan) return [];
    const needle = qText.trim().toLowerCase();
    const list = scan.findings.filter((f) => {
      if (sev !== "all" && f.severity !== sev) return false;
      if (cat !== "all" && f.category !== cat) return false;
      if (group === "secrets" && f.category !== "Secret") return false;
      if (group === "dependencies" && !f.category.startsWith("Dependency")) return false;
      if (!needle) return true;
      return [f.rule, f.file, f.package, f.advisory_id, f.summary, ...(f.aliases || [])].some((v) => v && v.toLowerCase().includes(needle));
    });
    const dir = sort.dir === "desc" ? -1 : 1;
    return [...list].sort((a, b) => SORTERS[sort.key](a, b) * dir || a.index - b.index);
  }, [scan, qText, sev, cat, group, sort]);

  if (!scan) {
    return <><PageHeader title="Findings" /><div className="pg-panel"><EmptyState icon={ShieldAlert} title="No findings to review" description="Findings appear after a completed scan." action={<Button onClick={() => nav("/scan")} data-testid="findings-go-scan-btn">Start a scan</Button>} /></div></>;
  }
  const finding = scan.findings.find((f) => f.uid === selected);
  const filtered = qText || sev !== "all" || cat !== "all" || group !== "all";
  const clear = () => { setQ(""); setSev("all"); setCat("all"); setGroup("all"); };

  return (
    <div className="flex flex-col min-h-[480px] h-[calc(100vh-164px)]">
      <PageHeader title="Findings" description={`${scan.summary.total_findings} findings · ${scan.summary.critical} critical · ${scan.summary.warnings} warnings`} />
      <ViewingBanner />
      <div className="flex flex-wrap items-center gap-2 mb-3" data-testid="findings-filters">
        <div className="relative w-full sm:w-[280px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-pg-muted" />
          <Input value={qText} onChange={(e) => setQ(e.target.value)} placeholder="Search rule, file, package, advisory" className="pl-9 bg-pg-surface" data-testid="findings-search-input" />
        </div>
        <Select value={sev} onValueChange={setSev}>
          <SelectTrigger className="w-[150px] bg-pg-surface" data-testid="findings-severity-filter"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All severities</SelectItem><SelectItem value="CRITICAL">Critical</SelectItem><SelectItem value="WARNING">Warning</SelectItem></SelectContent>
        </Select>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="w-[200px] bg-pg-surface" data-testid="findings-category-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {Object.keys(scan.category_counts).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <ToggleGroup type="single" value={group} onValueChange={(v) => setGroup(v || "all")} className="rounded-lg border border-pg-line bg-pg-surface p-0.5" data-testid="findings-group-toggle">
          <ToggleGroupItem value="all" className="h-8 px-3 text-xs data-[state=on]:bg-pg-surface2" data-testid="findings-group-all">All</ToggleGroupItem>
          <ToggleGroupItem value="secrets" className="h-8 px-3 text-xs data-[state=on]:bg-pg-surface2" data-testid="findings-group-secrets">Secrets</ToggleGroupItem>
          <ToggleGroupItem value="dependencies" className="h-8 px-3 text-xs data-[state=on]:bg-pg-surface2" data-testid="findings-group-dependencies">Dependencies</ToggleGroupItem>
        </ToggleGroup>
        {filtered && <Button variant="ghost" size="sm" onClick={clear} data-testid="findings-clear-filters-btn"><X className="h-4 w-4 mr-1" />Clear filters</Button>}
        <span className="ml-auto text-xs text-pg-muted font-mono" data-testid="findings-visible-count">{rows.length} of {scan.findings.length} shown</span>
      </div>
      <div className="flex gap-4 flex-1 min-h-0 min-w-0">
        <div className="pg-panel flex-1 min-w-0 overflow-hidden">
          <VirtualTable testId="findings-table" columns={COLUMNS} rows={rows} getKey={(f) => f.uid} selectedKey={selected}
            onSelect={(f) => setSelected(f.uid)} sort={sort} onSort={setSort}
            empty={<EmptyState compact title={scan.findings.length ? "No findings match these filters" : "No findings in this scan"} testId="findings-empty" />} />
        </div>
        {finding && <FindingInspector key={finding.uid} finding={finding} scanId={scan.scan_id} onClose={() => setSelected(null)} />}
      </div>
      <p className="sr-only">{location(finding || {})}</p>
    </div>
  );
}
