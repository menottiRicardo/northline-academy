from app.models import Assignment, Attendance, Score

WEIGHTS = {"homework": 0.20, "quiz": 0.30, "exam": 0.50}
CATEGORY_LABELS = {"homework": "Homework", "quiz": "Quizzes", "exam": "Exams"}
DAY_KEYS = "MTWRF"
DAY_LABELS = {
    "M": "Mon",
    "T": "Tue",
    "W": "Wed",
    "R": "Thu",
    "F": "Fri",
}
LETTER_CUTS = (
    (93, "A", 4.0),
    (90, "A-", 3.7),
    (87, "B+", 3.3),
    (83, "B", 3.0),
    (80, "B-", 2.7),
    (77, "C+", 2.3),
    (73, "C", 2.0),
    (70, "C-", 1.7),
    (60, "D", 1.0),
)


def letter_for(percent: float | None) -> tuple[str | None, float | None]:
    if percent is None:
        return None, None
    for cut, letter, points in LETTER_CUTS:
        if percent >= cut:
            return letter, points
    return "F", 0.0


def days_label(days: str) -> str:
    return ", ".join(DAY_LABELS[day] for day in days)


def summarize_course(
    assignments: list[Assignment], scores_by_assignment: dict[int, Score]
) -> dict:
    buckets = {
        category: {"earned": 0.0, "possible": 0.0, "pending": 0}
        for category in WEIGHTS
    }
    for assignment in assignments:
        score = scores_by_assignment.get(assignment.id)
        bucket = buckets[assignment.category]
        if score is None or score.points is None:
            bucket["pending"] += 1
            continue
        bucket["earned"] += score.points
        bucket["possible"] += assignment.max_points

    used: list[tuple[float, float]] = []
    categories = []
    for category, weight in WEIGHTS.items():
        bucket = buckets[category]
        percent = None
        if bucket["possible"] > 0:
            percent = round(bucket["earned"] / bucket["possible"] * 100, 1)
            used.append((weight, percent))
        categories.append(
            {
                "name": category,
                "label": CATEGORY_LABELS[category],
                "weight": weight,
                "percent": percent,
                "earned": round(bucket["earned"], 1),
                "possible": round(bucket["possible"], 1),
                "pending": bucket["pending"],
            }
        )

    weight_sum = sum(weight for weight, _percent in used)
    percent = None
    if weight_sum:
        percent = round(
            sum(weight * value for weight, value in used) / weight_sum, 1
        )
    letter, gpa_points = letter_for(percent)
    return {
        "percent": percent,
        "letter": letter,
        "gpa_points": gpa_points,
        "categories": categories,
    }


def credit_gpa(courses: list[dict]) -> float | None:
    earned = 0.0
    credits = 0.0
    for course in courses:
        if course["gpa_points"] is None:
            continue
        earned += course["gpa_points"] * course["credits"]
        credits += course["credits"]
    if credits == 0:
        return None
    return round(earned / credits, 2)


def attendance_rate(marks: list[Attendance]) -> float | None:
    counted = [mark for mark in marks if mark.status != "excused"]
    if not counted:
        return None
    attended = sum(1 for mark in counted if mark.status in {"present", "tardy"})
    return round(attended / len(counted), 3)
