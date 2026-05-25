import asyncio
import json
import logging
import os
import re
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

from dotenv import load_dotenv


load_dotenv(Path(__file__).resolve().parent.parent / ".env")
load_dotenv()

logger = logging.getLogger("waraq.grader")

MODEL_NAME = "gemini-2.5-flash"
FALLBACK_NOTE = "AI grading unavailable; local fallback grading was used."
CLEAR_READ_FAILURE = "Could not read this answer clearly."


def _use_gemini() -> bool:
    enabled = os.getenv("USE_GEMINI", "false").strip().lower() in {"1", "true", "yes", "on"}
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    return enabled and bool(api_key)


def _normalize_text(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).lower()
    value = "".join(ch for ch in value if unicodedata.category(ch) != "Mn")
    value = re.sub(r"[^\w\s\u0600-\u06ff]", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def _text_similarity(student_answer: str, answer_key: str) -> float:
    student = _normalize_text(student_answer)
    key = _normalize_text(answer_key)
    if not student or not key or student == _normalize_text(CLEAR_READ_FAILURE):
        return 0.0

    sequence_score = SequenceMatcher(None, student, key).ratio()
    student_words = set(student.split())
    key_words = set(key.split())
    overlap_score = len(student_words & key_words) / len(key_words) if key_words else 0.0
    return round((sequence_score * 0.55) + (overlap_score * 0.45), 3)


def _score_from_similarity(similarity: float, max_points: float) -> tuple[float, bool, str, str]:
    if similarity >= 0.75:
        return (
            max_points,
            True,
            "إجابة جيدة ومطابقة بدرجة عالية لمفتاح الإجابة.",
            "Good answer with high similarity to the answer key.",
        )
    if similarity >= 0.45:
        return (
            round(max_points * 0.6, 2),
            False,
            "الإجابة صحيحة جزئياً وتحتاج إلى تفاصيل أدق.",
            "Partially correct; add more key details from the answer key.",
        )
    if similarity >= 0.25:
        return (
            round(max_points * 0.3, 2),
            False,
            "الإجابة تحتوي على بعض الأفكار القريبة لكنها غير مكتملة.",
            "Some relevant ideas were found, but the answer is incomplete.",
        )
    return (
        0.0,
        False,
        "الإجابة غير كافية أو بعيدة عن مفتاح الإجابة.",
        "The answer is insufficient or does not match the answer key.",
    )


def _fallback_grade(
    extracted_answers: list[dict[str, Any]],
    questions: list[dict[str, Any]],
    note: str | None = None,
) -> dict[str, Any]:
    question_results = []
    total = 0.0
    max_score = 0.0
    answers_by_number = {
        int(item["question_number"]): item
        for item in extracted_answers
        if str(item.get("question_number", "")).isdigit()
    }

    for index, question in enumerate(questions, start=1):
        qid = int(question["id"])
        max_points = float(question.get("max_score", 0))
        answer = answers_by_number.get(qid) or answers_by_number.get(index)
        if answer is None and index <= len(extracted_answers):
            answer = extracted_answers[index - 1]
        answer = answer or {}
        extracted_text = str(answer.get("student_answer") or answer.get("extracted_text", ""))
        answer_key = str(question.get("answer_key", ""))
        similarity = _text_similarity(extracted_text, answer_key)
        awarded, is_correct, feedback_ar, feedback_en = _score_from_similarity(
            similarity, max_points
        )
        total += awarded
        max_score += max_points
        question_results.append(
            {
                "question_id": qid,
                "question_text": question.get("text") or answer.get("question_text", ""),
                "student_answer": extracted_text,
                "correct_answer": answer_key,
                "score": awarded,
                "max_score": max_points,
                "is_correct": is_correct,
                "feedback_ar": feedback_ar,
                "feedback_en": feedback_en,
                "improvement_tip": (
                    f"Local similarity score: {similarity:.2f}. "
                    "Review the answer key and add missing key terms."
                ),
            }
        )

    graded: dict[str, Any] = {
        "total_score": round(total, 2),
        "max_score": round(max_score, 2),
        "questions": question_results,
    }
    if note:
        graded["grading_note"] = note
    return graded


def _extract_json(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("Gemini response did not contain a JSON object")
    return json.loads(cleaned[start : end + 1])


def _gemini_grade_sync(
    extracted_answers: list[dict[str, Any]], questions: list[dict[str, Any]]
) -> dict[str, Any]:
    import google.generativeai as genai

    genai.configure(api_key=os.environ["GEMINI_API_KEY"])
    model = genai.GenerativeModel(MODEL_NAME)
    prompt = {
        "role": "exam_grader",
        "instructions": [
            "Grade each student answer against the provided answer key.",
            "Use an academic tone and be fair to short computer science answers.",
            "Do not hallucinate facts not present in the answer key or student answer.",
            "Return strict JSON only, without markdown.",
            "Scores must be numeric and must not exceed max_score.",
            "Include Arabic and English feedback for every question.",
        ],
        "answer_key": questions,
        "extracted_answers": extracted_answers,
        "required_json_schema": {
            "total_score": "number",
            "max_score": "number",
            "questions": [
                {
                    "question_id": 1,
                    "question_text": "string",
                    "student_answer": "string",
                    "correct_answer": "string",
                    "score": 8,
                    "max_score": 10,
                    "is_correct": False,
                    "feedback_ar": "string",
                    "feedback_en": "string",
                    "improvement_tip": "string",
                }
            ],
        },
    }
    response = model.generate_content(
        json.dumps(prompt, ensure_ascii=False),
        generation_config={
            "temperature": 0.1,
            "response_mime_type": "application/json",
        },
        request_options={"timeout": 45},
    )
    return _extract_json(response.text or "{}")


def _merge_gemini_with_fallback(
    gemini_result: dict[str, Any],
    fallback: dict[str, Any],
) -> dict[str, Any]:
    by_qid = {int(item["question_id"]): item for item in fallback["questions"]}
    for result in gemini_result.get("questions", []):
        qid = int(result.get("question_id", 0))
        if qid in by_qid:
            by_qid[qid].update(result)

    merged_questions = list(by_qid.values())
    total_score = sum(float(item.get("score", 0)) for item in merged_questions)
    max_score = sum(float(item.get("max_score", 0)) for item in merged_questions)
    return {
        "total_score": round(total_score, 2),
        "max_score": round(max_score, 2),
        "questions": merged_questions,
    }


async def grade_answers(
    extracted_answers: list[dict[str, Any]], questions: list[dict[str, Any]]
) -> dict[str, Any]:
    if not _use_gemini():
        logger.info("Offline mode used for grading; Gemini is disabled.")
        return _fallback_grade(extracted_answers, questions)

    logger.info("Gemini mode used for grading with %s.", MODEL_NAME)
    fallback = _fallback_grade(extracted_answers, questions)
    try:
        gemini_result = await asyncio.to_thread(_gemini_grade_sync, extracted_answers, questions)
        return _merge_gemini_with_fallback(gemini_result, fallback)
    except Exception as exc:
        logger.warning("Gemini grading failed; local fallback triggered: %s", exc)
        return _fallback_grade(extracted_answers, questions, note=FALLBACK_NOTE)
