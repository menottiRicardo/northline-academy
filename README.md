# Northline Academy

A school register for one upper school. Students read their own grades, one parent sees one child, teachers keep the gradebook for their courses, and the registrar sees the whole roll.

The demo term is Fall 2026. Scores, attendance, and notices are stored in a local SQLite file and survive a restart.

## Run it

Use two terminals from the project root.

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8741
```

```bash
cd frontend
npm install
npm run dev
```

Open the Vite app. The dev server proxies `/api` to the FastAPI process on port 8741.

API docs are at `http://127.0.0.1:8741/api/docs`.

Delete `backend/northline.db` to rebuild the demo school from scratch.

## Sign in

Every demo account uses the password `northline`.

| Desk | Person | Email |
| --- | --- | --- |
| Registrar | Elena Voss | elena.voss@northline.edu |
| Mathematics | Marcus Hale | marcus.hale@northline.edu |
| English | Priya Shah | priya.shah@northline.edu |
| Science | James Okonkwo | james.okonkwo@northline.edu |
| History | Helen Cho | helen.cho@northline.edu |
| Student | Avery Chen | avery.chen@northline.edu |
| Parent | Diane Chen | diane.chen@northline.edu |

Diane is Avery's mother. She can open Avery's grades, schedule, attendance, and course notices, and nothing else on the roll.

## What each desk can do

- **Student:** GPA, weighted course grades, weekly schedule, attendance, notices.
- **Parent:** the same record for their one linked child. Scores are read-only.
- **Teacher:** class averages, an editable gradebook, attendance for their sections, course notices.
- **Registrar:** school averages, a watch list, the directory, any gradebook, and school-wide notices.

Homework counts 20%, quizzes 30%, and exams 50%. A score that has not been entered yet is left out of the average.

## License

MIT. See [LICENSE](LICENSE).

Source: https://github.com/menottiRicardo/northline-academy
