import { useState } from "react"
import { Link, Outlet } from "@tanstack/react-router"
import {
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Users,
} from "lucide-react"
import { Crest } from "@/components/crest"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { useAuth } from "@/lib/auth"
import { initials, roleLabel } from "@/lib/format"
import type { Role } from "@/lib/types"

type NavItem = {
  to: "/" | "/grades" | "/gradebook" | "/attendance" | "/schedule" | "/notices" | "/directory"
  label: string
  icon: typeof LayoutDashboard
  exact?: boolean
}

const navByRole: Record<Role, NavItem[]> = {
  student: [
    { to: "/", label: "Overview", icon: LayoutDashboard, exact: true },
    { to: "/grades", label: "Grades", icon: GraduationCap },
    { to: "/schedule", label: "Schedule", icon: CalendarDays },
    { to: "/attendance", label: "Attendance", icon: ClipboardCheck },
    { to: "/notices", label: "Notices", icon: Megaphone },
  ],
  parent: [
    { to: "/", label: "Overview", icon: LayoutDashboard, exact: true },
    { to: "/grades", label: "Grades", icon: GraduationCap },
    { to: "/schedule", label: "Schedule", icon: CalendarDays },
    { to: "/attendance", label: "Attendance", icon: ClipboardCheck },
    { to: "/notices", label: "Notices", icon: Megaphone },
  ],
  teacher: [
    { to: "/", label: "Overview", icon: LayoutDashboard, exact: true },
    { to: "/gradebook", label: "Gradebook", icon: BookOpen },
    { to: "/attendance", label: "Attendance", icon: ClipboardCheck },
    { to: "/notices", label: "Notices", icon: Megaphone },
  ],
  admin: [
    { to: "/", label: "Overview", icon: LayoutDashboard, exact: true },
    { to: "/directory", label: "Directory", icon: Users },
    { to: "/gradebook", label: "Gradebook", icon: BookOpen },
    { to: "/notices", label: "Notices", icon: Megaphone },
  ],
}

function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: item.exact ?? false }}
            onClick={onNavigate}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground [&.active]:bg-sidebar-accent [&.active]:font-medium [&.active]:text-sidebar-accent-foreground"
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

function Brand() {
  return (
    <div className="flex items-center gap-3 px-2">
      <Crest className="size-9" />
      <div className="flex flex-col">
        <span className="font-heading text-lg leading-none">Northline</span>
        <span className="text-xs text-sidebar-foreground/70">Upper school register</span>
      </div>
    </div>
  )
}

export function Shell() {
  const auth = useAuth()
  const [open, setOpen] = useState(false)
  const user = auth.user
  if (!user) return null
  const items = navByRole[user.role]
  const subtitle =
    user.role === "parent" && user.child
      ? `${user.child.relationship_label ?? "Parent"} of ${user.child.full_name}`
      : user.role === "teacher"
        ? user.department
        : user.role === "student"
          ? `Grade ${user.grade_level} · ${user.house}`
          : "Office of the registrar"

  function signOut() {
    auth.logout()
  }

  return (
    <div className="flex min-h-svh bg-background">
      <aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col gap-6 bg-sidebar px-4 py-5 text-sidebar-foreground md:flex">
        <Brand />
        <NavLinks items={items} />
        <div className="mt-auto flex flex-col gap-3">
          <p className="px-2 text-xs text-sidebar-foreground/70">{auth.term}</p>
          <Separator className="bg-sidebar-border" />
          <UserBlock name={user.full_name} role={roleLabel[user.role]} subtitle={subtitle} />
          <Button variant="secondary" onClick={signOut}>
            <LogOut data-icon="inline-start" />
            Sign out
          </Button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b px-4 py-3 md:px-8">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={<Button variant="outline" size="icon" className="md:hidden" />}
            >
              <Menu />
              <span className="sr-only">Open menu</span>
            </SheetTrigger>
            <SheetContent side="left" className="bg-sidebar text-sidebar-foreground">
              <SheetHeader>
                <SheetTitle className="text-sidebar-foreground">Northline Academy</SheetTitle>
                <SheetDescription className="text-sidebar-foreground/70">
                  Move between the register.
                </SheetDescription>
              </SheetHeader>
              <div className="px-4">
                <NavLinks items={items} onNavigate={() => setOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>
          <div className="md:hidden">
            <p className="font-heading text-lg leading-none">Northline</p>
            <p className="text-xs text-muted-foreground">{auth.term}</p>
          </div>
          <p className="ml-auto hidden text-sm text-muted-foreground sm:block">{subtitle}</p>
        </header>
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function UserBlock({
  name,
  role,
  subtitle,
}: {
  name: string
  role: string
  subtitle: string | null
}) {
  return (
    <div className="flex items-center gap-3 px-1">
      <Avatar>
        <AvatarFallback>{initials(name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="truncate text-xs text-sidebar-foreground/70">
          {role}
          {subtitle ? ` · ${subtitle}` : ""}
        </p>
      </div>
    </div>
  )
}
