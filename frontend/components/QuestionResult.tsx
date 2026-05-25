import type { QuestionFeedback } from "@/app/lib/api";

export function QuestionResult({ result }: { result: QuestionFeedback }) {
  return (
    <article className="panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-primary">Question {result.question_id}</p>
          <h2 className="mt-1 text-lg font-bold text-white">{result.question_text}</h2>
        </div>
        <div className="rounded-lg border border-white/10 px-3 py-2 text-sm font-bold">
          {result.score}/{result.max_score}
        </div>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <p className="label">Student answer</p>
          <p className="mt-2 rounded-lg bg-white/[0.04] p-3 text-sm text-slate-200" dir="auto">
            {result.student_answer || "لم نتمكن من قراءة هذه الإجابة / Could not read this answer clearly."}
          </p>
        </div>
        <div>
          <p className="label">Correct answer</p>
          <p className="mt-2 rounded-lg bg-white/[0.04] p-3 text-sm text-slate-200" dir="auto">
            {result.correct_answer}
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
        <p className="rounded-lg border border-white/10 p-3" dir="rtl">
          {result.feedback_ar}
        </p>
        <p className="rounded-lg border border-white/10 p-3">{result.feedback_en}</p>
      </div>
      <p className="mt-4 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
        {result.improvement_tip}
      </p>
    </article>
  );
}
