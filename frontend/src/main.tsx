import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "./App";
import DashboardPage from "./pages/DashboardPage";
import PortfolioPage from "./pages/PortfolioPage";
import OrdersPage from "./pages/OrdersPage";
import AssetsPage from "./pages/AssetsPage";
import SettingsPage from "./pages/SettingsPage";
import NotFoundPage from "./pages/NotFoundPage";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    errorElement: <NotFoundPage />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "dashboard", element: <DashboardPage /> },
      { path: "portfolio", element: <PortfolioPage /> },
      { path: "orders", element: <OrdersPage /> },
      { path: "assets", element: <AssetsPage /> },
      { path: "settings", element: <SettingsPage /> },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <RouterProvider router={router} />
  </QueryClientProvider>
);
