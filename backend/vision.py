import asyncio
import json
import logging
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
from dotenv import load_dotenv
from PIL import Image, ImageEnhance, ImageFilter, ImageOps


load_dotenv(Path(__file__).resolve().parent.parent / ".env")
load_dotenv()

logger = logging.getLogger("waraq.vision")

MODEL_NAME = "gemini-2.5-flash"
CLEAR_READ_FAILURE = "Could not read this answer clearly."
FULL_PAGE_GEMINI_PROMPT = """This is a handwritten exam paper.
Extract all questions and answers exactly as written.
Return JSON format:
[
{
"question_number": 1,
"question_text": "...",
"student_answer": "..."
}
]
Read carefully, the handwriting is clear and in English."""


@dataclass
class ExtractedAnswer:
    question_number: int
    extracted_text: str
    confidence: float
    question_text: str = ""
    student_answer: str = ""


def _use_gemini() -> bool:
    enabled = os.getenv("USE_GEMINI", "false").strip().lower() in {"1", "true", "yes", "on"}
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    return enabled and bool(api_key)


def _load_full_image(image_path: str) -> Image.Image:
    return ImageOps.exif_transpose(Image.open(image_path)).convert("RGB")


def preprocess_image(image_path: str) -> Image.Image:
    image = _load_full_image(image_path)
    image = ImageEnhance.Contrast(image).enhance(1.45)
    image = ImageEnhance.Sharpness(image).enhance(1.2)
    return image.filter(ImageFilter.MedianFilter(size=3))


def _fallback_answer_boxes(image: Image.Image, expected_count: int = 4) -> list[tuple[int, int, int, int]]:
    width, height = image.size
    slices = max(1, expected_count)
    margin_x = int(width * 0.05)
    margin_y = int(height * 0.08)
    usable_h = height - (margin_y * 2)
    box_h = max(1, usable_h // slices)
    boxes = [
        (margin_x, margin_y + (idx * box_h), width - margin_x, margin_y + ((idx + 1) * box_h))
        for idx in range(slices)
    ]
    return sorted(boxes, key=lambda b: (b[1], -b[0]))


def _ocr_crop(crop: Image.Image) -> tuple[str, float]:
    try:
        import easyocr  # type: ignore
    except Exception:
        return "", 0.0

    model_dir = Path(os.getenv("EASYOCR_MODEL_DIR", Path(__file__).resolve().parent / ".easyocr"))
    model_dir.mkdir(parents=True, exist_ok=True)
    reader = easyocr.Reader(
        ["ar", "en"],
        gpu=False,
        verbose=False,
        model_storage_directory=str(model_dir),
        user_network_directory=str(model_dir),
    )
    result = reader.readtext(np.array(crop))
    if not result:
        return "", 0.0

    texts = [item[1] for item in result]
    confidences = [float(item[2]) for item in result]
    return " ".join(texts).strip(), sum(confidences) / len(confidences)


def _extract_json_array(text: str) -> list[dict[str, Any]]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)

    start = cleaned.find("[")
    end = cleaned.rfind("]")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("Gemini response did not contain a JSON array")

    data = json.loads(cleaned[start : end + 1])
    if not isinstance(data, list):
        raise ValueError("Gemini JSON response was not a list")

    validated: list[dict[str, Any]] = []
    for index, item in enumerate(data, start=1):
        if not isinstance(item, dict):
            raise ValueError("Gemini JSON item was not an object")

        question_number = item.get("question_number", index)
        question_text = str(item.get("question_text", "")).strip()
        student_answer = str(item.get("student_answer", "")).strip()
        if not question_text and not student_answer:
            raise ValueError("Gemini JSON item did not include readable exam text")

        validated.append(
            {
                "question_number": int(question_number) if str(question_number).isdigit() else index,
                "question_text": question_text,
                "student_answer": student_answer,
            }
        )

    return validated


def _gemini_full_page_extract_sync(image_path: str) -> list[dict[str, Any]]:
    import google.generativeai as genai

    genai.configure(api_key=os.environ["GEMINI_API_KEY"])
    model = genai.GenerativeModel(MODEL_NAME)
    image = _load_full_image(image_path)
    response = model.generate_content(
        [FULL_PAGE_GEMINI_PROMPT, image],
        generation_config={"temperature": 0},
        request_options={"timeout": 45},
    )
    return _extract_json_array(response.text or "")


async def _gemini_full_page_extract(image_path: str) -> list[dict[str, Any]]:
    logger.info("Full-page Gemini extraction is being used with %s.", MODEL_NAME)
    extracted = await asyncio.to_thread(_gemini_full_page_extract_sync, image_path)
    logger.info("Full-page Gemini extraction parsing succeeded with %s item(s).", len(extracted))
    return extracted


def _answers_from_gemini_items(items: list[dict[str, Any]], expected_count: int) -> list[dict[str, Any]]:
    answers: list[ExtractedAnswer] = []
    for fallback_index, item in enumerate(items, start=1):
        question_number = int(item.get("question_number") or fallback_index)
        if question_number <= 0:
            question_number = fallback_index
        answers.append(
            ExtractedAnswer(
                question_number=question_number,
                question_text=str(item.get("question_text", "")).strip(),
                student_answer=str(item.get("student_answer", "")).strip(),
                extracted_text=str(item.get("student_answer", "")).strip() or CLEAR_READ_FAILURE,
                confidence=0.95,
            )
        )

    answers.sort(key=lambda answer: answer.question_number)
    if not answers and expected_count:
        return _empty_answers(expected_count)
    return [answer.__dict__ for answer in answers]


def _empty_answers(expected_count: int) -> list[dict[str, Any]]:
    return [
        ExtractedAnswer(
            question_number=index,
            extracted_text=CLEAR_READ_FAILURE,
            student_answer=CLEAR_READ_FAILURE,
            confidence=0.0,
        ).__dict__
        for index in range(1, max(1, expected_count) + 1)
    ]


async def _extract_answers_with_easyocr_fallback(
    image_path: str, expected_count: int = 4
) -> list[dict[str, Any]]:
    logger.info("Fallback to EasyOCR segmentation/slicing flow is being used.")
    image = preprocess_image(image_path)
    boxes = _fallback_answer_boxes(image, expected_count=expected_count)
    answers: list[ExtractedAnswer] = []

    for index, box in enumerate(boxes, start=1):
        crop = image.crop(box)
        text, confidence = _ocr_crop(crop)
        answers.append(
            ExtractedAnswer(
                question_number=index,
                extracted_text=text or CLEAR_READ_FAILURE,
                student_answer=text or CLEAR_READ_FAILURE,
                confidence=round(confidence, 3),
            )
        )

    return [answer.__dict__ for answer in answers]


async def extract_answers(image_path: str, expected_count: int = 4) -> list[dict[str, Any]]:
    if _use_gemini():
        try:
            items = await _gemini_full_page_extract(image_path)
            return _answers_from_gemini_items(items, expected_count=expected_count)
        except Exception as exc:
            logger.warning("Full-page Gemini extraction failed; falling back to EasyOCR: %s", exc)
            return await _extract_answers_with_easyocr_fallback(image_path, expected_count)

    logger.info("Offline mode used for OCR; Gemini full-page extraction is disabled.")
    return await _extract_answers_with_easyocr_fallback(image_path, expected_count)
