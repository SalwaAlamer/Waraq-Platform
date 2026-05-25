export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

export type Question = {
  id: number;
  text: string;
  answer_key: string;
  max_score: number;
};

export type Exam = {
  id: number;
  code: string;
  title: string;
  questions: Question[];
  created_at: string;
};

export type ExamSummary = Exam & {
  exam_id: number;
  exam_code: string;
  submission_count: number;
  latest_submission: string | null;
};

export type QuestionFeedback = {
  question_id: number;
  question_text: string;
  student_answer: string;
  correct_answer: string;
  score: number;
  max_score: number;
  is_correct: boolean;
  feedback_ar: string;
  feedback_en: string;
  improvement_tip: string;
};

export type Submission = {
  id: number;
  exam: Exam;
  student_name: string;
  total_score: number;
  max_score: number;
  feedback: {
    total_score: number;
    max_score: number;
    questions: QuestionFeedback[];
    extracted_answers?: unknown[];
  };
  created_at: string;
};

export type DashboardSubmission = {
  id: number;
  student_name: string;
  total_score: number;
  max_score: number;
  percent: number;
  grade: "A" | "B" | "C" | "D" | "F";
  created_at: string;
  feedback: Submission["feedback"];
};

export type DashboardData = {
  exam: Exam;
  submissions: DashboardSubmission[];
  stats: {
    total_submissions: number;
    class_average: number;
    highest_score: number;
    lowest_score: number;
    pass_rate: number;
  };
  grade_distribution: { grade: string; count: number }[];
  per_question: {
    question_id: number;
    question_text: string;
    average_score: number;
    max_score: number;
    average_percent: number;
  }[];
  hardest_question: {
    question_id: number;
    question_text: string;
    average_score: number;
    max_score: number;
    average_percent: number;
  } | null;
};

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail ?? "حدث خطأ / Something went wrong. Try again.");
  }
  return response.json() as Promise<T>;
}

export async function createExam(payload: { title: string; questions: Question[] }) {
  const response = await fetch(`${API_BASE}/exams`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseResponse<Exam>(response);
}

export async function getExams() {
  const response = await fetch(`${API_BASE}/exams`, { cache: "no-store" });
  return parseResponse<ExamSummary[]>(response);
}

export async function uploadSubmission(formData: FormData) {
  const submitUrl = `${API_BASE}/submissions`;
  console.log("API URL:", API_BASE);
  console.log("Submitting to:", submitUrl);

  const response = await fetch(submitUrl, {
    method: "POST",
    body: formData
  });
  return parseResponse<{ id: number }>(response);
}

export async function getSubmission(id: string) {
  const response = await fetch(`${API_BASE}/submissions/${id}`, { cache: "no-store" });
  return parseResponse<Submission>(response);
}

export async function getAnalytics(id: string) {
  const response = await fetch(`${API_BASE}/analytics/${id}`, { cache: "no-store" });
  return parseResponse<{
    exam: Exam;
    submission_count: number;
    class_average: number;
    score_distribution: { grade: string; count: number }[];
    per_question_average: { question_id: number; question_text: string; average: number; max_score: number }[];
    common_mistakes: string[];
  }>(response);
}

export async function getDashboard(id: string) {
  const response = await fetch(`${API_BASE}/dashboard/${id}`, { cache: "no-store" });
  return parseResponse<DashboardData>(response);
}
