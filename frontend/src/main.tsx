import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { RouterProvider } from "@tanstack/react-router"
import { Crest } from "@/components/crest"
import { Toaster } from "@/components/ui/sonner"
import { AuthProvider, useAuth } from "@/lib/auth"
import { router, routerContext } from "@/router"
import "./index.css"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 5_000 },
  },
})

function AuthedRouter() {
  const auth = useAuth()
  if (!auth.ready) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-3 text-primary">
        <Crest />
        <p className="text-sm text-muted-foreground">Opening the register…</p>
      </div>
    )
  }
  return <RouterProvider router={router} context={routerContext} />
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthedRouter />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
