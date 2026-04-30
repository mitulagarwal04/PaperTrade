import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Wallet,
  ArrowUpDown,
  BarChart3,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const tabItems = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/portfolio", label: "Portfolio", icon: Wallet },
  { path: "/orders", label: "Orders", icon: ArrowUpDown },
  { path: "/assets", label: "Assets", icon: BarChart3 },
  { path: "/settings", label: "Settings", icon: Settings },
];

export default function BottomTabBar() {
  const location = useLocation();

  const isActive = (itemPath: string) => {
    if (itemPath === "/dashboard") {
      return (
        location.pathname === "/" ||
        location.pathname === "/dashboard" ||
        location.pathname.startsWith("/dashboard/")
      );
    }
    return (
      location.pathname === itemPath ||
      location.pathname.startsWith(itemPath + "/")
    );
  };

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-14 bg-surface-1 border-t border-border z-50">
      <div className="flex h-full">
        {tabItems.map((item) => {
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5 cursor-pointer",
                "transition-colors duration-150",
                "focus-visible:ring-2 ring-info/60 ring-offset-2 ring-offset-background",
                active ? "text-info" : "text-muted"
              )}
              aria-label={item.label}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[11px]">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
