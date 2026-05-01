import { useLocation } from "react-router-dom";

const routeTitleMap: Record<string, string> = {
  "/": "Dashboard",
  "/dashboard": "Dashboard",
  "/portfolio": "Portfolio",
  "/orders": "Orders",
  "/assets": "Assets",
  "/settings": "Settings",
};

export default function Header() {
  const location = useLocation();

  const pageTitle = routeTitleMap[location.pathname] ?? "PaperTrade";

  return (
    <header className="hidden lg:flex h-14 bg-surface-1 border-b border-border items-center justify-between px-6">
      <h1 className="text-xl font-semibold text-primary">{pageTitle}</h1>
      <div className="flex items-center gap-3">
        {/* Reserved for future action buttons */}
      </div>
    </header>
  );
}
