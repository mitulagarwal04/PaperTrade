import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background text-primary">
      <div className="text-center space-y-4">
        <h1 className="text-xl font-semibold">Page not found</h1>
        <p className="text-sm text-secondary">
          The page you are looking for does not exist.
        </p>
        <nav className="flex items-center justify-center gap-4 text-sm">
          <Link
            to="/dashboard"
            className="text-info hover:underline transition-colors duration-150"
          >
            Dashboard
          </Link>
          <Link
            to="/portfolio"
            className="text-info hover:underline transition-colors duration-150"
          >
            Portfolio
          </Link>
          <Link
            to="/orders"
            className="text-info hover:underline transition-colors duration-150"
          >
            Orders
          </Link>
        </nav>
      </div>
    </div>
  );
}
