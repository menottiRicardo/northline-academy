import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table"
import { ErrorState, PageHeader, PageSkeleton } from "@/components/page"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { api } from "@/lib/api"
import { formatGpa, formatRate } from "@/lib/format"
import type { Directory, DirectoryStudent, Faculty } from "@/lib/types"

const features = tableFeatures({})
const studentHelper = createColumnHelper<typeof features, DirectoryStudent>()
const facultyHelper = createColumnHelper<typeof features, Faculty>()
const emptyStudents: DirectoryStudent[] = []
const emptyFaculty: Faculty[] = []

const studentColumns = studentHelper.columns([
  studentHelper.accessor("full_name", {
    header: "Student",
    cell: (info) => (
      <Link
        to="/students/$studentId"
        params={{ studentId: String(info.row.original.id) }}
        className="font-medium underline-offset-4 hover:underline"
      >
        {info.getValue()}
      </Link>
    ),
  }),
  studentHelper.accessor("grade_level", { header: "Grade" }),
  studentHelper.accessor("house", { header: "House" }),
  studentHelper.accessor("gpa", {
    header: "GPA",
    cell: (info) => formatGpa(info.getValue()),
  }),
  studentHelper.accessor("attendance_rate", {
    header: "Attendance",
    cell: (info) => formatRate(info.getValue()),
  }),
  studentHelper.accessor("parent_name", {
    header: "Parent",
    cell: (info) => info.getValue() ?? "—",
  }),
])

const facultyColumns = facultyHelper.columns([
  facultyHelper.accessor("full_name", { header: "Name" }),
  facultyHelper.accessor("department", { header: "Department" }),
  facultyHelper.accessor("title", { header: "Title" }),
  facultyHelper.accessor("courses", {
    header: "Courses",
    cell: (info) => info.getValue().join(", "),
  }),
])

export function DirectoryPage() {
  const query = useQuery({
    queryKey: ["directory"],
    queryFn: () => api<Directory>("/directory"),
  })
  const [search, setSearch] = useState("")
  const students = useMemo(() => {
    const rows = query.data?.students ?? emptyStudents
    const needle = search.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter((student) =>
      `${student.full_name} ${student.house} ${student.parent_name ?? ""}`
        .toLowerCase()
        .includes(needle),
    )
  }, [query.data?.students, search])
  const studentTable = useTable({ features, columns: studentColumns, data: students })
  const facultyTable = useTable({
    features,
    columns: facultyColumns,
    data: query.data?.faculty ?? emptyFaculty,
  })

  if (query.isPending) return <PageSkeleton />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Directory"
        title="The upper school roll"
        description="Open a student to read the same grade record their family sees."
      />
      <Tabs defaultValue="students">
        <TabsList>
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="faculty">Faculty</TabsTrigger>
        </TabsList>
        <TabsContent value="students" className="flex flex-col gap-3">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, house, or parent"
            className="max-w-sm"
          />
          <Table>
            <TableHeader>
              {studentTable.getHeaderGroups().map((group) => (
                <TableRow key={group.id}>
                  {group.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : <studentTable.FlexRender header={header} />}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {studentTable.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getAllCells().map((cell) => (
                    <TableCell key={cell.id}>
                      <studentTable.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>
        <TabsContent value="faculty">
          <Table>
            <TableHeader>
              {facultyTable.getHeaderGroups().map((group) => (
                <TableRow key={group.id}>
                  {group.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : <facultyTable.FlexRender header={header} />}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {facultyTable.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getAllCells().map((cell) => (
                    <TableCell key={cell.id}>
                      <facultyTable.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>
    </div>
  )
}
