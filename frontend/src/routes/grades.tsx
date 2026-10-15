import { useQuery } from "@tanstack/react-query"
import { ErrorState, PageHeader, PageSkeleton, Stat } from "@/components/page"
import { ReportView } from "@/components/report-view"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { formatGpa, formatRate } from "@/lib/format"
import type { Report } from "@/lib/types"

export function GradesPage() {
  const auth = useAuth()
  const query = useQuery({
    queryKey: ["report", auth.user?.id],
    queryFn: () => api<Report>("/report"),
  })
  if (query.isPending) return <PageSkeleton />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />
  const report = query.data
  const student = report.student
  const own = auth.user?.role === "student"

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={`${student.student_number} · House ${student.house}`}
        title={own ? "Your grades" : `${student.full_name}'s grades`}
        description={
          own
            ? `Grade ${student.grade_level} record for Fall term.`
            : `Grade ${student.grade_level}. You can read this record. Only teachers can change a score.`
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="GPA" value={formatGpa(report.gpa)} hint="Weighted by credits" />
        <Stat label="Attendance" value={formatRate(report.attendance_rate)} />
        <Stat label="Courses" value={String(report.courses.length)} />
      </div>
      <ReportView report={report} />
    </div>
  )
}
