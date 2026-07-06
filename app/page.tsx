"use client";

import React, { useState } from "react";
import { IBM_Plex_Mono, Inter } from "next/font/google";
import {
    FaCloudArrowUp,
    FaEnvelope,
    FaPhone,
    FaLinkedin,
    FaLocationDot,
    FaBuilding,
    FaGraduationCap,
    FaCertificate,
    FaTrophy,
    FaChevronDown,
    FaChevronUp,
} from "react-icons/fa6";
import Head from "next/head";

const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-mono" });
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-inter" });

async function loadPdfjs() {
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    return pdfjsLib;
}

const SIDEBAR_RATIO = 202 / 612;

interface RawChunk {
    text: string;
    page: number;
    x: number;
    y: number;
}

interface Experience {
    title: string;
    company: string;
    duration: string;
    location: string;
    description: string;
}

interface Education {
    degree: string;
    institution: string;
    duration: string;
}

interface Profile {
    name: string | null;
    email: string | null;
    phone: string | null;
    linkedIn: string | null;
    company: string | null;
    location: string | null;
    summary: string | null;
    topSkills: string[];
    certifications: string[];
    honorsAwards: string[];
    experience: Experience[];
    education: Education[];
}

function groupIntoLines(chunks: RawChunk[]): string[] {
    const Y_TOLERANCE = 3;
    const sorted = [...chunks].sort(
        (a, b) => a.page - b.page || b.y - a.y || a.x - b.x
    );

    const lines: { page: number; y: number; parts: { x: number; text: string }[] }[] = [];

    for (const c of sorted) {
        let line = lines.find(
            (l) => l.page === c.page && Math.abs(l.y - c.y) < Y_TOLERANCE
        );
        if (!line) {
            line = { page: c.page, y: c.y, parts: [] };
            lines.push(line);
        }
        line.parts.push({ x: c.x, text: c.text });
    }

    return lines
        .map((l) =>
            l.parts
                .sort((a, b) => a.x - b.x)
                .map((p) => p.text)
                .join(" ")
                .replace(/\s+/g, " ")
                .trim()
        )
        .filter(Boolean);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="mb-2">
            <h3
                className="text-xs font-semibold tracking-widest uppercase text-[#8A93A3] mb-4 pb-2 border-b border-[#232833]"
                style={{ fontFamily: "var(--font-mono)" }}
            >
                {title}
            </h3>
            {children}
        </div>
    );
}

function Field({
    label,
    value,
    icon,
}: {
    label: string;
    value: string | null;
    icon?: React.ReactNode;
}) {
    return (
        <div className="mb-3">
            <p
                className="text-[11px] tracking-wide uppercase text-[#8A93A3] mb-1"
                style={{ fontFamily: "var(--font-mono)" }}
            >
                {label}
            </p>
            <p className="text-sm text-[#E7E9EE] font-medium flex items-center gap-2">
                {icon && <span className="text-[#58A6FF] text-xs">{icon}</span>}
                {value || <span className="text-[#4B5261] font-normal italic">not found</span>}
            </p>
        </div>
    );
}

function TagList({ items }: { items: string[] }) {
    if (!items?.length)
        return <p className="text-sm text-[#4B5261] italic">none found</p>;
    return (
        <div className="flex flex-wrap gap-2">
            {items.map((item, i) => (
                <span
                    key={i}
                    className="bg-[#3FB950]/10 text-[#3FB950] border border-[#3FB950]/20 text-xs px-3 py-1 rounded-full font-medium"
                >
                    {item}
                </span>
            ))}
        </div>
    );
}

export default function ResumeParserPage() {
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [error, setError] = useState("");
    const [showRaw, setShowRaw] = useState(false);
    const [rawBlue, setRawBlue] = useState("");
    const [rawWhite, setRawWhite] = useState("");
    const [logLines, setLogLines] = useState<string[]>([]);

    const pushLog = (line: string) => setLogLines((prev) => [...prev, line]);

    const handleUpload = async () => {
        if (!file) {
            setError("Please select a PDF file");
            return;
        }

        try {
            setLoading(true);
            setError("");
            setProfile(null);
            setLogLines([`$ ./parse ${file.name}`]);

            const pdfjsLib = await loadPdfjs();
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

            pushLog(`> reading ${pdf.numPages} page${pdf.numPages > 1 ? "s" : ""}...`);

            const blueChunks: RawChunk[] = [];
            const whiteChunks: RawChunk[] = [];

            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                const page = await pdf.getPage(pageNum);
                const viewport = page.getViewport({ scale: 1 });
                const sidebarBoundary = viewport.width * SIDEBAR_RATIO;

                const content = await page.getTextContent();

                for (const item of content.items as any[]) {
                    if (!("str" in item) || !item.str.trim()) continue;

                    const x = item.transform[4];
                    const y = item.transform[5];
                    const chunk: RawChunk = { text: item.str, page: pageNum, x, y };

                    if (x < sidebarBoundary) {
                        blueChunks.push(chunk);
                    } else {
                        whiteChunks.push(chunk);
                    }
                }
            }

            pushLog("> splitting sidebar / main columns...");

            const blueLines = groupIntoLines(blueChunks);
            const whiteLines = groupIntoLines(whiteChunks);

            setRawBlue(blueLines.join("\n"));
            setRawWhite(whiteLines.join("\n"));

            pushLog("> extracting fields (no llm call)...");

            const response = await fetch("/api/resume-parser", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ blueLines, whiteLines }),
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message || "Failed to parse PDF");
            }

            setProfile(data.profile);
            pushLog("> done — 0 tokens spent ✓");
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Something went wrong";
            setError(message);
            pushLog(`> error: ${message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <React.Fragment>
            <Head>
                <link rel="icon" href="/favicon.png" type="png" sizes="70x70" />
                <title>Upgrd — Turn a LinkedIn PDF into Structured JSON, No AI Tokens</title>
                <meta
                    name="description"
                    content="Drop in a LinkedIn PDF export and get back structured profile data — name, contact, skills, experience, education — parsed entirely client-side with layout heuristics. No LLM calls, no tokens spent."
                />
                <meta name="author" content="Bipanshu Kumar" />

                <meta property="og:title" content="Resume Parser — LinkedIn PDF to Structured JSON, No AI Tokens" />
                <meta
                    property="og:description"
                    content="Client-side column detection and field extraction turn a LinkedIn PDF export into structured JSON — zero model calls in the loop."
                />
                <meta property="og:type" content="website" />
                <meta property="og:image" content="/og-resume-parser.png" />
                <meta property="og:url" content="https://linkedin-resume-parser.vercel.app/" />

                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content="Resume Parser — Zero AI Tokens" />
                <meta
                    name="twitter:description"
                    content="Parse a LinkedIn PDF export into structured JSON entirely in the browser — no tokens spent."
                />
            </Head>

            <div
                className={`${mono.variable} ${inter.variable} relative w-full min-h-screen bg-[#0A0C10] text-[#E7E9EE] overflow-hidden`}
                style={{ fontFamily: "var(--font-inter)" }}
            >
                {/* Ambient grid backdrop */}
                <div
                    className="pointer-events-none fixed inset-0 opacity-[0.06]"
                    style={{
                        backgroundImage:
                            "linear-gradient(#8A93A3 1px, transparent 1px), linear-gradient(90deg, #8A93A3 1px, transparent 1px)",
                        backgroundSize: "42px 42px",
                    }}
                />
                <div
                    className="pointer-events-none fixed -top-40 right-0 w-xl h-144 rounded-full opacity-20 blur-3xl"
                    style={{ background: "radial-gradient(circle, #3FB950 0%, transparent 70%)" }}
                />

                {/* Nav */}
                <div className="relative z-10 w-full border-b border-[#1E222B]">
                    <div className="w-11/12 max-w-5xl mx-auto flex flex-row items-center justify-between py-5">
                        <span
                            className="text-sm font-semibold text-[#F3F5F8]"
                            style={{ fontFamily: "var(--font-mono)" }}
                        >
                            upgrd<span className="text-[#3FB950]">://</span>resume-parser
                        </span>
                        <span
                            className="hidden sm:flex items-center gap-2 rounded-full border border-[#232833] bg-[#12151C] px-3 py-1.5 text-xs text-[#8A93A3]"
                            style={{ fontFamily: "var(--font-mono)" }}
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-[#3FB950]" />
                            runs entirely in your browser
                        </span>
                    </div>
                </div>

                {/* Hero */}
                <section className="relative z-10 w-11/12 max-w-5xl mx-auto pt-16 pb-14">
                    <div
                        className="w-fit rounded-full px-4 py-1.5 border border-[#232833] bg-[#12151C] text-[#3FB950] text-xs tracking-widest uppercase mb-6"
                        style={{ fontFamily: "var(--font-mono)" }}
                    >
                        client-side · zero ai tokens
                    </div>
                    <h1
                        className="text-3xl md:text-5xl font-bold leading-[1.1] text-[#F3F5F8] max-w-2xl"
                        style={{ fontFamily: "var(--font-mono)" }}
                    >
                        Parse a resume.
                        <br />
                        Not a token budget.
                    </h1>
                    <p className="text-base md:text-lg text-[#A8B0BE] max-w-xl mt-5 leading-relaxed">
                        Drop in a LinkedIn PDF export. The layout is split into columns, grouped
                        into lines, and mapped into fields — name, contact, skills, experience,
                        education — with plain heuristics. No model in the loop.
                    </p>
                </section>

                {/* Terminal upload window */}
                <section className="relative z-10 w-11/12 max-w-5xl mx-auto pb-16">
                    <div className="w-full rounded-lg border border-[#232833] bg-[#12151C] shadow-2xl shadow-black/50 overflow-hidden">
                        <div className="flex flex-row items-center gap-2 px-4 py-3 border-b border-[#232833] bg-[#181C24]">
                            <span className="w-3 h-3 rounded-full bg-[#F85149]" />
                            <span className="w-3 h-3 rounded-full bg-[#E3B341]" />
                            <span className="w-3 h-3 rounded-full bg-[#3FB950]" />
                            <span
                                className="ml-3 text-xs text-[#8A93A3]"
                                style={{ fontFamily: "var(--font-mono)" }}
                            >
                                resume-parser — bash
                            </span>
                        </div>

                        <div className="p-6 flex flex-col gap-5">
                            <div
                                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${file
                                    ? "border-[#3FB950]/40 bg-[#3FB950]/5"
                                    : "border-[#232833] hover:border-[#2F3543]"
                                    }`}
                            >
                                <input
                                    type="file"
                                    accept=".pdf"
                                    id="file-upload"
                                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                                    className="hidden"
                                />
                                <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-2">
                                    <FaCloudArrowUp className="text-2xl text-[#8A93A3]" />
                                    {file ? (
                                        <>
                                            <p className="text-sm font-semibold text-[#3FB950]">{file.name}</p>
                                            <p
                                                className="text-xs text-[#8A93A3]"
                                                style={{ fontFamily: "var(--font-mono)" }}
                                            >
                                                {(file.size / 1024).toFixed(1)} KB · click to change
                                            </p>
                                        </>
                                    ) : (
                                        <>
                                            <p className="text-sm font-medium text-[#E7E9EE]">
                                                Click to select a PDF
                                            </p>
                                            <p
                                                className="text-xs text-[#8A93A3]"
                                                style={{ fontFamily: "var(--font-mono)" }}
                                            >
                                                LinkedIn resume export recommended
                                            </p>
                                        </>
                                    )}
                                </label>
                            </div>

                            <button
                                onClick={handleUpload}
                                disabled={loading || !file}
                                className="w-full bg-[#E7E9EE] text-[#0A0C10] py-3 rounded-md font-semibold text-sm hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                                style={{ fontFamily: "var(--font-mono)" }}
                            >
                                {loading ? (
                                    <>
                                        <span className="w-2 h-2 rounded-full bg-[#0A0C10] animate-pulse" />
                                        parsing...
                                    </>
                                ) : (
                                    "$ ./extract-profile"
                                )}
                            </button>

                            {logLines.length > 0 && (
                                <div
                                    className="rounded-md bg-[#0D0F14] border border-[#232833] p-4 text-xs leading-loose text-[#8A93A3] overflow-x-auto"
                                    style={{ fontFamily: "var(--font-mono)" }}
                                >
                                    {logLines.map((line, i) => (
                                        <p
                                            key={i}
                                            className={
                                                line.startsWith("$")
                                                    ? "text-[#F3F5F8]"
                                                    : line.includes("error")
                                                        ? "text-[#F85149]"
                                                        : line.includes("done")
                                                            ? "text-[#3FB950]"
                                                            : "text-[#58A6FF]"
                                            }
                                        >
                                            {line}
                                        </p>
                                    ))}
                                </div>
                            )}

                            {error && (
                                <div className="bg-[#F85149]/10 border border-[#F85149]/30 text-[#F85149] text-sm rounded-lg px-4 py-3">
                                    {error}
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                {/* Results */}
                {profile && (
                    <section className="relative z-10 w-11/12 max-w-5xl mx-auto pb-20 space-y-6">
                        {/* Identity Card */}
                        <div className="bg-[#12151C] rounded-2xl border border-[#232833] p-6">
                            <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
                                <div>
                                    <h2
                                        className="text-xl font-bold text-[#F3F5F8]"
                                        style={{ fontFamily: "var(--font-mono)" }}
                                    >
                                        {profile.name || "Unknown"}
                                    </h2>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                                        {profile.location && (
                                            <p className="text-sm text-[#A8B0BE] flex items-center gap-1.5">
                                                <FaLocationDot className="text-[#8A93A3] text-xs" /> {profile.location}
                                            </p>
                                        )}
                                        {profile.company && (
                                            <p className="text-sm text-[#A8B0BE] flex items-center gap-1.5">
                                                <FaBuilding className="text-[#8A93A3] text-xs" /> {profile.company}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <span
                                    className="bg-[#3FB950]/10 text-[#3FB950] border border-[#3FB950]/20 text-xs font-semibold px-3 py-1 rounded-full shrink-0"
                                    style={{ fontFamily: "var(--font-mono)" }}
                                >
                                    parsed
                                </span>
                            </div>

                            <div className="grid sm:grid-cols-3 gap-4">
                                <Field label="Email" value={profile.email} icon={<FaEnvelope />} />
                                <Field label="Phone" value={profile.phone} icon={<FaPhone />} />
                                <Field label="LinkedIn" value={profile.linkedIn} icon={<FaLinkedin />} />
                            </div>

                            {profile.summary && (
                                <div className="mt-4 pt-4 border-t border-[#232833]">
                                    <p
                                        className="text-[11px] tracking-wide uppercase text-[#8A93A3] mb-1.5"
                                        style={{ fontFamily: "var(--font-mono)" }}
                                    >
                                        Summary
                                    </p>
                                    <p className="text-sm text-[#A8B0BE] leading-relaxed">{profile.summary}</p>
                                </div>
                            )}
                        </div>

                        {/* Skills, Certs, Awards */}
                        <div className="grid sm:grid-cols-3 gap-6">
                            <div className="bg-[#12151C] rounded-2xl border border-[#232833] p-5">
                                <Section title="Top Skills">
                                    <TagList items={profile.topSkills} />
                                </Section>
                            </div>

                            <div className="bg-[#12151C] rounded-2xl border border-[#232833] p-5">
                                <Section title="Certifications">
                                    <ul className="space-y-2">
                                        {profile.certifications?.length ? (
                                            profile.certifications.map((c, i) => (
                                                <li key={i} className="text-sm text-[#A8B0BE] flex gap-2">
                                                    <FaCertificate className="text-[#58A6FF] mt-0.5 shrink-0" />
                                                    {c}
                                                </li>
                                            ))
                                        ) : (
                                            <p className="text-sm text-[#4B5261] italic">none found</p>
                                        )}
                                    </ul>
                                </Section>
                            </div>

                            <div className="bg-[#12151C] rounded-2xl border border-[#232833] p-5">
                                <Section title="Honors & Awards">
                                    <ul className="space-y-2">
                                        {profile.honorsAwards?.length ? (
                                            profile.honorsAwards.map((a, i) => (
                                                <li key={i} className="text-sm text-[#A8B0BE] flex gap-2">
                                                    <FaTrophy className="text-[#E3B341] mt-0.5 shrink-0" />
                                                    {a}
                                                </li>
                                            ))
                                        ) : (
                                            <p className="text-sm text-[#4B5261] italic">none found</p>
                                        )}
                                    </ul>
                                </Section>
                            </div>
                        </div>

                        {/* Experience — git-log style timeline */}
                        <div className="bg-[#12151C] rounded-2xl border border-[#232833] p-6">
                            <Section title="Experience">
                                <div className="relative flex flex-col">
                                    {profile.experience?.length ? (
                                        profile.experience.map((exp, i) => (
                                            <div key={i} className="relative flex flex-row gap-5 pb-8 last:pb-0">
                                                <div className="flex flex-col items-center">
                                                    <span className="w-2.5 h-2.5 rounded-full bg-[#3FB950] mt-1.5 shrink-0" />
                                                    {i !== profile.experience.length - 1 && (
                                                        <span className="w-px flex-1 bg-[#232833] mt-1" />
                                                    )}
                                                </div>
                                                <div className="flex flex-col gap-1 pb-1">
                                                    <p
                                                        className="text-xs text-[#E3B341]"
                                                        style={{ fontFamily: "var(--font-mono)" }}
                                                    >
                                                        {exp.duration}
                                                        {exp.location ? ` · ${exp.location}` : ""}
                                                    </p>
                                                    <p className="text-sm font-semibold text-[#F3F5F8]">
                                                        {exp.title || (
                                                            <span className="text-[#4B5261] italic font-normal">
                                                                title not found
                                                            </span>
                                                        )}
                                                    </p>
                                                    <p className="text-xs font-medium text-[#58A6FF]">
                                                        {exp.company || (
                                                            <span className="text-[#4B5261] italic font-normal">
                                                                organization not found
                                                            </span>
                                                        )}
                                                    </p>
                                                    {exp.description && (
                                                        <p className="text-sm text-[#A8B0BE] mt-1.5 leading-relaxed">
                                                            {exp.description}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-sm text-[#4B5261] italic">no experience found</p>
                                    )}
                                </div>
                            </Section>
                        </div>

                        {/* Education */}
                        <div className="bg-[#12151C] rounded-2xl border border-[#232833] p-6">
                            <Section title="Education">
                                <div className="space-y-4">
                                    {profile.education?.length ? (
                                        profile.education.map((edu, i) => (
                                            <div key={i} className="flex gap-4 items-start">
                                                <div className="w-9 h-9 rounded-lg bg-[#181C24] border border-[#232833] flex items-center justify-center shrink-0">
                                                    <FaGraduationCap className="text-[#58A6FF]" />
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-[#F3F5F8] text-sm">
                                                        {edu.degree || (
                                                            <span className="text-[#4B5261] italic font-normal">
                                                                degree not found
                                                            </span>
                                                        )}
                                                    </p>
                                                    <p className="text-[#A8B0BE] text-xs mt-0.5">{edu.institution}</p>
                                                    <p
                                                        className="text-[#8A93A3] text-xs mt-0.5"
                                                        style={{ fontFamily: "var(--font-mono)" }}
                                                    >
                                                        {edu.duration}
                                                    </p>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-sm text-[#4B5261] italic">no education found</p>
                                    )}
                                </div>
                            </Section>
                        </div>

                        {/* Raw Text Toggle */}
                        <div className="bg-[#12151C] rounded-2xl border border-[#232833] overflow-hidden">
                            <button
                                onClick={() => setShowRaw((v) => !v)}
                                className="w-full flex items-center justify-between px-6 py-4 text-sm font-medium text-[#A8B0BE] hover:bg-[#181C24] transition-colors"
                                style={{ fontFamily: "var(--font-mono)" }}
                            >
                                <span>raw extracted columns</span>
                                {showRaw ? <FaChevronUp className="text-xs" /> : <FaChevronDown className="text-xs" />}
                            </button>
                            {showRaw && (
                                <div className="px-6 pb-6 grid sm:grid-cols-2 gap-4">
                                    <div>
                                        <p
                                            className="text-[11px] tracking-wide uppercase text-[#8A93A3] mb-1.5"
                                            style={{ fontFamily: "var(--font-mono)" }}
                                        >
                                            sidebar (blue) · {rawBlue.split("\n").filter(Boolean).length} lines
                                        </p>
                                        <pre
                                            className="bg-[#0D0F14] border border-[#232833] rounded-xl p-4 text-xs text-[#A8B0BE] overflow-auto max-h-80 whitespace-pre-wrap leading-relaxed"
                                            style={{ fontFamily: "var(--font-mono)" }}
                                        >
                                            {rawBlue || "no sidebar content detected."}
                                        </pre>
                                    </div>
                                    <div>
                                        <p
                                            className="text-[11px] tracking-wide uppercase text-[#8A93A3] mb-1.5"
                                            style={{ fontFamily: "var(--font-mono)" }}
                                        >
                                            main (white) · {rawWhite.split("\n").filter(Boolean).length} lines
                                        </p>
                                        <pre
                                            className="bg-[#0D0F14] border border-[#232833] rounded-xl p-4 text-xs text-[#A8B0BE] overflow-auto max-h-80 whitespace-pre-wrap leading-relaxed"
                                            style={{ fontFamily: "var(--font-mono)" }}
                                        >
                                            {rawWhite || "no main content detected."}
                                        </pre>
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>
                )}

                {/* Footer */}
                <footer className="relative w-full overflow-hidden bg-black border-t border-[#1E222B] py-20">
                    <p
                        className="text-center text-xs tracking-widest uppercase text-[#3FB950] mb-4"
                        style={{ fontFamily: "var(--font-mono)" }}
                    >
                    // 0 tokens spent
                    </p>
                    <h1
                        className="pointer-events-none select-none mx-auto text-center font-bold leading-none text-transparent bg-clip-text bg-linear-to-b from-[#8c8c8c] via-[#2b2b2b] to-[#010101] opacity-90 text-5xl sm:text-[7rem] md:text-[9rem] lg:text-[10rem]"
                        style={{ fontFamily: "var(--font-mono)" }}
                    >
                        THE PARSER
                    </h1>
                </footer>
            </div>
        </React.Fragment>
    );
}