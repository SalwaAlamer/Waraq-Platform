# Waraq

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=nextdotjs)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi)
![SQLite](https://img.shields.io/badge/SQLite-SQLAlchemy-003B57?logo=sqlite)
![Gemini](https://img.shields.io/badge/Gemini-2.5%20Flash-4285F4?logo=google)
![Tailwind](https://img.shields.io/badge/Tailwind-CSS-38B2AC?logo=tailwindcss)

Waraq is an AI-assisted exam grading system for handwritten answer sheets. Teachers create an exam key, students upload a paper photo, and Waraq extracts answers, grades them, and returns bilingual feedback.

## Problem Statement

Manual grading is slow and hard to scale, especially when teachers need to give useful feedback to every student. Handwritten Arabic and English answers add OCR complexity.

## Solution Overview

- Teachers create exams with question text, answer keys, and max scores.
- Students upload answer-sheet images by exam code.
- The backend can send the full uploaded exam image directly to Gemini Vision for extraction.
- If Gemini is disabled or unavailable, the backend falls back to EasyOCR.
- Offline mode grades locally with normalized text similarity.
- Gemini-enhanced mode can improve low-confidence OCR and semantic grading.
- Teachers can view analytics, score distribution, hard questions, and common mistakes.

## Tech Stack

- Frontend: Next.js 14, React, Tailwind CSS, Recharts, jsPDF
- Backend: FastAPI, SQLAlchemy, SQLite
- AI/OCR: Full-page Gemini Vision extraction, EasyOCR fallback, Google Gemini 2.5 Flash
- Deployment: Vercel for `frontend`, Railway for `backend`

## Local Environment

Copy `.env.example` to `.env`.

Offline mode is free and enabled by default:

```bash
USE_GEMINI=false
GEMINI_API_KEY=
DATABASE_URL=sqlite:///./waraq.db
MAX_IMAGE_SIZE_MB=10
CORS_ORIGINS=http://localhost:3001
NEXT_PUBLIC_API_URL=http://localhost:8001
EASYOCR_MODEL_DIR=./.easyocr
```

To enable Gemini-enhanced OCR and grading:

```bash
USE_GEMINI=true
GEMINI_API_KEY=your_gemini_key_here
```

If Gemini fails because of quota, invalid key, timeout, or outage, Waraq automatically falls back to local grading and returns:

```text
AI grading unavailable; local fallback grading was used.
```

## Backend

Use Python 3.11 for the backend. The OCR/CV packages are not reliable on Python 3.14.

```bash
cd C:\Users\Salwa\Documents\Waraq\backend
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8001
```

The API runs at `http://localhost:8001`.

## Frontend

```bash
cd C:\Users\Salwa\Documents\Waraq\frontend
npm install
npm run dev
```

The web app runs at `http://localhost:3001`.

## AI Pipeline Notes

When `USE_GEMINI=true`, Waraq sends the full uploaded exam image directly to Gemini 2.5 Flash and asks for a JSON list of question numbers, question text, and student answers. This bypasses YOLO, page slicing, and per-answer crops for the Gemini path.

When `USE_GEMINI=false`, or when Gemini fails, Waraq falls back to the existing EasyOCR flow and local grading. The fallback never crashes the upload request; unreadable answers return `Could not read this answer clearly.`

`backend/grader.py` uses local text similarity in offline mode. Gemini mode asks Gemini 2.5 Flash for semantic grading and bilingual feedback, then merges the result with the local fallback shape.

## API Endpoints

- `POST /exams` creates an exam and answer key.
- `GET /exams` lists exams.
- `GET /exams/{id_or_code}` returns exam details.
- `POST /submissions` uploads and grades an answer sheet.
- `GET /submissions/{id}` returns grading results.
- `GET /analytics/{exam_id}` returns class analytics.

## Screenshots

Placeholder:

- Home screen
- Teacher setup
- Student upload
- Results view
- Analytics dashboard

## Live Demo

Placeholder: `https://waraq-demo.example.com`

## Deployment

Deploy `frontend/` to Vercel and set `NEXT_PUBLIC_API_URL` to the Railway backend URL.

Deploy `backend/` to Railway and set:

```bash
USE_GEMINI=false
GEMINI_API_KEY=
DATABASE_URL=sqlite:///./waraq.db
MAX_IMAGE_SIZE_MB=10
CORS_ORIGINS=https://your-vercel-domain.vercel.app
```
