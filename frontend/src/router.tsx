import { useEffect, useRef } from "react"
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  redirect,
  useNavigate,
} from "@tanstack/react-router"
import { authRef, useAuth, type AuthSnapshot } from "@/lib/auth"
import type { Role } from "@/lib/types"
import { AttendancePage } from "@/routes/attendance"
import { DirectoryPage } from "@/routes/directory"
import { GradebookPage } from "@/routes/gradebook"
import { GradesPage } from "@/routes/grades"
import { LoginPage } from "@/routes/login"
import { NoticesPage } from "@/routes/notices"
import { OverviewPage } from "@/routes/overview"
import { SchedulePage } from "@/routes/schedule"
import { Shell } from "@/components/shell"
import { StudentPage } from "@/routes/student"

export type RouterContext = {
  auth: AuthSnapshot
}

function courseSearch(search: Record<string, unknown>) {
  const raw = search.course
  const course =
    typeof raw === "number"
      ? raw
      : typeof raw === "string" && raw !== ""
        ? Number(raw)
        : undefined
  return {
    course: course != null && Number.isFinite(course) ? course : undefined,
  }
}

function requireRole(roles: Role[]) {
  return ({ context }: { context: RouterContext }) => {
    const role = context.auth.user?.role
    if (!role || !roles.includes(role)) {
      throw redirect({ to: "/" })
    }
  }
}

function AuthRedirect() {
  const auth = useAuth()
  const navigate = useNavigate()
  const previous = useRef(auth.user)

  useEffect(() => {
    const before = previous.current
    previous.current = auth.user
    if (!before && auth.user) void navigate({ to: "/" })
    if (before && !auth.user) void navigate({ to: "/login" })
  }, [auth.user, navigate])

  return null
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <>
      <AuthRedirect />
      <Outlet />
    </>
  ),
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  beforeLoad: ({ context }) => {
    if (context.auth.user) throw redirect({ to: "/" })
  },
  component: LoginPage,
})

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "app",
  beforeLoad: ({ context }) => {
    if (!context.auth.user) throw redirect({ to: "/login" })
  },
  component: Shell,
})

const overviewRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/",
  component: OverviewPage,
})

const gradesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/grades",
  beforeLoad: requireRole(["student", "parent"]),
  component: GradesPage,
})

const gradebookRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/gradebook",
  validateSearch: courseSearch,
  beforeLoad: requireRole(["teacher", "admin"]),
  component: GradebookPage,
})

const attendanceRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/attendance",
  validateSearch: courseSearch,
  component: AttendancePage,
})

const scheduleRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/schedule",
  beforeLoad: requireRole(["student", "parent"]),
  component: SchedulePage,
})

const noticesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/notices",
  component: NoticesPage,
})

const directoryRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/directory",
  beforeLoad: requireRole(["admin"]),
  component: DirectoryPage,
})

const studentRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/students/$studentId",
  component: StudentPage,
})

const routeTree = rootRoute.addChildren([
  loginRoute,
  appRoute.addChildren([
    overviewRoute,
    gradesRoute,
    gradebookRoute,
    attendanceRoute,
    scheduleRoute,
    noticesRoute,
    directoryRoute,
    studentRoute,
  ]),
])

export const routerContext: RouterContext = {
  get auth() {
    return authRef.current
  },
}

export const router = createRouter({
  routeTree,
  context: routerContext,
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}
