"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { UploadZone } from "@/components/UploadZone";
import { uploadSubmission } from "../lib/api";

const loadingSteps = [
  "جاري قراءة خطك... Reading your handwriting...",
  "جاري التصحيح... Grading your answers...",
  "جاهز! Done!"
];

export default function UploadPage() {
  const router = useRouter();
  const [examCode, setExamCode] = useState("");
  const [studentName, setStudentName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading) return;
    const interval = window.setInterval(() => setStep((current) => Math.min(current + 1, loadingSteps.length - 1)), 2200);
    return () => window.clearInterval(interval);
  }, [loading]);

  async function submit() {
    if (!file) return;
    setLoading(true);
    setError("");
    const formData = new FormData();
    formData.append("exam_code", examCode);
    formData.append("student_name", studentName);
    formData.append("image", file);
    try {
      const submission = await uploadSubmission(formData);
      setStep(2);
      router.push(`/results/${submission.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ / Something went wrong. Try again.");
      setLoading(false);
      setStep(0);
    }
  }

  return (
    <main className="min-h-screen bg-canvas px-5 py-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8">
          <p className="text-sm font-bold text-success">Student upload</p>
          <h1 className="mt-2 text-4xl font-extrabold">Upload answer sheet</h1>
        </header>

        <section className="panel p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label" htmlFor="exam-code">
                Exam code
              </label>
              <input id="exam-code" className="field mt-2 uppercase" value={examCode} onChange={(event) => setExamCode(event.target.value)} placeholder="WAR-2847" />
            </div>
            <div>
              <label className="label" htmlFor="student-name">
                Student name
              </label>
              <input id="student-name" className="field mt-2" value={studentName} onChange={(event) => setStudentName(event.target.value)} placeholder="Name / الاسم" />
            </div>
          </div>

          <div className="mt-5">
            <UploadZone file={file} onFile={setFile} />
          </div>

          {loading && (
            <div className="mt-5 rounded-lg border border-primary/30 bg-primary/10 p-4">
              <p className="font-bold">{loadingSteps[step]}</p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${((step + 1) / loadingSteps.length) * 100}%` }} />
              </div>
            </div>
          )}

          {error && <p className="mt-4 text-sm text-error">{error}</p>}

          <button
            type="button"
            disabled={loading || !file || !examCode || !studentName}
            className="mt-5 w-full rounded-lg bg-primary px-5 py-3 font-bold text-white disabled:opacity-50"
            onClick={submit}
          >
            Submit paper
          </button>
        </section>
      </div>
    </main>
  );
}
