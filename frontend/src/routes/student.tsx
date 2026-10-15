import { useQuery } from "@tanstack/react-query"
import { useParams } from "@tanstack/react-router"
import { ErrorState, PageHeader, PageSkeleton, Stat } from "@/components/page"
import { ReportView } from "@/components/report-view"
import { api } from "@/lib/api"
import { formatGpa, formatRate } from "@/lib/format"
import type { Report } from "@/lib/types"

export function StudentPage() {
  const { studentId } = useParams({ from: "/app/students/$studentId" })
  const query = useQuery({
    queryKey: ["report", studentId],
    queryFn: () => api<Report>(`/report/${studentId}`),
  })
  if (query.isPending) return <PageSkeleton />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />
  const report = query.data
  const student = report.student

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={`${student.student_number} · House ${student.house}`}
        title={student.full_name}
        description={
          student.parent_name
            ? `Grade ${student.grade_level}. Family contact: ${student.parent_name}.`
            : `Grade ${student.grade_level}. No parent is linked on this record.`
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="GPA" value={formatGpa(report.gpa)} />
        <Stat label="Attendance" value={formatRate(report.attendance_rate)} />
        <Stat label="Courses" value={String(report.courses.length)} />
      </div>
      <ReportView report={report} />
    </div>
  )
}
