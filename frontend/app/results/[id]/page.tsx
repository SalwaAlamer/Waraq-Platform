"use client";

import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import { QuestionResult } from "@/components/QuestionResult";
import { ScoreCard } from "@/components/ScoreCard";
import { getSubmission, type Submission } from "@/app/lib/api";

export default function ResultsPage({ params }: { params: { id: string } }) {
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getSubmission(params.id)
      .then(setSubmission)
      .catch((err) => setError(err instanceof Error ? err.message : "حدث خطأ / Something went wrong. Try again."));
  }, [params.id]);

  async function exportPdf() {
    if (!submission) return;
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text(`Waraq Results - ${submission.student_name}`, 14, 20);
    doc.setFontSize(14);
    doc.text(`Score: ${submission.total_score}/${submission.max_score}`, 14, 32);
    let y = 46;
    submission.feedback.questions.forEach((question) => {
      doc.setFontSize(11);
      doc.text(`Q${question.question_id}: ${question.score}/${question.max_score}`, 14, y);
      y += 7;
      doc.text(doc.splitTextToSize(question.feedback_en, 180), 14, y);
      y += 16;
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    });
    doc.save(`waraq-results-${submission.id}.pdf`);
  }

  if (error) {
    return <main className="min-h-screen bg-canvas p-5 text-error">{error}</main>;
  }

  if (!submission) {
    return <main className="min-h-screen bg-canvas p-5 text-slate-300">Loading results...</main>;
  }

  return (
    <main className="min-h-screen bg-canvas px-5 py-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-primary">{submission.exam.title}</p>
            <h1 className="mt-2 text-4xl font-extrabold">{submission.student_name}</h1>
          </div>
          <button type="button" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-3 font-bold text-white" onClick={exportPdf}>
            <Download className="h-4 w-4" />
            Export PDF
          </button>
        </header>

        <ScoreCard score={submission.total_score} maxScore={submission.max_score} />

        <section className="mt-6 space-y-4">
          {submission.feedback.questions.map((question) => (
            <QuestionResult key={question.question_id} result={question} />
          ))}
        </section>
      </div>
    </main>
  );
}
