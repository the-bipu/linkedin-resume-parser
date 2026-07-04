import type { Metadata } from "next";
import "./globals.css";
import { UserProvider } from '@/context/userContext.js';

export const metadata: Metadata = {
  icons: "/favicon.png",
  title: "Resume Parser — Turn a LinkedIn PDF into Structured JSON, No AI Tokens",
  description: "Drop in a LinkedIn PDF export and get back structured profile data — name, contact, skills, experience, education — parsed entirely client-side with layout heuristics. No LLM calls, no tokens spent.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`antialiased`}
      >
        <UserProvider>
          {children}
        </UserProvider>
      </body>
    </html>
  );
}
