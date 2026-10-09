import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KV } from "@/components/common/Panel";
import { PackageStatus, SeverityBadge } from "@/components/common/Badges";
import AdvisoryDetails from "@/components/deps/AdvisoryDetails";

export default function PackagePanel({ pkg: p, onClose }) {
  return (
    <aside className="pg-panel w-[440px] shrink-0 flex flex-col min-h-0" data-testid="package-panel">
      <header className="px-5 pt-4 pb-3 border-b border-pg-line/60 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold truncate" data-testid="package-panel-name">{p.name}</h2>
          <p className="text-xs text-pg-muted font-mono mt-0.5">{p.ecosystem} · {p.version || p.constraint || "unpinned"}</p>
        </div>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onClose} aria-label="Close package panel" data-testid="package-panel-close-btn"><X className="h-4 w-4" /></Button>
      </header>
      <div className="flex-1 overflow-y-auto pg-scroll px-5 py-4 space-y-5">
        <dl>
          <KV label="Version" mono>{p.version || "No exact version"}</KV>
          <KV label="Declared as" mono>{p.constraint || "—"} <span className="text-pg-muted">({p.constraint_type})</span></KV>
          <KV label="Ecosystem">{p.ecosystem}</KV>
          <KV label="Manifest" mono>{p.manifest}</KV>
          <KV label="Lockfile">{p.resolved ? "Resolved from lockfile" : "Declared in manifest"}</KV>
          <KV label="Analysis"><PackageStatus status={p.status} testId="package-panel-status" /></KV>
        </dl>
        <section>
          <h3 className="text-xs text-pg-muted mb-2">Known vulnerabilities ({p.advisories.length})</h3>
          {p.advisories.length === 0 ? (
            <p className="text-sm text-pg-muted" data-testid="package-panel-no-advisories">
              {p.status === "No known advisories" ? "OSV returned no advisories for this exact version." : "No advisory data — this package was not checked."}
            </p>
          ) : (
            <ul className="space-y-3">
              {p.advisories.map((a) => (
                <li key={a.uid} className="rounded-lg border border-pg-line/70 bg-pg-bg/50 p-3.5" data-testid={`package-advisory-${a.advisory_id}`}>
                  <div className="flex items-center gap-2 mb-1.5"><SeverityBadge value={a.advisory_severity} /><span className="font-mono text-xs">{a.advisory_id}</span></div>
                  {a.summary && <p className="text-sm leading-relaxed mb-2">{a.summary}</p>}
                  <AdvisoryDetails advisory={a} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </aside>
  );
}
