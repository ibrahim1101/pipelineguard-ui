import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Package, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApp } from "@/context/AppContext";
import { EmptyState, Note, PageHeader } from "@/components/common/Panel";
import { PackageStatus, SeverityBadge } from "@/components/common/Badges";
import { VirtualTable } from "@/components/common/VirtualTable";
import ViewingBanner from "@/components/common/ViewingBanner";
import PackagePanel from "@/components/deps/PackagePanel";

const COLUMNS = [
  { key: "name", label: "Package", width: "minmax(150px,1.2fr)", sortable: true, render: (p) => <span className="font-medium">{p.name}</span> },
  { key: "version", label: "Version", width: "130px", render: (p) => <span className="font-mono text-xs">{p.version || <span className="text-pg-muted">{p.constraint || "unpinned"}</span>}</span> },
  { key: "ecosystem", label: "Ecosystem", width: "90px", sortable: true, render: (p) => <span className="text-pg-muted">{p.ecosystem}</span> },
  { key: "manifest", label: "Manifest", width: "minmax(140px,1fr)", sortable: true, render: (p) => <span className="font-mono text-xs text-pg-muted">{p.manifest}</span> },
  { key: "vulnerability_count", label: "Vulns", width: "70px", sortable: true, render: (p) => <span className={`font-mono ${p.vulnerability_count ? "text-pg-crit" : "text-pg-muted"}`}>{p.vulnerability_count}</span> },
  { key: "highest", label: "Highest", width: "100px", render: (p) => (p.highest_severity ? <SeverityBadge value={p.highest_severity} /> : <span className="text-pg-muted">—</span>) },
  { key: "status", label: "Analysis status", width: "190px", sortable: true, render: (p) => <PackageStatus status={p.status} /> },
];

const Tile = ({ label, value, tone, testId }) => (
  <div className="pg-panel px-4 py-3" data-testid={testId}>
    <p className="text-xs text-pg-muted">{label}</p>
    <p className={`text-2xl font-semibold tabular-nums mt-1 ${tone || ""}`}>{value}</p>
  </div>
);

export default function Dependencies() {
  const { currentScan: scan } = useApp();
  const nav = useNavigate();
  const [qText, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [eco, setEco] = useState("all");
  const [sort, setSort] = useState({ key: "vulnerability_count", dir: "desc" });
  const [selected, setSelected] = useState(null);

  const rows = useMemo(() => {
    if (!scan) return [];
    const n = qText.trim().toLowerCase();
    const list = scan.dependencies.packages.filter((p) => (status === "all" || p.status === status) && (eco === "all" || p.ecosystem === eco) && (!n || p.name.toLowerCase().includes(n)));
    const dir = sort.dir === "desc" ? -1 : 1;
    return [...list].sort((a, b) => {
      const x = a[sort.key] ?? "", y = b[sort.key] ?? "";
      return (typeof x === "number" ? x - y : String(x).localeCompare(String(y))) * dir || a.name.localeCompare(b.name);
    });
  }, [scan, qText, status, eco, sort]);

  if (!scan) return <><PageHeader title="Dependencies" /><div className="pg-panel"><EmptyState icon={Package} title="No dependency inventory yet" description="Run a scan to inventory requirements.txt, pyproject.toml, package.json and package-lock.json manifests." action={<Button onClick={() => nav("/scan")} data-testid="deps-go-scan-btn">Start a scan</Button>} /></div></>;

  const ins = scan.dependencies.insights;
  const pkg = scan.dependencies.packages.find((p) => p.uid === selected);
  const statuses = [...new Set(scan.dependencies.packages.map((p) => p.status))];
  const ecos = [...new Set(scan.dependencies.packages.map((p) => p.ecosystem))];
  return (
    <div className="flex flex-col min-h-[480px] h-[calc(100vh-164px)]">
      <PageHeader title="Dependencies" description={`${scan.dependencies.manifests.length} manifests · ${ins.mode === "online" ? "checked against OSV" : "offline inventory, advisories not checked"}`} />
      <ViewingBanner />
      <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-3 mb-3" data-testid="deps-insights">
        <Tile label="Packages" value={ins.total} testId="deps-insight-total" />
        <Tile label="Vulnerable" value={ins.vulnerable} tone={ins.vulnerable ? "text-pg-crit" : ""} testId="deps-insight-vulnerable" />
        <Tile label="No known advisories" value={ins.no_known_advisories} testId="deps-insight-clean" />
        <Tile label="Not checked" value={ins.not_checked} tone={ins.not_checked ? "text-pg-warn" : ""} testId="deps-insight-unchecked" />
        <Tile label="Lookup failed" value={ins.lookup_failed} tone={ins.lookup_failed ? "text-pg-warn" : ""} testId="deps-insight-failed" />
        <Tile label="Analysis mode" value={ins.mode === "online" ? "Online" : "Offline"} tone={ins.mode === "online" ? "text-pg-accent" : "text-pg-warn"} testId="deps-insight-mode" />
      </div>
      {ins.notices.length > 0 && <div className="mb-3"><Note tone="warn" testId="deps-notices">Engine notices: {ins.notices.join(" · ")} "No known advisories" means OSV returned none for that exact version — it is not a guarantee of safety.</Note></div>}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative w-full sm:w-[260px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-pg-muted" />
          <Input value={qText} onChange={(e) => setQ(e.target.value)} placeholder="Search packages" className="pl-9 bg-pg-surface" data-testid="deps-search-input" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[220px] bg-pg-surface" data-testid="deps-status-filter"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All analysis states</SelectItem>{statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={eco} onValueChange={setEco}>
          <SelectTrigger className="w-[150px] bg-pg-surface" data-testid="deps-ecosystem-filter"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All ecosystems</SelectItem>{ecos.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
        <span className="ml-auto text-xs text-pg-muted font-mono" data-testid="deps-visible-count">{rows.length} of {scan.dependencies.packages.length} packages</span>
      </div>
      <div className="flex gap-4 flex-1 min-h-0 min-w-0">
        <div className="pg-panel flex-1 min-w-0 overflow-hidden">
          <VirtualTable testId="deps-table" columns={COLUMNS} rows={rows} getKey={(p) => p.uid} selectedKey={selected} onSelect={(p) => setSelected(p.uid)} sort={sort} onSort={setSort}
            empty={<EmptyState compact title={scan.dependencies.packages.length ? "No packages match" : "No supported dependency manifests found"} testId="deps-empty" />} />
        </div>
        {pkg && <PackagePanel key={pkg.uid} pkg={pkg} onClose={() => setSelected(null)} />}
      </div>
    </div>
  );
}
