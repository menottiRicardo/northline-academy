export type Role = "admin" | "teacher" | "student" | "parent"

export type StudentBrief = {
  id: number
  full_name: string
  email: string
  student_number: string
  grade_level: number
  house: string
  parent_name: string | null
  relationship_label: string | null
}

export type User = {
  id: number
  email: string
  full_name: string
  role: Role
  student_id: number | null
  grade_level: number | null
  student_number: string | null
  house: string | null
  child: StudentBrief | null
  teacher_id: number | null
  department: string | null
  title: string | null
}

export type Session = {
  token: string
  user: User
  term: string
  today: string
}

export type DemoAccount = {
  role: Role
  full_name: string
  email: string
  detail: string
  featured: boolean
}

export type CourseSummary = {
  id: number
  code: string
  name: string
  period: number
  days: string
  days_label: string
  room: string
  department: string
  teacher_name: string
  percent: number | null
  letter: string | null
  roster_count: number | null
  missing_scores: number | null
  class_average: number | null
}

export type RecentScore = {
  student_name: string
  course_name: string
  course_code: string
  title: string
  points: number
  max_points: number
  percent: number
  due_on: string
  comment: string
}

export type Notice = {
  id: number
  title: string
  body: string
  created_at: string
  audience: string
  course_id: number | null
  author_name: string
}

export type AttentionItem = {
  student_id: number
  full_name: string
  grade_level: number
  reason: string
  gpa: number | null
  attendance_rate: number | null
}

export type Dashboard = {
  role: Role
  term: string
  today: string
  focus_student: StudentBrief | null
  gpa: number | null
  attendance_rate: number | null
  course_count: number
  student_count: number | null
  missing_scores: number | null
  school_gpa: number | null
  school_attendance: number | null
  courses: CourseSummary[]
  today_courses: CourseSummary[]
  recent_scores: RecentScore[]
  notices: Notice[]
  attention: AttentionItem[]
}

export type CategoryGrade = {
  name: string
  label: string
  weight: number
  percent: number | null
  earned: number
  possible: number
  pending: number
}

export type AssignmentGrade = {
  id: number
  title: string
  category: string
  category_label: string
  max_points: number
  due_on: string
  points: number | null
  percent: number | null
  comment: string
  pending: boolean
}

export type CourseGrade = {
  id: number
  code: string
  name: string
  period: number
  days: string
  days_label: string
  room: string
  credits: number
  department: string
  teacher_name: string
  percent: number | null
  letter: string | null
  gpa_points: number | null
  categories: CategoryGrade[]
  assignments: AssignmentGrade[]
}

export type Report = {
  student: StudentBrief
  gpa: number | null
  attendance_rate: number | null
  courses: CourseGrade[]
}

export type Course = {
  id: number
  code: string
  name: string
  period: number
  days: string
  days_label: string
  room: string
  credits: number
  department: string
  teacher_name: string
  teacher_id: number
}

export type GradebookAssignment = {
  id: number
  title: string
  category: string
  category_label: string
  max_points: number
  due_on: string
}

export type GradebookScore = {
  assignment_id: number
  grade_id: number | null
  points: number | null
  comment: string
}

export type GradebookStudent = {
  id: number
  full_name: string
  student_number: string
  grade_level: number
  percent: number | null
  letter: string | null
  scores: GradebookScore[]
}

export type Gradebook = {
  course: Course
  assignments: GradebookAssignment[]
  students: GradebookStudent[]
  roster_count: number
  missing_scores: number
  class_average: number | null
}

export type AttendanceMark = {
  day: string
  status: string
}

export type AttendanceCourse = Course & {
  rate: number | null
  marks: AttendanceMark[]
}

export type AttendanceSummary = {
  student: StudentBrief
  attendance_rate: number | null
  courses: AttendanceCourse[]
}

export type SheetRow = {
  student_id: number
  full_name: string
  student_number: string
  status: string
  recorded: boolean
}

export type AttendanceSheet = {
  course: Course
  day: string
  meets: boolean
  roster: SheetRow[]
}

export type Schedule = {
  student: StudentBrief
  periods: number[]
  days: { key: string; label: string }[]
  blocks: Course[]
}

export type DirectoryStudent = StudentBrief & {
  gpa: number | null
  attendance_rate: number | null
  course_count: number
}

export type Faculty = {
  id: number
  full_name: string
  email: string
  title: string
  department: string
  courses: string[]
}

export type Directory = {
  students: DirectoryStudent[]
  faculty: Faculty[]
}
