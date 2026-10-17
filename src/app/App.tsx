import { QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider } from "react-router";
import { useMe } from "@/entities/session";
import { AdminPage } from "@/pages/admin";
import { DrillPage } from "@/pages/drill";
import { LoginPage } from "@/pages/login";
import { PrivacyPage } from "@/pages/privacy";
import { SettingsPage } from "@/pages/settings";
import { WordsPage } from "@/pages/words";
import { queryClient } from "@/shared/api";
import { Layout } from "./Layout.tsx";

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: <DrillPage /> },
      { path: "/words", element: <WordsPage /> },
      { path: "/settings", element: <SettingsPage /> },
      { path: "/admin", element: <AdminPage /> },
      { path: "*", element: <DrillPage /> },
    ],
  },
]);

/** Без входа — только экран входа и политика конфиденциальности; приложение грузится после /api/auth/me. */
function AuthGate() {
  if (window.location.pathname === "/privacy") return <PrivacyPage />;
  return <SignedIn />;
}

function SignedIn() {
  const { data: me, isLoading, isError, refetch } = useMe();
  if (isLoading) return null;
  if (isError) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 p-4">
        <p>Сервер не отвечает.</p>
        <button type="button" className="underline" onClick={() => refetch()}>
          Попробовать ещё раз
        </button>
      </main>
    );
  }
  if (!me) return <LoginPage />;
  return <RouterProvider router={router} />;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthGate />
    </QueryClientProvider>
  );
}
