import { ExternalLink } from "lucide-react";
import { SeverityBadge } from "@/components/common/Badges";

const rangeText = (r) => r.events.map((e) => Object.entries(e).map(([k, v]) => `${k.replace("_", " ")} ${v}`).join(", ")).join(" → ");

export default function AdvisoryDetails({ advisory: a }) {
  return (
    <section className="space-y-3" data-testid={`advisory-details-${a.advisory_id}`}>
      {a.aliases?.length > 0 && (
        <div><h3 className="text-xs text-pg-muted mb-1">Aliases</h3><p className="font-mono text-xs break-words">{a.aliases.join(", ")}</p></div>
      )}
      <div className="flex flex-wrap gap-4 text-sm">
        <div><h3 className="text-xs text-pg-muted mb-1">Advisory severity</h3><SeverityBadge value={a.advisory_severity} /></div>
        {a.cvss_score != null && <div><h3 className="text-xs text-pg-muted mb-1">CVSS score</h3><span className="font-mono">{a.cvss_score}</span></div>}
      </div>
      <div>
        <h3 className="text-xs text-pg-muted mb-1">Fixed versions</h3>
        <p className="font-mono text-xs" data-testid="advisory-fixed-versions">{a.fixed_versions?.length ? a.fixed_versions.join(", ") : "Not supplied by the advisory"}</p>
      </div>
      {a.affected_ranges?.length > 0 && (
        <div>
          <h3 className="text-xs text-pg-muted mb-1">Affected ranges</h3>
          <ul className="font-mono text-xs space-y-1">{a.affected_ranges.map((r, i) => <li key={i}><span className="text-pg-muted">{r.type}</span> {rangeText(r)}</li>)}</ul>
        </div>
      )}
      {a.references?.length > 0 && (
        <div>
          <h3 className="text-xs text-pg-muted mb-1">References</h3>
          <ul className="space-y-1">
            {a.references.slice(0, 8).map((u) => (
              <li key={u}><a href={u} target="_blank" rel="noopener noreferrer nofollow" className="text-xs text-pg-accent hover:underline inline-flex items-center gap-1 break-all"><ExternalLink className="h-3 w-3 shrink-0" />{u}</a></li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
