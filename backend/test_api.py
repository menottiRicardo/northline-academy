import os
import tempfile

os.environ["NORTHLINE_DB"] = os.path.join(tempfile.mkdtemp(), "test.db")

from fastapi.testclient import TestClient

from app.main import app

PASSWORD = "northline"


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_roles_and_boundaries(client: TestClient) -> None:
    def login(email: str) -> dict:
        response = client.post("/api/auth/login", json={"email": email, "password": PASSWORD})
        assert response.status_code == 200, response.text
        return response.json()

    avery = login("avery.chen@northline.edu")
    diane = login("diane.chen@northline.edu")
    marcus = login("marcus.hale@northline.edu")
    elena = login("elena.voss@northline.edu")
    priya = login("priya.shah@northline.edu")

    assert avery["user"]["role"] == "student"
    assert diane["user"]["child"]["full_name"] == "Avery Chen"
    assert diane["user"]["child"]["id"] == avery["user"]["student_id"]

    own = client.get("/api/report", headers=auth(avery["token"]))
    assert own.status_code == 200
    assert own.json()["student"]["full_name"] == "Avery Chen"
    assert own.json()["gpa"] is not None

    parent_view = client.get("/api/report", headers=auth(diane["token"]))
    assert parent_view.status_code == 200
    assert parent_view.json()["student"]["full_name"] == "Avery Chen"

    directory = client.get("/api/directory", headers=auth(elena["token"])).json()
    other = next(row for row in directory["students"] if row["full_name"] == "Owen Walsh")
    blocked = client.get(f"/api/report/{other['id']}", headers=auth(diane["token"]))
    assert blocked.status_code == 403
    student_blocked = client.get(f"/api/report/{other['id']}", headers=auth(avery["token"]))
    assert student_blocked.status_code == 403

    nora = next(row for row in directory["students"] if row["full_name"] == "Nora Kim")
    assert nora["gpa"] > other["gpa"]

    parent_directory = client.get("/api/directory", headers=auth(diane["token"]))
    assert parent_directory.status_code == 403

    courses = client.get("/api/courses", headers=auth(marcus["token"])).json()["courses"]
    algebra = next(course for course in courses if course["code"] == "ALG2")
    book = client.get(f"/api/gradebook/{algebra['id']}", headers=auth(marcus["token"])).json()
    owen = next(student for student in book["students"] if student["full_name"] == "Owen Walsh")
    homework = next(item for item in book["assignments"] if item["title"] == "Weekly practice 2")
    before = owen["percent"]
    saved = client.put(
        "/api/scores",
        headers=auth(marcus["token"]),
        json={
            "assignment_id": homework["id"],
            "student_id": owen["id"],
            "points": homework["max_points"],
            "comment": "Made up after tutorial.",
        },
    )
    assert saved.status_code == 200, saved.text
    owen_after = next(student for student in saved.json()["students"] if student["id"] == owen["id"])
    assert owen_after["percent"] != before
    score = next(item for item in owen_after["scores"] if item["assignment_id"] == homework["id"])
    assert score["points"] == homework["max_points"]
    assert score["comment"] == "Made up after tutorial."

    denied = client.put(
        "/api/scores",
        headers=auth(priya["token"]),
        json={
            "assignment_id": homework["id"],
            "student_id": owen["id"],
            "points": 10,
        },
    )
    assert denied.status_code == 403

    student_edit = client.put(
        "/api/scores",
        headers=auth(avery["token"]),
        json={
            "assignment_id": homework["id"],
            "student_id": owen["id"],
            "points": 10,
        },
    )
    assert student_edit.status_code == 403

    sheet = client.get(
        f"/api/attendance/sheet?course_id={algebra['id']}",
        headers=auth(marcus["token"]),
    )
    assert sheet.status_code == 200
    day = sheet.json()["day"]
    marks = [
        {"student_id": row["student_id"], "status": "tardy" if row["student_id"] == owen["id"] else "present"}
        for row in sheet.json()["roster"]
    ]
    posted = client.put(
        "/api/attendance/sheet",
        headers=auth(marcus["token"]),
        json={"course_id": algebra["id"], "day": day, "marks": marks},
    )
    assert posted.status_code == 200
    owen_mark = next(row for row in posted.json()["roster"] if row["student_id"] == owen["id"])
    assert owen_mark["status"] == "tardy"

    notice = client.post(
        "/api/notices",
        headers=auth(marcus["token"]),
        json={
            "title": "Tutorial moved to Thursday",
            "body": "Algebra II tutorial meets in 118 on Thursday this week, right after period 2.",
            "course_id": algebra["id"],
        },
    )
    assert notice.status_code == 200
    titles = [item["title"] for item in notice.json()["notices"]]
    assert "Tutorial moved to Thursday" in titles

    avery_notices = client.get("/api/notices", headers=auth(avery["token"])).json()["notices"]
    assert any(item["title"] == "Tutorial moved to Thursday" for item in avery_notices)
    diane_notices = client.get("/api/notices", headers=auth(diane["token"])).json()["notices"]
    assert any(item["title"] == "Tutorial moved to Thursday" for item in diane_notices)

    school = client.post(
        "/api/notices",
        headers=auth(marcus["token"]),
        json={
            "title": "A school-wide try",
            "body": "Teachers should not be able to post this to the whole school.",
        },
    )
    assert school.status_code == 403


if __name__ == "__main__":
    with TestClient(app) as client:
        test_roles_and_boundaries(client)
    print("api checks passed")
