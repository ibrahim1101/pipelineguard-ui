import { NavLink } from "react-router-dom";
import { FileText, Globe2, History, LayoutDashboard, Package, Radar, Settings2, ShieldAlert, ShieldCheck } from "lucide-react";
import { useApp } from "@/context/AppContext";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, id: "dashboard" },
  { to: "/scan", label: "Scan Project", icon: Radar, id: "scan" },
  { to: "/findings", label: "Findings", icon: ShieldAlert, id: "findings", count: "findings" },
  { to: "/dependencies", label: "Dependencies", icon: Package, id: "dependencies", count: "deps" },
  { to: "/osv", label: "OSV Intelligence", icon: Globe2, id: "osv" },
  { to: "/reports", label: "Reports", icon: FileText, id: "reports" },
  { to: "/history", label: "Scan History", icon: History, id: "history" },
  { to: "/settings", label: "Settings", icon: Settings2, id: "settings" },
];

export default function Sidebar() {
  const { latest } = useApp();
  const counts = { findings: latest?.summary?.total_findings, deps: latest?.dependencies?.insights?.total };
  return (
    <nav className="w-[232px] shrink-0 bg-pg-side border-r border-pg-line/80 flex flex-col justify-between py-4 px-3" aria-label="Main navigation" data-testid="sidebar">
      <ul className="space-y-1">
        {NAV.map(({ to, label, icon: Icon, id, count }) => (
          <li key={id}>
            <NavLink
              to={to}
              end={to === "/"}
              data-testid={`nav-${id}`}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  isActive ? "bg-pg-surface text-pg-text font-medium" : "text-pg-muted hover:text-pg-text hover:bg-pg-surface/60"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r bg-pg-accent transition-opacity ${isActive ? "opacity-100" : "opacity-0"}`} />
                  <Icon className={`h-[18px] w-[18px] ${isActive ? "text-pg-accent" : ""}`} strokeWidth={1.8} />
                  <span className="flex-1">{label}</span>
                  {count && counts[count] != null && (
                    <span className="font-mono text-[11px] text-pg-muted bg-pg-surface2 rounded px-1.5 py-0.5" data-testid={`nav-${id}-count`}>
                      {counts[count]}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
      <div className="px-3 py-3 rounded-lg border border-pg-line/60 bg-pg-bg/60 text-xs text-pg-muted leading-relaxed" data-testid="sidebar-privacy-note">
        <ShieldCheck className="h-4 w-4 text-pg-accent2 mb-1.5" />
        Local-first. No telemetry. Source code never leaves this machine.
      </div>
    </nav>
  );
}
