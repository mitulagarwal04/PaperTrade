import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Wallet,
  ArrowUpDown,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/portfolio", label: "Portfolio", icon: Wallet },
  { path: "/orders", label: "Orders", icon: ArrowUpDown },
  { path: "/assets", label: "Assets", icon: BarChart3 },
  { path: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
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
    <aside
      className={cn(
        "hidden lg:flex flex-col bg-surface-1 border-r border-border transition-all duration-200 ease-in-out",
        collapsed ? "w-14" : "w-60"
      )}
    >
      {/* Logo / Brand */}
      <div
        className={cn(
          "flex items-center h-14 border-b border-border",
          collapsed ? "justify-center px-0" : "px-4"
        )}
      >
        {!collapsed && (
          <span className="text-base font-semibold text-primary">PaperTrade</span>
        )}
        {collapsed && (
          <span className="text-base font-semibold text-primary">PT</span>
        )}
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 space-y-1 p-2">
        {navItems.map((item) => {
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors duration-150 cursor-pointer",
                "focus-visible:ring-2 ring-info/60 ring-offset-2 ring-offset-background",
                active
                  ? "bg-surface-3 text-foreground border-l-2 border-info"
                  : "text-secondary hover:bg-surface-2"
              )}
              aria-label={item.label}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <div className="p-2 border-t border-border">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "flex items-center gap-3 w-full px-3 py-2 rounded-md text-sm text-secondary hover:bg-surface-2 transition-colors duration-150 cursor-pointer",
            "focus-visible:ring-2 ring-info/60 ring-offset-2 ring-offset-background",
            collapsed && "justify-center"
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-5 w-5 shrink-0" />
          ) : (
            <>
              <ChevronLeft className="h-5 w-5 shrink-0" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
