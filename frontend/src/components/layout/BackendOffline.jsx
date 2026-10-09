import { PlugZap, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/context/AppContext";

export default function BackendOffline() {
  const { retry, backend } = useApp();
  return (
    <div className="h-full grid place-items-center p-8" data-testid="backend-offline">
      <div className="pg-panel max-w-md p-8 text-center">
        <PlugZap className="mx-auto h-9 w-9 text-pg-crit" />
        <h1 className="mt-4 text-xl font-semibold">Engine bridge unavailable</h1>
        <p className="mt-2 text-sm text-pg-muted leading-relaxed">
          The PipelineGuard Python engine is not responding. No results are shown until the connection is restored.
        </p>
        <Button className="mt-6" onClick={retry} disabled={backend === "connecting"} data-testid="backend-retry-btn">
          <RotateCw className="h-4 w-4 mr-2" /> Reconnect
        </Button>
      </div>
    </div>
  );
}
