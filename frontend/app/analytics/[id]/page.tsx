"use client";

import { Download } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getAnalytics } from "@/app/lib/api";

type Analytics = Awaited<ReturnType<typeof getAnalytics>>;

export default function AnalyticsPage({ params }: { params: { id: string } }) {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getAnalytics(params.id)
      .then(setAnalytics)
      .catch((err) => setError(err instanceof Error ? err.message : "حدث خطأ / Something went wrong. Try again."));
  }, [params.id]);

  const mistakeWords = useMemo(() => {
    const counts = new Map<string, number>();
    analytics?.common_mistakes.forEach((mistake) => {
      mistake
        .toLowerCase()
        .split(/\W+/)
        .filter((word) => word.length > 3)
        .forEach((word) => counts.set(word, (counts.get(word) ?? 0) + 1));
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 18);
  }, [analytics]);

  function exportCsv() {
    if (!analytics) return;
    const rows = [
      ["question_id", "question_text", "average", "max_score"],
      ...analytics.per_question_average.map((item) => [item.question_id, item.question_text, item.average, item.max_score])
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `waraq-analytics-${params.id}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (error) {
    return <main className="min-h-screen bg-canvas p-5 text-error">{error}</main>;
  }

  if (!analytics) {
    return <main className="min-h-screen bg-canvas p-5 text-slate-300">Loading analytics...</main>;
  }

  return (
    <main className="min-h-screen bg-canvas px-5 py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-primary">{analytics.exam.code}</p>
            <h1 className="mt-2 text-4xl font-extrabold">{analytics.exam.title}</h1>
          </div>
          <button type="button" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-3 font-bold text-white" onClick={exportCsv}>
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="panel p-5">
            <p className="text-sm font-semibold text-slate-400">Class average</p>
            <p className="mt-2 text-4xl font-extrabold">{analytics.class_average}%</p>
          </div>
          <div className="panel p-5">
            <p className="text-sm font-semibold text-slate-400">Submissions</p>
            <p className="mt-2 text-4xl font-extrabold">{analytics.submission_count}</p>
          </div>
          <div className="panel p-5">
            <p className="text-sm font-semibold text-slate-400">Hardest question</p>
            <p className="mt-2 text-2xl font-extrabold">
              Q{[...analytics.per_question_average].sort((a, b) => a.average - b.average)[0]?.question_id ?? "-"}
            </p>
          </div>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-2">
          <div className="panel p-5">
            <h2 className="text-xl font-bold">Score distribution</h2>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.score_distribution}>
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
            <h2 className="text-xl font-bold">Per-question average</h2>
            <div className="mt-4 space-y-3">
              {analytics.per_question_average.map((item) => {
                const percent = item.max_score ? (item.average / item.max_score) * 100 : 0;
                return (
                  <div key={item.question_id}>
                    <div className="flex justify-between gap-3 text-sm">
                      <span>Q{item.question_id}</span>
                      <span>{item.average}/{item.max_score}</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-success" style={{ width: `${Math.min(percent, 100)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="panel mt-5 p-5">
          <h2 className="text-xl font-bold">Most common mistakes</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {mistakeWords.length ? (
              mistakeWords.map(([word, count]) => (
                <span key={word} className="rounded-lg border border-white/10 px-3 py-2 text-sm" style={{ fontSize: `${Math.min(14 + count * 2, 28)}px` }}>
                  {word}
                </span>
              ))
            ) : (
              <p className="text-sm text-slate-400">No mistakes recorded yet.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
