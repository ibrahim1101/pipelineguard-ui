export function Panel({ title, description, actions, children, className = "", bodyClass = "", testId }) {
  return (
    <section className={`pg-panel flex flex-col min-w-0 ${className}`} data-testid={testId}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-4 px-5 pt-4 pb-3">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-pg-text">{title}</h2>}
            {description && <p className="text-xs text-pg-muted mt-0.5 leading-relaxed">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </header>
      )}
      <div className={`px-5 pb-5 pg-density-pad flex-1 min-h-0 ${bodyClass}`}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, description, actions, testId = "page-header" }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6" data-testid={testId}>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-pg-text">{title}</h1>
        {description && <p className="text-sm text-pg-muted mt-1 max-w-3xl leading-relaxed">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function KV({ label, children, mono, testId }) {
  return (
    <div className="grid grid-cols-[130px_1fr] gap-3 py-2 border-b border-pg-line/40 last:border-0 text-sm">
      <dt className="text-pg-muted">{label}</dt>
      <dd className={`min-w-0 break-words ${mono ? "font-mono text-[12.5px]" : ""}`} data-testid={testId}>{children ?? "—"}</dd>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action, testId = "empty-state", compact }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? "py-8" : "py-16"} px-6`} data-testid={testId}>
      {Icon && (
        <div className="h-12 w-12 rounded-xl border border-pg-line bg-pg-surface2 grid place-items-center pg-metal">
          <Icon className="h-5 w-5 text-pg-muted" strokeWidth={1.6} />
        </div>
      )}
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      {description && <p className="mt-1.5 text-sm text-pg-muted max-w-md leading-relaxed">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function InlineError({ message, testId = "inline-error" }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-lg border border-pg-crit/40 bg-pg-crit/[0.07] px-3 py-2 text-sm text-[#FF9AA0]" data-testid={testId}>
      {message}
    </div>
  );
}

export function Note({ children, tone = "muted", testId }) {
  const tones = { muted: "border-pg-line/70 text-pg-muted", warn: "border-pg-warn/35 text-pg-warn bg-pg-warn/[0.05]" };
  return <div className={`rounded-lg border px-3 py-2 text-xs leading-relaxed ${tones[tone]}`} data-testid={testId}>{children}</div>;
}
