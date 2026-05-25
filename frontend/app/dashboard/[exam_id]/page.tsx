"use client";

import { Copy, Download, ExternalLink, Search } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getDashboard, type DashboardData } from "@/app/lib/api";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function statValue(value: number, suffix = "%") {
  return `${Number.isFinite(value) ? value : 0}${suffix}`;
}

export default function TeacherDashboardPage({ params }: { params: { exam_id: string } }) {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [now, setNow] = useState(new Date());
  const [copied, setCopied] = useState(false);

  const loadDashboard = useCallback(async () => {
    try {
      const data = await getDashboard(params.exam_id);
      setDashboard(data);
      setLastUpdated(new Date());
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ / Something went wrong. Try again.");
    }
  }, [params.exam_id]);

  useEffect(() => {
    loadDashboard();
    const refresh = window.setInterval(loadDashboard, 30000);
    const ticker = window.setInterval(() => setNow(new Date()), 1000);
    return () => {
      window.clearInterval(refresh);
      window.clearInterval(ticker);
    };
  }, [loadDashboard]);

  const filteredSubmissions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!dashboard || !normalized) return dashboard?.submissions ?? [];
    return dashboard.submissions.filter((submission) =>
      submission.student_name.toLowerCase().includes(normalized)
    );
  }, [dashboard, query]);

  const lastUpdatedSeconds = lastUpdated
    ? Math.max(0, Math.floor((now.getTime() - lastUpdated.getTime()) / 1000))
    : null;

  function exportCsv() {
    if (!dashboard) return;
    const rows = [
      ["student_name", "score", "max_score", "percent", "grade", "submitted_at"],
      ...dashboard.submissions.map((submission) => [
        submission.student_name,
        submission.total_score,
        submission.max_score,
        submission.percent,
        submission.grade,
        submission.created_at
      ])
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `waraq-dashboard-${params.exam_id}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function copyDashboardLink() {
    const url = `http://localhost:3001/dashboard/${params.exam_id}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
  }

  if (error) {
    return <main className="min-h-screen bg-canvas p-5 text-error">{error}</main>;
  }

  if (!dashboard) {
    return <main className="min-h-screen bg-canvas p-5 text-slate-300">Loading dashboard...</main>;
  }

  return (
    <main className="min-h-screen bg-canvas px-5 py-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-primary">{dashboard.exam.code}</p>
            <h1 className="mt-2 text-4xl font-extrabold">{dashboard.exam.title}</h1>
            <p className="mt-2 text-sm text-slate-400">
              Last updated: {lastUpdatedSeconds ?? 0} seconds ago
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-3 text-sm font-bold"
              onClick={copyDashboardLink}
            >
              <Copy className="h-4 w-4" />
              {copied ? "Copied" : "Copy Dashboard Link"}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-bold text-white"
              onClick={exportCsv}
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </header>

        <section className="mb-5 grid gap-4 md:grid-cols-5">
          <div className="panel p-5">
            <p className="text-sm font-semibold text-slate-400">Total Submissions</p>
            <p className="mt-2 text-3xl font-extrabold">{dashboard.stats.total_submissions}</p>
          </div>
          <div className="panel p-5">
            <p className="text-sm font-semibold text-slate-400">Class Average</p>
            <p className="mt-2 text-3xl font-extrabold">{statValue(dashboard.stats.class_average)}</p>
          </div>
          <div className="panel p-5">
            <p className="text-sm font-semibold text-slate-400">Highest Score</p>
            <p className="mt-2 text-3xl font-extrabold text-success">{statValue(dashboard.stats.highest_score)}</p>
          </div>
          <div className="panel p-5">
            <p className="text-sm font-semibold text-slate-400">Lowest Score</p>
            <p className="mt-2 text-3xl font-extrabold text-warning">{statValue(dashboard.stats.lowest_score)}</p>
          </div>
          <div className="panel p-5">
            <p className="text-sm font-semibold text-slate-400">Pass Rate</p>
            <p className="mt-2 text-3xl font-extrabold text-primary">{statValue(dashboard.stats.pass_rate)}</p>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1fr_1fr]">
          <div className="panel p-5">
            <h2 className="text-xl font-bold">Score Distribution</h2>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dashboard.grade_distribution}>
                  <CartesianGrid stroke="#ffffff12" />
                  <XAxis dataKey="grade" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "#111111", border: "1px solid #ffffff1a" }} />
                  <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="panel p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">Per-Question Analysis</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Hardest question: Q{dashboard.hardest_question?.question_id ?? "-"}
                </p>
              </div>
            </div>
            <div className="mt-5 space-y-4">
              {dashboard.per_question.map((question) => (
                <div key={question.question_id}>
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="font-semibold">Q{question.question_id}</span>
                    <span>{question.average_percent}%</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-success"
                      style={{ width: `${Math.min(question.average_percent, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
              {!dashboard.per_question.length && (
                <p className="text-sm text-slate-400">Question analytics will appear after submissions.</p>
              )}
            </div>
          </div>
        </section>

        <section className="panel mt-5 p-5">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold">Students</h2>
            <label className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                className="field pl-10"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by student name"
              />
            </label>
          </div>

          {dashboard.submissions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/15 p-8 text-center">
              <p className="text-lg font-bold">No submissions yet.</p>
              <p className="mt-2 text-sm text-slate-400">
                Share exam code <span className="font-bold text-primary">{dashboard.exam.code}</span> with your students.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400">
                    <th className="py-3 pr-4 font-semibold">Student Name</th>
                    <th className="py-3 pr-4 font-semibold">Total Score</th>
                    <th className="py-3 pr-4 font-semibold">Grade</th>
                    <th className="py-3 pr-4 font-semibold">Submission Date</th>
                    <th className="py-3 pr-4 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubmissions.map((submission) => (
                    <tr key={submission.id} className="border-b border-white/5">
                      <td className="py-4 pr-4 font-semibold text-white">{submission.student_name}</td>
                      <td className="py-4 pr-4 text-slate-200">
                        {submission.total_score}/{submission.max_score}
                      </td>
                      <td className="py-4 pr-4">
                        <span className="rounded-lg border border-white/10 px-3 py-1 font-bold">
                          {submission.grade}
                        </span>
                      </td>
                      <td className="py-4 pr-4 text-slate-300">{formatDate(submission.created_at)}</td>
                      <td className="py-4 pr-4">
                        <Link
                          href={`/results/${submission.id}`}
                          className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 font-bold text-primary"
                        >
                          <ExternalLink className="h-4 w-4" />
                          View Results
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredSubmissions.length === 0 && (
                <p className="py-8 text-center text-sm text-slate-400">No students match your search.</p>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
