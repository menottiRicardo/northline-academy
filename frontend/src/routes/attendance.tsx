import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate, useSearch } from "@tanstack/react-router"
import { toast } from "sonner"
import { ErrorState, PageHeader, PageSkeleton, Panel, Stat } from "@/components/page"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { api, ApiError } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { formatDate, formatRate, statusLabel } from "@/lib/format"
import type { AttendanceSheet, AttendanceSummary, Course } from "@/lib/types"

const statuses = [
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "tardy", label: "Tardy" },
  { value: "excused", label: "Excused" },
]

export function AttendancePage() {
  const auth = useAuth()
  if (auth.user?.role === "teacher" || auth.user?.role === "admin") return <TakeAttendance />
  return <AttendanceRecord />
}

function AttendanceRecord() {
  const auth = useAuth()
  const query = useQuery({
    queryKey: ["attendance", auth.user?.id],
    queryFn: () => api<AttendanceSummary>("/attendance"),
  })
  if (query.isPending) return <PageSkeleton />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />
  const data = query.data
  const own = auth.user?.role === "student"

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Attendance"
        title={own ? "Your attendance" : `${data.student.full_name}'s attendance`}
        description="Tardies still count as present. Excused days are left out of the rate."
      />
      <Stat label="Overall" value={formatRate(data.attendance_rate)} hint="This term so far" />
      <div className="grid gap-3">
        {data.courses.map((course) => (
          <Panel
            key={course.id}
            title={course.name}
            description={`${course.days_label} · ${course.teacher_name}`}
            action={<Badge variant="secondary">{formatRate(course.rate)}</Badge>}
          >
            <div className="flex flex-wrap gap-2">
              {course.marks.map((mark) => (
                <div key={mark.day} className="flex min-w-16 flex-col items-center gap-1">
                  <span className="text-xs text-muted-foreground">{formatDate(mark.day)}</span>
                  <Badge variant={mark.status === "absent" ? "destructive" : "outline"}>
                    {statusLabel(mark.status)}
                  </Badge>
                </div>
              ))}
            </div>
          </Panel>
        ))}
      </div>
    </div>
  )
}

function TakeAttendance() {
  const auth = useAuth()
  const navigate = useNavigate()
  const search = useSearch({ from: "/app/attendance" })
  const courses = useQuery({
    queryKey: ["courses", auth.user?.id],
    queryFn: () => api<{ courses: Course[] }>("/courses"),
  })
  const list = courses.data?.courses ?? []
  const courseId = list.some((course) => course.id === search.course) ? search.course : list[0]?.id
  const [day, setDay] = useState(auth.today)
  const sheet = useQuery({
    queryKey: ["sheet", courseId, day],
    queryFn: () => api<AttendanceSheet>(`/attendance/sheet?course_id=${courseId}&day=${day}`),
    enabled: courseId != null && Boolean(day),
  })
  const [marks, setMarks] = useState<Record<number, string>>({})
  useEffect(() => {
    if (!sheet.data) return
    const next: Record<number, string> = {}
    for (const row of sheet.data.roster) next[row.student_id] = row.status
    setMarks(next)
  }, [sheet.data])

  const queryClient = useQueryClient()
  const save = useMutation({
    mutationFn: () =>
      api<AttendanceSheet>("/attendance/sheet", {
        method: "PUT",
        body: JSON.stringify({
          course_id: courseId,
          day,
          marks: Object.entries(marks).map(([studentId, status]) => ({
            student_id: Number(studentId),
            status,
          })),
        }),
      }),
    onSuccess: (next) => {
      queryClient.setQueryData(["sheet", courseId, day], next)
      toast.success("Attendance saved")
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Attendance was not saved.")
    },
  })

  if (courses.isPending || (courseId != null && sheet.isPending)) return <PageSkeleton />
  if (courses.isError) return <ErrorState error={courses.error} onRetry={() => void courses.refetch()} />
  if (sheet.isError) return <ErrorState error={sheet.error} onRetry={() => void sheet.refetch()} />
  if (!sheet.data || courseId == null) {
    return (
      <PageHeader
        eyebrow="Attendance"
        title="No class to take"
        description="Attendance opens when a section is on your schedule."
      />
    )
  }

  const items = list.map((course) => ({
    label: `${course.code} · ${course.name}`,
    value: String(course.id),
  }))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Attendance"
        title={sheet.data.course.name}
        description="Mark the roll, then save. Students and parents will see the update on their record."
      />
      <div className="flex flex-col gap-3 sm:flex-row">
        <Select
          items={items}
          value={String(courseId)}
          onValueChange={(value) => {
            if (!value) return
            void navigate({ to: "/attendance", search: { course: Number(value) } })
          }}
        >
          <SelectTrigger className="w-full sm:w-72">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {items.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Input type="date" value={day} onChange={(event) => setDay(event.target.value)} className="sm:w-44" />
      </div>
      {sheet.data.meets ? null : (
        <Alert>
          <AlertTitle>This section does not usually meet that day</AlertTitle>
          <AlertDescription>
            {sheet.data.course.name} meets {sheet.data.course.days_label}. You can still record a mark.
          </AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col gap-3">
        {sheet.data.roster.map((row) => (
          <div
            key={row.student_id}
            className="flex flex-col gap-3 rounded-xl bg-card px-3 py-3 ring-1 ring-foreground/10 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium">{row.full_name}</p>
              <p className="text-xs text-muted-foreground">{row.student_number}</p>
            </div>
            <ToggleGroup
              size="sm"
              variant="outline"
              spacing={1}
              value={[marks[row.student_id] ?? row.status]}
              onValueChange={(next) => {
                const picked = next[next.length - 1]
                if (!picked) return
                setMarks((current) => ({ ...current, [row.student_id]: picked }))
              }}
            >
              {statuses.map((status) => (
                <ToggleGroupItem key={status.value} value={status.value}>
                  {status.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        ))}
      </div>
      <Button disabled={save.isPending} onClick={() => save.mutate()}>
        Save {formatDate(day)}
      </Button>
    </div>
  )
}
