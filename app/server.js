const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 4757);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const STATE_FILE = path.join(DATA_DIR, "state.json");
const LOG_FILE = path.join(DATA_DIR, "server.log");

process.stdout?.on?.("error", () => {});
process.stderr?.on?.("error", () => {});

const ROLE_HINTS = [
  "product designer",
  "ux designer",
  "ui designer",
  "design systems",
  "frontend engineer",
  "software engineer",
  "product manager",
  "data analyst",
  "data scientist",
  "machine learning",
  "marketing manager",
  "customer success",
  "sales engineer",
  "operations manager"
];

const SKILLS = [
  "accessibility",
  "analytics",
  "api",
  "aws",
  "azure",
  "c#",
  "css",
  "data visualization",
  "design systems",
  "figma",
  "frontend",
  "github",
  "html",
  "javascript",
  "jira",
  "machine learning",
  "node",
  "python",
  "react",
  "research",
  "sql",
  "tailwind",
  "typescript",
  "user research",
  "ux",
  "webflow"
];

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

function ensureStorage() {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  if (!fs.existsSync(STATE_FILE)) {
    writeState(defaultState());
  }
}

function defaultState() {
  const now = new Date().toISOString();
  return {
    createdAt: now,
    updatedAt: now,
    preferences: {
      roles: ["Product Designer", "UX Designer", "Frontend Engineer"],
      locations: ["Remote", "United States"],
      minimumScore: 55,
      maxQueue: 5,
      reviewBeforeSubmit: true
    },
    resume: null,
    sources: [
      {
        id: id("source"),
        name: "OpenAI Ashby",
        type: "ashby",
        value: "openai",
        enabled: true,
        lastStatus: "Not scanned yet",
        lastScannedAt: null
      },
      {
        id: id("source"),
        name: "Figma Greenhouse",
        type: "greenhouse",
        value: "figma",
        enabled: true,
        lastStatus: "Not scanned yet",
        lastScannedAt: null
      },
      {
        id: id("source"),
        name: "Databricks Greenhouse",
        type: "greenhouse",
        value: "databricks",
        enabled: true,
        lastStatus: "Not scanned yet",
        lastScannedAt: null
      }
    ],
    jobs: [],
    queue: [],
    activity: [
      {
        id: id("activity"),
        at: now,
        level: "info",
        message: "ApplyPilot initialized. Add a resume, then scan configured sources."
      }
    ],
    targetRuns: [],
    answerBank: {
      authorization: "Authorized to work in the United States",
      sponsorship: "No sponsorship required",
      salary: "",
      availability: "",
      portfolio: ""
    }
  };
}

function readState() {
  ensureStorage();
  return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
}

function writeState(state) {
  state.updatedAt = new Date().toISOString();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  try {
    fs.appendFileSync(LOG_FILE, `${line}\n`);
  } catch {
    // Logging must never stop the local app from starting.
  }
  try {
    console.log(message);
  } catch {
    // Some launch methods close stdout; the file log above is authoritative.
  }
}

function id(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

function hash(value) {
  return crypto.createHash("sha1").update(String(value)).digest("hex").slice(0, 16);
}

function send(res, status, payload, headers = {}) {
  const body = Buffer.isBuffer(payload) ? payload : Buffer.from(payload == null ? "" : String(payload));
  res.writeHead(status, {
    "Content-Length": body.length,
    ...headers
  });
  res.end(body);
}

function sendJson(res, status, payload) {
  send(res, status, JSON.stringify(payload, null, 2), {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
}

function readBody(req, limit = 12 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", chunk => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("Request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function readJson(req) {
  const body = await readBody(req, 1024 * 1024);
  if (!body.length) return {};
  return JSON.parse(body.toString("utf8"));
}

function parseMultipart(buffer, contentType) {
  const boundaryMatch = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || "");
  if (!boundaryMatch) throw new Error("Missing multipart boundary");
  const boundary = `--${boundaryMatch[1] || boundaryMatch[2]}`;
  const raw = buffer.toString("latin1");
  const parts = raw.split(boundary).slice(1, -1);
  const fields = {};
  const files = [];

  for (let part of parts) {
    part = part.replace(/^\r\n/, "").replace(/\r\n$/, "");
    const splitAt = part.indexOf("\r\n\r\n");
    if (splitAt < 0) continue;
    const headerText = part.slice(0, splitAt);
    let content = part.slice(splitAt + 4);
    content = content.replace(/\r\n$/, "");
    const disposition = /content-disposition:\s*form-data;\s*([^\r\n]+)/i.exec(headerText);
    if (!disposition) continue;
    const name = /name="([^"]+)"/i.exec(disposition[1])?.[1];
    const filename = /filename="([^"]*)"/i.exec(disposition[1])?.[1];
    const mime = /content-type:\s*([^\r\n]+)/i.exec(headerText)?.[1]?.trim() || "application/octet-stream";
    if (!name) continue;
    if (filename) {
      files.push({
        name,
        filename: path.basename(filename),
        mime,
        buffer: Buffer.from(content, "latin1")
      });
    } else {
      fields[name] = Buffer.from(content, "latin1").toString("utf8").trim();
    }
  }

  return { fields, files };
}

function safeFileName(name) {
  const cleaned = String(name || "resume.txt").replace(/[^\w.\- ]+/g, "_").trim();
  return cleaned || "resume.txt";
}

function plainTextFromBuffer(file) {
  const ext = path.extname(file.filename).toLowerCase();
  if (ext === ".txt" || file.mime.startsWith("text/")) {
    return {
      text: file.buffer.toString("utf8"),
      quality: "full"
    };
  }

  if (ext === ".pdf") {
    const rough = file.buffer
      .toString("latin1")
      .replace(/[^\x09\x0a\x0d\x20-\x7e]/g, " ")
      .replace(/\s+/g, " ");
    return {
      text: rough,
      quality: "rough-pdf"
    };
  }

  if (ext === ".docx" || ext === ".doc") {
    return {
      text: file.buffer
        .toString("latin1")
        .replace(/[^\x09\x0a\x0d\x20-\x7e]/g, " ")
        .replace(/\s+/g, " "),
      quality: "limited-word"
    };
  }

  return {
    text: file.buffer.toString("utf8"),
    quality: "unknown"
  };
}

function parseResume(text, file) {
  const lower = text.toLowerCase();
  const words = lower.match(/[a-z0-9+#.-]+/g) || [];
  const uniqueWords = [...new Set(words)].slice(0, 500);
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
  const phone = text.match(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/)?.[0] || "";
  const skills = SKILLS.filter(skill => lower.includes(skill.toLowerCase()));
  const roles = ROLE_HINTS.filter(role => lower.includes(role));
  const years = text.match(/(\d+)\+?\s+years?/i)?.[1] || "";
  const locations = extractLocations(text);
  const keywords = [...new Set([...skills, ...roles, ...uniqueWords.filter(word => word.length > 5).slice(0, 24)])].slice(0, 40);

  return {
    id: id("resume"),
    filename: file.filename,
    uploadedAt: new Date().toISOString(),
    size: file.buffer.length,
    parseQuality: file.quality,
    email,
    phone,
    skills,
    roles,
    years,
    locations,
    keywords,
    wordCount: words.length,
    preview: text.replace(/\s+/g, " ").trim().slice(0, 700)
  };
}

function extractLocations(text) {
  const found = [];
  const common = [
    "remote",
    "united states",
    "usa",
    "seattle",
    "austin",
    "new york",
    "san francisco",
    "los angeles",
    "chicago",
    "boston",
    "denver",
    "toronto",
    "vancouver"
  ];
  const lower = text.toLowerCase();
  for (const place of common) {
    if (lower.includes(place)) found.push(titleCase(place));
  }
  return [...new Set(found)];
}

function titleCase(text) {
  return String(text).replace(/\b\w/g, char => char.toUpperCase());
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 18000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "User-Agent": "ApplyPilotLocal/0.1 (+local user initiated job search)",
        "Accept": "application/json,text/html;q=0.9,*/*;q=0.8",
        ...(options.headers || {})
      }
    });
  } finally {
    clearTimeout(timer);
  }
}

async function scanSource(source) {
  if (!source.enabled) return [];
  if (source.type === "greenhouse") return scanGreenhouse(source);
  if (source.type === "lever") return scanLever(source);
  if (source.type === "ashby") return scanAshby(source);
  return scanGeneric(source);
}

async function scanGreenhouse(source) {
  const slug = source.value.trim();
  const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs?content=true`;
  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error(`Greenhouse returned ${response.status}`);
  const data = await response.json();
  return (data.jobs || []).map(job => ({
    externalId: String(job.id || job.absolute_url || job.title),
    title: job.title || "Untitled role",
    company: source.name.replace(/\s+Greenhouse$/i, ""),
    location: job.location?.name || "",
    department: job.departments?.map(item => item.name).join(", ") || "",
    sourceId: source.id,
    sourceName: source.name,
    sourceType: source.type,
    url: job.absolute_url || "",
    applyUrl: job.absolute_url || "",
    postedAt: job.updated_at || null,
    description: stripHtml(job.content || ""),
    raw: { requisitionId: job.internal_job_id || "" }
  }));
}

async function scanLever(source) {
  const slug = source.value.trim();
  const url = `https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`;
  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error(`Lever returned ${response.status}`);
  const data = await response.json();
  return (Array.isArray(data) ? data : []).map(job => ({
    externalId: String(job.id || job.hostedUrl || job.text),
    title: job.text || "Untitled role",
    company: source.name.replace(/\s+Lever$/i, ""),
    location: job.categories?.location || "",
    department: job.categories?.team || "",
    sourceId: source.id,
    sourceName: source.name,
    sourceType: source.type,
    url: job.hostedUrl || "",
    applyUrl: job.applyUrl || job.hostedUrl || "",
    postedAt: job.createdAt ? new Date(job.createdAt).toISOString() : null,
    description: stripHtml(`${job.descriptionPlain || ""} ${job.lists?.map(list => `${list.text} ${list.content}`).join(" ") || ""}`),
    raw: { commitment: job.categories?.commitment || "" }
  }));
}

async function scanAshby(source) {
  const slug = source.value.trim();
  const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}`;
  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error(`Ashby returned ${response.status}`);
  const data = await response.json();
  return (data.jobs || []).map(job => ({
    externalId: String(job.id || job.jobUrl || job.title),
    title: job.title || "Untitled role",
    company: source.name.replace(/\s+Ashby$/i, ""),
    location: [job.location, job.secondaryLocations?.join(", ")].filter(Boolean).join(", "),
    department: job.department || "",
    sourceId: source.id,
    sourceName: source.name,
    sourceType: source.type,
    url: job.jobUrl || "",
    applyUrl: job.applyUrl || job.jobUrl || "",
    postedAt: job.publishedAt || null,
    description: stripHtml(job.descriptionHtml || job.descriptionPlain || ""),
    raw: {}
  }));
}

async function scanGeneric(source) {
  const url = source.value.trim();
  if (!/^https?:\/\//i.test(url)) throw new Error("Generic source must be a URL");
  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error(`URL returned ${response.status}`);
  const html = await response.text();
  const jobs = [];

  const jsonLdBlocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const block of jsonLdBlocks) {
    try {
      const parsed = JSON.parse(block[1].trim());
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items.flatMap(entry => entry["@graph"] || entry)) {
        if (item && /jobposting/i.test(String(item["@type"] || ""))) {
          jobs.push({
            externalId: String(item.identifier?.value || item.url || item.title),
            title: item.title || "Untitled role",
            company: item.hiringOrganization?.name || source.name,
            location: locationFromJsonLd(item.jobLocation),
            department: item.industry || "",
            sourceId: source.id,
            sourceName: source.name,
            sourceType: source.type,
            url: absolutize(item.url || url, url),
            applyUrl: absolutize(item.url || url, url),
            postedAt: item.datePosted || null,
            description: stripHtml(item.description || ""),
            raw: {}
          });
        }
      }
    } catch {
      // Some sites emit invalid JSON-LD; continue with link extraction.
    }
  }

  if (jobs.length) return jobs;

  const linkMatches = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  for (const match of linkMatches) {
    const href = absolutize(match[1], url);
    const text = stripHtml(match[2]);
    if (!text || text.length > 120) continue;
    if (!/job|career|designer|engineer|manager|analyst|developer|product|ux|ui/i.test(`${href} ${text}`)) continue;
    jobs.push({
      externalId: href,
      title: text,
      company: source.name,
      location: "",
      department: "",
      sourceId: source.id,
      sourceName: source.name,
      sourceType: source.type,
      url: href,
      applyUrl: href,
      postedAt: null,
      description: text,
      raw: {}
    });
  }

  return jobs.slice(0, 80);
}

function locationFromJsonLd(jobLocation) {
  const locations = Array.isArray(jobLocation) ? jobLocation : [jobLocation].filter(Boolean);
  return locations.map(location => {
    const address = location.address || {};
    return [address.addressLocality, address.addressRegion, address.addressCountry].filter(Boolean).join(", ");
  }).filter(Boolean).join("; ");
}

function absolutize(value, base) {
  try {
    return new URL(value, base).toString();
  } catch {
    return value || base;
  }
}

function scoreJob(job, resume, preferences) {
  const text = `${job.title} ${job.company} ${job.department} ${job.location} ${job.description}`.toLowerCase();
  const rolePrefs = preferences.roles.map(item => item.toLowerCase());
  const locationPrefs = preferences.locations.map(item => item.toLowerCase());
  const resumeSkills = resume?.skills?.length ? resume.skills : [];
  const resumeKeywords = resume?.keywords?.length ? resume.keywords : [];

  const matchedSkills = resumeSkills.filter(skill => text.includes(skill.toLowerCase()));
  const matchedKeywords = resumeKeywords.filter(keyword => keyword.length > 3 && text.includes(keyword.toLowerCase())).slice(0, 10);
  const roleMatches = rolePrefs.filter(role => text.includes(role));
  const locationMatches = locationPrefs.filter(location => text.includes(location) || (location.includes("remote") && text.includes("remote")));
  const recency = recencyScore(job.postedAt);

  let score = 18;
  score += Math.min(38, matchedSkills.length * 7);
  score += Math.min(16, matchedKeywords.length * 2);
  score += roleMatches.length ? 22 : 0;
  score += locationMatches.length ? 14 : 0;
  score += recency;
  if (/remote|hybrid/i.test(job.location)) score += 4;

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    matchedSkills,
    matchedKeywords,
    roleMatches,
    locationMatches,
    recency
  };
}

function recencyScore(value) {
  if (!value) return 4;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 4;
  const ageHours = (Date.now() - date.getTime()) / 36e5;
  if (ageHours < 24) return 10;
  if (ageHours < 72) return 8;
  if (ageHours < 168) return 5;
  return 2;
}

function upsertJobs(state, scannedJobs) {
  const existing = new Map(state.jobs.map(job => [job.id, job]));
  const nextJobs = [...state.jobs];
  let added = 0;
  let updated = 0;

  for (const scanned of scannedJobs) {
    const stableId = `job_${hash(`${scanned.sourceId}:${scanned.externalId}:${scanned.url}:${scanned.title}`)}`;
    const match = scoreJob(scanned, state.resume, state.preferences);
    const normalized = {
      ...scanned,
      id: stableId,
      discoveredAt: new Date().toISOString(),
      score: match.score,
      matchedSkills: match.matchedSkills,
      matchedKeywords: match.matchedKeywords,
      roleMatches: match.roleMatches,
      locationMatches: match.locationMatches,
      status: match.score >= state.preferences.minimumScore ? "matched" : "low-match"
    };

    const current = existing.get(stableId);
    if (current) {
      Object.assign(current, normalized, {
        discoveredAt: current.discoveredAt,
        queuedAt: current.queuedAt || null,
        submittedAt: current.submittedAt || null
      });
      updated += 1;
    } else {
      nextJobs.push(normalized);
      existing.set(stableId, normalized);
      added += 1;
    }
  }

  state.jobs = nextJobs
    .sort((a, b) => b.score - a.score || dateValue(b.postedAt) - dateValue(a.postedAt))
    .slice(0, 400);

  return { added, updated };
}

async function performScan(state) {
  const scannedJobs = [];
  const results = [];

  for (const source of state.sources) {
    if (!source.enabled) continue;
    try {
      const jobs = await scanSource(source);
      scannedJobs.push(...jobs);
      source.lastStatus = `Found ${jobs.length} job${jobs.length === 1 ? "" : "s"}`;
      source.lastScannedAt = new Date().toISOString();
      results.push({ sourceId: source.id, ok: true, count: jobs.length });
    } catch (error) {
      source.lastStatus = error.message || "Scan failed";
      source.lastScannedAt = new Date().toISOString();
      results.push({ sourceId: source.id, ok: false, error: source.lastStatus });
    }
  }

  const upsert = upsertJobs(state, scannedJobs);
  return { results, ...upsert };
}

function dateValue(value) {
  const date = value ? new Date(value).getTime() : 0;
  return Number.isFinite(date) ? date : 0;
}

function addActivity(state, message, level = "info") {
  state.activity.unshift({
    id: id("activity"),
    at: new Date().toISOString(),
    level,
    message
  });
  state.activity = state.activity.slice(0, 120);
}

function stateSummary(state) {
  const matched = state.jobs.filter(job => job.status === "matched").length;
  const queued = state.queue.filter(item => !["submitted", "skipped"].includes(item.status)).length;
  const submitted = state.queue.filter(item => item.status === "submitted").length;
  const blocked = state.queue.filter(item => item.status === "needs-answer").length;
  return {
    matched,
    queued,
    submitted,
    blocked,
    sources: state.sources.length,
    resumeReady: Boolean(state.resume)
  };
}

function createQueueItem(state, job, options = {}) {
  const existing = state.queue.find(item => item.jobId === job.id && item.status !== "skipped");
  if (existing) return { item: existing, created: false };

  const needsAnswer = !state.resume || !state.answerBank.authorization;
  const item = {
    id: id("queue"),
    jobId: job.id,
    createdAt: new Date().toISOString(),
    status: needsAnswer ? "needs-answer" : "ready",
    title: job.title,
    company: job.company,
    location: job.location,
    applyUrl: job.applyUrl || job.url,
    sourceName: job.sourceName,
    score: job.score,
    runId: options.runId || null,
    target: options.target || null,
    coverNote: generateCoverNote(state, job),
    answers: {
      authorization: state.answerBank.authorization,
      sponsorship: state.answerBank.sponsorship,
      salary: state.answerBank.salary,
      availability: state.answerBank.availability,
      portfolio: state.answerBank.portfolio
    },
    audit: [
      {
        at: new Date().toISOString(),
        message: options.target ? `Application draft created for target: ${options.target.role || "Any role"}.` : "Application draft created."
      }
    ]
  };
  state.queue.unshift(item);
  job.queuedAt = item.createdAt;
  return { item, created: true };
}

function generateCoverNote(state, job) {
  const resume = state.resume;
  const skills = (job.matchedSkills?.length ? job.matchedSkills : resume?.skills || []).slice(0, 5);
  const skillText = skills.length ? ` My background in ${skills.join(", ")} maps well to the role requirements.` : "";
  const roleText = resume?.roles?.[0] ? ` I have been targeting ${resume.roles[0]} roles with a strong match to this opening.` : "";
  return `I am interested in the ${job.title} role at ${job.company}.${skillText}${roleText} I would welcome the chance to bring practical product judgment, clear execution, and measurable impact to this team.`;
}

function targetCandidates(state, target) {
  const roleTerms = importantTerms(target.role);
  const companyTerms = importantTerms(target.company);
  const locationTerms = importantTerms(target.location);
  const minScore = clamp(Number(target.minScore ?? state.preferences.minimumScore), 0, 100);

  return state.jobs
    .filter(job => job.score >= minScore)
    .filter(job => !state.queue.some(item => item.jobId === job.id && item.status !== "skipped"))
    .map(job => ({ job, targetScore: scoreTargetFit(job, roleTerms, companyTerms, locationTerms) }))
    .filter(result => result.targetScore > 0)
    .sort((a, b) => b.targetScore - a.targetScore || b.job.score - a.job.score || dateValue(b.job.postedAt) - dateValue(a.job.postedAt))
    .map(result => result.job);
}

function scoreTargetFit(job, roleTerms, companyTerms, locationTerms) {
  const title = String(job.title || "").toLowerCase();
  const company = String(job.company || "").toLowerCase();
  const location = String(job.location || "").toLowerCase();
  const allText = `${title} ${company} ${location} ${job.department || ""} ${job.description || ""}`.toLowerCase();
  let score = 1;

  if (roleTerms.length) {
    const titleMatches = roleTerms.filter(term => title.includes(term)).length;
    const textMatches = roleTerms.filter(term => allText.includes(term)).length;
    if (!titleMatches && textMatches < Math.ceil(roleTerms.length * 0.7)) return 0;
    score += titleMatches * 12 + textMatches * 3;
  }

  if (companyTerms.length) {
    const companyMatches = companyTerms.filter(term => company.includes(term)).length;
    if (!companyMatches) return 0;
    score += companyMatches * 14;
  }

  if (locationTerms.length) {
    const locationMatches = locationTerms.filter(term => {
      if (term === "remote") return location.includes("remote") || allText.includes("remote");
      return location.includes(term) || allText.includes(term);
    }).length;
    if (!locationMatches) return 0;
    score += locationMatches * 8;
  }

  return score;
}

function importantTerms(value) {
  const stop = new Set(["a", "an", "and", "at", "for", "in", "of", "on", "or", "the", "to", "with"]);
  return [...new Set(String(value || "")
    .toLowerCase()
    .split(/[^a-z0-9+#]+/)
    .map(term => term.trim())
    .filter(term => term.length > 1 && !stop.has(term)))];
}

function publicState(state) {
  return {
    preferences: state.preferences,
    resume: state.resume,
    sources: state.sources,
    jobs: state.jobs,
    queue: state.queue,
    activity: state.activity,
    answerBank: state.answerBank,
    targetRuns: state.targetRuns || [],
    summary: stateSummary(state)
  };
}

async function handleApi(req, res, pathname) {
  try {
    if (req.method === "GET" && pathname === "/api/state") {
      return sendJson(res, 200, publicState(readState()));
    }

    if (req.method === "PATCH" && pathname === "/api/preferences") {
      const state = readState();
      const body = await readJson(req);
      state.preferences = {
        ...state.preferences,
        ...body,
        roles: normalizeList(body.roles ?? state.preferences.roles),
        locations: normalizeList(body.locations ?? state.preferences.locations),
        minimumScore: clamp(Number(body.minimumScore ?? state.preferences.minimumScore), 0, 100),
        maxQueue: clamp(Number(body.maxQueue ?? state.preferences.maxQueue), 1, 25)
      };
      addActivity(state, "Preferences updated.");
      writeState(state);
      return sendJson(res, 200, publicState(state));
    }

    if (req.method === "PATCH" && pathname === "/api/answers") {
      const state = readState();
      const body = await readJson(req);
      state.answerBank = { ...state.answerBank, ...body };
      addActivity(state, "Answer bank updated.");
      writeState(state);
      return sendJson(res, 200, publicState(state));
    }

    if (req.method === "POST" && pathname === "/api/upload-resume") {
      const body = await readBody(req);
      const { files } = parseMultipart(body, req.headers["content-type"]);
      const file = files.find(item => item.name === "resume") || files[0];
      if (!file) return sendJson(res, 400, { error: "No resume file was uploaded." });

      file.filename = safeFileName(file.filename);
      const savedName = `${Date.now()}-${file.filename}`;
      fs.writeFileSync(path.join(UPLOAD_DIR, savedName), file.buffer);
      const extracted = plainTextFromBuffer(file);
      const parsed = parseResume(extracted.text, {
        ...file,
        quality: extracted.quality
      });
      parsed.savedPath = path.join("data", "uploads", savedName);

      const state = readState();
      state.resume = parsed;
      state.jobs = state.jobs.map(job => {
        const match = scoreJob(job, state.resume, state.preferences);
        return {
          ...job,
          score: match.score,
          matchedSkills: match.matchedSkills,
          matchedKeywords: match.matchedKeywords,
          roleMatches: match.roleMatches,
          locationMatches: match.locationMatches,
          status: match.score >= state.preferences.minimumScore ? "matched" : "low-match"
        };
      }).sort((a, b) => b.score - a.score);
      addActivity(state, `Resume uploaded and parsed: ${file.filename}.`);
      writeState(state);
      return sendJson(res, 200, publicState(state));
    }

    if (req.method === "POST" && pathname === "/api/sources") {
      const state = readState();
      const body = await readJson(req);
      const source = {
        id: id("source"),
        name: String(body.name || "").trim() || "Untitled source",
        type: String(body.type || "generic").trim(),
        value: String(body.value || "").trim(),
        enabled: body.enabled !== false,
        lastStatus: "Not scanned yet",
        lastScannedAt: null
      };
      if (!source.value) return sendJson(res, 400, { error: "Source value is required." });
      state.sources.unshift(source);
      addActivity(state, `Source added: ${source.name}.`);
      writeState(state);
      return sendJson(res, 201, publicState(state));
    }

    const sourceMatch = pathname.match(/^\/api\/sources\/([^/]+)$/);
    if (sourceMatch && req.method === "PATCH") {
      const state = readState();
      const body = await readJson(req);
      const source = state.sources.find(item => item.id === sourceMatch[1]);
      if (!source) return sendJson(res, 404, { error: "Source not found." });
      Object.assign(source, {
        name: body.name ?? source.name,
        type: body.type ?? source.type,
        value: body.value ?? source.value,
        enabled: body.enabled ?? source.enabled
      });
      addActivity(state, `Source updated: ${source.name}.`);
      writeState(state);
      return sendJson(res, 200, publicState(state));
    }

    if (sourceMatch && req.method === "DELETE") {
      const state = readState();
      const before = state.sources.length;
      state.sources = state.sources.filter(item => item.id !== sourceMatch[1]);
      if (state.sources.length === before) return sendJson(res, 404, { error: "Source not found." });
      addActivity(state, "Source removed.");
      writeState(state);
      return sendJson(res, 200, publicState(state));
    }

    if (req.method === "POST" && pathname === "/api/scan") {
      const state = readState();
      const scan = await performScan(state);
      addActivity(state, `Scan complete. ${scan.added} new jobs, ${scan.updated} updated.`);
      writeState(state);
      return sendJson(res, 200, { ...publicState(state), scan });
    }

    if (req.method === "POST" && pathname === "/api/apply/start") {
      const state = readState();
      const candidates = state.jobs
        .filter(job => job.status === "matched" && !state.queue.some(item => item.jobId === job.id && item.status !== "skipped"))
        .slice(0, state.preferences.maxQueue);
      const created = [];
      for (const job of candidates) {
        const result = createQueueItem(state, job);
        if (result.created) created.push(result.item);
      }
      addActivity(state, `Application run prepared ${created.length} draft${created.length === 1 ? "" : "s"} for review.`);
      writeState(state);
      return sendJson(res, 200, { ...publicState(state), created });
    }

    if (req.method === "POST" && pathname === "/api/apply/target") {
      const state = readState();
      const body = await readJson(req);
      const target = {
        role: String(body.role || "").trim(),
        company: String(body.company || "").trim(),
        location: String(body.location || "").trim(),
        minScore: clamp(Number(body.minScore ?? state.preferences.minimumScore), 0, 100),
        limit: clamp(Number(body.limit ?? 3), 1, 25),
        scanBefore: body.scanBefore === true
      };

      if (!target.role && !target.company && !target.location) {
        return sendJson(res, 400, { error: "Enter at least a role, company, or location target." });
      }

      let scan = null;
      if (target.scanBefore) {
        scan = await performScan(state);
      }

      const runId = id("target_run");
      const matches = targetCandidates(state, target).slice(0, target.limit);
      const created = [];
      for (const job of matches) {
        const result = createQueueItem(state, job, { runId, target });
        if (result.created) created.push(result.item);
      }

      const run = {
        id: runId,
        at: new Date().toISOString(),
        target,
        matchedJobs: matches.length,
        createdDrafts: created.length
      };
      state.targetRuns = [run, ...(state.targetRuns || [])].slice(0, 30);
      addActivity(state, `Targeted run for "${target.role || target.company || target.location}" prepared ${created.length} draft${created.length === 1 ? "" : "s"}.`);
      writeState(state);
      return sendJson(res, 200, { ...publicState(state), created, targetRun: run, scan });
    }

    if (req.method === "POST" && pathname === "/api/queue") {
      const state = readState();
      const body = await readJson(req);
      const job = state.jobs.find(item => item.id === body.jobId);
      if (!job) return sendJson(res, 404, { error: "Job not found." });
      const result = createQueueItem(state, job);
      addActivity(state, result.created ? `Draft queued: ${job.title} at ${job.company}.` : `Draft already queued: ${job.title} at ${job.company}.`);
      writeState(state);
      return sendJson(res, result.created ? 201 : 200, publicState(state));
    }

    const queueMatch = pathname.match(/^\/api\/queue\/([^/]+)(?:\/([^/]+))?$/);
    if (queueMatch && req.method === "PATCH") {
      const state = readState();
      const item = state.queue.find(entry => entry.id === queueMatch[1]);
      if (!item) return sendJson(res, 404, { error: "Queue item not found." });
      const body = await readJson(req);
      Object.assign(item, body, {
        audit: [
          ...(item.audit || []),
          { at: new Date().toISOString(), message: `Updated status to ${body.status || item.status}.` }
        ]
      });
      addActivity(state, `Queue item updated: ${item.title}.`);
      writeState(state);
      return sendJson(res, 200, publicState(state));
    }

    if (queueMatch && req.method === "POST" && queueMatch[2] === "approve") {
      const state = readState();
      const item = state.queue.find(entry => entry.id === queueMatch[1]);
      if (!item) return sendJson(res, 404, { error: "Queue item not found." });
      item.status = "approved";
      item.approvedAt = new Date().toISOString();
      item.audit = [
        ...(item.audit || []),
        { at: item.approvedAt, message: "User approved opening the official application page." }
      ];
      addActivity(state, `Approved for application: ${item.title} at ${item.company}.`);
      writeState(state);
      return sendJson(res, 200, { ...publicState(state), openUrl: item.applyUrl });
    }

    return sendJson(res, 404, { error: "API route not found." });
  } catch (error) {
    return sendJson(res, 500, { error: error.message || "Unexpected server error" });
  }
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
  return String(value || "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function serveStatic(req, res, pathname) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const resolved = path.normalize(path.join(PUBLIC_DIR, requested));
  if (!resolved.startsWith(PUBLIC_DIR)) {
    return send(res, 403, "Forbidden", { "Content-Type": "text/plain; charset=utf-8" });
  }
  fs.readFile(resolved, (error, data) => {
    if (error) {
      return send(res, 404, "Not found", { "Content-Type": "text/plain; charset=utf-8" });
    }
    send(res, 200, data, {
      "Content-Type": MIME_TYPES[path.extname(resolved).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
  });
}

function start() {
  ensureStorage();
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) {
      return handleApi(req, res, url.pathname);
    }
    return serveStatic(req, res, decodeURIComponent(url.pathname));
  });

  server.listen(PORT, "127.0.0.1", () => {
    log(`ApplyPilot running at http://127.0.0.1:${PORT}`);
    log(`Data stored in ${DATA_DIR}`);
  });
}

start();
