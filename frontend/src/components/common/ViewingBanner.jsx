import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/context/AppContext";
import { basename, fmtDate } from "@/lib/format";

export default function ViewingBanner() {
  const { viewScan, clearViewScan } = useApp();
  if (!viewScan) return null;
  return (
    <div className="mb-3 flex items-center gap-3 rounded-lg border border-pg-warn/35 bg-pg-warn/[0.05] px-3 py-2 text-sm" data-testid="viewing-historical-banner">
      <History className="h-4 w-4 text-pg-warn" />
      <span>Viewing a historical scan of <b>{basename(viewScan.meta.project)}</b> from {fmtDate(viewScan.scanned_at)}.</span>
      <Button size="sm" variant="ghost" className="ml-auto" onClick={clearViewScan} data-testid="viewing-back-to-latest-btn">Back to latest</Button>
    </div>
  );
}
