import { useQuery } from "@tanstack/react-query"
import { ErrorState, PageHeader, PageSkeleton } from "@/components/page"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { departmentClass } from "@/lib/format"
import type { Schedule } from "@/lib/types"

export function SchedulePage() {
  const auth = useAuth()
  const query = useQuery({
    queryKey: ["schedule", auth.user?.id],
    queryFn: () => api<Schedule>("/schedule"),
  })
  if (query.isPending) return <PageSkeleton />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />
  const schedule = query.data
  const own = auth.user?.role === "student"

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Weekly schedule"
        title={own ? "Your week" : `${schedule.student.full_name}'s week`}
        description="Open blocks are free. A course only appears on the days it meets."
      />
      <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
        <div className="grid min-w-[44rem] grid-cols-[4.5rem_repeat(5,minmax(0,1fr))]">
          <div className="border-b px-3 py-3 text-xs text-muted-foreground">Period</div>
          {schedule.days.map((day) => (
            <div key={day.key} className="border-b px-3 py-3 text-sm font-medium">
              {day.label}
            </div>
          ))}
          {schedule.periods.map((period) => (
            <PeriodRow key={period} period={period} schedule={schedule} />
          ))}
        </div>
      </div>
    </div>
  )
}

function PeriodRow({ period, schedule }: { period: number; schedule: Schedule }) {
  return (
    <>
      <div className="border-b px-3 py-3 text-sm text-muted-foreground">{period}</div>
      {schedule.days.map((day) => {
        const course = schedule.blocks.find(
          (block) => block.period === period && block.days.includes(day.key),
        )
        return (
          <div key={day.key} className="border-b p-2">
            {course ? (
              <div className={`flex h-full flex-col gap-1 rounded-lg px-2 py-2 ${departmentClass(course.department)}`}>
                <p className="text-sm font-medium">{course.name}</p>
                <p className="text-xs text-muted-foreground">
                  {course.room} · {course.teacher_name.split(" ").slice(-1)}
                </p>
              </div>
            ) : (
              <div className="flex h-full items-center px-2 text-xs text-muted-foreground">Open</div>
            )}
          </div>
        )
      })}
    </>
  )
}
