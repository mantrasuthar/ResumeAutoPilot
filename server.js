const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const net = require("net");
const { spawn } = require("child_process");

const PORT = Number(process.env.PORT || 4757);
const HOST = process.env.HOST || "0.0.0.0";
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const { AsyncLocalStorage } = require('async_hooks');
const asyncLocalStorage = new AsyncLocalStorage();
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, "data"));
const LOG_FILE = path.join(DATA_DIR, "server.log");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const SESSIONS_FILE = path.join(DATA_DIR, "sessions.json");
const APP_PASSWORD = process.env.APP_PASSWORD || "";
const DISABLE_BROWSER_AUTOFILL = process.env.DISABLE_BROWSER_AUTOFILL === "1";

function getUserId() {
  const userId = asyncLocalStorage.getStore();
  if (!userId) throw new Error("No user context");
  return userId;
}

function ensureAuthFiles() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify({}));
  if (!fs.existsSync(SESSIONS_FILE)) fs.writeFileSync(SESSIONS_FILE, JSON.stringify({}));
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return salt + ":" + hash;
}

function verifyPassword(password, stored) {
  const [salt, key] = stored.split(':');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return key === hash;
}


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
  "accessibility", "agile", "analytics", "angular", "api", "aws", "azure", 
  "c#", "c++", "ci/cd", "css", "data visualization", "design systems", 
  "django", "docker", "express", "figma", "flask", "frontend", "git", 
  "github", "go", "graphql", "html", "java", "javascript", "jira", 
  "kubernetes", "machine learning", "node", "node.js", "python", "react", 
  "research", "rest", "ruby", "scrum", "software engineering", "spring", 
  "sql", "tailwind", "typescript", "ui", "user research", "ux", "vue", "webflow"
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

const CANADA_DEFAULT_SOURCES = [
  { name: "7shifts Careers", type: "generic", value: "https://www.7shifts.com/careers/", province: "Saskatchewan/Ontario", country: "Canada", includeIfUnlocated: true },
  { name: "Vendasta Careers", type: "generic", value: "https://www.vendasta.com/careers/", province: "Saskatchewan", country: "Canada", includeIfUnlocated: true },
  { name: "Coconut Software Careers", type: "generic", value: "https://www.coconutsoftware.com/company/careers/", province: "Saskatchewan", country: "Canada", includeIfUnlocated: true },
  { name: "Nutrien Careers", type: "generic", value: "https://www.nutrien.com/careers", province: "Saskatchewan", country: "Canada", includeIfUnlocated: true },
  { name: "Cameco Careers", type: "generic", value: "https://www.cameco.com/careers", province: "Saskatchewan", country: "Canada", includeIfUnlocated: true },
  { name: "SaskPower Careers", type: "generic", value: "https://www.saskpower.com/careers", province: "Saskatchewan", country: "Canada", includeIfUnlocated: true },
  { name: "SaskTel Careers", type: "generic", value: "https://www.sasktel.com/about-us/careers", province: "Saskatchewan", country: "Canada", includeIfUnlocated: true },
  { name: "Federated Co-operatives Careers", type: "generic", value: "https://www.fcl.crs/careers/overview", province: "Saskatchewan", country: "Canada", includeIfUnlocated: true },
  { name: "Conexus Careers", type: "generic", value: "https://www.conexus.ca/about-us/careers", province: "Saskatchewan", country: "Canada", includeIfUnlocated: true },
  { name: "Shopify Careers", type: "generic", value: "https://www.shopify.com/careers", province: "Ontario/Canada", country: "Canada", includeIfUnlocated: false },
  { name: "Wealthsimple Ashby", type: "ashby", value: "wealthsimple", province: "Ontario", country: "Canada", includeIfUnlocated: false },
  { name: "Cohere Ashby", type: "ashby", value: "cohere", province: "Ontario", country: "Canada", includeIfUnlocated: false },
  { name: "Waabi Lever", type: "lever", value: "waabi", province: "Ontario", country: "Canada", includeIfUnlocated: false },
  { name: "D2L Careers", type: "generic", value: "https://www.d2l.com/careers/", province: "Ontario", country: "Canada", includeIfUnlocated: true },
  { name: "Geotab Careers", type: "generic", value: "https://careers.geotab.com/", province: "Ontario", country: "Canada", includeIfUnlocated: true },
  { name: "CGI Canada Careers", type: "generic", value: "https://www.cgi.com/en/careers", province: "Canada", country: "Canada", includeIfUnlocated: true }
];

function ensureStorage() {
  const userId = getUserId();
  const userDir = path.join(DATA_DIR, "users", userId);
  const stateFile = path.join(userDir, "state.json");
  const uploadDir = path.join(userDir, "uploads");
  const profileDir = path.join(userDir, "browser-profiles");
  
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(userDir, { recursive: true });
  fs.mkdirSync(uploadDir, { recursive: true });
  fs.mkdirSync(profileDir, { recursive: true });
  ensureAuthFiles();
  
  if (!fs.existsSync(stateFile)) {
    fs.writeFileSync(stateFile, JSON.stringify(defaultState(), null, 2));
  }
  return { stateFile, uploadDir, profileDir };
}

function defaultState() {
  const now = new Date().toISOString();
  return {
    createdAt: now,
    updatedAt: now,
    preferences: {
      roles: ["Product Designer", "UX Designer", "Frontend Engineer"],
      locations: ["Remote Canada", "Canada", "Saskatchewan", "Ontario", "Toronto", "Saskatoon", "Regina"],
      minimumScore: 55,
      maxQueue: 5,
      reviewBeforeSubmit: true
    },
    resume: null,
    sources: CANADA_DEFAULT_SOURCES.map(makeSource),
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
      authorization: "Authorized to work in Canada",
      sponsorship: "No sponsorship required",
      salary: "",
      availability: "",
      portfolio: ""
    }
  };
}

function makeSource(template) {
  return {
    id: id("source"),
    name: template.name,
    type: template.type,
    value: template.value,
    province: template.province || "",
    country: template.country || "",
    includeIfUnlocated: Boolean(template.includeIfUnlocated),
    enabled: template.enabled !== false,
    lastStatus: "Not scanned yet",
    lastScannedAt: null
  };
}

function readState() {
  const { stateFile } = ensureStorage();
  return JSON.parse(fs.readFileSync(stateFile, "utf8"));
}

function writeState(state) {
  const { stateFile } = ensureStorage();
  state.updatedAt = new Date().toISOString();
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
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

function parseCookies(req) {
  const list = {};
  const rc = req.headers.cookie;
  if (rc) {
    rc.split(';').forEach(cookie => {
      const parts = cookie.split('=');
      list[parts.shift().trim()] = decodeURI(parts.join('='));
    });
  }
  return list;
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  
  if (req.method === "GET" && url.pathname === "/api/health") {
    return sendJson(res, 200, { ok: true, hostedMode: isHostedMode(), browserAutofill: browserAutofillAvailable() });
  }

  if (req.method === "POST" && url.pathname === "/api/auth/login") {
    const body = await readBody(req);
    const { email, password } = JSON.parse(body.toString());
    ensureAuthFiles();
    const users = JSON.parse(fs.readFileSync(USERS_FILE));
    if (!users[email] || !verifyPassword(password, users[email].password)) {
      return sendJson(res, 401, { error: "Invalid credentials" });
    }
    const token = crypto.randomBytes(32).toString("hex");
    const sessions = JSON.parse(fs.readFileSync(SESSIONS_FILE));
    sessions[token] = { userId: users[email].id, expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7 };
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions));
    res.setHeader("Set-Cookie", `ApplyPilotSession=${token}; HttpOnly; Path=/; Max-Age=${60*60*24*7}`);
    return sendJson(res, 200, { ok: true, userId: users[email].id });
  }

  if (req.method === "POST" && url.pathname === "/api/auth/signup") {
    const body = await readBody(req);
    const { email, password } = JSON.parse(body.toString());
    ensureAuthFiles();
    const users = JSON.parse(fs.readFileSync(USERS_FILE));
    if (users[email]) return sendJson(res, 400, { error: "User already exists" });
    const userId = id("user");
    users[email] = { id: userId, password: hashPassword(password), createdAt: new Date().toISOString() };
    fs.writeFileSync(USERS_FILE, JSON.stringify(users));
    
    const token = crypto.randomBytes(32).toString("hex");
    const sessions = JSON.parse(fs.readFileSync(SESSIONS_FILE));
    sessions[token] = { userId, expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7 };
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions));
    res.setHeader("Set-Cookie", `ApplyPilotSession=${token}; HttpOnly; Path=/; Max-Age=${60*60*24*7}`);
    return sendJson(res, 200, { ok: true, userId });
  }

  const cookies = parseCookies(req);
  const token = cookies.ApplyPilotSession;
  let userId = null;
  if (token) {
    ensureAuthFiles();
    const sessions = JSON.parse(fs.readFileSync(SESSIONS_FILE));
    const session = sessions[token];
    if (session && session.expiresAt > Date.now()) {
      userId = session.userId;
    }
  }

  if (req.method === "POST" && url.pathname === "/api/auth/logout") {
    if (token) {
      const sessions = JSON.parse(fs.readFileSync(SESSIONS_FILE));
      delete sessions[token];
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions));
    }
    res.setHeader("Set-Cookie", `ApplyPilotSession=; HttpOnly; Path=/; Max-Age=0`);
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === "GET" && url.pathname === "/api/auth/me") {
    if (!userId) return sendJson(res, 401, { error: "Unauthorized" });
    return sendJson(res, 200, { ok: true, userId });
  }

  if (url.pathname.startsWith("/api/")) {
    if (!userId) return sendJson(res, 401, { error: "Unauthorized" });
    return asyncLocalStorage.run(userId, () => {
      return handleApi(req, res, url.pathname);
    });
  }

  return serveStatic(req, res, decodeURIComponent(url.pathname));
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

async function plainTextFromBuffer(file) {
  const ext = path.extname(file.filename).toLowerCase();
  if (ext === ".txt" || file.mime.startsWith("text/")) {
    return {
      text: file.buffer.toString("utf8"),
      quality: "full"
    };
  }

  if (ext === ".pdf") {
    try {
      const pdfModule = require("pdf-parse");
      const pdfParse = typeof pdfModule === "function" ? pdfModule : (pdfModule.PDFParse || pdfModule.default || pdfModule);
      const data = await pdfParse(file.buffer);
      return {
        text: data.text,
        quality: "parsed"
      };
    } catch (err) {
      console.error("PDF parse error:", err);
      const rough = file.buffer
        .toString("latin1")
        .replace(/[^\x09\x0a\x0d\x20-\x7e]/g, " ")
        .replace(/\s+/g, " ");
      return {
        text: rough,
        quality: "rough-pdf"
      };
    }
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
    "canada",
    "remote canada",
    "saskatchewan",
    "saskatoon",
    "regina",
    "ontario",
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
    "ottawa",
    "waterloo",
    "kitchener",
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
  if (source.type === "linkedin") return scanLinkedin(source);
  if (source.type === "remotive") return scanRemotive(source);
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
    sourceCountry: source.country || "",
    sourceProvince: source.province || "",
    includeIfUnlocated: Boolean(source.includeIfUnlocated),
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
    sourceCountry: source.country || "",
    sourceProvince: source.province || "",
    includeIfUnlocated: Boolean(source.includeIfUnlocated),
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
    location: [formatAshbyLocation(job.location), ...(job.secondaryLocations || []).map(formatAshbyLocation)].filter(Boolean).join(", "),
    department: job.department || "",
    sourceId: source.id,
    sourceName: source.name,
    sourceType: source.type,
    sourceCountry: source.country || "",
    sourceProvince: source.province || "",
    includeIfUnlocated: Boolean(source.includeIfUnlocated),
    url: job.jobUrl || "",
    applyUrl: job.applyUrl || job.jobUrl || "",
    postedAt: job.publishedAt || null,
    description: stripHtml(job.descriptionHtml || job.descriptionPlain || ""),
    raw: {}
  }));
}

function formatAshbyLocation(loc) {
  if (!loc) return "";
  if (typeof loc === "string") return loc;
  if (loc.locationName) return loc.locationName;
  if (loc.address) return [loc.address.city, loc.address.region, loc.address.country].filter(Boolean).join(", ");
  return "";
}

async function scanLinkedin(source) {
  const keywords = encodeURIComponent(source.value.trim());
  const location = encodeURIComponent(source.country || source.province || "Worldwide");
  const url = `https://www.linkedin.com/jobs/search?keywords=${keywords}&location=${location}`;
  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error(`LinkedIn returned ${response.status}`);
  const html = await response.text();
  
  const jobs = [];
  const cards = html.split('class="base-search-card__info"');
  for (let i = 1; i < cards.length; i++) {
    if (i > 50) break; // Limit to 50 jobs
    const chunk = cards[i];
    
    const titleMatch = chunk.match(/<h3 class="base-search-card__title">\s*(.*?)\s*<\/h3>/s);
    const title = titleMatch ? titleMatch[1].trim() : "Untitled role";
    
    const companyMatch = chunk.match(/<h4 class="base-search-card__subtitle">[\s\S]*?<a[^>]*>\s*(.*?)\s*<\/a>[\s\S]*?<\/h4>/s);
    const company = companyMatch ? companyMatch[1].trim() : source.name;
    
    const locationMatch = chunk.match(/<span class="job-search-card__location">\s*(.*?)\s*<\/span>/s);
    const loc = locationMatch ? locationMatch[1].trim() : "";
    
    const prevChunk = cards[i-1];
    const urlMatch = prevChunk.match(/href="([^"]+)"[^>]*class="base-card__full-link/i);
    const jobUrl = urlMatch ? urlMatch[1].split('?')[0] : "";
    
    const timeMatch = chunk.match(/<time[^>]*datetime="([^"]+)"/);
    const postedAt = timeMatch ? timeMatch[1] : null;
    
    jobs.push({
      externalId: jobUrl || `${company}-${title}-${i}`,
      title,
      company,
      location: loc,
      department: "LinkedIn Jobs",
      sourceId: source.id,
      sourceName: source.name,
      sourceType: source.type,
      sourceCountry: source.country || "",
      sourceProvince: source.province || "",
      includeIfUnlocated: Boolean(source.includeIfUnlocated),
      url: jobUrl,
      applyUrl: jobUrl,
      postedAt
    });
  }
  return jobs;
}

async function scanRemotive(source) {
  const url = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(source.value.trim())}&limit=50`;
  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error(`Remotive returned ${response.status}`);
  const data = await response.json();
  
  return (data.jobs || []).slice(0, 50).map(job => ({
    externalId: String(job.id || job.url),
    title: job.title || "Untitled role",
    company: job.company_name || source.name,
    location: job.candidate_required_location || "Worldwide",
    department: job.category || "",
    sourceId: source.id,
    sourceName: source.name,
    sourceType: source.type,
    sourceCountry: source.country || "",
    sourceProvince: source.province || "",
    includeIfUnlocated: Boolean(source.includeIfUnlocated),
    url: job.url || "",
    applyUrl: job.url || "",
    postedAt: job.publication_date || null
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
            sourceCountry: source.country || "",
            sourceProvince: source.province || "",
            includeIfUnlocated: Boolean(source.includeIfUnlocated),
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
      sourceCountry: source.country || "",
      sourceProvince: source.province || "",
      includeIfUnlocated: Boolean(source.includeIfUnlocated),
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

function hasCanadaSignal(job) {
  const text = regionText(job);
  return [
    /\bcanada\b/,
    /\bcanadian\b/,
    /\bremote\s*[-–—]?\s*canada\b/,
    /\bcanada\s*remote\b/,
    /\bsaskatchewan\b/,
    /\bsaskatoon\b/,
    /\bregina\b/,
    /\bprince albert\b/,
    /\bmoose jaw\b/,
    /\bontario\b/,
    /\btoronto\b/,
    /\bottawa\b/,
    /\bwaterloo\b/,
    /\bkitchener\b/,
    /\bmississauga\b/,
    /\bmarkham\b/,
    /\boakville\b/,
    /\bhamilton\b/,
    /\blondon,?\s+ontario\b/,
    /\bguelph\b/,
    /\bvancouver\b/,
    /\bbritish columbia\b/,
    /\bmontreal\b/,
    /\bmontréal\b/,
    /\bquebec\b/,
    /\bcalgary\b/,
    /\bedmonton\b/,
    /\bwinnipeg\b/,
    /\btoronto,\s*on\b/,
    /\bottawa,\s*on\b/,
    /\bsaskatoon,\s*sk\b/,
    /\bregina,\s*sk\b/
  ].some(pattern => pattern.test(text));
}

function hasUsSignal(job) {
  const text = regionText(job);
  return [
    /\bunited states\b/,
    /\bremote\s*[-–—]?\s*us\b/,
    /\bremote\s*[-–—]?\s*usa\b/,
    /\bus only\b/,
    /\busa\b/,
    /\bsan francisco\b/,
    /\bnew york\b/,
    /\bseattle\b/,
    /\bdallas\b/,
    /\bphoenix\b/,
    /\bpittsburgh\b/,
    /\bcalifornia\b/,
    /\btexas\b/,
    /\bwashington,\s*dc\b/,
    /\bnyc\b/,
    /\bca\b.*\busa\b/
  ].some(pattern => pattern.test(text));
}

function regionText(job) {
  return `${job.title || ""} ${job.company || ""} ${job.location || ""} ${job.department || ""} ${job.description || ""}`.toLowerCase();
}

const REMOTE_LOCATION_PATTERNS = [
  /\bremote\b/,
  /\bworldwide\b/,
  /\bglobal\b/,
  /\banywhere\b/
];

const CANADA_LOCATION_TERMS = [
  "canada", "canadian", "remote canada", "saskatchewan", "saskatoon", "regina",
  "ontario", "toronto", "ottawa", "waterloo", "kitchener", "mississauga",
  "vancouver", "montreal", "quebec", "calgary", "edmonton", "winnipeg"
];

const INDIA_LOCATION_TERMS = [
  "india", "ind", "remote india", "bangalore", "bengaluru", "hyderabad",
  "mumbai", "pune", "delhi", "new delhi", "gurugram", "gurgaon", "noida",
  "chennai", "kolkata", "ahmedabad"
];

function locationIntent(value) {
  const raw = String(value || "").trim().toLowerCase();
  const terms = importantTerms(raw);
  const text = ` ${raw} `;
  const wantsRemote = REMOTE_LOCATION_PATTERNS.some(pattern => pattern.test(text));
  const wantsCanada = hasTermOverlap(text, CANADA_LOCATION_TERMS) || terms.includes("ca");
  const wantsIndia = hasTermOverlap(text, INDIA_LOCATION_TERMS);
  return {
    raw,
    terms,
    hasExplicitLocation: Boolean(raw),
    wantsRemote,
    wantsCanada,
    wantsIndia
  };
}

function hasTermOverlap(text, terms) {
  return terms.some(term => text.includes(term));
}

function hasRemoteSignal(job) {
  const text = regionText(job);
  return REMOTE_LOCATION_PATTERNS.some(pattern => pattern.test(text));
}

function jobMatchesLocationIntent(job, intent) {
  if (!intent?.hasExplicitLocation) return isCanadaRelevantJob(job);
  if (intent.wantsCanada) return isCanadaRelevantJob(job) || (intent.wantsRemote && hasRemoteSignal(job));

  const text = regionText(job);
  if (intent.wantsIndia && hasTermOverlap(text, INDIA_LOCATION_TERMS)) return true;
  if (intent.terms.some(term => term.length > 1 && text.includes(term))) return true;
  if (intent.wantsRemote && hasRemoteSignal(job)) return true;
  if (!String(job.location || "").trim() && job.includeIfUnlocated) {
    const sourceText = `${job.sourceCountry || ""} ${job.sourceProvince || ""} ${job.sourceName || ""}`.toLowerCase();
    if (!sourceText.trim()) return true;
    if (intent.wantsIndia && hasTermOverlap(sourceText, INDIA_LOCATION_TERMS)) return true;
    if (intent.terms.some(term => term.length > 1 && sourceText.includes(term))) return true;
  }
  return false;
}

function isCanadaRelevantJob(job) {
  if (String(job.location || "").trim()) {
    const locationOnly = { location: job.location };
    if (hasCanadaSignal(locationOnly)) return true;
    if (hasUsSignal(locationOnly)) return false;
  }
  if (hasCanadaSignal(job)) return true;
  if (hasUsSignal(job)) return false;
  if (job.includeIfUnlocated && String(job.sourceCountry || "").toLowerCase() === "canada") return true;
  return false;
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

function upsertJobs(state, scannedJobs, options = {}) {
  const existing = new Map(state.jobs.map(job => [job.id, job]));
  const nextJobs = [...state.jobs];
  let added = 0;
  let updated = 0;
  const intent = locationIntent(options.targetLocation || "");

  for (const scanned of scannedJobs.filter(job => jobMatchesLocationIntent(job, intent))) {
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
    .sort((a, b) => b.score - a.score || dateValue(b.postedAt) - dateValue(a.postedAt));

  return { added, updated };
}

function buildTargetedSources(target) {
  const role = String(target.role || "").trim();
  const company = String(target.company || "").trim();
  const location = String(target.location || "").trim();
  const query = [role, company].filter(Boolean).join(" ").trim() || role || company || "jobs";
  if (!query && !location) return [];

  const locationLabel = location || "Worldwide";
  const suffix = hash(`${query}:${locationLabel}`).slice(0, 8);
  const sources = [
    {
      id: `target_linkedin_${suffix}`,
      name: `LinkedIn targeted: ${query || "jobs"} in ${locationLabel}`,
      type: "linkedin",
      value: query || "jobs",
      country: locationLabel,
      province: "",
      includeIfUnlocated: true,
      enabled: true,
      transient: true
    }
  ];

  if (/remote|worldwide|global|anywhere/i.test(locationLabel) || !location) {
    sources.push({
      id: `target_remotive_${suffix}`,
      name: `Remote targeted: ${query || "jobs"}`,
      type: "remotive",
      value: query || "jobs",
      country: locationLabel,
      province: "",
      includeIfUnlocated: true,
      enabled: true,
      transient: true
    });
  }

  return sources;
}

async function performScan(state, options = {}) {
  const scannedJobs = [];
  const results = [];
  const sources = [
    ...state.sources,
    ...(options.extraSources || [])
  ];

  for (const source of sources) {
    if (!source.enabled) continue;
    try {
      const jobs = await scanSource(source);
      scannedJobs.push(...jobs);
      if (!source.transient) {
        source.lastStatus = `Found ${jobs.length} job${jobs.length === 1 ? "" : "s"}`;
        source.lastScannedAt = new Date().toISOString();
      }
      results.push({ sourceId: source.id, ok: true, count: jobs.length });
    } catch (error) {
      const status = error.message || "Scan failed";
      if (!source.transient) {
        source.lastStatus = status;
        source.lastScannedAt = new Date().toISOString();
      }
      results.push({ sourceId: source.id, ok: false, error: status });
    }
  }

  const upsert = upsertJobs(state, scannedJobs, { targetLocation: options.targetLocation });
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
    .filter(job => !state.queue.some(item => item.jobId === job.id && item.status !== "skipped"))
    .map(job => ({ job, targetScore: scoreTargetFit(job, roleTerms, companyTerms, locationTerms) }))
    .filter(result => result.targetScore > 0)
    .filter(result => result.job.score >= minScore || result.targetScore >= 14)
    .sort((a, b) => b.targetScore - a.targetScore || b.job.score - a.job.score || dateValue(b.job.postedAt) - dateValue(a.job.postedAt))
    .map(result => result.job);
}

function buildAutofillPayload(state, item) {
  const resume = state.resume || {};
  const answers = item.answers || state.answerBank || {};
  const nameGuess = guessName(resume);
  return {
    fullName: nameGuess.fullName,
    firstName: nameGuess.firstName,
    lastName: nameGuess.lastName,
    email: resume.email || answers.email || "",
    phone: resume.phone || answers.phone || "",
    location: item.location || state.preferences.locations?.[0] || "Canada",
    country: "Canada",
    authorization: answers.authorization || "Authorized to work in Canada",
    sponsorship: answers.sponsorship || "No sponsorship required",
    salary: answers.salary || "",
    availability: answers.availability || "",
    portfolio: answers.portfolio || "",
    coverNote: item.coverNote || "",
    jobTitle: item.title,
    company: item.company
  };
}

function guessName(resume) {
  const preview = String(resume.preview || "").replace(/\s+/g, " ").trim();
  const filename = String(resume.filename || "").replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
  const source = preview && !preview.startsWith("%PDF") ? preview : filename;
  const words = source.split(/\s+/).filter(word => /^[A-Za-z][A-Za-z.'-]+$/.test(word)).slice(0, 3);
  const firstName = words[0] || "";
  const lastName = words.length > 1 ? words[words.length - 1] : "";
  return {
    firstName,
    lastName,
    fullName: [firstName, lastName].filter(Boolean).join(" ")
  };
}

async function openAndAutofillApplication(state, item) {
  if (!item.applyUrl) throw new Error("This queue item does not have an application URL.");
  if (!browserAutofillAvailable()) {
    throw new Error("Browser autofill is available only on the local desktop app. Hosted deployments can prepare drafts and open official links, but they cannot control your local browser.");
  }
  const browserPath = findBrowserExecutable();
  if (!browserPath) throw new Error("Could not find Microsoft Edge or Google Chrome on this machine.");
  if (typeof WebSocket === "undefined") throw new Error("This Node runtime does not include WebSocket support for browser automation.");

  const port = await findFreePort();
  const { profileDir: userProfileDir } = ensureStorage();
  const profileDir = path.join(userProfileDir, item.id);
  fs.mkdirSync(profileDir, { recursive: true });

  const browser = spawn(browserPath, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--new-window",
    item.applyUrl
  ], {
    detached: true,
    stdio: "ignore"
  });
  browser.unref();

  const target = await waitForBrowserTarget(port, item.applyUrl);
  await sleep(2800);
  const clickResult = await cdpEvaluate(target.webSocketDebuggerUrl, buildApplyClickScript());
  if (clickResult?.clicked) await sleep(3200);

  const payload = buildAutofillPayload(state, item);
  const fillResult = await cdpEvaluate(target.webSocketDebuggerUrl, buildAutofillScript(payload));
  return {
    browser: path.basename(browserPath),
    port,
    openedUrl: item.applyUrl,
    clickedApply: clickResult?.clicked || false,
    clickedApplyText: clickResult?.text || "",
    ...fillResult
  };
}

function findBrowserExecutable() {
  const local = process.env.LOCALAPPDATA || "";
  const programFiles = process.env.ProgramFiles || "C:\\Program Files";
  const programFilesX86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
  const candidates = [
    path.join(programFilesX86, "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(programFiles, "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
    path.join(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
    local ? path.join(local, "Google", "Chrome", "Application", "chrome.exe") : ""
  ].filter(Boolean);
  return candidates.find(candidate => fs.existsSync(candidate)) || "";
}

function isHostedMode() {
  return process.env.HOSTED_MODE === "1"
    || process.env.RENDER === "true"
    || Boolean(process.env.RAILWAY_ENVIRONMENT)
    || Boolean(process.env.FLY_APP_NAME)
    || process.env.NODE_ENV === "production";
}

function browserAutofillAvailable() {
  return !DISABLE_BROWSER_AUTOFILL
    && !isHostedMode()
    && typeof WebSocket !== "undefined"
    && Boolean(findBrowserExecutable());
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForBrowserTarget(port, url) {
  const startedAt = Date.now();
  let lastError = null;
  while (Date.now() - startedAt < 15000) {
    try {
      const targets = await fetchJson(`http://127.0.0.1:${port}/json/list`);
      const page = targets.find(target => target.type === "page" && target.webSocketDebuggerUrl && target.url && target.url !== "about:blank")
        || targets.find(target => target.type === "page" && target.webSocketDebuggerUrl);
      if (page) return page;
    } catch (error) {
      lastError = error;
    }
    await sleep(350);
  }
  throw new Error(`Browser automation did not become ready for ${url}. ${lastError?.message || ""}`.trim());
}

async function fetchJson(url) {
  const response = await fetchWithTimeout(url, {}, 5000);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function cdpEvaluate(webSocketUrl, expression) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(webSocketUrl);
    const callbacks = new Map();
    let id = 0;
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error("Timed out while talking to the browser."));
    }, 15000);

    socket.addEventListener("open", () => {
      const requestId = ++id;
      callbacks.set(requestId, { resolve, reject });
      socket.send(JSON.stringify({
        id: requestId,
        method: "Runtime.evaluate",
        params: {
          expression,
          awaitPromise: true,
          returnByValue: true
        }
      }));
    });

    socket.addEventListener("message", event => {
      const message = JSON.parse(event.data);
      if (!message.id || !callbacks.has(message.id)) return;
      const callback = callbacks.get(message.id);
      callbacks.delete(message.id);
      clearTimeout(timer);
      socket.close();
      if (message.error) {
        callback.reject(new Error(message.error.message || "Browser evaluation failed."));
        return;
      }
      if (message.result?.exceptionDetails) {
        callback.reject(new Error(message.result.exceptionDetails.text || "Browser script failed."));
        return;
      }
      callback.resolve(message.result?.result?.value || {});
    });

    socket.addEventListener("error", () => {
      clearTimeout(timer);
      reject(new Error("Could not connect to browser automation."));
    });
  });
}

function buildApplyClickScript() {
  return `(() => {
    const visible = el => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
    const fillables = [...document.querySelectorAll("input, textarea, select")].filter(el => {
      const type = (el.type || "").toLowerCase();
      return visible(el) && !el.disabled && !el.readOnly && !["hidden", "button", "submit", "reset", "file"].includes(type);
    });
    if (fillables.length) return { clicked: false, reason: "form-visible" };
    const actions = [...document.querySelectorAll("a, button")].filter(visible).map(el => ({
      el,
      text: (el.innerText || el.textContent || el.getAttribute("aria-label") || "").trim(),
      href: el.href || ""
    }));
    const action = actions.find(item => /^(apply|apply now|apply for this job|start application)$/i.test(item.text));
    if (!action) return { clicked: false, reason: "no-apply-action" };
    action.el.click();
    return { clicked: true, text: action.text, href: action.href };
  })()`;
}

function buildAutofillScript(payload) {
  const data = JSON.stringify(payload).replace(/</g, "\\u003c");
  return `(() => {
    const payload = ${data};
    const filled = [];
    const skipped = [];
    const warnings = [];

    const visible = el => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
    const textOf = value => String(value || "").replace(/\\s+/g, " ").trim();
    const labelsFor = el => {
      const parts = [
        el.getAttribute("aria-label"),
        el.getAttribute("placeholder"),
        el.getAttribute("name"),
        el.id,
        el.autocomplete
      ];
      if (el.id) {
        document.querySelectorAll("label").forEach(label => {
          if (label.getAttribute("for") === el.id) parts.push(label.innerText || label.textContent);
        });
      }
      const wrappingLabel = el.closest("label");
      if (wrappingLabel) parts.push(wrappingLabel.innerText || wrappingLabel.textContent);
      let container = el.parentElement;
      for (let i = 0; i < 3 && container; i++) {
        const text = (container.innerText || container.textContent || "").trim();
        if (text && text.length < 200) parts.push(text);
        container = container.parentElement;
      }
      return textOf(parts.filter(Boolean).join(" ")).toLowerCase();
    };
    const setValue = (el, value) => {
      if (!value) return false;
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
      if (descriptor?.set) descriptor.set.call(el, value);
      else el.value = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.style.outline = "3px solid #00e5ff";
      el.style.outlineOffset = "1px";
      return true;
    };
    const matchValue = (descriptor, type) => {
      if (/e-?mail|email/.test(descriptor)) return payload.email;
      if (/phone|mobile|telephone/.test(descriptor)) return payload.phone;
      if (/first\\s*name|given\\s*name/.test(descriptor)) return payload.firstName;
      if (/last\\s*name|family\\s*name|surname/.test(descriptor)) return payload.lastName;
      if (/full\\s*name|your\\s*name|name/.test(descriptor) && !/company|employer|school/.test(descriptor)) return payload.fullName;
      if (/portfolio|website|personal\\s*site|linkedin|github/.test(descriptor)) return payload.portfolio;
      if (/cover|message|additional\\s*information|why.*interested|note/.test(descriptor)) return payload.coverNote;
      if (/salary|compensation|pay/.test(descriptor)) return payload.salary;
      if (/available|start\\s*date|notice/.test(descriptor)) return payload.availability;
      if (/location|city|province|state/.test(descriptor)) return payload.location;
      if (/country/.test(descriptor)) return payload.country;
      if (/work.*authori|authori.*work|legally.*work/.test(descriptor)) return payload.authorization;
      if (/sponsor|visa/.test(descriptor)) return payload.sponsorship;
      if (type === "email") return payload.email;
      if (type === "tel") return payload.phone;
      return "";
    };
    const chooseSelect = (el, descriptor) => {
      const options = [...el.options];
      const wants = [];
      if (/country/.test(descriptor)) wants.push("canada");
      if (/sponsor|visa/.test(descriptor)) wants.push("no", "not require", "do not");
      if (/work.*authori|authori.*work|legally.*work/.test(descriptor)) wants.push("yes", "authorized", "canada");
      if (!wants.length) return false;
      const option = options.find(opt => wants.some(want => textOf(opt.textContent).toLowerCase().includes(want)));
      if (!option) return false;
      el.value = option.value;
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.style.outline = "3px solid #00e5ff";
      filled.push({ field: descriptor.slice(0, 80), value: textOf(option.textContent) });
      return true;
    };
    const chooseBoolean = (el, descriptor) => {
      const value = textOf(el.value || el.getAttribute("aria-label") || "").toLowerCase();
      const surrounding = descriptor + " " + value;
      if (/sponsor|visa/.test(surrounding) && /(^|\\b)(no|not require|do not)(\\b|$)/.test(surrounding)) {
        el.click();
        return true;
      }
      if (/work.*authori|authori.*work|legally.*work/.test(surrounding) && /(^|\\b)(yes|authorized|canada)(\\b|$)/.test(surrounding)) {
        el.click();
        return true;
      }
      return false;
    };

    const fields = [...document.querySelectorAll("input, textarea, select")].filter(el => visible(el) && !el.disabled);
    for (const el of fields) {
      const type = (el.type || el.tagName || "").toLowerCase();
      const descriptor = labelsFor(el);
      if (!descriptor) continue;
      if (type === "file") {
        warnings.push("Resume/file upload field detected; left for manual review.");
        continue;
      }
      if (el.tagName === "SELECT") {
        if (!chooseSelect(el, descriptor)) skipped.push({ field: descriptor.slice(0, 80), reason: "no matching select option" });
        continue;
      }
      if (["checkbox", "radio"].includes(type)) {
        if (chooseBoolean(el, descriptor)) filled.push({ field: descriptor.slice(0, 80), value: "selected" });
        continue;
      }
      if (["hidden", "submit", "button", "reset"].includes(type) || el.readOnly) continue;
      const value = matchValue(descriptor, type);
      if (setValue(el, value)) filled.push({ field: descriptor.slice(0, 80), value: value.length > 60 ? value.slice(0, 57) + "..." : value });
      else skipped.push({ field: descriptor.slice(0, 80), reason: "no safe value" });
    }

    let banner = document.querySelector("#applypilot-autofill-banner");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "applypilot-autofill-banner";
      document.documentElement.appendChild(banner);
    }
    banner.textContent = "ApplyPilot filled " + filled.length + " field(s). Review everything. File uploads, CAPTCHA, custom questions, and final submit are manual.";
    Object.assign(banner.style, {
      position: "fixed",
      zIndex: "2147483647",
      left: "24px",
      right: "24px",
      bottom: "24px",
      padding: "16px 20px",
      background: "rgba(18, 20, 27, 0.95)",
      color: "#f0f1f5",
      border: "1px solid #00e5ff",
      backdropFilter: "blur(12px)",
      font: "500 14px/1.4 'Inter', -apple-system, sans-serif",
      borderRadius: "12px",
      boxShadow: "0 8px 32px rgba(0,0,0,0.8), 0 0 16px rgba(0, 229, 255, 0.1)"
    });
    return { filled, skipped: skipped.slice(0, 12), warnings };
  })()`;
}

function scoreTargetFit(job, roleTerms, companyTerms, locationTerms) {
  const title = String(job.title || "").toLowerCase();
  const company = String(job.company || "").toLowerCase();
  const location = String(job.location || "").toLowerCase();
  const allText = `${title} ${company} ${location} ${job.department || ""} ${job.description || ""}`.toLowerCase();
  let score = 1;

  if (roleTerms.length) {
    const titleMatches = roleTerms.filter(term => termMatches(title, term)).length;
    const textMatches = roleTerms.filter(term => termMatches(allText, term)).length;
    const requiredMatches = Math.max(1, Math.ceil(roleTerms.length * 0.5));
    if (!titleMatches && textMatches < requiredMatches) return 0;
    score += titleMatches * 14 + textMatches * 3;
  }

  if (companyTerms.length) {
    const companyMatches = companyTerms.filter(term => termMatches(company, term)).length;
    if (!companyMatches) return 0;
    score += companyMatches * 14;
  }

  if (locationTerms.length) {
    const intent = locationIntent(locationTerms.join(" "));
    if (!jobMatchesLocationIntent(job, intent)) return 0;
    const locationMatches = locationTerms.filter(term => termMatches(location, term) || termMatches(allText, term)).length;
    score += Math.max(1, locationMatches) * 8;
  }

  return score;
}

function termMatches(text, term) {
  if (!term) return false;
  if (text.includes(term)) return true;
  const compactText = text.replace(/[^a-z0-9+#]+/g, "");
  const compactTerm = term.replace(/[^a-z0-9+#]+/g, "");
  return compactTerm.length > 2 && compactText.includes(compactTerm);
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
    capabilities: {
      hostedMode: isHostedMode(),
      browserAutofill: browserAutofillAvailable()
    },
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
      const { uploadDir } = ensureStorage();
      fs.writeFileSync(path.join(uploadDir, savedName), file.buffer);
      const extracted = await plainTextFromBuffer(file);
      const parsed = parseResume(extracted.text, {
        ...file,
        quality: extracted.quality
      });
      parsed.savedPath = path.join("data", "users", getUserId(), "uploads", savedName);

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

    if (req.method === "DELETE" && pathname === "/api/resume") {
      const state = readState();
      state.resume = null;
      state.jobs = state.jobs.map(job => {
        const match = scoreJob(job, null, state.preferences);
        return {
          ...job,
          score: match.score,
          matchedSkills: match.matchedSkills,
          matchedKeywords: match.matchedKeywords,
          roleMatches: match.roleMatches,
          locationMatches: match.locationMatches,
          status: "low-match"
        };
      }).sort((a, b) => b.score - a.score);
      addActivity(state, "Resume removed.");
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
        country: String(body.country || "").trim(),
        province: String(body.province || "").trim(),
        includeIfUnlocated: Boolean(body.includeIfUnlocated),
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
        country: body.country ?? source.country,
        province: body.province ?? source.province,
        includeIfUnlocated: body.includeIfUnlocated ?? source.includeIfUnlocated,
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
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      const interval = setInterval(() => res.write(" "), 3000); // Keep connection alive
      try {
        const state = readState();
        const scan = await performScan(state);
        addActivity(state, `Scan complete. ${scan.added} new jobs, ${scan.updated} updated.`);
        writeState(state);
        clearInterval(interval);
        res.end(JSON.stringify({ ...publicState(state), scan }));
      } catch (err) {
        clearInterval(interval);
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
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
        scan = await performScan(state, {
          targetLocation: target.location,
          extraSources: buildTargetedSources(target)
        });
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
    if (queueMatch && req.method === "POST" && queueMatch[2] === "autofill") {
      const state = readState();
      const body = await readJson(req);
      const item = state.queue.find(entry => entry.id === queueMatch[1]);
      if (!item) return sendJson(res, 404, { error: "Queue item not found." });

      const payload = buildAutofillPayload(state, item);
      if (body.dryRun === true) {
        return sendJson(res, 200, {
          queueItem: {
            id: item.id,
            title: item.title,
            company: item.company,
            applyUrl: item.applyUrl
          },
          payload,
          safety: "Dry run only. No browser was opened and no form was filled."
        });
      }

      const result = await openAndAutofillApplication(state, item);
      item.status = "autofilled";
      item.autofilledAt = new Date().toISOString();
      item.audit = [
        ...(item.audit || []),
        {
          at: item.autofilledAt,
          message: `Opened official application page and autofilled ${result.filled?.length || 0} field(s). Final submit left for manual review.`
        }
      ];
      addActivity(state, `Opened and autofilled application page for ${item.title} at ${item.company}.`);
      writeState(state);
      return sendJson(res, 200, { ...publicState(state), autofill: result });
    }

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
  const server = http.createServer((req, res) => handleRequest(req, res).catch(err => { console.error(err); sendJson(res, 500, {error: "Internal Server Error"}); }));

  server.listen(PORT, HOST, () => {
    const shownHost = HOST === "0.0.0.0" ? "127.0.0.1" : HOST;
    log(`ApplyPilot running at http://${shownHost}:${PORT}`);
    log(`Data stored in ${DATA_DIR}`);
  });
}

start();
