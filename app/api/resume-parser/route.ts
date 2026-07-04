import { NextRequest, NextResponse } from "next/server";

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

interface ParsedProfile {
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

function clean(lines: string[]): string[] {
    return (lines ?? []).map((l) => l.trim()).filter(Boolean);
}

/**
 * ── SIDEBAR (blue) column ──────────────────────────────────────
 * On a LinkedIn PDF export, the sidebar reliably holds:
 * Contact (email / phone / linkedin url), Top Skills,
 * Certifications, Honors & Awards.
 */
function parseSidebar(rawLines: string[]) {
    const lines = clean(rawLines);

    const contactIdx = lines.findIndex((l) => /^contact$/i.test(l));

    // ── LinkedIn: URL may be split across two lines ───────────────
    const linkedInStartIdx = lines.findIndex((l) =>
        /^www\.linkedin\.com\/in\//i.test(l.replace(/\s+/g, ""))
    );

    const linkedIn = (() => {
        if (linkedInStartIdx === -1) return null;

        let raw = lines[linkedInStartIdx];

        if (!/\(linkedin\)/i.test(raw) && linkedInStartIdx + 1 < lines.length) {
            raw += lines[linkedInStartIdx + 1];
        }

        return (
            "https://" +
            raw
                .replace(/\s+/g, "")
                .replace(/\(linkedin\).*/i, "")
                .trim()
        );
    })();

    // ── Email: line immediately before the LinkedIn start line ────
    const email =
        linkedInStartIdx > 0
            ? lines[linkedInStartIdx - 1].replace(/\s+/g, "").trim()
            : lines.find((l) => /^[\w.+-]+@[\w-]+\.[a-z]{2,}$/i.test(l)) ?? null;

    // ── Phone: line after Contact heading that contains digits ───
    const phone =
        contactIdx !== -1
            ? (() => {
                  const phoneLine = lines
                      .slice(contactIdx + 1, contactIdx + 6)
                      .find((l) => /\d{5,}/.test(l));
                  if (!phoneLine) return null;
                  return phoneLine.split("(")[0].trim() || null;
              })()
            : null;

    // ── Top Skills ──────────────────────────────────────────────
    const skillsIdx = lines.findIndex((l) => /^top skills$/i.test(l));
    const topSkills: string[] = [];
    if (skillsIdx !== -1) {
        const stop =
            /^(certifications?|honors?|experience|education|summary|contact|languages)$/i;
        for (let i = skillsIdx + 1; i < lines.length && !stop.test(lines[i]); i++) {
            if (lines[i].length > 1 && lines[i].length < 80) topSkills.push(lines[i]);
        }
    }

    // ── Certifications ──────────────────────────────────────────
    const certIdx = lines.findIndex((l) => /^certifications?$/i.test(l));
    const certifications: string[] = [];
    if (certIdx !== -1) {
        const stop =
            /^(honors?|awards?|experience|education|summary|top skills|languages)$/i;
        for (let i = certIdx + 1; i < lines.length && !stop.test(lines[i]); i++) {
            if (lines[i].length > 1 && lines[i].length < 120) certifications.push(lines[i]);
        }
    }

    // ── Honors & Awards ─────────────────────────────────────────
    const awardsIdx = lines.findIndex((l) => /^honors?[-–]?awards?$/i.test(l));
    const honorsAwards: string[] = [];
    if (awardsIdx !== -1) {
        const stop =
            /^(experience|education|summary|top skills|certifications?|languages)$/i;
        for (let i = awardsIdx + 1; i < lines.length && !stop.test(lines[i]); i++) {
            if (lines[i].length > 1 && lines[i].length < 120) honorsAwards.push(lines[i]);
        }
    }

    return { email, phone, linkedIn, topSkills, certifications, honorsAwards };
}

/**
 * ── MAIN (white) column ─────────────────────────────────────────
 * On a LinkedIn PDF export, the main column reliably holds, in order:
 * Name (always line 1), headline/bio, location, Summary, Experience,
 * Education.
 */
function parseMain(rawLines: string[]) {
    const lines = clean(rawLines);

    // ── Name: the very first line of the main column. Since the name
    // is always the top-most text in the white column of a LinkedIn
    // PDF export, this is accurate regardless of bio/summary layout. ──
    const name = lines[0] ?? null;

    const summaryIdx = lines.findIndex((l) => /^summary$/i.test(l));

    // ── Location: line just before Summary ─────────────────────────
    const location = summaryIdx >= 1 ? lines[summaryIdx - 1] : null;

    // ── Company: pulled from the bio line(s) between name and location,
    // looking for a "... at <Company>" pattern ────────────────────────
    const company = (() => {
        const end = summaryIdx === -1 ? lines.length : summaryIdx;
        for (let i = 1; i < Math.min(end, 6); i++) {
            const m = lines[i]?.match(/\bat\s+(.+)$/i);
            if (m) return m[1].trim();
        }
        return null;
    })();

    // ── Summary ─────────────────────────────────────────────────
    const summaryLines: string[] = [];
    if (summaryIdx !== -1) {
        const stop = /^(experience|education|top skills|certifications?|honors?)$/i;
        for (let i = summaryIdx + 1; i < lines.length && !stop.test(lines[i]); i++) {
            summaryLines.push(lines[i]);
        }
    }
    const summary = summaryLines.join(" ").trim() || null;

    // ── Experience ───────────────────────────────────────────────
    const durationRe =
        /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|June|July|August|September|October|November|December)\s+\d{4}\s*[-–]\s*(Present|\w+ \d{4})/i;

    const tenureRe = /^\d+\s+years?(\s+\d+\s+months?)?$/i;

    const expIdx = lines.findIndex((l) => /^experience$/i.test(l));
    const eduIdx = lines.findIndex((l) => /^education$/i.test(l));
    const expEnd = eduIdx !== -1 ? eduIdx : lines.length;

    const experience: Experience[] = [];

    if (expIdx !== -1) {
        let i = expIdx + 1;
        while (i < expEnd) {
            if (durationRe.test(lines[i])) {
                const duration = lines[i];

                let lookback = i - 1;

                while (
                    lookback > expIdx &&
                    (tenureRe.test(lines[lookback]) || /^page \d/i.test(lines[lookback]))
                ) {
                    lookback--;
                }

                const isDescLine = (l: string) =>
                    (l.length > 40 && /[.!?]$/.test(l)) ||
                    /^[a-z]/.test(l) ||
                    /^[•●\-–]/.test(l);

                const titleCandidate = lookback > expIdx ? lines[lookback] : "";
                const title = isDescLine(titleCandidate) ? "" : titleCandidate;
                lookback--;

                while (
                    lookback > expIdx &&
                    (tenureRe.test(lines[lookback]) || /^page \d/i.test(lines[lookback]))
                ) {
                    lookback--;
                }

                const companyCandidate = lookback > expIdx ? lines[lookback] : "";
                const expCompany = isDescLine(companyCandidate) ? "" : companyCandidate;

                i++;

                let expLocation = "";
                if (
                    i < expEnd &&
                    lines[i].length < 40 &&
                    !/^[A-Z].*[.!?]$/.test(lines[i]) &&
                    !durationRe.test(lines[i]) &&
                    !/^page \d+ of \d+$/i.test(lines[i])
                ) {
                    expLocation = lines[i];
                    i++;
                }

                const descLines: string[] = [];
                while (
                    i < expEnd &&
                    !durationRe.test(lines[i]) &&
                    !/^(education|experience)$/i.test(lines[i]) &&
                    !/^page \d+( of \d+)?$/i.test(lines[i])
                ) {
                    descLines.push(lines[i]);
                    i++;
                }

                if (title || expCompany) {
                    experience.push({
                        title,
                        company: expCompany,
                        duration,
                        location: expLocation,
                        description: descLines.join(" ").trim(),
                    });
                }
            } else {
                i++;
            }
        }
    }

    // ── Education ───────────────────────────────────────────────
    const education: Education[] = [];
    if (eduIdx !== -1) {
        let i = eduIdx + 1;
        while (i < lines.length) {
            if (/^page \d/i.test(lines[i])) {
                i++;
                continue;
            }

            const combinedMatch = lines[i].match(/^(.+?)\s*·\s*\(([^)]+)\)\s*$/);
            if (combinedMatch) {
                const degree = combinedMatch[1].trim();
                const duration = combinedMatch[2].trim();
                const institution = i > eduIdx + 1 ? lines[i - 1] : "";
                education.push({ degree, institution, duration });
            }
            i++;
        }
    }

    return { name, location, company, summary, experience, education };
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const blueLines: string[] = Array.isArray(body?.blueLines) ? body.blueLines : [];
        const whiteLines: string[] = Array.isArray(body?.whiteLines) ? body.whiteLines : [];

        if (!blueLines.length && !whiteLines.length) {
            return NextResponse.json(
                { success: false, message: "No column data received" },
                { status: 400 }
            );
        }

        const sidebar = parseSidebar(blueLines);
        const main = parseMain(whiteLines);

        const profile: ParsedProfile = {
            name: main.name,
            email: sidebar.email,
            phone: sidebar.phone,
            linkedIn: sidebar.linkedIn,
            company: main.company,
            location: main.location,
            summary: main.summary,
            topSkills: sidebar.topSkills,
            certifications: sidebar.certifications,
            honorsAwards: sidebar.honorsAwards,
            experience: main.experience,
            education: main.education,
        };

        return NextResponse.json({ success: true, profile });
    } catch (error) {
        console.error(error);
        return NextResponse.json(
            { success: false, message: "Failed to parse resume data", error: String(error) },
            { status: 500 }
        );
    }
}