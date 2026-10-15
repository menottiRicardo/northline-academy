from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import (
    DEMO_PASSWORD,
    create_token,
    get_current_user,
    verify_password,
)
from app.database import get_db
from app.models import Announcement, Assignment, Attendance, Score, User
from app.records import (
    attendance_sheet,
    attendance_summary,
    can_edit_course,
    can_view_student,
    dashboard,
    directory,
    focus_student_id,
    gradebook,
    load_world,
    report_for,
    schedule_for,
    user_out,
    visible_courses,
    visible_notices,
    notice_out,
)
from app.seed import TERM, utcnow

router = APIRouter()

DEMOS = [
    {
        "role": "admin",
        "full_name": "Elena Voss",
        "email": "elena.voss@northline.edu",
        "detail": "Registrar",
        "featured": True,
    },
    {
        "role": "teacher",
        "full_name": "Marcus Hale",
        "email": "marcus.hale@northline.edu",
        "detail": "Mathematics",
        "featured": True,
    },
    {
        "role": "student",
        "full_name": "Avery Chen",
        "email": "avery.chen@northline.edu",
        "detail": "Grade 11 \u00b7 Rowan",
        "featured": True,
    },
    {
        "role": "parent",
        "full_name": "Diane Chen",
        "email": "diane.chen@northline.edu",
        "detail": "Avery's mother",
        "featured": True,
    },
    {
        "role": "teacher",
        "full_name": "Priya Shah",
        "email": "priya.shah@northline.edu",
        "detail": "English",
        "featured": False,
    },
    {
        "role": "teacher",
        "full_name": "James Okonkwo",
        "email": "james.okonkwo@northline.edu",
        "detail": "Science",
        "featured": False,
    },
    {
        "role": "teacher",
        "full_name": "Helen Cho",
        "email": "helen.cho@northline.edu",
        "detail": "History",
        "featured": False,
    },
    {
        "role": "student",
        "full_name": "Nora Kim",
        "email": "nora.kim@northline.edu",
        "detail": "Grade 12 \u00b7 Birch",
        "featured": False,
    },
    {
        "role": "student",
        "full_name": "Owen Walsh",
        "email": "owen.walsh@northline.edu",
        "detail": "Grade 11 \u00b7 Cedar",
        "featured": False,
    },
    {
        "role": "student",
        "full_name": "Jordan Blake",
        "email": "jordan.blake@northline.edu",
        "detail": "Grade 11 \u00b7 Lark",
        "featured": False,
    },
]


class LoginIn(BaseModel):
    email: str
    password: str


class ScoreIn(BaseModel):
    assignment_id: int
    student_id: int
    points: float | None = None
    comment: str | None = None


class MarkIn(BaseModel):
    student_id: int
    status: str


class AttendanceIn(BaseModel):
    course_id: int
    day: date
    marks: list[MarkIn]


class NoticeIn(BaseModel):
    title: str = Field(min_length=3, max_length=160)
    body: str = Field(min_length=8, max_length=2000)
    course_id: int | None = None


def session_payload(db: Session, user: User) -> dict:
    world = load_world(db)
    return {
        "token": create_token(user.id),
        "user": user_out(world, user),
        "term": TERM,
        "today": date.today().isoformat(),
    }


@router.get("/health")
def health() -> dict:
    return {"ok": True, "school": "Northline Academy"}


@router.get("/auth/demos")
def demos() -> dict:
    return {"password": DEMO_PASSWORD, "accounts": DEMOS, "term": TERM}


@router.post("/auth/login")
def login(body: LoginIn, db: Session = Depends(get_db)) -> dict:
    email = body.email.strip().lower()
    user = db.scalar(select(User).where(User.email == email))
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=401, detail="That email or password does not match the register."
        )
    return session_payload(db, user)


@router.get("/auth/me")
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    world = load_world(db)
    return {
        "user": user_out(world, user),
        "term": TERM,
        "today": date.today().isoformat(),
    }


@router.get("/dashboard")
def get_dashboard(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    return dashboard(load_world(db), user)


@router.get("/courses")
def courses(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    world = load_world(db)
    from app.records import course_out

    return {"courses": [course_out(world, course) for course in visible_courses(world, user)]}


@router.get("/report/{student_id}")
def report(
    student_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    world = load_world(db)
    if student_id not in world.student_by_id:
        raise HTTPException(status_code=404, detail="That student is not on the roll.")
    if not can_view_student(world, user, student_id):
        raise HTTPException(
            status_code=403, detail="You can only open a record that belongs to you."
        )
    return report_for(world, student_id)


@router.get("/report")
def own_report(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    world = load_world(db)
    student_id = focus_student_id(world, user)
    if student_id is None:
        raise HTTPException(
            status_code=403,
            detail="Open a student from the directory or the gradebook.",
        )
    return report_for(world, student_id)


@router.get("/gradebook/{course_id}")
def get_gradebook(
    course_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    world = load_world(db)
    if course_id not in world.course_by_id:
        raise HTTPException(status_code=404, detail="That course is not on the schedule.")
    if not can_edit_course(world, user, course_id) and user.role != "admin":
        if user.role != "teacher" or not can_edit_course(world, user, course_id):
            raise HTTPException(
                status_code=403, detail="The gradebook is open to the teacher of this course."
            )
    if user.role not in {"teacher", "admin"}:
        raise HTTPException(
            status_code=403, detail="The gradebook is open to the teacher of this course."
        )
    return gradebook(world, world.course_by_id[course_id])


@router.put("/scores")
def put_score(
    body: ScoreIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    world = load_world(db)
    assignment = db.get(Assignment, body.assignment_id)
    if assignment is None:
        raise HTTPException(status_code=404, detail="That assignment is not in the gradebook.")
    if not can_edit_course(world, user, assignment.course_id):
        raise HTTPException(
            status_code=403, detail="You can only enter scores for your own courses."
        )
    enrolled = any(
        enrollment.student_id == body.student_id
        and enrollment.course_id == assignment.course_id
        for enrollment in world.enrollments
    )
    if not enrolled:
        raise HTTPException(status_code=404, detail="That student is not on this course roll.")
    if body.points is not None and (body.points < 0 or body.points > assignment.max_points):
        raise HTTPException(
            status_code=422,
            detail=f"Enter a score from 0 to {assignment.max_points:g}.",
        )
    score = db.scalar(
        select(Score).where(
            Score.assignment_id == assignment.id,
            Score.student_id == body.student_id,
        )
    )
    if score is None:
        score = Score(
            assignment_id=assignment.id,
            student_id=body.student_id,
            points=body.points,
            comment=(body.comment or "").strip(),
            updated_at=utcnow(),
        )
        db.add(score)
    else:
        score.points = body.points
        if body.comment is not None:
            score.comment = body.comment.strip()
        score.updated_at = utcnow()
    db.commit()
    world = load_world(db)
    return gradebook(world, world.course_by_id[assignment.course_id])


@router.get("/attendance")
def get_attendance(
    student_id: int | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    world = load_world(db)
    target = student_id if student_id is not None else focus_student_id(world, user)
    if target is None:
        raise HTTPException(
            status_code=403, detail="Choose a class to take attendance."
        )
    if target not in world.student_by_id:
        raise HTTPException(status_code=404, detail="That student is not on the roll.")
    if not can_view_student(world, user, target):
        raise HTTPException(
            status_code=403, detail="You can only open a record that belongs to you."
        )
    return attendance_summary(world, target)


@router.get("/attendance/sheet")
def get_sheet(
    course_id: int,
    day: date | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    world = load_world(db)
    if not can_edit_course(world, user, course_id):
        raise HTTPException(
            status_code=403, detail="You can only take attendance for your own courses."
        )
    chosen = day or date.today()
    return attendance_sheet(world, world.course_by_id[course_id], chosen)


@router.put("/attendance/sheet")
def put_sheet(
    body: AttendanceIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    world = load_world(db)
    if not can_edit_course(world, user, body.course_id):
        raise HTTPException(
            status_code=403, detail="You can only take attendance for your own courses."
        )
    allowed = {"present", "absent", "tardy", "excused"}
    roster_ids = {
        enrollment.student_id
        for enrollment in world.enrollments_by_course.get(body.course_id, [])
    }
    for mark in body.marks:
        if mark.status not in allowed:
            raise HTTPException(
                status_code=422,
                detail="Status must be present, absent, tardy, or excused.",
            )
        if mark.student_id not in roster_ids:
            raise HTTPException(status_code=404, detail="That student is not on this course roll.")
        existing = db.scalar(
            select(Attendance).where(
                Attendance.course_id == body.course_id,
                Attendance.student_id == mark.student_id,
                Attendance.day == body.day,
            )
        )
        if existing is None:
            db.add(
                Attendance(
                    course_id=body.course_id,
                    student_id=mark.student_id,
                    day=body.day,
                    status=mark.status,
                )
            )
        else:
            existing.status = mark.status
    db.commit()
    world = load_world(db)
    return attendance_sheet(world, world.course_by_id[body.course_id], body.day)


@router.get("/schedule")
def get_schedule(
    student_id: int | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    world = load_world(db)
    target = student_id if student_id is not None else focus_student_id(world, user)
    if target is None:
        raise HTTPException(status_code=403, detail="The weekly schedule belongs to a student.")
    if not can_view_student(world, user, target):
        raise HTTPException(
            status_code=403, detail="You can only open a record that belongs to you."
        )
    return schedule_for(world, target)


@router.get("/notices")
def notices(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    world = load_world(db)
    return {"notices": [notice_out(world, notice) for notice in visible_notices(world, user)]}


@router.post("/notices")
def post_notice(
    body: NoticeIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    world = load_world(db)
    if user.role not in {"teacher", "admin"}:
        raise HTTPException(status_code=403, detail="Only faculty can post a notice.")
    course_id = body.course_id
    if course_id is None and user.role != "admin":
        raise HTTPException(
            status_code=403, detail="School-wide notices are posted by the registrar."
        )
    if course_id is not None and not can_edit_course(world, user, course_id):
        raise HTTPException(status_code=403, detail="You can only post to your own courses.")
    notice = Announcement(
        course_id=course_id,
        author_id=user.id,
        title=body.title.strip(),
        body=body.body.strip(),
        created_at=utcnow(),
    )
    db.add(notice)
    db.commit()
    world = load_world(db)
    return {"notices": [notice_out(world, item) for item in visible_notices(world, user)]}


@router.get("/directory")
def get_directory(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="The school directory is open to the registrar.")
    return directory(load_world(db))
