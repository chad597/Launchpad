// Minimal CSV reader: handles quoted fields, escaped quotes, and CRLF.
// Used by the admin import so a HubSpot export can be pasted in directly.

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === ",") { row.push(field); field = ""; continue; }
    if (c === "\r") continue;
    if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; continue; }
    field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export interface ImportRow {
  name: string;
  email: string;
  role: "founder" | "mentor" | "instructor" | "admin";
  company?: string;
  stage?: string;
  bio?: string;
  expertise?: string[];
}

export interface ParsedRow {
  row: ImportRow;
  line: number;
  problem?: string;
}

// Column names are matched loosely so a HubSpot export usually works unedited.
const ALIASES: Record<string, string[]> = {
  name: ["name", "full name", "fullname", "contact name"],
  firstName: ["first name", "firstname"],
  lastName: ["last name", "lastname", "surname"],
  email: ["email", "email address", "work email"],
  role: ["role", "type", "person type"],
  company: ["company", "company name", "startup", "venture"],
  stage: ["stage", "company stage"],
  bio: ["bio", "background", "headline", "title", "job title"],
  expertise: ["expertise", "skills", "areas of expertise", "focus areas"],
};

function indexFor(headers: string[], key: string): number {
  const wanted = ALIASES[key] ?? [key];
  return headers.findIndex((h) => wanted.includes(h.trim().toLowerCase()));
}

export function parsePeople(text: string, defaultRole: ImportRow["role"]): ParsedRow[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const headers = rows[0];
  const idx = {
    name: indexFor(headers, "name"),
    firstName: indexFor(headers, "firstName"),
    lastName: indexFor(headers, "lastName"),
    email: indexFor(headers, "email"),
    role: indexFor(headers, "role"),
    company: indexFor(headers, "company"),
    stage: indexFor(headers, "stage"),
    bio: indexFor(headers, "bio"),
    expertise: indexFor(headers, "expertise"),
  };

  const at = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");
  const out: ParsedRow[] = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const name = at(r, idx.name) || [at(r, idx.firstName), at(r, idx.lastName)].filter(Boolean).join(" ");
    const email = at(r, idx.email).toLowerCase();
    const rawRole = at(r, idx.role).toLowerCase();
    const role: ImportRow["role"] =
      rawRole.startsWith("found") ? "founder"
      : rawRole.startsWith("ment") ? "mentor"
      : rawRole.startsWith("instr") || rawRole.startsWith("sherpa") ? "instructor"
      : rawRole.startsWith("admin") ? "admin"
      : defaultRole;

    const expertise = at(r, idx.expertise)
      .split(/[;,|]/).map((s) => s.trim()).filter(Boolean);

    let problem: string | undefined;
    if (!name) problem = "No name";
    else if (!email) problem = "No email";
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) problem = "Email doesn't look valid";

    out.push({
      line: i + 1,
      problem,
      row: {
        name, email, role,
        company: at(r, idx.company) || undefined,
        stage: at(r, idx.stage) || undefined,
        bio: at(r, idx.bio) || undefined,
        expertise: expertise.length ? expertise : undefined,
      },
    });
  }
  return out;
}
