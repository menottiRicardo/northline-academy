import { Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { ErrorState, GradeMark, PageHeader, PageSkeleton, Panel, Stat } from "@/components/page"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { formatDate, formatGpa, formatPercent, formatRate, greeting } from "@/lib/format"
import type { Dashboard } from "@/lib/types"

export function OverviewPage() {
  const auth = useAuth()
  const query = useQuery({
    queryKey: ["dashboard", auth.user?.id],
    queryFn: () => api<Dashboard>("/dashboard"),
  })

  if (query.isPending) return <PageSkeleton />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />

  const data = query.data
  const user = auth.user
  if (!user) return null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={data.term}
        title={greeting(user.full_name)}
        description={descriptionFor(data, user.role)}
      />
      {user.role === "parent" && data.focus_student ? (
        <Alert>
          <AlertTitle>You are signed in for one student</AlertTitle>
          <AlertDescription>
            {data.focus_student.full_name}, grade {data.focus_student.grade_level}, house{" "}
            {data.focus_student.house}. Grades and attendance here are read-only.
          </AlertDescription>
        </Alert>
      ) : null}
      {user.role === "student" || user.role === "parent" ? <FamilyOverview data={data} /> : null}
      {user.role === "teacher" ? <TeacherOverview data={data} /> : null}
      {user.role === "admin" ? <AdminOverview data={data} /> : null}
    </div>
  )
}

function descriptionFor(data: Dashboard, role: string) {
  if (role === "student") return "Your courses, today's meetings, and the latest marks on your record."
  if (role === "parent") return "The same record your child sees, limited to your family."
  if (role === "teacher") {
    return data.missing_scores
      ? `${data.missing_scores} past-due scores still need a mark.`
      : "Your sections are up to date."
  }
  return "The whole upper school, from the registrar's desk."
}

function FamilyOverview({ data }: { data: Dashboard }) {
  const lowest = [...data.courses]
    .filter((course) => course.percent != null)
    .sort((a, b) => (a.percent ?? 0) - (b.percent ?? 0))[0]

  return (
    <>
      <div className="grid gap-3 md:grid-cols-3">
        <Stat label="GPA" value={formatGpa(data.gpa)} hint="Credit-weighted, Fall term" />
        <Stat label="Attendance" value={formatRate(data.attendance_rate)} hint="Excused marks left out" />
        <Stat
          label="Lowest course"
          value={lowest ? (lowest.letter ?? "—") : "—"}
          hint={lowest ? `${lowest.name} · ${formatPercent(lowest.percent)}` : "No scores yet"}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Today" description={formatDate(data.today)}>
          {data.today_courses.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No classes meet today</EmptyTitle>
                <EmptyDescription>The weekly schedule still lists the rest of the term.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ul className="flex flex-col gap-3">
              {data.today_courses.map((course) => (
                <li key={course.id} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      Period {course.period} · {course.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {course.teacher_name} · Room {course.room}
                    </p>
                  </div>
                  <GradeMark letter={course.letter} percent={course.percent} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel
          title="Recent marks"
          action={
            <Button variant="outline" nativeButton={false} render={<Link to="/grades" />}>
              Full record
            </Button>
          }
        >
          {data.recent_scores.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No scores posted yet</EmptyTitle>
                <EmptyDescription>They will show up here as teachers enter them.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ul className="flex flex-col gap-3">
              {data.recent_scores.map((score) => (
                <li key={`${score.course_code}-${score.title}`} className="flex items-baseline justify-between gap-3">
                  <div>
                    <p className="font-medium">{score.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {score.course_name} · due {formatDate(score.due_on)}
                    </p>
                  </div>
                  <p className="text-sm">
                    {score.points}/{score.max_points}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      <NoticeList notices={data.notices} />
    </>
  )
}

function TeacherOverview({ data }: { data: Dashboard }) {
  return (
    <>
      <div className="grid gap-3 md:grid-cols-3">
        <Stat label="Sections" value={String(data.course_count)} hint="Courses you teach" />
        <Stat label="Students" value={String(data.student_count ?? 0)} hint="Across those sections" />
        <Stat label="Missing scores" value={String(data.missing_scores ?? 0)} hint="Past due and still blank" />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {data.courses.map((course) => (
          <Panel
            key={course.id}
            title={course.name}
            description={`Period ${course.period} · ${course.days_label} · Room ${course.room}`}
            action={
              <p className="font-heading text-2xl tracking-tight">
                {formatPercent(course.class_average)}
              </p>
            }
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{course.roster_count} students</Badge>
              {(course.missing_scores ?? 0) > 0 ? (
                <Badge variant="destructive">{course.missing_scores} missing</Badge>
              ) : (
                <Badge variant="outline">Gradebook current</Badge>
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button nativeButton={false} render={<Link to="/gradebook" search={{ course: course.id }} />}>
                Open gradebook
              </Button>
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link to="/attendance" search={{ course: course.id }} />}
              >
                Take attendance
              </Button>
            </div>
          </Panel>
        ))}
      </div>
      <NoticeList notices={data.notices} />
    </>
  )
}

function AdminOverview({ data }: { data: Dashboard }) {
  return (
    <>
      <div className="grid gap-3 md:grid-cols-4">
        <Stat label="Students" value={String(data.student_count ?? 0)} />
        <Stat label="Mean GPA" value={formatGpa(data.school_gpa)} />
        <Stat label="Attendance" value={formatRate(data.school_attendance)} />
        <Stat label="Missing scores" value={String(data.missing_scores ?? 0)} hint="Past due, school-wide" />
      </div>
      <Panel title="Needs a look" description="Below 75% in a course, or attendance under 90%.">
        {data.attention.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Nobody is on the watch list</EmptyTitle>
              <EmptyDescription>Every student is at or above the line this term.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Why</TableHead>
                <TableHead>GPA</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.attention.map((item) => (
                <TableRow key={item.student_id}>
                  <TableCell>
                    <Link
                      to="/students/$studentId"
                      params={{ studentId: String(item.student_id) }}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {item.full_name}
                    </Link>
                  </TableCell>
                  <TableCell>{item.grade_level}</TableCell>
                  <TableCell>{item.reason}</TableCell>
                  <TableCell>{formatGpa(item.gpa)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>
      <Panel title="In session today" description={formatDate(data.today)}>
        <ul className="grid gap-2 sm:grid-cols-2">
          {data.today_courses.map((course) => (
            <li key={course.id} className="rounded-lg bg-muted/60 px-3 py-2">
              <p className="font-medium">
                Period {course.period} · {course.name}
              </p>
              <p className="text-sm text-muted-foreground">
                {course.teacher_name} · class average {formatPercent(course.class_average)}
              </p>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  )
}

function NoticeList({ notices }: { notices: Dashboard["notices"] }) {
  if (notices.length === 0) return null
  return (
    <Panel
      title="Notices"
      action={
        <Button variant="outline" nativeButton={false} render={<Link to="/notices" />}>
          All notices
        </Button>
      }
    >
      <ul className="flex flex-col gap-4">
        {notices.slice(0, 3).map((notice) => (
          <li key={notice.id}>
            <p className="font-medium">{notice.title}</p>
            <p className="text-sm text-muted-foreground">
              {notice.audience} · {notice.author_name}
            </p>
            <p className="mt-1 text-sm text-pretty">{notice.body}</p>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
