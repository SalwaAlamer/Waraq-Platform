import json
import os
import secrets
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
load_dotenv()

from database import get_db, init_db
from grader import grade_answers
from models import AnalyticsCache, Exam, Submission, utc_now
from vision import extract_answers


UPLOAD_DIR = Path("uploads")
MAX_IMAGE_SIZE_MB = int(os.getenv("MAX_IMAGE_SIZE_MB", "10"))
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/heic", "image/heif"}

configured_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:3001").split(",")
    if origin.strip()
]
LOCAL_DEV_ORIGINS = {
    "http://localhost:3001",
    "http://127.0.0.1:3001",
}
allowed_origins = sorted(set(configured_origins) | LOCAL_DEV_ORIGINS)

app = FastAPI(title="Waraq API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class QuestionIn(BaseModel):
    id: int
    text: str
    answer_key: str
    max_score: float = Field(gt=0)


class ExamCreate(BaseModel):
    title: str
    questions: list[QuestionIn]


class ExamOut(BaseModel):
    id: int
    code: str
    title: str
    questions: list[dict[str, Any]]
    created_at: str


@app.on_event("startup")
def startup() -> None:
    UPLOAD_DIR.mkdir(exist_ok=True)
    init_db()


def _exam_to_out(exam: Exam) -> dict[str, Any]:
    return {
        "id": exam.id,
        "code": exam.code,
        "title": exam.title,
        "questions": json.loads(exam.questions),
        "created_at": exam.created_at.isoformat(),
    }


def _exam_management_out(
    exam: Exam,
    submission_count: int = 0,
    latest_submission: Any = None,
) -> dict[str, Any]:
    return {
        **_exam_to_out(exam),
        "exam_id": exam.id,
        "exam_code": exam.code,
        "submission_count": submission_count,
        "latest_submission": latest_submission.isoformat() if latest_submission else None,
    }


def _generate_exam_code(db: Session) -> str:
    while True:
        code = f"WAR-{secrets.randbelow(9000) + 1000}"
        if not db.query(Exam).filter(Exam.code == code).first():
            return code


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/exams", response_model=ExamOut)
def create_exam(payload: ExamCreate, db: Session = Depends(get_db)) -> dict[str, Any]:
    exam = Exam(
        title=payload.title,
        code=_generate_exam_code(db),
        questions=json.dumps([question.model_dump() for question in payload.questions], ensure_ascii=False),
    )
    db.add(exam)
    db.commit()
    db.refresh(exam)
    return _exam_to_out(exam)


@app.get("/exams")
def list_exams(db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    rows = (
        db.query(
            Exam,
            func.count(Submission.id).label("submission_count"),
            func.max(Submission.created_at).label("latest_submission"),
        )
        .outerjoin(Submission, Submission.exam_id == Exam.id)
        .group_by(Exam.id)
        .order_by(Exam.created_at.desc())
        .all()
    )
    return [
        _exam_management_out(
            exam,
            submission_count=int(submission_count or 0),
            latest_submission=latest_submission,
        )
        for exam, submission_count, latest_submission in rows
    ]


@app.get("/exams/{exam_id_or_code}", response_model=ExamOut)
def get_exam(exam_id_or_code: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    query = db.query(Exam)
    exam = (
        query.filter(Exam.id == int(exam_id_or_code)).first()
        if exam_id_or_code.isdigit()
        else query.filter(Exam.code == exam_id_or_code.upper()).first()
    )
    if not exam:
        raise HTTPException(status_code=404, detail="رمز الاختبار غير صحيح / Invalid exam code")
    return _exam_to_out(exam)


async def _save_upload(file: UploadFile) -> str:
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported image type")

    suffix = Path(file.filename or "paper.jpg").suffix or ".jpg"
    target = UPLOAD_DIR / f"{secrets.token_hex(16)}{suffix}"
    size = 0
    with target.open("wb") as buffer:
        while chunk := await file.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_IMAGE_SIZE_MB * 1024 * 1024:
                target.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail="Image exceeds 10MB")
            buffer.write(chunk)
    return str(target)


@app.post("/submissions")
async def create_submission(
    exam_code: str = Form(...),
    student_name: str = Form(...),
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    exam = db.query(Exam).filter(Exam.code == exam_code.upper()).first()
    if not exam:
        raise HTTPException(status_code=404, detail="رمز الاختبار غير صحيح / Invalid exam code")

    image_path = await _save_upload(image)
    questions = json.loads(exam.questions)
    extracted_answers = await extract_answers(image_path, expected_count=len(questions))
    feedback = await grade_answers(extracted_answers, questions)
    feedback["extracted_answers"] = extracted_answers

    submission = Submission(
        exam_id=exam.id,
        student_name=student_name,
        image_path=image_path,
        total_score=feedback["total_score"],
        max_score=feedback["max_score"],
        feedback_json=json.dumps(feedback, ensure_ascii=False),
    )
    db.add(submission)
    db.query(AnalyticsCache).filter(AnalyticsCache.exam_id == exam.id).delete()
    db.commit()
    db.refresh(submission)
    return {"id": submission.id, **_submission_payload(submission)}


def _submission_payload(submission: Submission) -> dict[str, Any]:
    return {
        "exam_id": submission.exam_id,
        "student_name": submission.student_name,
        "total_score": submission.total_score,
        "max_score": submission.max_score,
        "feedback": json.loads(submission.feedback_json),
        "created_at": submission.created_at.isoformat(),
    }


def _score_percent(score: float, max_score: float) -> float:
    return (score / max_score * 100) if max_score else 0


def _letter_grade(percent: float) -> str:
    if percent >= 90:
        return "A"
    if percent >= 80:
        return "B"
    if percent >= 70:
        return "C"
    if percent >= 60:
        return "D"
    return "F"


def _build_dashboard_payload(exam: Exam, submissions: list[Submission]) -> dict[str, Any]:
    questions = json.loads(exam.questions)
    sorted_submissions = sorted(submissions, key=lambda item: item.created_at, reverse=True)
    submission_rows = []
    percents = []
    distribution = {"A": 0, "B": 0, "C": 0, "D": 0, "F": 0}

    for submission in sorted_submissions:
        feedback = json.loads(submission.feedback_json)
        percent = _score_percent(submission.total_score, submission.max_score)
        grade = _letter_grade(percent)
        distribution[grade] += 1
        percents.append(percent)
        submission_rows.append(
            {
                "id": submission.id,
                "student_name": submission.student_name,
                "total_score": submission.total_score,
                "max_score": submission.max_score,
                "percent": round(percent, 2),
                "grade": grade,
                "created_at": submission.created_at.isoformat(),
                "feedback": feedback,
            }
        )

    per_question = []
    for question in questions:
        qid = int(question["id"])
        question_scores = []
        max_points = float(question.get("max_score", 0))
        for submission in submissions:
            feedback = json.loads(submission.feedback_json)
            result = next(
                (item for item in feedback.get("questions", []) if int(item.get("question_id", 0)) == qid),
                None,
            )
            if result:
                question_scores.append(float(result.get("score", 0)))

        average_score = round(sum(question_scores) / len(question_scores), 2) if question_scores else 0
        average_percent = round(_score_percent(average_score, max_points), 2)
        per_question.append(
            {
                "question_id": qid,
                "question_text": question.get("text", ""),
                "average_score": average_score,
                "max_score": max_points,
                "average_percent": average_percent,
            }
        )

    hardest_question = min(per_question, key=lambda item: item["average_percent"], default=None)
    stats = {
        "total_submissions": len(submissions),
        "class_average": round(sum(percents) / len(percents), 2) if percents else 0,
        "highest_score": round(max(percents), 2) if percents else 0,
        "lowest_score": round(min(percents), 2) if percents else 0,
        "pass_rate": round(
            (sum(1 for percent in percents if percent >= 60) / len(percents) * 100),
            2,
        )
        if percents
        else 0,
    }

    return {
        "exam": _exam_to_out(exam),
        "submissions": submission_rows,
        "stats": stats,
        "grade_distribution": [
            {"grade": grade, "count": count} for grade, count in distribution.items()
        ],
        "per_question": per_question,
        "hardest_question": hardest_question,
    }


@app.get("/submissions/{submission_id}")
def get_submission(submission_id: int, db: Session = Depends(get_db)) -> dict[str, Any]:
    submission = db.get(Submission, submission_id)
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    exam = db.get(Exam, submission.exam_id)
    return {"id": submission.id, "exam": _exam_to_out(exam), **_submission_payload(submission)}


@app.get("/dashboard/{exam_id}")
def get_dashboard(exam_id: int, db: Session = Depends(get_db)) -> dict[str, Any]:
    exam = db.get(Exam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    submissions = db.query(Submission).filter(Submission.exam_id == exam_id).all()
    return _build_dashboard_payload(exam, submissions)


@app.get("/analytics/{exam_id}")
def get_analytics(exam_id: int, db: Session = Depends(get_db)) -> dict[str, Any]:
    cached = db.query(AnalyticsCache).filter(AnalyticsCache.exam_id == exam_id).first()
    if cached:
        return json.loads(cached.data_json)

    exam = db.get(Exam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    submissions = db.query(Submission).filter(Submission.exam_id == exam_id).all()
    scores = [
        (submission.total_score / submission.max_score * 100) if submission.max_score else 0
        for submission in submissions
    ]
    questions = json.loads(exam.questions)
    per_question = []
    mistakes: list[str] = []

    for question in questions:
        qid = int(question["id"])
        q_scores = []
        for submission in submissions:
            feedback = json.loads(submission.feedback_json)
            result = next(
                (item for item in feedback.get("questions", []) if int(item["question_id"]) == qid),
                None,
            )
            if result:
                q_scores.append(float(result.get("score", 0)))
                if not result.get("is_correct"):
                    mistakes.append(str(result.get("improvement_tip", "")))
        per_question.append(
            {
                "question_id": qid,
                "question_text": question.get("text", ""),
                "average": round(sum(q_scores) / len(q_scores), 2) if q_scores else 0,
                "max_score": question.get("max_score", 0),
            }
        )

    buckets = {"A": 0, "B": 0, "C": 0, "D": 0, "F": 0}
    for score in scores:
        buckets["A" if score >= 90 else "B" if score >= 80 else "C" if score >= 70 else "D" if score >= 60 else "F"] += 1

    data = {
        "exam": _exam_to_out(exam),
        "submission_count": len(submissions),
        "class_average": round(sum(scores) / len(scores), 2) if scores else 0,
        "score_distribution": [{"grade": key, "count": value} for key, value in buckets.items()],
        "per_question_average": per_question,
        "common_mistakes": [mistake for mistake in mistakes if mistake][:20],
    }
    cache_json = json.dumps(data, ensure_ascii=False)
    existing_cache = db.query(AnalyticsCache).filter(AnalyticsCache.exam_id == exam_id).first()
    if existing_cache:
        existing_cache.data_json = cache_json
        existing_cache.updated_at = utc_now()
    else:
        db.add(AnalyticsCache(exam_id=exam_id, data_json=cache_json, updated_at=utc_now()))
    db.commit()
    return data
