import { BookOpenCheck, GraduationCap } from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-canvas px-5 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col justify-center">
        <div className="mb-10">
          <p className="text-lg font-bold text-primary" dir="rtl">
            ورق
          </p>
          <h1 className="mt-2 text-5xl font-extrabold tracking-normal text-white md:text-7xl">Waraq</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">
            AI-powered exam grading for handwritten Arabic and English answer sheets, with instant feedback
            for every student.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/teacher" className="panel group p-6 transition hover:border-primary/70">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <BookOpenCheck className="h-6 w-6" />
            </div>
            <h2 className="mt-6 text-2xl font-bold">I&apos;m a Teacher</h2>
            <p className="mt-2 text-slate-400">Create an exam key, share a code, and inspect class analytics.</p>
          </Link>

          <Link href="/upload" className="panel group p-6 transition hover:border-success/70">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-success/15 text-success">
              <GraduationCap className="h-6 w-6" />
            </div>
            <h2 className="mt-6 text-2xl font-bold">I&apos;m a Student</h2>
            <p className="mt-2 text-slate-400">Upload your paper photo and receive your score with clear feedback.</p>
          </Link>
        </div>
      </div>
    </main>
  );
}
