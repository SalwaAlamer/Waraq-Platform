type ScoreCardProps = {
  score: number;
  maxScore: number;
};

function gradeFromPercent(percent: number) {
  if (percent >= 90) return { letter: "A", color: "text-success", ring: "border-success/40" };
  if (percent >= 80) return { letter: "B", color: "text-primary", ring: "border-primary/40" };
  if (percent >= 70) return { letter: "C", color: "text-warning", ring: "border-warning/40" };
  return { letter: percent >= 60 ? "D" : "F", color: "text-error", ring: "border-error/40" };
}

export function ScoreCard({ score, maxScore }: ScoreCardProps) {
  const percent = maxScore ? Math.round((score / maxScore) * 100) : 0;
  const grade = gradeFromPercent(percent);

  return (
    <section className={`panel border ${grade.ring} p-6`}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-400">Final score</p>
          <p className="mt-2 text-5xl font-extrabold tracking-normal">
            {score}
            <span className="text-2xl text-slate-400">/{maxScore}</span>
          </p>
        </div>
        <div className={`text-6xl font-extrabold ${grade.color}`}>{grade.letter}</div>
      </div>
      <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
      <p className="mt-3 text-sm text-slate-400">{percent}%</p>
    </section>
  );
}
