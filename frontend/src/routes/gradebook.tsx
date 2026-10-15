import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useNavigate, useSearch } from "@tanstack/react-router"
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table"
import { toast } from "sonner"
import { ErrorState, GradeMark, PageHeader, PageSkeleton, Stat } from "@/components/page"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { api, ApiError } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { formatPercent } from "@/lib/format"
import type { Course, Gradebook, GradebookStudent } from "@/lib/types"

const features = tableFeatures({})
const helper = createColumnHelper<typeof features, GradebookStudent>()

export function GradebookPage() {
  const auth = useAuth()
  const search = useSearch({ from: "/app/gradebook" })
  const courses = useQuery({
    queryKey: ["courses", auth.user?.id],
    queryFn: () => api<{ courses: Course[] }>("/courses"),
  })
  const list = courses.data?.courses ?? []
  const courseId = list.some((course) => course.id === search.course) ? search.course : list[0]?.id
  const book = useQuery({
    queryKey: ["gradebook", courseId],
    queryFn: () => api<Gradebook>(`/gradebook/${courseId}`),
    enabled: courseId != null,
  })

  if (courses.isPending || (courseId != null && book.isPending)) return <PageSkeleton />
  if (courses.isError) return <ErrorState error={courses.error} onRetry={() => void courses.refetch()} />
  if (book.isError) return <ErrorState error={book.error} onRetry={() => void book.refetch()} />
  if (!book.data || courseId == null) {
    return (
      <PageHeader
        eyebrow="Gradebook"
        title="No courses on your desk"
        description="When you are assigned a section, the roll will show up here."
      />
    )
  }

  return <GradebookEditor courses={list} book={book.data} courseId={courseId} />
}

function GradebookEditor({
  courses,
  book,
  courseId,
}: {
  courses: Course[]
  book: Gradebook
  courseId: number
}) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const items = courses.map((course) => ({
    label: `${course.code} · ${course.name}`,
    value: String(course.id),
  }))
  const save = useMutation({
    mutationFn: (body: {
      assignment_id: number
      student_id: number
      points: number | null
      comment: string
    }) =>
      api<Gradebook>("/scores", {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: (next) => {
      queryClient.setQueryData(["gradebook", courseId], next)
      toast.success("Score saved")
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "The score was not saved.")
    },
  })

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor("full_name", {
          header: "Student",
          cell: (info) => (
            <div className="flex min-w-36 flex-col">
              <Link
                to="/students/$studentId"
                params={{ studentId: String(info.row.original.id) }}
                className="font-medium underline-offset-4 hover:underline"
              >
                {info.getValue()}
              </Link>
              <span className="text-xs text-muted-foreground">{info.row.original.student_number}</span>
            </div>
          ),
        }),
        ...book.assignments.map((assignment) =>
          helper.display({
            id: `a-${assignment.id}`,
            header: () => (
              <span className="flex flex-col items-start">
                <span>{assignment.title}</span>
                <span className="font-normal text-muted-foreground">
                  {assignment.category_label} · /{assignment.max_points}
                </span>
              </span>
            ),
            cell: (info) => {
              const score = info.row.original.scores.find(
                (item) => item.assignment_id === assignment.id,
              )
              return (
                <ScoreField
                  points={score?.points ?? null}
                  max={assignment.max_points}
                  comment={score?.comment ?? ""}
                  disabled={save.isPending}
                  onSave={(points) =>
                    save.mutate({
                      assignment_id: assignment.id,
                      student_id: info.row.original.id,
                      points,
                      comment: score?.comment ?? "",
                    })
                  }
                />
              )
            },
          }),
        ),
        helper.display({
          id: "grade",
          header: "Grade",
          cell: (info) => (
            <GradeMark letter={info.row.original.letter} percent={info.row.original.percent} />
          ),
        }),
      ]),
    [book.assignments, save.mutate],
  )

  const table = useTable({ features, columns, data: book.students })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Gradebook"
        title={book.course.name}
        description={`${book.course.days_label} · Period ${book.course.period} · Room ${book.course.room}`}
        action={
          <Select
            items={items}
            value={String(courseId)}
            onValueChange={(value) => {
              if (!value) return
              void navigate({ to: "/gradebook", search: { course: Number(value) } })
            }}
          >
            <SelectTrigger className="w-full sm:w-64">
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
        }
      />
      <CourseSwitcher courses={courses} courseId={courseId} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Class average" value={formatPercent(book.class_average)} />
        <Stat label="On the roll" value={String(book.roster_count)} />
        <Stat label="Missing scores" value={String(book.missing_scores)} hint="Past due and still blank" />
      </div>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id}>
              {group.headers.map((header) => (
                <TableHead key={header.id} className={header.id === "full_name" ? "sticky left-0 bg-card" : undefined}>
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
                <TableCell
                  key={cell.id}
                  className={cell.column.id === "full_name" ? "sticky left-0 bg-card" : undefined}
                >
                  <table.FlexRender cell={cell} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function CourseSwitcher({ courses, courseId }: { courses: Course[]; courseId: number }) {
  return (
    <div className="flex flex-wrap gap-2">
      {courses.map((course) => (
        <Button
          key={course.id}
          variant={course.id === courseId ? "default" : "outline"}
          nativeButton={false}
          render={<Link to="/gradebook" search={{ course: course.id }} />}
        >
          {course.code}
        </Button>
      ))}
    </div>
  )
}

function ScoreField({
  points,
  max,
  comment,
  disabled,
  onSave,
}: {
  points: number | null
  max: number
  comment: string
  disabled: boolean
  onSave: (points: number | null) => void
}) {
  const shown = points == null ? "" : String(points)
  const [value, setValue] = useState(shown)
  useEffect(() => {
    setValue(shown)
  }, [shown])

  return (
    <Input
      value={value}
      disabled={disabled}
      inputMode="decimal"
      aria-label={`Score out of ${max}${comment ? `. ${comment}` : ""}`}
      className="w-20"
      onChange={(event) => setValue(event.target.value)}
      onBlur={(event) => {
        const trimmed = event.currentTarget.value.trim()
        if (trimmed === "" && points == null) return
        if (trimmed === "") {
          onSave(null)
          return
        }
        const next = Number(trimmed)
        if (Number.isNaN(next)) {
          toast.error("Enter a number of points.")
          setValue(shown)
          return
        }
        if (next < 0 || next > max) {
          toast.error(`Enter a score from 0 to ${max}.`)
          setValue(shown)
          return
        }
        if (next === points) return
        onSave(next)
      }}
    />
  )
}
