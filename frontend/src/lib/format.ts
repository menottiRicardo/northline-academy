export function formatPercent(value: number | null | undefined) {
  if (value == null) return "—"
  return `${value.toFixed(1)}%`
}

export function formatRate(value: number | null | undefined) {
  if (value == null) return "—"
  return `${Math.round(value * 100)}%`
}

export function formatGpa(value: number | null | undefined) {
  if (value == null) return "—"
  return value.toFixed(2)
}

export function formatDate(iso: string) {
  const date = new Date(`${iso.slice(0, 10)}T12:00:00`)
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function formatWhen(iso: string) {
  const date = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso)
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

export function greeting(name: string) {
  const hour = new Date().getHours()
  const part =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"
  return `${part}, ${name.split(" ")[0]}`
}

export function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
}

export function letterVariant(letter: string | null) {
  if (!letter) return "outline" as const
  if (letter.startsWith("A")) return "default" as const
  if (letter.startsWith("B")) return "secondary" as const
  if (letter.startsWith("C")) return "outline" as const
  return "destructive" as const
}

export function departmentClass(department: string) {
  if (department === "English") return "bg-chart-1/20"
  if (department === "Mathematics") return "bg-chart-2/20"
  if (department === "History") return "bg-chart-3/15"
  if (department === "Science") return "bg-chart-4/15"
  return "bg-muted"
}

export function statusLabel(status: string) {
  if (status === "present") return "Present"
  if (status === "absent") return "Absent"
  if (status === "tardy") return "Tardy"
  if (status === "excused") return "Excused"
  return status
}

export const roleLabel: Record<string, string> = {
  admin: "Registrar",
  teacher: "Faculty",
  student: "Student",
  parent: "Parent",
}
