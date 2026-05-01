import { Outlet } from "react-router-dom";
import Sidebar from "@/components/layout/Sidebar";
import BottomTabBar from "@/components/layout/BottomTabBar";
import Header from "@/components/layout/Header";
import { Toaster } from "@/components/ui/toaster";
import { WsReconnectBanner } from "@/components/shared/WsReconnectBanner";
import { useWebSocket } from "@/hooks/useWebSocket";

export default function App() {
  useWebSocket();

  return (
    <div className="flex h-screen bg-background text-primary">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <Header />
            <WsReconnectBanner />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
      <BottomTabBar />
      <Toaster />
    </div>
  );
}
