"use client";

import { Check, Copy, ExternalLink, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getExams, type ExamSummary } from "../lib/api";

function formatDate(value: string | null) {
  if (!value) return "No submissions";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export default function TeacherExamsPage() {
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [query, setQuery] = useState("");
  const [copiedCode, setCopiedCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadExams() {
      try {
        const data = await getExams();
        setExams(data);
        setError("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "حدث خطأ / Something went wrong. Try again.");
      } finally {
        setLoading(false);
      }
    }

    loadExams();
  }, []);

  const filteredExams = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return exams;
    return exams.filter((exam) => {
      return (
        exam.title.toLowerCase().includes(normalized) ||
        exam.exam_code.toLowerCase().includes(normalized)
      );
    });
  }, [exams, query]);

  async function copyExamCode(code: string) {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
  }

  return (
    <main className="min-h-screen bg-canvas px-5 py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-primary">Teacher exams</p>
            <h1 className="mt-2 text-4xl font-extrabold">All Exams</h1>
            <p className="mt-2 text-sm text-slate-400">Open existing dashboards or create a new exam key.</p>
          </div>
          <Link
            href="/setup"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-3 font-bold text-white"
          >
            <Plus className="h-4 w-4" />
            Create New Exam
          </Link>
        </header>

        <section className="panel p-5">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold">Created Exams</h2>
            <label className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                className="field pl-10"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by title or exam code"
              />
            </label>
          </div>

          {error && <p className="mb-4 text-sm text-error">{error}</p>}
          {loading && <p className="text-sm text-slate-400">Loading exams...</p>}

          {!loading && exams.length === 0 && (
            <div className="rounded-lg border border-dashed border-white/15 p-8 text-center">
              <p className="text-lg font-bold">No exams created yet.</p>
              <Link
                href="/setup"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-3 font-bold text-white"
              >
                <Plus className="h-4 w-4" />
                Create New Exam
              </Link>
            </div>
          )}

          {!loading && exams.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400">
                    <th className="py-3 pr-4 font-semibold">Exam Title</th>
                    <th className="py-3 pr-4 font-semibold">Exam Code</th>
                    <th className="py-3 pr-4 font-semibold">Submissions</th>
                    <th className="py-3 pr-4 font-semibold">Created</th>
                    <th className="py-3 pr-4 font-semibold">Latest Submission</th>
                    <th className="py-3 pr-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExams.map((exam) => (
                    <tr key={exam.exam_id} className="border-b border-white/5">
                      <td className="py-4 pr-4 font-semibold text-white">{exam.title}</td>
                      <td className="py-4 pr-4">
                        <span className="rounded-lg bg-white/[0.04] px-3 py-2 font-bold text-primary">
                          {exam.exam_code}
                        </span>
                      </td>
                      <td className="py-4 pr-4 text-slate-200">{exam.submission_count}</td>
                      <td className="py-4 pr-4 text-slate-300">{formatDate(exam.created_at)}</td>
                      <td className="py-4 pr-4 text-slate-300">{formatDate(exam.latest_submission)}</td>
                      <td className="py-4 pr-4">
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/dashboard/${exam.exam_id}`}
                            className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 font-bold text-primary"
                          >
                            <ExternalLink className="h-4 w-4" />
                            Open Dashboard
                          </Link>
                          <button
                            type="button"
                            className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 font-bold"
                            onClick={() => copyExamCode(exam.exam_code)}
                          >
                            {copiedCode === exam.exam_code ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                            Copy Exam Code
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredExams.length === 0 && (
                <p className="py-8 text-center text-sm text-slate-400">No exams match your search.</p>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
