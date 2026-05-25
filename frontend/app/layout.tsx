import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Waraq | AI Exam Grading",
  description: "AI-powered handwritten exam grading for Arabic and English classrooms."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
