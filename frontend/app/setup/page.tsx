"use client";

import { ArrowLeft, Check, Copy, ExternalLink, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { createExam, type Question } from "../lib/api";

export default function SetupPage() {
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState<Question[]>([
    { id: 1, text: "", answer_key: "", max_score: 10 }
  ]);
  const [code, setCode] = useState("");
  const [examId, setExamId] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [dashboardCopied, setDashboardCopied] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const dashboardUrl = examId ? `http://localhost:3001/dashboard/${examId}` : "";

  const updateQuestion = (index: number, patch: Partial<Question>) => {
    setQuestions((current) => current.map((question, qIndex) => (qIndex === index ? { ...question, ...patch } : question)));
  };

  const addQuestion = () => {
    setQuestions((current) => [...current, { id: current.length + 1, text: "", answer_key: "", max_score: 10 }]);
  };

  const removeQuestion = (index: number) => {
    setQuestions((current) => current.filter((_, qIndex) => qIndex !== index).map((question, qIndex) => ({ ...question, id: qIndex + 1 })));
  };

  async function submit() {
    setSaving(true);
    setError("");
    try {
      const exam = await createExam({ title, questions });
      setCode(exam.code);
      setExamId(exam.id);
      setCopied(false);
      setDashboardCopied(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ / Something went wrong. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-canvas px-5 py-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8">
          <Link href="/teacher" className="mb-5 inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-3 text-sm font-bold">
            <ArrowLeft className="h-4 w-4" />
            Back to Exams
          </Link>
          <p className="text-sm font-bold text-primary">Teacher setup</p>
          <h1 className="mt-2 text-4xl font-extrabold">Create exam key</h1>
        </header>

        <section className="panel p-5">
          <label className="label" htmlFor="title">
            Exam title
          </label>
          <input
            id="title"
            className="field mt-2"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Physics midterm / اختبار الفيزياء"
          />

          <div className="mt-6 space-y-4">
            {questions.map((question, index) => (
              <div key={question.id} className="rounded-lg border border-white/10 p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-bold">Question {question.id}</h2>
                  {questions.length > 1 && (
                    <button
                      type="button"
                      className="rounded-lg border border-error/30 p-2 text-error"
                      onClick={() => removeQuestion(index)}
                      aria-label="Remove question"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="grid gap-3 md:grid-cols-[1fr_120px]">
                  <textarea
                    className="field min-h-24"
                    value={question.text}
                    onChange={(event) => updateQuestion(index, { text: event.target.value })}
                    placeholder="Question text"
                    dir="auto"
                  />
                  <input
                    className="field"
                    type="number"
                    min="1"
                    value={question.max_score}
                    onChange={(event) => updateQuestion(index, { max_score: Number(event.target.value) })}
                    aria-label="Max score"
                  />
                </div>
                <textarea
                  className="field mt-3 min-h-28"
                  value={question.answer_key}
                  onChange={(event) => updateQuestion(index, { answer_key: event.target.value })}
                  placeholder="Answer key"
                  dir="auto"
                />
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-3 font-bold" onClick={addQuestion}>
              <Plus className="h-4 w-4" />
              Add question
            </button>
            <button type="button" className="rounded-lg bg-primary px-5 py-3 font-bold text-white disabled:opacity-50" disabled={saving || !title} onClick={submit}>
              {saving ? "Creating..." : "Create exam"}
            </button>
          </div>
          {error && <p className="mt-4 text-sm text-error">{error}</p>}
        </section>

        {code && (
          <section className="panel mt-5 p-5">
            <p className="mb-4 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm font-bold text-success">
              Exam created successfully.
            </p>
            <p className="text-sm font-semibold text-slate-400">Shareable exam code</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <p className="rounded-lg bg-white/[0.04] px-5 py-3 text-3xl font-extrabold tracking-normal">{code}</p>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg bg-success px-4 py-3 font-bold text-black"
                onClick={async () => {
                  await navigator.clipboard.writeText(code);
                  setCopied(true);
                }}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                Copy code
              </button>
            </div>
            {examId && (
              <div className="mt-5 rounded-lg border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-semibold text-slate-400">Teacher dashboard</p>
                <p className="mt-2 break-all rounded-lg bg-black/20 px-4 py-3 text-sm text-slate-200">
                  {dashboardUrl}
                </p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <a
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-3 font-bold text-white"
                    href={`/dashboard/${examId}`}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open Dashboard
                  </a>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-3 font-bold"
                    onClick={async () => {
                      await navigator.clipboard.writeText(dashboardUrl);
                      setDashboardCopied(true);
                    }}
                  >
                    {dashboardCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    Copy Dashboard Link
                  </button>
                  <a className="rounded-lg border border-white/10 px-4 py-3 font-bold" href={`/analytics/${examId}`}>
                    Analytics
                  </a>
                  <Link className="rounded-lg border border-white/10 px-4 py-3 font-bold" href="/teacher">
                    Go to All Exams
                  </Link>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
