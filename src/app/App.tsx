import { QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider } from "react-router";
import { DrillPage } from "@/pages/drill";
import { WordsPage } from "@/pages/words";
import { queryClient } from "@/shared/api";
import { Layout } from "./Layout.tsx";

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: <DrillPage /> },
      { path: "/words", element: <WordsPage /> },
    ],
  },
]);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
