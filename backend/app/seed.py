import hashlib
from datetime import date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import DEMO_PASSWORD, hash_password
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

TERM = "Fall 2026"


def utcnow():
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).replace(tzinfo=None)


def recent_weekdays(count: int, today: date) -> list[date]:
    days: list[date] = []
    cursor = today - timedelta(days=1)
    while len(days) < count:
        if cursor.weekday() < 5:
            days.append(cursor)
        cursor -= timedelta(days=1)
    days.reverse()
    return days


def _wobble(student_key: str, title: str) -> float:
    digest = hashlib.sha256(f"{student_key}:{title}".encode()).hexdigest()
    unit = int(digest[:4], 16) / 0xFFFF
    return unit * 0.10 - 0.04


def _round_points(category: str, raw: float, max_points: float) -> float:
    if category == "exam":
        points = round(raw)
    else:
        points = round(raw * 2) / 2
    return float(max(0, min(max_points, points)))


def seed(db: Session) -> None:
    if db.scalar(select(func.count()).select_from(User)):
        return

    today = date.today()
    password = hash_password(DEMO_PASSWORD)

    def add_user(email: str, full_name: str, role: str) -> User:
        user = User(
            email=email,
            full_name=full_name,
            role=role,
            password_hash=password,
        )
        db.add(user)
        db.flush()
        return user

    elena = add_user("elena.voss@northline.edu", "Elena Voss", "admin")
    hale_user = add_user("marcus.hale@northline.edu", "Marcus Hale", "teacher")
    shah_user = add_user("priya.shah@northline.edu", "Priya Shah", "teacher")
    okonkwo_user = add_user("james.okonkwo@northline.edu", "James Okonkwo", "teacher")
    cho_user = add_user("helen.cho@northline.edu", "Helen Cho", "teacher")

    teachers = {
        "hale": Teacher(
            user_id=hale_user.id,
            department="Mathematics",
            title="Mathematics faculty",
        ),
        "shah": Teacher(
            user_id=shah_user.id,
            department="English",
            title="English faculty",
        ),
        "okonkwo": Teacher(
            user_id=okonkwo_user.id,
            department="Science",
            title="Science faculty",
        ),
        "cho": Teacher(
            user_id=cho_user.id,
            department="History",
            title="History faculty",
        ),
    }
    db.add_all(teachers.values())
    db.flush()

    student_specs = [
        ("avery", "Avery Chen", "avery.chen@northline.edu", "NA-1108", 11, "Rowan", 0.93),
        ("jordan", "Jordan Blake", "jordan.blake@northline.edu", "NA-1114", 11, "Lark", 0.86),
        ("samira", "Samira Patel", "samira.patel@northline.edu", "NA-1042", 10, "Birch", 0.82),
        ("leo", "Leo Nguyen", "leo.nguyen@northline.edu", "NA-1120", 11, "Cedar", 0.88),
        ("maya", "Maya Alvarez", "maya.alvarez@northline.edu", "NA-1036", 10, "Rowan", 0.79),
        ("caleb", "Caleb Brooks", "caleb.brooks@northline.edu", "NA-1119", 11, "Lark", 0.74),
        ("nora", "Nora Kim", "nora.kim@northline.edu", "NA-1204", 12, "Birch", 0.97),
        ("owen", "Owen Walsh", "owen.walsh@northline.edu", "NA-1111", 11, "Cedar", 0.66),
    ]
    students: dict[str, Student] = {}
    profiles: dict[str, float] = {}
    for key, name, email, number, grade, house, profile in student_specs:
        user = add_user(email, name, "student")
        student = Student(
            user_id=user.id,
            student_number=number,
            grade_level=grade,
            house=house,
        )
        db.add(student)
        db.flush()
        students[key] = student
        profiles[key] = profile

    diane = add_user("diane.chen@northline.edu", "Diane Chen", "parent")
    db.add(
        ParentLink(
            user_id=diane.id,
            student_id=students["avery"].id,
            relationship_label="Mother",
        )
    )

    course_specs = [
        ("AMLIT", "American Literature", 1, "MWF", "204", 1.0, "English", "shah"),
        ("PREC", "Precalculus", 1, "MTWRF", "120", 1.0, "Mathematics", "hale"),
        ("ALG2", "Algebra II", 2, "MTWRF", "118", 1.0, "Mathematics", "hale"),
        ("COMP", "Composition", 3, "TR", "206", 0.5, "English", "shah"),
        ("WLD", "World History", 3, "MWF", "212", 1.0, "History", "cho"),
        ("HIST", "U.S. History", 4, "MWF", "210", 1.0, "History", "cho"),
        ("BIO", "Biology", 5, "MWF", "Lab A", 1.0, "Science", "okonkwo"),
        ("CHEM", "Chemistry", 6, "TR", "Lab B", 1.0, "Science", "okonkwo"),
    ]
    courses: dict[str, Course] = {}
    for code, name, period, days, room, credits, department, teacher_key in course_specs:
        course = Course(
            code=code,
            name=name,
            period=period,
            days=days,
            room=room,
            credits=credits,
            department=department,
            teacher_id=teachers[teacher_key].id,
        )
        db.add(course)
        db.flush()
        courses[code] = course

    roster = {
        "avery": ["AMLIT", "ALG2", "COMP", "HIST", "BIO"],
        "jordan": ["PREC", "COMP", "HIST", "BIO", "CHEM"],
        "samira": ["AMLIT", "ALG2", "COMP", "WLD", "BIO"],
        "leo": ["PREC", "COMP", "HIST", "CHEM", "WLD"],
        "maya": ["AMLIT", "ALG2", "WLD", "BIO", "HIST"],
        "caleb": ["PREC", "ALG2", "COMP", "HIST", "CHEM"],
        "nora": ["PREC", "COMP", "HIST", "CHEM", "WLD"],
        "owen": ["AMLIT", "ALG2", "COMP", "WLD", "BIO"],
    }
    for student_key, codes in roster.items():
        chosen = [courses[code] for code in codes]
        for left in chosen:
            for right in chosen:
                if left.id >= right.id:
                    continue
                if left.period == right.period and set(left.days) & set(right.days):
                    raise RuntimeError(
                        f"{student_key} has a schedule conflict between {left.code} and {right.code}"
                    )
        for code in codes:
            db.add(
                Enrollment(
                    course_id=courses[code].id,
                    student_id=students[student_key].id,
                )
            )

    assignment_plan = [
        ("homework", "Weekly practice 1", 20, -16),
        ("quiz", "Quiz \u2014 foundations", 30, -9),
        ("homework", "Weekly practice 2", 20, -2),
        ("exam", "Unit exam", 100, None),
    ]
    past_exams = {"ALG2", "PREC", "HIST", "BIO"}
    unscored_homework = {("owen", "Weekly practice 2"), ("caleb", "Weekly practice 2")}

    assignments: dict[tuple[str, str], Assignment] = {}
    for code, course in courses.items():
        for category, title, max_points, offset in assignment_plan:
            due_offset = offset
            if category == "exam":
                due_offset = -7 if code in past_exams else 5
            assignment = Assignment(
                course_id=course.id,
                title=title,
                category=category,
                max_points=max_points,
                due_on=today + timedelta(days=due_offset or 0),
            )
            db.add(assignment)
            db.flush()
            assignments[(code, title)] = assignment

    now = utcnow()
    for student_key, codes in roster.items():
        for code in codes:
            for category, title, max_points, _offset in assignment_plan:
                assignment = assignments[(code, title)]
                upcoming = assignment.due_on > today
                missing = (student_key, title) in unscored_homework
                points = None
                comment = ""
                if not upcoming and not missing:
                    raw = max_points * min(1.0, max(0.45, profiles[student_key] + _wobble(student_key, f"{code}:{title}")))
                    points = _round_points(category, raw, max_points)
                    if student_key == "owen" and category == "quiz" and code == "ALG2":
                        comment = "Come by during tutorial \u2014 the factoring section is the one to redo."
                    if student_key == "nora" and category == "exam":
                        comment = "Precise work. The last proof was especially clean."
                    if student_key == "avery" and code == "AMLIT" and category == "quiz":
                        comment = "Strong reading of the chapter. Quote more directly next time."
                db.add(
                    Score(
                        assignment_id=assignment.id,
                        student_id=students[student_key].id,
                        points=points,
                        comment=comment,
                        updated_at=now,
                    )
                )

    school_days = recent_weekdays(8, today)
    exceptions = {
        ("owen", school_days[1].isoformat()): "absent",
        ("owen", school_days[4].isoformat()): "tardy",
        ("owen", school_days[6].isoformat()): "absent",
        ("maya", school_days[3].isoformat()): "excused",
        ("caleb", school_days[2].isoformat()): "tardy",
        ("samira", school_days[5].isoformat()): "absent",
    }
    for student_key, codes in roster.items():
        for code in codes:
            course = courses[code]
            for day in school_days:
                if day.weekday() >= 5 or "MTWRF"[day.weekday()] not in course.days:
                    continue
                status = exceptions.get((student_key, day.isoformat()), "present")
                db.add(
                    Attendance(
                        course_id=course.id,
                        student_id=students[student_key].id,
                        day=day,
                        status=status,
                    )
                )

    notices = [
        (
            None,
            elena.id,
            "Fall conferences, November 6 and 7",
            "Parent conferences are Thursday and Friday, November 6 and 7. Students will bring a signup card home on Monday. Diane Chen's card is already on file for Avery.",
            today - timedelta(days=1),
        ),
        (
            courses["ALG2"].id,
            hale_user.id,
            "Algebra II corrections are open",
            "Unit exam corrections are open until Friday. Show the new work under each missed problem. A corrected solution can earn back half the points.",
            today - timedelta(days=2),
        ),
        (
            courses["AMLIT"].id,
            shah_user.id,
            "Bring the annotated novel Wednesday",
            "Bring the annotated copy of Their Eyes Were Watching God on Wednesday. We will start with chapter 8, so the margins should already have your questions.",
            today - timedelta(days=3),
        ),
        (
            courses["BIO"].id,
            okonkwo_user.id,
            "Lab closes ten minutes early Friday",
            "Lab benches close ten minutes early on Friday for the safety check. Goggles stay on until you are dismissed.",
            today - timedelta(days=4),
        ),
        (
            courses["HIST"].id,
            cho_user.id,
            "New Deal packet before Thursday",
            "The primary-source packet for the New Deal is on the back table. Read documents 2 and 4 before Thursday's discussion.",
            today - timedelta(days=5),
        ),
    ]
    for course_id, author_id, title, body, when in notices:
        db.add(
            Announcement(
                course_id=course_id,
                author_id=author_id,
                title=title,
                body=body,
                created_at=datetime.combine(when, datetime.min.time()),
            )
        )
    db.commit()
