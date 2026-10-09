import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

/** Windowed table: renders only visible rows so large finding sets stay smooth. */
export function VirtualTable({ columns, rows, getKey, selectedKey, onSelect, sort, onSort, rowHeight = 46, testId, empty }) {
  const ref = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewH, setViewH] = useState(500);
  useEffect(() => {
    const el = ref.current;
    const ro = new ResizeObserver(() => setViewH(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const template = columns.map((c) => c.width || "1fr").join(" ");
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - 6);
  const end = Math.min(rows.length, Math.ceil((scrollTop + viewH) / rowHeight) + 6);
  const selIndex = rows.findIndex((r) => getKey(r) === selectedKey);

  const onKey = (e) => {
    if (!["ArrowDown", "ArrowUp"].includes(e.key) || !rows.length) return;
    e.preventDefault();
    const next = Math.min(rows.length - 1, Math.max(0, selIndex + (e.key === "ArrowDown" ? 1 : -1)));
    onSelect(rows[next]);
    const top = next * rowHeight;
    if (top < ref.current.scrollTop) ref.current.scrollTop = top;
    if (top + rowHeight > ref.current.scrollTop + viewH - rowHeight) ref.current.scrollTop = top - viewH + rowHeight * 2;
  };

  return (
    <div className="flex flex-col min-h-0 h-full" data-testid={testId}>
      <div className="grid gap-3 px-4 py-2.5 text-xs text-pg-muted border-b border-pg-line/70 bg-pg-surface2/40" style={{ gridTemplateColumns: template }} role="row">
        {columns.map((c) => (
          <button key={c.key} type="button" disabled={!c.sortable}
            onClick={() => onSort?.({ key: c.key, dir: sort?.key === c.key && sort.dir === "desc" ? "asc" : "desc" })}
            className="flex items-center gap-1 text-left disabled:cursor-default hover:text-pg-text disabled:hover:text-pg-muted transition-colors"
            data-testid={`${testId}-sort-${c.key}`}>
            {c.label}
            {sort?.key === c.key && (sort.dir === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}
          </button>
        ))}
      </div>
      <div ref={ref} tabIndex={0} onKeyDown={onKey} onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        className="flex-1 min-h-0 overflow-y-auto pg-scroll focus-visible:outline-none" role="grid" aria-rowcount={rows.length}>
        {rows.length === 0 ? empty : (
          <div style={{ height: rows.length * rowHeight, position: "relative" }}>
            {rows.slice(start, end).map((row, i) => {
              const key = getKey(row);
              const active = key === selectedKey;
              return (
                <div key={key} role="row" onClick={() => onSelect(row)} data-testid={`${testId}-row-${start + i}`}
                  className={`absolute left-0 right-0 grid gap-3 items-center px-4 text-sm cursor-pointer border-b border-pg-line/30 transition-colors ${
                    active ? "bg-pg-accent/[0.07] shadow-[inset_2px_0_0_#A4D65E]" : "hover:bg-pg-surface2/60"}`}
                  style={{ top: (start + i) * rowHeight, height: rowHeight, gridTemplateColumns: template }}>
                  {columns.map((c) => (
                    <div key={c.key} className="min-w-0 truncate">{c.render ? c.render(row) : row[c.key] ?? "—"}</div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
