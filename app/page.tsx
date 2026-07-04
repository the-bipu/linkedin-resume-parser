"use client";

import { useState } from "react";

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
            <h3 className="text-xs font-semibold tracking-widest uppercase text-slate-400 mb-3 pb-2 border-b border-slate-100">
                {title}
            </h3>
            {children}
        </div>
    );
}

function Field({ label, value }: { label: string; value: string | null }) {
    return (
        <div className="mb-3">
            <p className="text-xs text-slate-400 mb-0.5">{label}</p>
            <p className="text-sm text-slate-800 font-medium">
                {value || <span className="text-slate-300 font-normal italic">Not found</span>}
            </p>
        </div>
    );
}

function TagList({ items }: { items: string[] }) {
    if (!items?.length) return <p className="text-sm text-slate-300 italic">None found</p>;
    return (
        <div className="flex flex-wrap gap-2">
            {items.map((item, i) => (
                <span
                    key={i}
                    className="bg-indigo-50 text-indigo-700 text-xs px-3 py-1 rounded-full font-medium"
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

    const handleUpload = async () => {
        if (!file) {
            setError("Please select a PDF file");
            return;
        }

        try {
            setLoading(true);
            setError("");
            setProfile(null);
        
            const pdfjsLib = await loadPdfjs();
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

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

            const blueLines = groupIntoLines(blueChunks);
            const whiteLines = groupIntoLines(whiteChunks);

            setRawBlue(blueLines.join("\n"));
            setRawWhite(whiteLines.join("\n"));

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
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            <div className="bg-white border-b border-slate-200 px-6 py-5">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                        Resume Parser without using AI Tokens
                    </h1>
                    <p className="text-sm text-slate-500 mt-0.5">
                        Upload a LinkedIn PDF to extract structured profile data
                    </p>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-6 py-8">
                {/* Upload Card */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-8">
                    <div
                        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                            file ? "border-indigo-300 bg-indigo-50" : "border-slate-200 hover:border-slate-300"
                        }`}
                    >
                        <input
                            type="file"
                            accept=".pdf"
                            id="file-upload"
                            onChange={(e) => setFile(e.target.files?.[0] || null)}
                            className="hidden"
                        />
                        <label htmlFor="file-upload" className="cursor-pointer">
                            <div className="text-3xl mb-2">📄</div>
                            {file ? (
                                <>
                                    <p className="text-sm font-semibold text-indigo-700">{file.name}</p>
                                    <p className="text-xs text-slate-400 mt-1">
                                        {(file.size / 1024).toFixed(1)} KB · Click to change
                                    </p>
                                </>
                            ) : (
                                <>
                                    <p className="text-sm font-medium text-slate-600">Click to select a PDF</p>
                                    <p className="text-xs text-slate-400 mt-1">
                                        LinkedIn resume export recommended
                                    </p>
                                </>
                            )}
                        </label>
                    </div>

                    <button
                        onClick={handleUpload}
                        disabled={loading || !file}
                        className="mt-4 w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                    <circle
                                        className="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                    />
                                    <path
                                        className="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8v8z"
                                    />
                                </svg>
                                Parsing resume...
                            </>
                        ) : (
                            "Extract Profile"
                        )}
                    </button>

                    {error && (
                        <div className="mt-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg px-4 py-3">
                            {error}
                        </div>
                    )}
                </div>

                {/* Results */}
                {profile && (
                    <div className="space-y-6">
                        {/* Identity Card */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                            <div className="flex items-start justify-between mb-6">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900">
                                        {profile.name || "Unknown"}
                                    </h2>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                                        {profile.location && (
                                            <p className="text-sm text-slate-500">📍 {profile.location}</p>
                                        )}
                                        {profile.company && (
                                            <p className="text-sm text-slate-500">🌐 {profile.company}</p>
                                        )}
                                    </div>
                                </div>
                                <span className="bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full shrink-0">
                                    Parsed
                                </span>
                            </div>

                            <div className="grid sm:grid-cols-3 gap-4">
                                <Field label="Email" value={profile.email} />
                                <Field label="Phone" value={profile.phone} />
                                <Field label="LinkedIn" value={profile.linkedIn} />
                            </div>

                            {profile.summary && (
                                <div className="mt-4 pt-4 border-t border-slate-100">
                                    <p className="text-xs text-slate-400 mb-1.5">Summary</p>
                                    <p className="text-sm text-slate-700 leading-relaxed">{profile.summary}</p>
                                </div>
                            )}
                        </div>

                        {/* Skills, Certs, Awards */}
                        <div className="grid sm:grid-cols-3 gap-6">
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                                <Section title="Top Skills">
                                    <TagList items={profile.topSkills} />
                                </Section>
                            </div>

                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                                <Section title="Certifications">
                                    <ul className="space-y-1.5">
                                        {profile.certifications?.length ? (
                                            profile.certifications.map((c, i) => (
                                                <li key={i} className="text-sm text-slate-700 flex gap-2">
                                                    <span className="text-indigo-400 mt-0.5">✓</span>
                                                    {c}
                                                </li>
                                            ))
                                        ) : (
                                            <p className="text-sm text-slate-300 italic">None found</p>
                                        )}
                                    </ul>
                                </Section>
                            </div>

                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                                <Section title="Honors & Awards">
                                    <ul className="space-y-1.5">
                                        {profile.honorsAwards?.length ? (
                                            profile.honorsAwards.map((a, i) => (
                                                <li key={i} className="text-sm text-slate-700 flex gap-2">
                                                    <span className="text-amber-400 mt-0.5">🏆</span>
                                                    {a}
                                                </li>
                                            ))
                                        ) : (
                                            <p className="text-sm text-slate-300 italic">None found</p>
                                        )}
                                    </ul>
                                </Section>
                            </div>
                        </div>

                        {/* Experience */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                            <Section title="Experience">
                                <div className="space-y-6">
                                    {profile.experience?.length ? (
                                        profile.experience.map((exp, i) => (
                                            <div key={i} className="relative pl-4 border-l-2 border-indigo-100">
                                                <div className="absolute -left-1.5 top-1 w-2.5 h-2.5 rounded-full bg-indigo-300" />
                                                <p className="font-semibold text-slate-800 text-sm">
                                                    {exp.title || (
                                                        <span className="text-slate-300 italic font-normal">
                                                            Title not found
                                                        </span>
                                                    )}
                                                </p>
                                                <p className="text-indigo-600 text-xs font-medium mt-0.5">
                                                    {exp.company || (
                                                        <span className="text-slate-300 italic font-normal">
                                                            Organization not found
                                                        </span>
                                                    )}
                                                </p>
                                                <p className="text-slate-400 text-xs mt-0.5">
                                                    {exp.duration}
                                                    {exp.location ? ` · ${exp.location}` : ""}
                                                </p>
                                                {exp.description && (
                                                    <p className="text-slate-600 text-sm mt-2 leading-relaxed">
                                                        {exp.description}
                                                    </p>
                                                )}
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-sm text-slate-300 italic">No experience found</p>
                                    )}
                                </div>
                            </Section>
                        </div>

                        {/* Education */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                            <Section title="Education">
                                <div className="space-y-4">
                                    {profile.education?.length ? (
                                        profile.education.map((edu, i) => (
                                            <div key={i} className="flex gap-4 items-start">
                                                <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-base shrink-0">
                                                    🎓
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-slate-800 text-sm">
                                                        {edu.degree || (
                                                            <span className="text-slate-300 italic font-normal">
                                                                Degree not found
                                                            </span>
                                                        )}
                                                    </p>
                                                    <p className="text-slate-500 text-xs mt-0.5">{edu.institution}</p>
                                                    <p className="text-slate-400 text-xs mt-0.5">{edu.duration}</p>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-sm text-slate-300 italic">No education found</p>
                                    )}
                                </div>
                            </Section>
                        </div>

                        {/* Raw Text Toggle */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <button
                                onClick={() => setShowRaw((v) => !v)}
                                className="w-full flex items-center justify-between px-6 py-4 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                            >
                                <span>Raw Extracted Columns</span>
                                <span className="text-slate-400 text-xs">{showRaw ? "▲ Hide" : "▼ Show"}</span>
                            </button>
                            {showRaw && (
                                <div className="px-6 pb-6 grid sm:grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs font-medium text-slate-400 mb-1">
                                            Sidebar (blue) · {rawBlue.split("\n").filter(Boolean).length} lines
                                        </p>
                                        <pre className="bg-slate-50 rounded-xl p-4 text-xs text-slate-600 overflow-auto max-h-80 whitespace-pre-wrap leading-relaxed">
                                            {rawBlue || "No sidebar content detected."}
                                        </pre>
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium text-slate-400 mb-1">
                                            Main (white) · {rawWhite.split("\n").filter(Boolean).length} lines
                                        </p>
                                        <pre className="bg-slate-50 rounded-xl p-4 text-xs text-slate-600 overflow-auto max-h-80 whitespace-pre-wrap leading-relaxed">
                                            {rawWhite || "No main content detected."}
                                        </pre>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}