const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export default function ProfilePicker({ profiles, value, onChange, disabled }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-2.5" role="radiogroup" aria-label="Scan profile">
      {profiles.map((p) => {
        const active = p.name === value;
        const declared = Object.entries(p.declared_flags).filter(([, v]) => v).map(([k]) => k.replace("_", " "));
        return (
          <button key={p.name} role="radio" aria-checked={active} disabled={disabled} onClick={() => onChange(p.name)} data-testid={`profile-option-${p.name}`}
            className={`text-left rounded-xl border p-3.5 transition-colors disabled:opacity-60 ${active ? "border-pg-accent/60 bg-pg-accent/[0.06]" : "border-pg-line bg-pg-bg/40 hover:border-pg-line hover:bg-pg-surface2/50"}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{cap(p.name)}</span>
              <span className={`h-3.5 w-3.5 rounded-full border-2 ${active ? "border-pg-accent bg-pg-accent/30" : "border-pg-line"}`} />
            </div>
            <ul className="mt-2 space-y-0.5 text-xs text-pg-muted leading-relaxed">
              {p.notes.map((n) => <li key={n}>{n}</li>)}
            </ul>
            {declared.length > 0 && (
              <p className="mt-2 text-[11px] text-pg-muted/80 italic">Declares {declared.join(" & ")} — not yet used by the current engine.</p>
            )}
          </button>
        );
      })}
    </div>
  );
}
