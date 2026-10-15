from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.grading import attendance_rate, credit_gpa, days_label, summarize_course
from app.models import (
    Announcement,
    Assignment,
    Attendance,
    Course,
    Enrollment,
    ParentLink,
    Score,
    Student,
    Teacher,
    User,
)


@dataclass
class World:
    users: list[User]
    students: list[Student]
    teachers: list[Teacher]
    parents: list[ParentLink]
    courses: list[Course]
    enrollments: list[Enrollment]
    assignments: list[Assignment]
    scores: list[Score]
    attendance: list[Attendance]
    announcements: list[Announcement]
    user_by_id: dict[int, User]
    student_by_id: dict[int, Student]
    student_by_user: dict[int, Student]
    teacher_by_id: dict[int, Teacher]
    teacher_by_user: dict[int, Teacher]
    parent_by_user: dict[int, ParentLink]
    course_by_id: dict[int, Course]
    assignments_by_course: dict[int, list[Assignment]]
    scores_for: dict[tuple[int, int], Score]
    enrollments_by_student: dict[int, list[Enrollment]]
    enrollments_by_course: dict[int, list[Enrollment]]
    attendance_by_student: dict[int, list[Attendance]]
    attendance_by_course: dict[int, list[Attendance]]


def load_world(db: Session) -> World:
    users = list(db.scalars(select(User)))
    students = list(db.scalars(select(Student)))
    teachers = list(db.scalars(select(Teacher)))
    parents = list(db.scalars(select(ParentLink)))
    courses = list(db.scalars(select(Course)))
    enrollments = list(db.scalars(select(Enrollment)))
    assignments = list(db.scalars(select(Assignment)))
    scores = list(db.scalars(select(Score)))
    attendance = list(db.scalars(select(Attendance)))
    announcements = list(db.scalars(select(Announcement)))

    assignments_by_course: dict[int, list[Assignment]] = defaultdict(list)
    for assignment in assignments:
        assignments_by_course[assignment.course_id].append(assignment)
    for group in assignments_by_course.values():
        group.sort(key=lambda item: (item.due_on, item.id))

    enrollments_by_student: dict[int, list[Enrollment]] = defaultdict(list)
    enrollments_by_course: dict[int, list[Enrollment]] = defaultdict(list)
    for enrollment in enrollments:
        enrollments_by_student[enrollment.student_id].append(enrollment)
        enrollments_by_course[enrollment.course_id].append(enrollment)

    attendance_by_student: dict[int, list[Attendance]] = defaultdict(list)
    attendance_by_course: dict[int, list[Attendance]] = defaultdict(list)
    for mark in attendance:
        attendance_by_student[mark.student_id].append(mark)
        attendance_by_course[mark.course_id].append(mark)

    return World(
        users=users,
        students=students,
        teachers=teachers,
        parents=parents,
        courses=courses,
        enrollments=enrollments,
        assignments=assignments,
        scores=scores,
        attendance=attendance,
        announcements=announcements,
        user_by_id={user.id: user for user in users},
        student_by_id={student.id: student for student in students},
        student_by_user={student.user_id: student for student in students},
        teacher_by_id={teacher.id: teacher for teacher in teachers},
        teacher_by_user={teacher.user_id: teacher for teacher in teachers},
        parent_by_user={link.user_id: link for link in parents},
        course_by_id={course.id: course for course in courses},
        assignments_by_course=dict(assignments_by_course),
        scores_for={(score.assignment_id, score.student_id): score for score in scores},
        enrollments_by_student=dict(enrollments_by_student),
        enrollments_by_course=dict(enrollments_by_course),
        attendance_by_student=dict(attendance_by_student),
        attendance_by_course=dict(attendance_by_course),
    )


def parent_of(world: World, student_id: int) -> ParentLink | None:
    for link in world.parents:
        if link.student_id == student_id:
            return link
    return None


def student_brief(world: World, student: Student) -> dict:
    user = world.user_by_id[student.user_id]
    link = parent_of(world, student.id)
    parent_name = world.user_by_id[link.user_id].full_name if link else None
    return {
        "id": student.id,
        "full_name": user.full_name,
        "email": user.email,
        "student_number": student.student_number,
        "grade_level": student.grade_level,
        "house": student.house,
        "parent_name": parent_name,
        "relationship_label": link.relationship_label if link else None,
    }


def user_out(world: World, user: User) -> dict:
    payload = {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "student_id": None,
        "grade_level": None,
        "student_number": None,
        "house": None,
        "child": None,
        "teacher_id": None,
        "department": None,
        "title": None,
    }
    student = world.student_by_user.get(user.id)
    if student:
        payload.update(
            {
                "student_id": student.id,
                "grade_level": student.grade_level,
                "student_number": student.student_number,
                "house": student.house,
            }
        )
    link = world.parent_by_user.get(user.id)
    if link:
        payload["child"] = student_brief(world, world.student_by_id[link.student_id])
    teacher = world.teacher_by_user.get(user.id)
    if teacher:
        payload.update(
            {
                "teacher_id": teacher.id,
                "department": teacher.department,
                "title": teacher.title,
            }
        )
    return payload


def teacher_of_course(world: World, course: Course) -> User:
    teacher = world.teacher_by_id[course.teacher_id]
    return world.user_by_id[teacher.user_id]


def course_out(world: World, course: Course) -> dict:
    teacher = teacher_of_course(world, course)
    return {
        "id": course.id,
        "code": course.code,
        "name": course.name,
        "period": course.period,
        "days": course.days,
        "days_label": days_label(course.days),
        "room": course.room,
        "credits": course.credits,
        "department": course.department,
        "teacher_name": teacher.full_name,
        "teacher_id": course.teacher_id,
    }


def scores_for_student_course(
    world: World, student_id: int, course_id: int
) -> dict[int, Score]:
    found: dict[int, Score] = {}
    for assignment in world.assignments_by_course.get(course_id, []):
        score = world.scores_for.get((assignment.id, student_id))
        if score is not None:
            found[assignment.id] = score
    return found


def course_grade(world: World, student_id: int, course: Course) -> dict:
    assignments = world.assignments_by_course.get(course.id, [])
    summary = summarize_course(assignments, scores_for_student_course(world, student_id, course.id))
    rows = []
    for assignment in assignments:
        score = world.scores_for.get((assignment.id, student_id))
        points = None if score is None else score.points
        percent = None
        if points is not None and assignment.max_points:
            percent = round(points / assignment.max_points * 100, 1)
        rows.append(
            {
                "id": assignment.id,
                "title": assignment.title,
                "category": assignment.category,
                "category_label": {
                    "homework": "Homework",
                    "quiz": "Quiz",
                    "exam": "Exam",
                }[assignment.category],
                "max_points": assignment.max_points,
                "due_on": assignment.due_on.isoformat(),
                "points": points,
                "percent": percent,
                "comment": "" if score is None else score.comment,
                "pending": points is None,
            }
        )
    return {
        **course_out(world, course),
        **summary,
        "assignments": rows,
    }


def student_courses(world: World, student_id: int) -> list[Course]:
    courses = [
        world.course_by_id[enrollment.course_id]
        for enrollment in world.enrollments_by_student.get(student_id, [])
    ]
    return sorted(courses, key=lambda course: (course.period, course.name))


def report_for(world: World, student_id: int) -> dict:
    student = world.student_by_id[student_id]
    grades = [course_grade(world, student_id, course) for course in student_courses(world, student_id)]
    marks = world.attendance_by_student.get(student_id, [])
    return {
        "student": student_brief(world, student),
        "gpa": credit_gpa(grades),
        "attendance_rate": attendance_rate(marks),
        "courses": grades,
    }


def can_view_student(world: World, user: User, student_id: int) -> bool:
    if student_id not in world.student_by_id:
        return False
    if user.role == "admin":
        return True
    if user.role == "student":
        own = world.student_by_user.get(user.id)
        return own is not None and own.id == student_id
    if user.role == "parent":
        link = world.parent_by_user.get(user.id)
        return link is not None and link.student_id == student_id
    if user.role == "teacher":
        teacher = world.teacher_by_user.get(user.id)
        if teacher is None:
            return False
        course_ids = {course.id for course in world.courses if course.teacher_id == teacher.id}
        return any(
            enrollment.student_id == student_id and enrollment.course_id in course_ids
            for enrollment in world.enrollments
        )
    return False


def visible_courses(world: World, user: User) -> list[Course]:
    if user.role == "admin":
        courses = list(world.courses)
    elif user.role == "teacher":
        teacher = world.teacher_by_user[user.id]
        courses = [course for course in world.courses if course.teacher_id == teacher.id]
    elif user.role == "student":
        student = world.student_by_user[user.id]
        courses = student_courses(world, student.id)
    elif user.role == "parent":
        link = world.parent_by_user[user.id]
        courses = student_courses(world, link.student_id)
    else:
        courses = []
    return sorted(courses, key=lambda course: (course.period, course.code))


def can_edit_course(world: World, user: User, course_id: int) -> bool:
    course = world.course_by_id.get(course_id)
    if course is None:
        return False
    if user.role == "admin":
        return True
    if user.role != "teacher":
        return False
    teacher = world.teacher_by_user.get(user.id)
    return teacher is not None and course.teacher_id == teacher.id


def class_stats(world: World, course: Course) -> dict:
    roster = world.enrollments_by_course.get(course.id, [])
    percents = []
    missing = 0
    today = date.today()
    for enrollment in roster:
        grade = course_grade(world, enrollment.student_id, course)
        if grade["percent"] is not None:
            percents.append(grade["percent"])
        for assignment in grade["assignments"]:
            due = date.fromisoformat(assignment["due_on"])
            if assignment["pending"] and due <= today:
                missing += 1
    average = round(sum(percents) / len(percents), 1) if percents else None
    return {
        "roster_count": len(roster),
        "missing_scores": missing,
        "class_average": average,
    }


def dash_course(world: World, course: Course, grade: dict | None = None, with_class: bool = False) -> dict:
    payload = {
        "id": course.id,
        "code": course.code,
        "name": course.name,
        "period": course.period,
        "days": course.days,
        "days_label": days_label(course.days),
        "room": course.room,
        "department": course.department,
        "teacher_name": teacher_of_course(world, course).full_name,
        "percent": None if grade is None else grade["percent"],
        "letter": None if grade is None else grade["letter"],
        "roster_count": None,
        "missing_scores": None,
        "class_average": None,
    }
    if with_class:
        payload.update(class_stats(world, course))
    return payload


def meets_today(course: Course, today: date) -> bool:
    if today.weekday() >= 5:
        return False
    return "MTWRF"[today.weekday()] in course.days


def visible_notices(world: World, user: User) -> list[Announcement]:
    if user.role == "admin":
        notices = list(world.announcements)
    elif user.role == "teacher":
        teacher = world.teacher_by_user[user.id]
        own = {course.id for course in world.courses if course.teacher_id == teacher.id}
        notices = [
            notice
            for notice in world.announcements
            if notice.course_id is None or notice.course_id in own
        ]
    else:
        if user.role == "student":
            student_id = world.student_by_user[user.id].id
        else:
            student_id = world.parent_by_user[user.id].student_id
        enrolled = {course.id for course in student_courses(world, student_id)}
        notices = [
            notice
            for notice in world.announcements
            if notice.course_id is None or notice.course_id in enrolled
        ]
    return sorted(notices, key=lambda notice: notice.created_at, reverse=True)


def notice_out(world: World, notice: Announcement) -> dict:
    if notice.course_id is None:
        audience = "Whole school"
    else:
        course = world.course_by_id[notice.course_id]
        audience = f"{course.name}"
    return {
        "id": notice.id,
        "title": notice.title,
        "body": notice.body,
        "created_at": notice.created_at.isoformat(timespec="minutes"),
        "audience": audience,
        "course_id": notice.course_id,
        "author_name": world.user_by_id[notice.author_id].full_name,
    }


def recent_scores_for_student(world: World, student_id: int) -> list[dict]:
    rows = []
    for course in student_courses(world, student_id):
        grade = course_grade(world, student_id, course)
        for assignment in grade["assignments"]:
            if assignment["points"] is None:
                continue
            rows.append(
                {
                    "student_name": world.user_by_id[
                        world.student_by_id[student_id].user_id
                    ].full_name,
                    "course_name": course.name,
                    "course_code": course.code,
                    "title": assignment["title"],
                    "points": assignment["points"],
                    "max_points": assignment["max_points"],
                    "percent": assignment["percent"],
                    "due_on": assignment["due_on"],
                    "comment": assignment["comment"],
                }
            )
    rows.sort(key=lambda row: row["due_on"], reverse=True)
    return rows[:6]


def recent_scores_for_teacher(world: World, teacher: Teacher) -> list[dict]:
    rows = []
    for course in world.courses:
        if course.teacher_id != teacher.id:
            continue
        for enrollment in world.enrollments_by_course.get(course.id, []):
            for item in recent_scores_for_student(world, enrollment.student_id):
                if item["course_code"] == course.code:
                    rows.append(item)
    rows.sort(key=lambda row: (row["due_on"], row["student_name"]), reverse=True)
    return rows[:6]


def attention_list(world: World) -> list[dict]:
    items = []
    for student in world.students:
        report = report_for(world, student.id)
        reasons = []
        low = [course for course in report["courses"] if course["percent"] is not None and course["percent"] < 75]
        if low:
            names = ", ".join(course["code"] for course in low)
            reasons.append(f"Below 75% in {names}")
        rate = report["attendance_rate"]
        if rate is not None and rate < 0.9:
            reasons.append(f"Attendance {round(rate * 100)}%")
        if not reasons:
            continue
        items.append(
            {
                "student_id": student.id,
                "full_name": report["student"]["full_name"],
                "grade_level": student.grade_level,
                "reason": "; ".join(reasons),
                "gpa": report["gpa"],
                "attendance_rate": rate,
            }
        )
    items.sort(key=lambda item: (item["gpa"] is None, item["gpa"] or 0))
    return items


def dashboard(world: World, user: User) -> dict:
    today = date.today()
    courses = visible_courses(world, user)
    focus = None
    gpa = None
    rate = None
    recent: list[dict] = []
    today_courses = []
    attention: list[dict] = []
    missing = None
    student_count = None
    school_gpa = None
    school_attendance = None
    dash_courses = []

    if user.role in {"student", "parent"}:
        student_id = (
            world.student_by_user[user.id].id
            if user.role == "student"
            else world.parent_by_user[user.id].student_id
        )
        report = report_for(world, student_id)
        focus = report["student"]
        gpa = report["gpa"]
        rate = report["attendance_rate"]
        recent = recent_scores_for_student(world, student_id)
        by_id = {course["id"]: course for course in report["courses"]}
        dash_courses = [
            dash_course(world, course, by_id[course.id]) for course in courses
        ]
        today_courses = [
            item for item in dash_courses if meets_today(world.course_by_id[item["id"]], today)
        ]
    elif user.role == "teacher":
        teacher = world.teacher_by_user[user.id]
        dash_courses = [dash_course(world, course, with_class=True) for course in courses]
        today_courses = [
            item for item in dash_courses if meets_today(world.course_by_id[item["id"]], today)
        ]
        recent = recent_scores_for_teacher(world, teacher)
        missing = sum(item["missing_scores"] or 0 for item in dash_courses)
        seen: set[int] = set()
        for course in courses:
            for enrollment in world.enrollments_by_course.get(course.id, []):
                seen.add(enrollment.student_id)
        student_count = len(seen)
    else:
        dash_courses = [dash_course(world, course, with_class=True) for course in courses]
        today_courses = [
            item for item in dash_courses if meets_today(world.course_by_id[item["id"]], today)
        ]
        reports = [report_for(world, student.id) for student in world.students]
        gpas = [item["gpa"] for item in reports if item["gpa"] is not None]
        rates = [item["attendance_rate"] for item in reports if item["attendance_rate"] is not None]
        school_gpa = round(sum(gpas) / len(gpas), 2) if gpas else None
        school_attendance = round(sum(rates) / len(rates), 3) if rates else None
        student_count = len(world.students)
        attention = attention_list(world)
        missing = sum(item["missing_scores"] or 0 for item in dash_courses)

    return {
        "role": user.role,
        "term": "Fall 2026",
        "today": today.isoformat(),
        "focus_student": focus,
        "gpa": gpa,
        "attendance_rate": rate,
        "course_count": len(courses),
        "student_count": student_count,
        "missing_scores": missing,
        "school_gpa": school_gpa,
        "school_attendance": school_attendance,
        "courses": dash_courses,
        "today_courses": sorted(today_courses, key=lambda item: item["period"]),
        "recent_scores": recent,
        "notices": [notice_out(world, notice) for notice in visible_notices(world, user)[:4]],
        "attention": attention,
    }


def gradebook(world: World, course: Course) -> dict:
    assignments = world.assignments_by_course.get(course.id, [])
    students = []
    for enrollment in world.enrollments_by_course.get(course.id, []):
        student = world.student_by_id[enrollment.student_id]
        grade = course_grade(world, student.id, course)
        score_rows = []
        for assignment in assignments:
            score = world.scores_for.get((assignment.id, student.id))
            score_rows.append(
                {
                    "assignment_id": assignment.id,
                    "grade_id": None if score is None else score.id,
                    "points": None if score is None else score.points,
                    "comment": "" if score is None else score.comment,
                }
            )
        students.append(
            {
                "id": student.id,
                "full_name": world.user_by_id[student.user_id].full_name,
                "student_number": student.student_number,
                "grade_level": student.grade_level,
                "percent": grade["percent"],
                "letter": grade["letter"],
                "scores": score_rows,
            }
        )
    students.sort(key=lambda item: item["full_name"])
    stats = class_stats(world, course)
    return {
        "course": course_out(world, course),
        "assignments": [
            {
                "id": assignment.id,
                "title": assignment.title,
                "category": assignment.category,
                "category_label": {
                    "homework": "Homework",
                    "quiz": "Quiz",
                    "exam": "Exam",
                }[assignment.category],
                "max_points": assignment.max_points,
                "due_on": assignment.due_on.isoformat(),
            }
            for assignment in assignments
        ],
        "students": students,
        **stats,
    }


def attendance_summary(world: World, student_id: int) -> dict:
    student = world.student_by_id[student_id]
    courses = []
    all_marks = world.attendance_by_student.get(student_id, [])
    for course in student_courses(world, student_id):
        marks = [mark for mark in all_marks if mark.course_id == course.id]
        marks.sort(key=lambda mark: mark.day)
        courses.append(
            {
                **course_out(world, course),
                "rate": attendance_rate(marks),
                "marks": [
                    {"day": mark.day.isoformat(), "status": mark.status} for mark in marks
                ],
            }
        )
    return {
        "student": student_brief(world, student),
        "attendance_rate": attendance_rate(all_marks),
        "courses": courses,
    }


def attendance_sheet(world: World, course: Course, day: date) -> dict:
    roster = []
    for enrollment in world.enrollments_by_course.get(course.id, []):
        student = world.student_by_id[enrollment.student_id]
        mark = next(
            (
                item
                for item in world.attendance_by_course.get(course.id, [])
                if item.student_id == student.id and item.day == day
            ),
            None,
        )
        roster.append(
            {
                "student_id": student.id,
                "full_name": world.user_by_id[student.user_id].full_name,
                "student_number": student.student_number,
                "status": "present" if mark is None else mark.status,
                "recorded": mark is not None,
            }
        )
    roster.sort(key=lambda item: item["full_name"])
    return {
        "course": course_out(world, course),
        "day": day.isoformat(),
        "meets": meets_today(course, day) or (day.weekday() < 5 and "MTWRF"[day.weekday()] in course.days),
        "roster": roster,
    }


def schedule_for(world: World, student_id: int) -> dict:
    blocks = []
    for course in student_courses(world, student_id):
        blocks.append(
            {
                **course_out(world, course),
            }
        )
    return {
        "student": student_brief(world, world.student_by_id[student_id]),
        "periods": [1, 2, 3, 4, 5, 6],
        "days": [
            {"key": "M", "label": "Mon"},
            {"key": "T", "label": "Tue"},
            {"key": "W", "label": "Wed"},
            {"key": "R", "label": "Thu"},
            {"key": "F", "label": "Fri"},
        ],
        "blocks": blocks,
    }


def directory(world: World) -> dict:
    students = []
    for student in world.students:
        report = report_for(world, student.id)
        students.append(
            {
                **report["student"],
                "gpa": report["gpa"],
                "attendance_rate": report["attendance_rate"],
                "course_count": len(report["courses"]),
            }
        )
    students.sort(key=lambda item: item["full_name"])
    faculty = []
    for teacher in world.teachers:
        user = world.user_by_id[teacher.user_id]
        taught = [course for course in world.courses if course.teacher_id == teacher.id]
        faculty.append(
            {
                "id": teacher.id,
                "full_name": user.full_name,
                "email": user.email,
                "title": teacher.title,
                "department": teacher.department,
                "courses": [f"{course.code} {course.name}" for course in taught],
            }
        )
    faculty.sort(key=lambda item: item["full_name"])
    return {"students": students, "faculty": faculty}


def focus_student_id(world: World, user: User) -> int | None:
    if user.role == "student":
        return world.student_by_user[user.id].id
    if user.role == "parent":
        return world.parent_by_user[user.id].student_id
    return None


def iso_day(value: datetime | date) -> str:
    if isinstance(value, datetime):
        return value.date().isoformat()
    return value.isoformat()
