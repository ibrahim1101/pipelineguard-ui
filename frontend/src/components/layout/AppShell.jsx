import { MotionConfig, motion } from "framer-motion";
import { useLocation, useOutlet } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useApp } from "@/context/AppContext";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import StatusBar from "@/components/layout/StatusBar";
import BackendOffline from "@/components/layout/BackendOffline";

export default function AppShell() {
  const { settings, backend } = useApp();
  const location = useLocation();
  const outlet = useOutlet();
  return (
    <MotionConfig reducedMotion={settings?.reduced_motion ? "always" : "never"}>
      <TooltipProvider delayDuration={250}>
        <div className="pg-grain h-screen w-screen flex flex-col bg-pg-bg text-pg-text overflow-hidden" data-testid="app-shell">
          <Header />
          <div className="flex flex-1 min-h-0">
            <Sidebar />
            <main className="flex-1 min-w-0 overflow-y-auto pg-scroll" data-testid="main-workspace">
              {backend === "offline" ? (
                <BackendOffline />
              ) : (
                <motion.div
                  key={location.pathname}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="px-6 py-6 xl:px-8 max-w-[1680px] mx-auto"
                >
                  {outlet}
                </motion.div>
              )}
            </main>
          </div>
          <StatusBar />
        </div>
      </TooltipProvider>
    </MotionConfig>
  );
}
