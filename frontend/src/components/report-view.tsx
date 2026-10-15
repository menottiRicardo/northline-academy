import { useState } from "react"
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { GradeMark } from "@/components/page"
import { formatDate, formatPercent } from "@/lib/format"
import type { AssignmentGrade, Report } from "@/lib/types"

const features = tableFeatures({})
const helper = createColumnHelper<typeof features, AssignmentGrade>()
const columns = helper.columns([
  helper.accessor("title", {
    header: "Work",
    cell: (info) => (
      <div className="flex flex-col gap-1">
        <span>{info.getValue()}</span>
        {info.row.original.comment ? (
          <span className="max-w-sm text-xs text-muted-foreground">{info.row.original.comment}</span>
        ) : null}
      </div>
    ),
  }),
  helper.accessor("category_label", { header: "Kind" }),
  helper.accessor("due_on", {
    header: "Due",
    cell: (info) => formatDate(info.getValue()),
  }),
  helper.accessor("points", {
    header: "Score",
    cell: (info) => {
      const points = info.getValue()
      if (points == null) return "Not scored"
      return `${points} / ${info.row.original.max_points}`
    },
  }),
  helper.accessor("percent", {
    header: "Percent",
    cell: (info) => formatPercent(info.getValue()),
  }),
])

export function ReportView({ report }: { report: Report }) {
  const [courseId, setCourseId] = useState(report.courses[0]?.id)
  const course = report.courses.find((item) => item.id === courseId) ?? report.courses[0]

  return (
    <div className="flex flex-col gap-4">
      <Alert>
        <AlertTitle>How the mark is built</AlertTitle>
        <AlertDescription>
          Homework counts 20%, quizzes 30%, and exams 50%. Work that does not have a score yet
          stays out of the average until a teacher enters it.
        </AlertDescription>
      </Alert>
      <div className="grid gap-3 lg:grid-cols-[16rem_1fr]">
        <div className="flex flex-col gap-2">
          {report.courses.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setCourseId(item.id)}
              className={`flex items-center justify-between gap-3 rounded-xl px-3 py-3 text-left ring-1 ring-foreground/10 ${
                item.id === course?.id ? "bg-card" : "bg-card/60 hover:bg-card"
              }`}
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{item.name}</span>
                <span className="block text-xs text-muted-foreground">
                  Period {item.period} · {item.teacher_name}
                </span>
              </span>
              <GradeMark letter={item.letter} percent={item.percent} />
            </button>
          ))}
        </div>
        {course ? <CourseDetail key={course.id} course={course} /> : null}
      </div>
    </div>
  )
}

function CourseDetail({ course }: { course: Report["courses"][number] }) {
  const table = useTable({
    features,
    columns,
    data: course.assignments,
  })

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardDescription>
              {course.code} · {course.credits} credit{course.credits === 1 ? "" : "s"} · Room{" "}
              {course.room}
            </CardDescription>
            <CardTitle className="font-heading text-2xl">{course.name}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {course.teacher_name} · {course.days_label}
            </p>
          </div>
          <GradeMark letter={course.letter} percent={course.percent} />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-3 sm:grid-cols-3">
          {course.categories.map((category) => (
            <div key={category.name} className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span>{category.label}</span>
                <span className="text-muted-foreground">{Math.round(category.weight * 100)}%</span>
              </div>
              {category.percent == null ? (
                <p className="text-xs text-muted-foreground">Nothing scored yet</p>
              ) : (
                <Progress value={category.percent} />
              )}
              <p className="text-xs text-muted-foreground">
                {category.percent == null
                  ? `${category.pending} still open`
                  : `${formatPercent(category.percent)} · ${category.earned}/${category.possible}`}
              </p>
            </div>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">{course.department}</p>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getAllCells().map((cell) => (
                  <TableCell key={cell.id}>
                    <table.FlexRender cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
