"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "sonner"; // Shadcn UI standard toaster

export default function Providers({ children }) {
  // Use state to instantiate queryClient once per session safely on Client
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000, // 30 seconds
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* Configure Sonner wrapper for dark app context */}
      <Toaster theme="dark" position="top-right" />
    </QueryClientProvider>
  );
}
