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
const AUTH_SECRET = process.env.AUTH_SECRET || process.env.APP_PASSWORD || "applypilot-dev-auth-secret-change-me";
const DISABLE_BROWSER_AUTOFILL = process.env.DISABLE_BROWSER_AUTOFILL === "1";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

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

function base64UrlEncode(value) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signValue(value) {
  return crypto.createHmac("sha256", AUTH_SECRET).update(value).digest("base64url");
}

function createSessionToken(userId, email) {
  const payload = base64UrlEncode(JSON.stringify({
    userId,
    email,
    exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000
  }));
  return `${payload}.${signValue(payload)}`;
}

function readSignedSession(token) {
  if (!token || !token.includes(".")) return null;
  const [payload, signature] = token.split(".");
  const expected = signValue(payload);
  if (signature.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const session = JSON.parse(base64UrlDecode(payload));
    if (!session.userId || !session.exp || session.exp <= Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

function isHttpsRequest(req) {
  return String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim() === "https";
}

function setSessionCookie(req, res, token) {
  const attrs = [
    `ApplyPilotSession=${encodeURIComponent(token)}`,
    "HttpOnly",
    "Path=/",
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
    "SameSite=Lax"
  ];
  if (isHttpsRequest(req)) attrs.push("Secure");
  res.setHeader("Set-Cookie", attrs.join("; "));
}

function clearSessionCookie(req, res) {
  const attrs = [
    "ApplyPilotSession=",
    "HttpOnly",
    "Path=/",
    "Max-Age=0",
    "SameSite=Lax"
  ];
  if (isHttpsRequest(req)) attrs.push("Secure");
  res.setHeader("Set-Cookie", attrs.join("; "));
}


process.stdout?.on?.("error", () => {});
process.stderr?.on?.("error", () => {});

const ROLE_HINTS = [
  "software developer",
  "product designer",
  "ux designer",
  "ui designer",
  "ux researcher",
  "frontend engineer",
  "frontend developer",
  "front end developer",
  "backend engineer",
  "backend developer",
  "back end developer",
  "full stack developer",
  "full stack engineer",
  "web developer",
  "react developer",
  "node developer",
  "python developer",
  "java developer",
  "software engineer",
  "qa engineer",
  "quality assurance analyst",
  "devops engineer",
  "cloud engineer",
  "product manager",
  "project manager",
  "business analyst",
  "data analyst",
  "data scientist",
  "machine learning engineer",
  "marketing manager",
  "customer success",
  "sales engineer",
  "operations manager",
  "operations coordinator",
  "administrative assistant",
  "customer service representative",
  "sales representative",
  "supply chain analyst",
  "procurement specialist",
  "mechanical engineer",
  "mechanical designer",
  "manufacturing engineer",
  "quality engineer",
  "electrical engineer",
  "civil engineer",
  "graphic designer",
  "digital marketing specialist"
];

const SKILL_ALIASES = {
  "Accessibility": ["accessibility", "wcag"],
  "Agile": ["agile"],
  "Analytics": ["analytics"],
  "Angular": ["angular", "angular.js", "angularjs"],
  "ANSYS": ["ansys"],
  "API": ["api", "apis"],
  "AutoCAD": ["autocad", "auto cad"],
  "AWS": ["aws", "amazon web services"],
  "Azure": ["azure", "microsoft azure"],
  "C#": ["c#", "c sharp"],
  "C++": ["c++"],
  "CATIA": ["catia"],
  "CI/CD": ["ci/cd", "continuous integration", "continuous delivery"],
  "CNC": ["cnc", "computer numerical control"],
  "Creo": ["creo", "pro/engineer"],
  "CRM": ["crm", "customer relationship management"],
  "CSS": ["css", "css3"],
  "Data visualization": ["data visualization", "data visualisation"],
  "Design systems": ["design system", "design systems"],
  "Django": ["django"],
  "Docker": ["docker"],
  "Excel": ["excel", "microsoft excel", "ms excel"],
  "Express": ["express", "express.js", "expressjs"],
  "FEA": ["fea", "finite element analysis"],
  "Figma": ["figma"],
  "Flask": ["flask"],
  "Fusion 360": ["fusion 360"],
  "GD&T": ["gd&t", "geometric dimensioning and tolerancing"],
  "Git": ["git"],
  "GitHub": ["github"],
  "Go": ["golang", "go language"],
  "GraphQL": ["graphql"],
  "HTML": ["html", "html5"],
  "Inventory management": ["inventory management", "inventory control"],
  "Java": ["java"],
  "JavaScript": ["javascript", "ecmascript"],
  "Jira": ["jira"],
  "Kubernetes": ["kubernetes", "k8s"],
  "Laravel": ["laravel"],
  "Lean manufacturing": ["lean manufacturing", "lean principles"],
  "Machine learning": ["machine learning"],
  "MATLAB": ["matlab"],
  "MongoDB": ["mongodb", "mongo db"],
  "MySQL": ["mysql"],
  "Node.js": ["node.js", "nodejs"],
  "NX": ["siemens nx", "nx cad"],
  "Operations": ["operations management", "business operations"],
  "PHP": ["php"],
  "PostgreSQL": ["postgresql", "postgres"],
  "Power BI": ["power bi", "powerbi"],
  "Procurement": ["procurement", "purchasing"],
  "Project management": ["project management", "project planning"],
  "Python": ["python"],
  "Quality control": ["quality control", "quality management", "quality assurance"],
  "React": ["react", "react.js", "reactjs"],
  "Redis": ["redis"],
  "Revit": ["revit"],
  "REST": ["rest api", "restful"],
  "Ruby": ["ruby"],
  "Salesforce": ["salesforce"],
  "SAP": ["sap"],
  "Scrum": ["scrum"],
  "Simulink": ["simulink"],
  "Six Sigma": ["six sigma"],
  "SolidWorks": ["solidworks", "solid works"],
  "Spring": ["spring boot", "spring framework"],
  "SQL": ["sql", "structured query language"],
  "Supply chain": ["supply chain", "logistics"],
  "Tableau": ["tableau"],
  "Tailwind CSS": ["tailwind", "tailwind css"],
  "Terraform": ["terraform"],
  "TypeScript": ["typescript"],
  "UI design": ["ui design", "user interface design"],
  "User research": ["user research", "usability testing"],
  "UX design": ["ux design", "user experience design"],
  "Vue": ["vue", "vue.js", "vuejs"],
  "Webflow": ["webflow"]
};

const RESUME_STOP_WORDS = new Set([
  "about", "after", "also", "among", "and", "are", "been", "being", "can", "company",
  "contact", "education", "email", "experience", "for", "from", "have", "into", "more",
  "objective", "professional", "profile", "resume", "skills", "summary", "that", "the", "their",
  "this", "through", "using", "with", "work", "worked", "year", "years", "your"
]);

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
      roles: ["Software Developer", "Frontend Engineer", "Backend Engineer"],
      locations: ["Remote Canada", "Canada", "Saskatchewan", "Ontario", "Toronto", "Saskatoon", "Regina"],
      minimumScore: 55,
      maxQueue: 5,
      reviewBeforeSubmit: true
    },
    consent: null,
    resume: null,
    resumeBuilder: defaultResumeBuilder(),
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
      firstName: "",
      lastName: "",
      address: "",
      city: "",
      province: "",
      postalCode: "",
      country: "",
      authorization: "",
      sponsorship: "",
      salary: "",
      availability: "",
      portfolio: "",
      linkedin: "",
      github: "",
      currentCompany: "",
      currentTitle: "",
      school: "",
      degree: "",
      yearsExperience: ""
    }
  };
}

function defaultResumeBuilder() {
  return {
    contact: { fullName: "", email: "", phone: "", location: "", linkedin: "", portfolio: "" },
    headline: "",
    summary: "",
    skills: [],
    experience: [],
    education: [],
    projects: [],
    certifications: [],
    targetJobDescription: "",
    density: "standard",
    updatedAt: null
  };
}

function cleanBuilderText(value, maxLength = 500) {
  return String(value || "").replace(/\r\n/g, "\n").trim().slice(0, maxLength);
}

function cleanBuilderLines(value, maxItems = 8, maxLength = 260) {
  const items = Array.isArray(value) ? value : String(value || "").split(/\n|,/);
  return items.map(item => cleanBuilderText(item, maxLength)).filter(Boolean).slice(0, maxItems);
}

function builderItemId(value, prefix) {
  const current = cleanBuilderText(value, 80);
  return /^[a-z]+_[a-z0-9_-]{3,}$/i.test(current) ? current : id(prefix);
}

function sanitizeResumeBuilder(value = {}) {
  const contact = value.contact || {};
  const cleanItems = (items, maxItems, mapper) => (Array.isArray(items) ? items : []).slice(0, maxItems).map(mapper);
  return {
    contact: {
      fullName: cleanBuilderText(contact.fullName, 100),
      email: cleanBuilderText(contact.email, 160),
      phone: cleanBuilderText(contact.phone, 60),
      location: cleanBuilderText(contact.location, 140),
      linkedin: cleanBuilderText(contact.linkedin, 300),
      portfolio: cleanBuilderText(contact.portfolio, 300)
    },
    headline: cleanBuilderText(value.headline, 140),
    summary: cleanBuilderText(value.summary, 1200),
    skills: cleanBuilderLines(value.skills, 40, 80),
    experience: cleanItems(value.experience, 12, item => ({
      id: builderItemId(item?.id, "exp"),
      title: cleanBuilderText(item?.title, 120),
      company: cleanBuilderText(item?.company, 120),
      location: cleanBuilderText(item?.location, 120),
      startDate: cleanBuilderText(item?.startDate, 40),
      endDate: cleanBuilderText(item?.endDate, 40),
      current: Boolean(item?.current),
      bullets: cleanBuilderLines(item?.bullets, 10, 320)
    })),
    education: cleanItems(value.education, 8, item => ({
      id: builderItemId(item?.id, "edu"),
      school: cleanBuilderText(item?.school, 160),
      degree: cleanBuilderText(item?.degree, 180),
      location: cleanBuilderText(item?.location, 120),
      graduationDate: cleanBuilderText(item?.graduationDate, 40),
      details: cleanBuilderLines(item?.details, 5, 260)
    })),
    projects: cleanItems(value.projects, 10, item => ({
      id: builderItemId(item?.id, "project"),
      name: cleanBuilderText(item?.name, 140),
      link: cleanBuilderText(item?.link, 300),
      technologies: cleanBuilderText(item?.technologies, 240),
      bullets: cleanBuilderLines(item?.bullets, 6, 320)
    })),
    certifications: cleanItems(value.certifications, 12, item => ({
      id: builderItemId(item?.id, "cert"),
      name: cleanBuilderText(item?.name, 180),
      issuer: cleanBuilderText(item?.issuer, 140),
      date: cleanBuilderText(item?.date, 40)
    })),
    targetJobDescription: cleanBuilderText(value.targetJobDescription, 12000),
    density: ["standard", "compact"].includes(value.density) ? value.density : "standard",
    updatedAt: value.updatedAt || null
  };
}

function seedResumeBuilder(state, resume) {
  const existing = sanitizeResumeBuilder(state.resumeBuilder || {});
  const answers = state.answerBank || {};
  const name = guessName(resume);
  const role = resume.roles?.[0] || resume.details?.currentTitle || "";
  const skills = resume.skills || [];
  const location = resume.details?.location || resume.locations?.find(value => !/^remote$/i.test(value)) || "";
  const generatedSummary = role
    ? `${role} with experience in ${skills.slice(0, 6).join(", ") || "cross-functional delivery"}. Focused on clear execution, measurable outcomes, and reliable collaboration.`
    : "";
  const experience = existing.experience.length ? existing.experience : (resume.details?.currentCompany || role) ? [{
    id: id("exp"),
    title: resume.details?.currentTitle || role,
    company: resume.details?.currentCompany || "",
    location,
    startDate: "",
    endDate: "",
    current: true,
    bullets: []
  }] : [];
  const education = existing.education.length ? existing.education : (resume.details?.school || resume.details?.degree) ? [{
    id: id("edu"),
    school: resume.details?.school || "",
    degree: resume.details?.degree || "",
    location: "",
    graduationDate: "",
    details: []
  }] : [];

  return sanitizeResumeBuilder({
    ...existing,
    contact: {
      fullName: name.fullName || existing.contact.fullName,
      email: resume.email || answers.email || existing.contact.email,
      phone: resume.phone || answers.phone || existing.contact.phone,
      location: location || [answers.city, answers.province].filter(Boolean).join(", ") || existing.contact.location,
      linkedin: resume.details?.linkedin || answers.linkedin || existing.contact.linkedin,
      portfolio: resume.details?.portfolio || answers.portfolio || existing.contact.portfolio
    },
    headline: role || existing.headline,
    summary: existing.summary || generatedSummary,
    skills: skills.length ? skills : existing.skills,
    experience,
    education,
    updatedAt: new Date().toISOString()
  });
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
  const state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
  state.resumeBuilder = sanitizeResumeBuilder(state.resumeBuilder || {});
  return state;
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
    const token = createSessionToken(users[email].id, email);
    const sessions = JSON.parse(fs.readFileSync(SESSIONS_FILE));
    sessions[token] = { userId: users[email].id, expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS * 1000 };
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions));
    setSessionCookie(req, res, token);
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
    
    const token = createSessionToken(userId, email);
    const sessions = JSON.parse(fs.readFileSync(SESSIONS_FILE));
    sessions[token] = { userId, expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS * 1000 };
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions));
    setSessionCookie(req, res, token);
    return sendJson(res, 200, { ok: true, userId });
  }

  const cookies = parseCookies(req);
  const token = cookies.ApplyPilotSession;
  let userId = null;
  if (token) {
    const signedSession = readSignedSession(token);
    if (signedSession) {
      userId = signedSession.userId;
    } else {
      ensureAuthFiles();
      const sessions = JSON.parse(fs.readFileSync(SESSIONS_FILE));
      const session = sessions[token];
      if (session && session.expiresAt > Date.now()) {
        userId = session.userId;
      }
    }
  }

  if (req.method === "POST" && url.pathname === "/api/auth/logout") {
    if (token) {
      const sessions = JSON.parse(fs.readFileSync(SESSIONS_FILE));
      delete sessions[token];
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions));
    }
    clearSessionCookie(req, res);
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
      let data;

      if (typeof pdfModule.PDFParse === "function") {
        const parser = new pdfModule.PDFParse({ data: file.buffer });
        try {
          data = await parser.getText();
        } finally {
          await parser.destroy?.();
        }
      } else {
        const pdfParse = typeof pdfModule === "function" ? pdfModule : pdfModule.default;
        if (typeof pdfParse !== "function") throw new Error("Unsupported pdf-parse API");
        data = await pdfParse(file.buffer);
      }

      const extracted = normalizeResumeText(data?.text || "");
      if (!isUsableResumeText(extracted)) throw new Error("PDF did not contain usable text");
      return {
        text: extracted,
        quality: "parsed"
      };
    } catch (err) {
      console.error("PDF parse error:", err);
      const rough = extractReadablePdfFragments(file.buffer);
      return {
        text: rough,
        quality: isUsableResumeText(rough) ? "rough-pdf" : "unreadable-pdf"
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

function normalizeResumeText(value) {
  return String(value || "")
    .replace(/[\uFB00-\uFB06]/g, character => ({
      "ﬀ": "ff", "ﬁ": "fi", "ﬂ": "fl", "ﬃ": "ffi", "ﬄ": "ffl", "ﬅ": "st", "ﬆ": "st"
    })[character] || character)
    .replace(/[\u00AD\u200B-\u200D\uFEFF]/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/([A-Za-z])-[ \t]*\r?\n[ \t]*([a-z])/g, "$1$2")
    .replace(/[•●▪◦]/g, "\n")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isUsableResumeText(text) {
  const words = String(text || "").match(/[A-Za-z][A-Za-z+#.&/-]{1,}/g) || [];
  return words.length >= 20 && words.join("").length >= 120;
}

function extractReadablePdfFragments(buffer) {
  const raw = buffer.toString("latin1");
  const fragments = [];
  const stringPattern = /\(([^()\\]*(?:\\.[^()\\]*)*)\)/g;
  let match;
  while ((match = stringPattern.exec(raw)) && fragments.length < 3000) {
    const value = match[1]
      .replace(/\\([()\\])/g, "$1")
      .replace(/\\[nrt]/g, " ")
      .replace(/\\[0-7]{1,3}/g, " ");
    if (/[A-Za-z]{2}/.test(value)) fragments.push(value);
  }
  return normalizeResumeText(fragments.join("\n"));
}

function phrasePattern(phrase) {
  const escaped = String(phrase)
    .trim()
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  return new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, "i");
}

function extractResumeSkills(text) {
  const normalized = normalizeResumeText(text).toLowerCase();
  return Object.entries(SKILL_ALIASES)
    .filter(([, aliases]) => aliases.some(alias => phrasePattern(alias).test(normalized)))
    .map(([skill]) => skill);
}

function extractResumeKeywords(text, skills, roles) {
  const frequencies = new Map();
  const tokens = normalizeResumeText(text).toLowerCase().match(/[a-z][a-z0-9+#.-]{2,}/g) || [];
  for (const token of tokens) {
    const clean = token.replace(/^[.-]+|[.-]+$/g, "");
    if (clean.length < 3 || RESUME_STOP_WORDS.has(clean) || /^\d+$/.test(clean)) continue;
    frequencies.set(clean, (frequencies.get(clean) || 0) + 1);
  }
  const ranked = [...frequencies.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length || a[0].localeCompare(b[0]))
    .map(([word]) => word);
  return [...new Set([...roles, ...skills, ...ranked])].slice(0, 48);
}

function parseResume(text, file) {
  const normalizedText = normalizeResumeText(text);
  const lower = normalizedText.toLowerCase();
  const words = lower.match(/[a-z0-9+#.-]+/g) || [];
  const email = normalizedText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
  const phone = normalizedText.match(/(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/)?.[0] || "";
  const skills = extractResumeSkills(normalizedText);
  const roles = inferResumeRoles(normalizedText, skills);
  const years = normalizedText.match(/(\d+)\+?\s+years?/i)?.[1] || "";
  const locations = extractLocations(normalizedText);
  const keywords = extractResumeKeywords(normalizedText, skills, roles);
  const details = extractResumeDetails(normalizedText, roles, locations);
  const name = extractCandidateName(normalizedText);

  return {
    id: id("resume"),
    filename: file.filename,
    uploadedAt: new Date().toISOString(),
    size: file.buffer.length,
    parseQuality: file.quality,
    email,
    phone,
    name,
    skills,
    roles,
    years,
    locations,
    keywords,
    details,
    wordCount: words.length,
    preview: normalizedText.replace(/\s+/g, " ").trim().slice(0, 700)
  };
}

function extractCandidateName(text) {
  const blocked = /\b(resume|curriculum|developer|engineer|designer|manager|analyst|specialist|coordinator|consultant|student|professional|profile|summary)\b/i;
  const line = String(text || "").split(/\r?\n/).slice(0, 10).find(value => {
    const clean = value.trim();
    const words = clean.split(/\s+/);
    return clean.length <= 70
      && words.length >= 2
      && words.length <= 4
      && words.every(word => /^[A-Za-z][A-Za-z.'-]+$/.test(word))
      && !blocked.test(clean);
  }) || "";
  const words = line.trim().split(/\s+/).filter(Boolean).map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
  return {
    firstName: words[0] || "",
    lastName: words.length > 1 ? words[words.length - 1] : "",
    fullName: words.join(" ")
  };
}

function extractResumeDetails(text, roles = [], locations = []) {
  const lines = String(text || "").split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const urls = String(text || "").match(/https?:\/\/[^\s<>]+/gi) || [];
  const linkedin = urls.find(url => /linkedin\.com/i.test(url)) || "";
  const github = urls.find(url => /github\.com/i.test(url)) || "";
  const portfolio = urls.find(url => !/linkedin\.com|github\.com/i.test(url)) || "";
  const postalCode = String(text || "").match(/\b[A-Z]\d[A-Z][ -]?\d[A-Z]\d\b/i)?.[0]?.toUpperCase() || "";
  const header = String(text || "").slice(0, 500);
  const countries = ["Canada", "India", "United States", "USA", "United Kingdom", "Australia", "Germany", "France"];
  const country = countries
    .map(value => ({ value: value === "USA" ? "United States" : value, index: header.toLowerCase().indexOf(value.toLowerCase()) }))
    .filter(item => item.index >= 0)
    .sort((a, b) => a.index - b.index)[0]?.value || "";
  const broadLocations = new Set(["remote", "remote india", "remote canada", "india", "canada", "united states", "usa"]);
  const provinceNames = ["Saskatchewan", "Ontario", "British Columbia", "Alberta", "Manitoba", "Quebec"];
  const province = provinceNames.find(value => new RegExp(`\\b${value}\\b`, "i").test(header)) || "";
  const city = locations.find(value => !broadLocations.has(String(value).toLowerCase()) && !provinceNames.includes(value)) || "";
  const location = [...new Set([city, province, country].filter(Boolean))].join(", ");
  const degreeLine = lines.find(line => /\b(bachelor|master|doctor|ph\.?d|diploma|associate|b\.?tech|m\.?tech|b\.?sc|m\.?sc|mba)\b/i.test(line)) || "";
  const schoolLine = lines.find(line => /\b(university|college|polytechnic|institute of technology|school of)\b/i.test(line) && line.length <= 140) || "";
  const experienceIndex = lines.findIndex(line => /^(professional |work |employment )?experience$/i.test(line));
  const experienceLines = experienceIndex >= 0 ? lines.slice(experienceIndex + 1, experienceIndex + 16) : lines;
  const companyLine = experienceLines.find(line => /\b(inc\.?|ltd\.?|llc|corp\.?|corporation|company|technologies|solutions|systems|consulting)\b/i.test(line) && line.length <= 140) || "";
  const companyMatch = companyLine.match(/^(.+?\b(?:inc\.?|ltd\.?|llc|corp\.?|corporation|company|technologies|solutions|systems|consulting))\b/i);

  return {
    linkedin,
    github,
    portfolio,
    postalCode,
    country,
    city,
    province,
    location,
    degree: degreeLine.split(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}\b/i)[0].trim().slice(0, 140),
    school: schoolLine.slice(0, 140),
    currentTitle: roles[0] || "",
    currentCompany: (companyMatch?.[1] || companyLine).slice(0, 100),
    yearsExperience: estimateExperienceYears(text)
  };
}

function estimateExperienceYears(text) {
  const experienceText = String(text || "").split(/\b(?:professional |work |employment )?experience\b/i)[1]?.split(/\b(projects?|education|certifications?)\b/i)[0] || "";
  const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  const ranges = [...experienceText.matchAll(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{4})\s*[-–—]\s*(?:(Present|Current)|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4})/gi)];
  let totalMonths = 0;
  for (const match of ranges) {
    const start = new Date(Number(match[2]), months[match[1].slice(0, 3).toLowerCase()], 1);
    const endText = match[0].split(/[-–—]/).pop().trim();
    const endMatch = endText.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{4})/i);
    const end = /present|current/i.test(endText)
      ? new Date()
      : endMatch ? new Date(Number(endMatch[2]), months[endMatch[1].slice(0, 3).toLowerCase()], 1) : start;
    totalMonths += Math.max(0, (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth());
  }
  return totalMonths ? String(Math.max(1, Math.round(totalMonths / 12))) : "";
}

function inferResumeRoles(text, skills = []) {
  const lower = String(text || "").toLowerCase();
  const firstPage = lower.slice(0, 1800);
  const skillSet = new Set(skills.map(skill => skill.toLowerCase()));
  const scores = new Map();

  const add = (role, points) => {
    const normalized = titleCaseRole(role);
    scores.set(normalized, (scores.get(normalized) || 0) + points);
  };

  for (const role of ROLE_HINTS) {
    if (lower.includes(role)) add(role, firstPage.includes(role) ? 45 : 35);
  }

  extractExperienceTitles(text).forEach((role, index) => add(role, index === 0 ? 100 : 65));

  const phraseRules = [
    [/front[\s-]?end.{0,24}(developer|engineer)|\breact developer\b|\bui developer\b/i, "Frontend Engineer", 45],
    [/back[\s-]?end.{0,24}(developer|engineer)|\bnode developer\b|\bapi developer\b/i, "Backend Engineer", 45],
    [/full[\s-]?stack.{0,24}(developer|engineer)/i, "Full Stack Developer", 55],
    [/\bsoftware (developer|engineer)\b|\bapplication developer\b|\bprogrammer\b/i, "Software Developer", 45],
    [/\bproduct designer\b|\bux\/ui\s+designer\b|\bui\/ux\s+designer\b|\buser experience designer\b/i, "Product Designer", 45],
    [/\bux designer\b|\buser experience designer\b|\bux researcher\b/i, "UX Designer", 40],
    [/\bdata analyst\b|\bbusiness intelligence\b|\bpower bi\b|\btableau\b/i, "Data Analyst", 45],
    [/\bdata scientist\b|\b(machine learning|ml) engineer\b/i, "Data Scientist", 45],
    [/\bquality assurance\b|\bqa\b|\btest automation\b/i, "QA Engineer", 40],
    [/\bdevops\b|\bcloud engineer\b|\bkubernetes\b|\bci\/cd\b/i, "DevOps Engineer", 40],
    [/\bproduct manager\b|\bproduct owner\b/i, "Product Manager", 45],
    [/\bbusiness analyst\b|\brequirements analyst\b/i, "Business Analyst", 40],
    [/\b(digital )?marketing (manager|specialist|coordinator)\b|\bseo specialist\b/i, "Digital Marketing Specialist", 40],
    [/\bmechanical (engineer|designer)\b|\bmachine design\b/i, "Mechanical Engineer", 45],
    [/\bmanufacturing (engineer|specialist)\b|\bproduction engineer\b/i, "Manufacturing Engineer", 45],
    [/\bquality (engineer|specialist)\b|\bquality control\b/i, "Quality Engineer", 42],
    [/\belectrical engineer\b|\belectronics engineer\b/i, "Electrical Engineer", 45],
    [/\bcivil engineer\b|\bstructural engineer\b/i, "Civil Engineer", 45],
    [/\bsupply chain (analyst|coordinator)\b|\blogistics coordinator\b/i, "Supply Chain Analyst", 42],
    [/\boperations (coordinator|specialist)\b/i, "Operations Coordinator", 42],
    [/\badministrative assistant\b|\boffice administrator\b/i, "Administrative Assistant", 42],
    [/\bcustomer service (representative|associate)\b/i, "Customer Service Representative", 42],
    [/\bsales (representative|associate|executive)\b/i, "Sales Representative", 42]
  ];

  for (const [pattern, role, points] of phraseRules) {
    if (pattern.test(text)) add(role, points);
  }

  const hasSkill = (...items) => items.some(item => skillSet.has(item.toLowerCase()));
  const countSkills = (...items) => items.filter(item => skillSet.has(item.toLowerCase())).length;
  if (countSkills("react", "javascript", "typescript", "html", "css", "vue", "angular") >= 3) add("Frontend Engineer", 30);
  if (countSkills("node.js", "express", "api", "rest", "graphql", "java", "spring", "django", "flask") >= 3) add("Backend Engineer", 28);
  if (countSkills("javascript", "python", "java", "git", "github", "sql", "c#", "c++") >= 3) add("Software Developer", 22);
  if (hasSkill("figma", "design systems", "user research", "ux design", "ui design") && /\b(product|ux|ui|visual|graphic)\s+design(er)?\b/i.test(text)) add("UX Designer", 28);
  if (countSkills("analytics", "sql", "data visualization", "power bi", "tableau", "excel") >= 3) add("Data Analyst", 24);
  if (countSkills("aws", "azure", "docker", "kubernetes", "ci/cd", "terraform") >= 3) add("DevOps Engineer", 24);
  if (countSkills("autocad", "solidworks", "catia", "creo", "nx", "fusion 360", "gd&t", "fea") >= 2) add("Mechanical Designer", 28);
  if (countSkills("lean manufacturing", "six sigma", "quality control", "cnc", "sap") >= 2) add("Manufacturing Engineer", 25);
  if (countSkills("supply chain", "procurement", "inventory management", "sap", "excel") >= 3) add("Supply Chain Analyst", 24);

  const ranked = [...scores.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const strongestScore = ranked[0]?.[1] || 0;
  const minimumRoleScore = strongestScore >= 70 ? Math.max(40, strongestScore - 45) : 24;

  return ranked
    .filter(([, score]) => score >= minimumRoleScore)
    .map(([role]) => role)
    .slice(0, 4);
}

function extractExperienceTitles(text) {
  const titles = [];
  const lines = String(text || "")
    .split(/\r?\n|(?<=\.)\s{2,}/)
    .map(line => line.replace(/\s+/g, " ").trim())
    .filter(line => line.length >= 3 && line.length <= 110)
    .slice(0, 180);

  const titleRules = [
    [/\b(senior\s+)?software\s+(developer|engineer)\b/i, "Software Developer"],
    [/\b(front[\s-]?end|frontend)\s+(developer|engineer)\b/i, "Frontend Engineer"],
    [/\b(back[\s-]?end|backend)\s+(developer|engineer)\b/i, "Backend Engineer"],
    [/\bfull[\s-]?stack\s+(developer|engineer)\b/i, "Full Stack Developer"],
    [/\bweb\s+developer\b/i, "Web Developer"],
    [/\breact\s+(developer|engineer)\b/i, "React Developer"],
    [/\bnode(\.js)?\s+(developer|engineer)\b/i, "Node Developer"],
    [/\bpython\s+(developer|engineer)\b/i, "Python Developer"],
    [/\bjava\s+(developer|engineer)\b/i, "Java Developer"],
    [/\bproduct\s+designer\b/i, "Product Designer"],
    [/\bux\s+designer\b|\buser experience designer\b/i, "UX Designer"],
    [/\bui\s+designer\b|\buser interface designer\b/i, "UI Designer"],
    [/\bux\s+researcher\b/i, "UX Researcher"],
    [/\b(data|business)\s+analyst\b/i, "Data Analyst"],
    [/\bdata\s+scientist\b/i, "Data Scientist"],
    [/\b(machine\s+learning|ml)\s+engineer\b/i, "Machine Learning Engineer"],
    [/\b(devops|cloud)\s+engineer\b/i, "DevOps Engineer"],
    [/\bqa\s+(engineer|analyst)|quality\s+assurance\s+(engineer|analyst)\b/i, "QA Engineer"],
    [/\bproduct\s+manager\b/i, "Product Manager"],
    [/\bproject\s+manager\b/i, "Project Manager"],
    [/\bbusiness\s+analyst\b/i, "Business Analyst"],
    [/\bmarketing\s+(manager|specialist|coordinator)\b/i, "Digital Marketing Specialist"],
    [/\bgraphic\s+designer\b/i, "Graphic Designer"],
    [/\bmechanical\s+(engineer|designer)\b/i, "Mechanical Engineer"],
    [/\bmanufacturing\s+(engineer|specialist)\b|\bproduction\s+engineer\b/i, "Manufacturing Engineer"],
    [/\bquality\s+(engineer|specialist|analyst)\b/i, "Quality Engineer"],
    [/\belectrical\s+engineer\b|\belectronics\s+engineer\b/i, "Electrical Engineer"],
    [/\bcivil\s+engineer\b|\bstructural\s+engineer\b/i, "Civil Engineer"],
    [/\bsupply\s+chain\s+(analyst|coordinator)\b|\blogistics\s+coordinator\b/i, "Supply Chain Analyst"],
    [/\boperations\s+(manager|coordinator|specialist)\b/i, "Operations Coordinator"],
    [/\badministrative\s+assistant\b|\boffice\s+administrator\b/i, "Administrative Assistant"],
    [/\bcustomer\s+service\s+(representative|associate)\b/i, "Customer Service Representative"],
    [/\bsales\s+(representative|associate|executive)\b/i, "Sales Representative"]
  ];

  for (const line of lines) {
    for (const [pattern, role] of titleRules) {
      if (pattern.test(line)) titles.push(role);
    }
  }
  return [...new Set(titles)].slice(0, 6);
}

function titleCaseRole(role) {
  const acronyms = new Set(["ui", "ux", "qa", "seo"]);
  return String(role || "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map(word => acronyms.has(word) ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function mergeResumeRoles(inferredRoles, currentRoles) {
  const genericDefaults = new Set([
    "product designer",
    "ux designer",
    "ui designer",
    "frontend engineer",
    "software developer",
    "backend engineer"
  ]);
  const inferredKeys = new Set((inferredRoles || []).map(role => String(role || "").trim().toLowerCase()).filter(Boolean));
  const byKey = new Map();
  for (const role of [...(inferredRoles || []), ...(currentRoles || [])]) {
    const clean = String(role || "").trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (inferredKeys.size && genericDefaults.has(key) && !inferredKeys.has(key)) continue;
    if (!byKey.has(key)) byKey.set(key, clean);
  }
  return [...byKey.values()].slice(0, 8);
}

function extractLocations(text) {
  const found = [];
  const common = [
    "remote",
    "india",
    "remote india",
    "bengaluru",
    "bangalore",
    "hyderabad",
    "pune",
    "mumbai",
    "delhi",
    "new delhi",
    "noida",
    "gurugram",
    "gurgaon",
    "chennai",
    "kolkata",
    "ahmedabad",
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
  const nextJobs = options.replaceResults ? [] : [...state.jobs];
  const existing = new Map(nextJobs.map(job => [job.id, job]));
  let added = 0;
  let updated = 0;
  const intent = locationIntent(options.targetLocation || "");

  for (const scanned of scannedJobs.filter(job => jobMatchesLocationIntent(job, intent))) {
    const source = state.sources.find(item => item.id === scanned.sourceId) || scanned;
    const sourceUrl = sourceCareerUrl(source);
    scanned.url = safeApplicationUrl(scanned.url, sourceUrl);
    scanned.applyUrl = safeApplicationUrl(scanned.applyUrl || scanned.url, sourceUrl);
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
    ...(options.includeConfigured === false ? [] : state.sources),
    ...(options.extraSources || [])
  ];

  for (const source of sources) {
    if (!source.enabled) continue;
    try {
      const jobs = await scanSource(source);
      for (const job of jobs) {
        job.sourceValue = source.value || "";
      }
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

  const upsert = upsertJobs(state, scannedJobs, {
    targetLocation: options.targetLocation,
    replaceResults: options.replaceResults === true
  });
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
    sourceId: job.sourceId,
    sourceName: job.sourceName,
    sourceType: job.sourceType,
    sourceValue: job.sourceValue,
    sourceCountry: job.sourceCountry,
    sourceProvince: job.sourceProvince,
    score: job.score,
    runId: options.runId || null,
    target: options.target || null,
    coverNote: generateCoverNote(state, job),
    answers: { ...state.answerBank },
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

function targetCandidates(state, target, options = {}) {
  const roleTerms = importantTerms(target.role);
  const companyTerms = importantTerms(target.company);
  const locationTerms = importantTerms(target.location);
  const minScore = clamp(Number(target.minScore ?? state.preferences.minimumScore), 0, 100);

  return state.jobs
    .filter(job => options.includeQueued || !state.queue.some(item => item.jobId === job.id && item.status !== "skipped"))
    .map(job => ({ job, targetScore: scoreTargetFit(job, roleTerms, companyTerms, locationTerms) }))
    .filter(result => result.targetScore > 0)
    .filter(result => result.job.score >= minScore || result.targetScore >= 14)
    .sort((a, b) => b.targetScore - a.targetScore || b.job.score - a.job.score || dateValue(b.job.postedAt) - dateValue(a.job.postedAt))
    .map(result => result.job);
}

function buildAutofillPayload(state, item) {
  const resume = state.resume || {};
  const answers = { ...(item.answers || {}), ...(state.answerBank || {}) };
  const nameGuess = guessName(resume);
  return {
    fullName: [answers.firstName || nameGuess.firstName, answers.lastName || nameGuess.lastName].filter(Boolean).join(" ") || nameGuess.fullName,
    firstName: answers.firstName || nameGuess.firstName,
    lastName: answers.lastName || nameGuess.lastName,
    email: answers.email || resume.email || "",
    phone: answers.phone || resume.phone || "",
    address: answers.address || "",
    city: answers.city || "",
    province: answers.province || "",
    postalCode: answers.postalCode || resume.details?.postalCode || "",
    location: [answers.city, answers.province].filter(Boolean).join(", ")
      || resume.details?.location
      || resume.locations?.find(value => !/^remote$/i.test(value))
      || state.preferences.locations?.[0]
      || item.location
      || "",
    country: answers.country || resume.details?.country || "",
    authorization: answers.authorization || "",
    sponsorship: answers.sponsorship || "",
    salary: answers.salary || "",
    availability: answers.availability || "",
    portfolio: answers.portfolio || resume.details?.portfolio || "",
    linkedin: answers.linkedin || resume.details?.linkedin || "",
    github: answers.github || resume.details?.github || "",
    currentCompany: answers.currentCompany || resume.details?.currentCompany || "",
    currentTitle: answers.currentTitle || resume.details?.currentTitle || resume.roles?.[0] || "",
    school: answers.school || resume.details?.school || "",
    degree: answers.degree || resume.details?.degree || "",
    yearsExperience: answers.yearsExperience || resume.details?.yearsExperience || resume.years || "",
    skills: (resume.skills || []).join(", "),
    coverNote: item.coverNote || "",
    jobTitle: item.title,
    company: item.company
  };
}

function safeApplicationUrl(value, base = "") {
  try {
    const raw = String(value || "").trim();
    if (!raw || raw === "#" || /^(?:javascript|data|mailto|tel):/i.test(raw)) return "";
    const parsed = base ? new URL(raw, base) : new URL(raw);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : "";
  } catch {
    return "";
  }
}

function sourceCareerUrl(source) {
  if (!source) return "";
  const value = String(source.value || source.sourceValue || "").trim();
  const directUrl = safeApplicationUrl(value);
  if (directUrl) return directUrl;

  const slug = encodeURIComponent(value);
  switch (String(source.type || source.sourceType || "").toLowerCase()) {
    case "greenhouse":
      return value ? `https://job-boards.greenhouse.io/${slug}` : "https://www.greenhouse.com/job-board";
    case "lever":
      return value ? `https://jobs.lever.co/${slug}` : "https://jobs.lever.co/";
    case "ashby":
      return value ? `https://jobs.ashbyhq.com/${slug}` : "https://jobs.ashbyhq.com/";
    case "linkedin": {
      const location = String(source.country || source.province || source.sourceCountry || source.sourceProvince || "").trim();
      const params = new URLSearchParams();
      if (value) params.set("keywords", value);
      if (location) params.set("location", location);
      const query = params.toString();
      return `https://www.linkedin.com/jobs/search/${query ? `?${query}` : ""}`;
    }
    case "remotive":
      return value
        ? `https://remotive.com/remote-jobs?search=${encodeURIComponent(value)}`
        : "https://remotive.com/remote-jobs";
    default:
      return "";
  }
}

function applicationUrlFor(state, item) {
  const job = item.jobId ? state.jobs.find(candidate => candidate.id === item.jobId) : item;
  const sourceId = item.sourceId || job?.sourceId;
  const source = state.sources.find(candidate => candidate.id === sourceId)
    || state.sources.find(candidate => candidate.name === (item.sourceName || job?.sourceName))
    || {
      type: item.sourceType || job?.sourceType,
      value: item.sourceValue || job?.sourceValue,
      country: item.sourceCountry || job?.sourceCountry,
      province: item.sourceProvince || job?.sourceProvince
    };
  const sourceUrl = sourceCareerUrl(source);
  const directUrl = safeApplicationUrl(item.applyUrl || job?.applyUrl || job?.url, sourceUrl);
  if (directUrl || sourceUrl) return directUrl || sourceUrl;

  const params = new URLSearchParams();
  const keywords = [item.title || job?.title, item.company || job?.company].filter(Boolean).join(" ");
  const location = item.location || job?.location || "";
  if (keywords) params.set("keywords", keywords);
  if (location) params.set("location", location);
  return `https://www.linkedin.com/jobs/search/?${params.toString()}`;
}

function guessName(resume) {
  if (resume.name?.firstName || resume.name?.lastName) {
    return {
      firstName: resume.name.firstName || "",
      lastName: resume.name.lastName || "",
      fullName: resume.name.fullName || [resume.name.firstName, resume.name.lastName].filter(Boolean).join(" ")
    };
  }
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

  let target = await waitForBrowserTarget(port, item.applyUrl);
  await sleep(2800);
  const clickResult = await cdpEvaluate(target.webSocketDebuggerUrl, buildApplyClickScript());
  if (clickResult?.clicked) {
    await sleep(3200);
    target = await waitForAutofillTarget(port, target, item.applyUrl);
  }

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

async function waitForAutofillTarget(port, originalTarget, originalUrl) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 3000) {
    try {
      const targets = (await fetchJson(`http://127.0.0.1:${port}/json/list`))
        .filter(target => target.type === "page" && target.webSocketDebuggerUrl && /^https?:/i.test(target.url || ""));
      const navigatedOriginal = targets.find(target => target.webSocketDebuggerUrl === originalTarget.webSocketDebuggerUrl && target.url !== originalUrl);
      const newApplicationTab = targets.find(target => target.webSocketDebuggerUrl !== originalTarget.webSocketDebuggerUrl && target.url !== originalUrl);
      if (newApplicationTab || navigatedOriginal) return newApplicationTab || navigatedOriginal;
    } catch {
      // The page may be between navigations; retry briefly.
    }
    await sleep(350);
  }
  return originalTarget;
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
    const action = actions
      .filter(item => /\\b(apply|start application|continue application)\\b/i.test(item.text))
      .filter(item => !/filter|search|view application|application status|saved/i.test(item.text))
      .sort((a, b) => {
        const score = item => {
          return (/^(apply|apply now|start application)$/i.test(item.text) ? 20 : 0)
            + (/apply for this (job|position|role)/i.test(item.text) ? 12 : 0)
            + (/\\/apply|application/i.test(item.href) ? 6 : 0)
            - Math.min(item.text.length, 80) / 20;
        };
        return score(b) - score(a);
      })[0];
    if (!action) return { clicked: false, reason: "no-apply-action" };
    action.el.click();
    return { clicked: true, text: action.text, href: action.href };
  })()`;
}

function buildAutofillScript(payload) {
  const data = JSON.stringify(payload).replace(/</g, "\\u003c");
  return `(async () => {
    const payload = ${data};
    const filledByField = new Map();
    const skippedByField = new Map();
    const warningSet = new Set();

    const visible = el => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
    const textOf = value => String(value || "").replace(/\\s+/g, " ").trim();
    const normalized = value => textOf(value).toLowerCase();
    const rememberFilled = (descriptor, value) => {
      const field = textOf(descriptor).slice(0, 100) || "unlabelled field";
      filledByField.set(field, { field, value: textOf(value).slice(0, 80) });
      skippedByField.delete(field);
    };
    const rememberSkipped = (descriptor, reason) => {
      const field = textOf(descriptor).slice(0, 100) || "unlabelled field";
      if (!filledByField.has(field)) skippedByField.set(field, { field, reason });
    };
    const allRoots = () => {
      const roots = [document];
      for (let index = 0; index < roots.length; index++) {
        const root = roots[index];
        root.querySelectorAll("*").forEach(el => {
          if (el.shadowRoot && !roots.includes(el.shadowRoot)) roots.push(el.shadowRoot);
        });
      }
      return roots;
    };
    const deepFields = () => allRoots().flatMap(root => [
      ...root.querySelectorAll('input, textarea, select, [contenteditable="true"], [role="textbox"]')
    ]);
    const nodeText = node => textOf(node && (node.innerText || node.textContent));
    const labelsFor = el => {
      const directParts = [
        el.getAttribute("aria-label"),
        el.getAttribute("name"),
        el.id,
        el.autocomplete,
        el.getAttribute("title"),
        el.getAttribute("data-testid"),
        el.getAttribute("data-test-id"),
        el.getAttribute("data-qa"),
        el.getAttribute("data-field"),
        el.getAttribute("data-field-name")
      ];
      const nearbyParts = [];
      const placeholder = el.getAttribute("placeholder");
      const root = el.getRootNode && el.getRootNode();
      const labelledBy = textOf(el.getAttribute("aria-labelledby")).split(/\\s+/).filter(Boolean);
      labelledBy.forEach(id => {
        const label = root && root.querySelector ? root.querySelector("#" + CSS.escape(id)) : null;
        if (label) nearbyParts.push(nodeText(label));
      });
      if (el.id) {
        const labelRoot = root && root.querySelectorAll ? root : document;
        labelRoot.querySelectorAll("label").forEach(label => {
          if (label.getAttribute("for") === el.id) nearbyParts.push(label.innerText || label.textContent);
        });
      }
      const wrappingLabel = el.closest("label");
      if (wrappingLabel) nearbyParts.push(wrappingLabel.innerText || wrappingLabel.textContent);
      const fieldContainer = el.closest('[data-field], [data-field-name], [class*="field" i], [class*="question" i], [role="group"]');
      if (fieldContainer) {
        const nearbyLabel = fieldContainer.querySelector("label, legend, [class*=label i], [class*=title i]");
        if (nearbyLabel) nearbyParts.push(nodeText(nearbyLabel));
      }
      let sibling = el.previousElementSibling;
      for (let i = 0; i < 2 && sibling; i++, sibling = sibling.previousElementSibling) {
        const text = nodeText(sibling);
        if (text && text.length < 120) nearbyParts.push(text);
      }
      const strongParts = [...directParts, ...nearbyParts].filter(Boolean).map(textOf);
      if (strongParts.length) {
        if (placeholder && !/^(type|enter|select|choose|search)\\b/i.test(placeholder)) strongParts.push(placeholder);
        return normalized([...new Set(strongParts)].join(" "));
      }
      let container = el.parentElement;
      for (let i = 0; i < 3 && container; i++, container = container.parentElement) {
        const text = nodeText(container);
        if (text && text.length < 160) return normalized(text);
      }
      return normalized(placeholder);
    };
    const setValue = (el, value) => {
      if (!value) return false;
      const existing = textOf(el.value || (el.isContentEditable ? el.textContent : ""));
      if (existing && !el.dataset.applypilotFilled) return false;
      el.focus();
      if (el.isContentEditable || (!('value' in el) && el.getAttribute("role") === "textbox")) {
        el.textContent = value;
      } else {
        const prototype = el instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : el instanceof HTMLSelectElement
            ? HTMLSelectElement.prototype
            : HTMLInputElement.prototype;
        const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
        const previous = el.value;
        if (descriptor && descriptor.set) descriptor.set.call(el, value);
        else el.value = value;
        if (el._valueTracker) el._valueTracker.setValue(previous);
      }
      const inputEvent = typeof InputEvent === "function"
        ? new InputEvent("input", { bubbles: true, inputType: "insertText", data: value })
        : new Event("input", { bubbles: true });
      el.dispatchEvent(inputEvent);
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.dataset.applypilotFilled = "true";
      el.style.outline = "3px solid #00e5ff";
      el.style.outlineOffset = "1px";
      return true;
    };
    const matchValue = (descriptor, type) => {
      if (/e-?mail|email/.test(descriptor)) return payload.email;
      if (/phone|mobile|telephone|contact\\s*number/.test(descriptor)) return payload.phone;
      if (/first\\s*name|given\\s*name/.test(descriptor)) return payload.firstName;
      if (/last\\s*name|family\\s*name|surname/.test(descriptor)) return payload.lastName;
      if (/full\\s*name|your\\s*name|name/.test(descriptor) && !/company|employer|school/.test(descriptor)) return payload.fullName;
      if (/linkedin/.test(descriptor)) return payload.linkedin;
      if (/github/.test(descriptor)) return payload.github;
      if (/portfolio|website|personal\\s*site/.test(descriptor)) return payload.portfolio;
      if (/cover|message|additional\\s*information|why.*interested|note/.test(descriptor)) return payload.coverNote;
      if (/salary|compensation|pay/.test(descriptor)) return payload.salary;
      if (/available|start\\s*date|notice/.test(descriptor)) return payload.availability;
      if (/street|address\\s*(line)?\\s*1|home address|mailing address/.test(descriptor) && !/email/.test(descriptor)) return payload.address;
      if (/postal|zip/.test(descriptor)) return payload.postalCode;
      if (/\\bcity\\b|town/.test(descriptor)) return payload.city;
      if (/province|\\bstate\\b|region/.test(descriptor)) return payload.province;
      if (/location/.test(descriptor)) return payload.location;
      if (/country/.test(descriptor)) return payload.country;
      if (/work.*authori|authori.*work|legally.*work/.test(descriptor)) return payload.authorization;
      if (/sponsor|visa/.test(descriptor)) return payload.sponsorship;
      if (/current.*company|current.*employer|most recent.*employer|organization|organisation/.test(descriptor)) return payload.currentCompany;
      if (/current.*(title|position|role)|most recent.*(title|position|role)|job\\s*title/.test(descriptor)) return payload.currentTitle;
      if (/school|university|college|institution/.test(descriptor) && !/email/.test(descriptor)) return payload.school;
      if (/degree|qualification|field of study/.test(descriptor)) return payload.degree;
      if (/years?.*(experience)|experience.*years?/.test(descriptor)) return payload.yearsExperience;
      if (/skills?|technologies|expertise/.test(descriptor)) return payload.skills;
      if (type === "email") return payload.email;
      if (type === "tel") return payload.phone;
      if (/autocomplete.*organization/.test(descriptor)) return payload.currentCompany;
      if (/autocomplete.*address-level2/.test(descriptor)) return payload.city || payload.location;
      if (/autocomplete.*country/.test(descriptor)) return payload.country;
      return "";
    };
    const chooseSelect = (el, descriptor) => {
      const options = [...el.options];
      const wants = [];
      if (/country/.test(descriptor)) wants.push(payload.country);
      if (/province|\\bstate\\b|region/.test(descriptor)) wants.push(payload.province);
      if (/sponsor|visa/.test(descriptor)) wants.push(payload.sponsorship, "no", "not require", "do not");
      if (/work.*authori|authori.*work|legally.*work/.test(descriptor)) wants.push(payload.authorization, "yes", "authorized");
      if (/years?.*(experience)|experience.*years?/.test(descriptor)) wants.push(payload.yearsExperience);
      if (!wants.length) return false;
      const normalizedWants = wants.filter(Boolean).map(want => textOf(want).toLowerCase());
      const option = options.find(opt => {
        const optionText = textOf(opt.textContent + " " + opt.value).toLowerCase();
        return normalizedWants.some(want => optionText.includes(want) || want.includes(optionText));
      });
      if (!option) return false;
      const descriptorSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
      if (descriptorSetter && descriptorSetter.set) descriptorSetter.set.call(el, option.value);
      else el.value = option.value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.dataset.applypilotFilled = "true";
      el.style.outline = "3px solid #00e5ff";
      rememberFilled(descriptor, textOf(option.textContent));
      return true;
    };
    const chooseBoolean = (el, descriptor) => {
      const value = textOf(el.value || el.getAttribute("aria-label") || "").toLowerCase();
      const surrounding = descriptor + " " + value;
      if (/gender|ethnic|race|veteran|disability|aboriginal|indigenous|sexual orientation|pronoun/.test(descriptor)) {
        warningSet.add("Optional demographic questions were left for manual review.");
        return false;
      }
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

    let scanned = 0;
    let passes = 0;
    for (let pass = 0; pass < 5; pass++) {
      passes++;
      const fields = [...new Set(deepFields())].filter(el => visible(el) && !el.disabled);
      scanned = Math.max(scanned, fields.length);
      for (const el of fields) {
        const type = (el.type || el.tagName || el.getAttribute("role") || "").toLowerCase();
        const descriptor = labelsFor(el);
        if (!descriptor) continue;
        if (type === "file") {
          warningSet.add("Resume and other file uploads require manual review.");
          continue;
        }
        if (el.tagName === "SELECT") {
          if (!el.dataset.applypilotFilled && !chooseSelect(el, descriptor)) rememberSkipped(descriptor, "no matching select option");
          continue;
        }
        if (["checkbox", "radio"].includes(type)) {
          if (!el.checked && chooseBoolean(el, descriptor)) rememberFilled(descriptor, "selected");
          continue;
        }
        if (["hidden", "submit", "button", "reset"].includes(type) || el.readOnly) continue;
        const value = matchValue(descriptor, type);
        if (!value) {
          rememberSkipped(descriptor, "no verified profile value");
          continue;
        }
        if (setValue(el, value)) rememberFilled(descriptor, value);
      }
      if (pass < 4) await new Promise(resolve => setTimeout(resolve, 700));
    }

    let banner = [...allRoots()].map(root => root.querySelector("#applypilot-autofill-banner")).find(Boolean);
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "applypilot-autofill-banner";
      document.documentElement.appendChild(banner);
    }
    const filled = [...filledByField.values()];
    const skipped = [...skippedByField.values()];
    const warnings = [...warningSet];
    banner.textContent = "ApplyPilot filled " + filled.length + " field(s). Review everything. File uploads, CAPTCHA, custom questions, and final submit remain manual.";
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
    return { filled, skipped: skipped.slice(0, 20), warnings, scanned, passes };
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
    consent: state.consent || null,
    preferences: state.preferences,
    resume: state.resume,
    resumeBuilder: sanitizeResumeBuilder(state.resumeBuilder || {}),
    sources: state.sources,
    jobs: state.jobs.map(job => {
      const openUrl = applicationUrlFor(state, job);
      return { ...job, url: openUrl, applyUrl: openUrl };
    }),
    queue: state.queue.map(item => ({ ...item, applyUrl: applicationUrlFor(state, item) })),
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

    if (req.method === "POST" && pathname === "/api/consent") {
      const body = await readJson(req);
      if (!body.version || body.dataProcessing !== true || body.automationResponsibility !== true) {
        return sendJson(res, 400, { error: "Complete both consent confirmations to continue." });
      }
      const state = readState();
      state.consent = {
        version: String(body.version).slice(0, 40),
        acceptedAt: new Date().toISOString(),
        dataProcessing: true,
        automationResponsibility: true
      };
      addActivity(state, `Terms and data processing consent accepted (${state.consent.version}).`);
      writeState(state);
      return sendJson(res, 200, publicState(state));
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
      const locationFilter = state.preferences.locations.join(" ");
      const locationFilterIntent = locationIntent(locationFilter);
      state.jobs = state.jobs
        .filter(job => !locationFilter || jobMatchesLocationIntent(job, locationFilterIntent))
        .map(job => {
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
        })
        .sort((a, b) => b.score - a.score || dateValue(b.postedAt) - dateValue(a.postedAt));
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

    if (req.method === "PATCH" && pathname === "/api/resume-builder") {
      const state = readState();
      const body = await readJson(req);
      state.resumeBuilder = sanitizeResumeBuilder({ ...body, updatedAt: new Date().toISOString() });
      addActivity(state, "Resume Builder draft saved.");
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
      const name = guessName(parsed);
      const inferredAnswers = {
        firstName: name.firstName,
        lastName: name.lastName,
        email: parsed.email,
        phone: parsed.phone,
        postalCode: parsed.details?.postalCode,
        country: parsed.details?.country,
        city: parsed.details?.city,
        province: parsed.details?.province,
        portfolio: parsed.details?.portfolio,
        linkedin: parsed.details?.linkedin,
        github: parsed.details?.github,
        currentCompany: parsed.details?.currentCompany,
        currentTitle: parsed.details?.currentTitle,
        school: parsed.details?.school,
        degree: parsed.details?.degree,
        yearsExperience: parsed.details?.yearsExperience
      };
      state.answerBank = { ...state.answerBank };
      for (const [key, value] of Object.entries(inferredAnswers)) {
        if (value) state.answerBank[key] = value;
      }
      state.resumeBuilder = seedResumeBuilder(state, parsed);
      if (parsed.roles?.length) {
        state.preferences.roles = mergeResumeRoles(parsed.roles, state.preferences.roles);
      }
      if (parsed.locations?.length) {
        state.preferences.locations = parsed.locations.slice(0, 6);
      }
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

    if (req.method === "POST" && pathname === "/api/jobs/match-resume") {
      const state = readState();
      if (!state.resume) {
        return sendJson(res, 400, { error: "Upload a resume before searching for matching jobs." });
      }

      const resumeLocations = state.resume.locations || [];
      const inferredLocation = state.preferences.locations?.[0]
        || resumeLocations.find(location => /^remote\s+\S+/i.test(location))
        || resumeLocations.find(location => !/^remote$/i.test(location))
        || resumeLocations[0]
        || "Worldwide";
      const target = {
        role: state.resume.roles?.[0] || state.preferences.roles?.[0] || "",
        company: "",
        location: inferredLocation,
        minScore: state.preferences.minimumScore
      };
      if (!target.role) {
        return sendJson(res, 400, { error: "No target role could be identified from this resume." });
      }

      const scan = await performScan(state, {
        includeConfigured: false,
        targetLocation: target.location,
        replaceResults: true,
        extraSources: buildTargetedSources(target)
      });
      const matches = targetCandidates(state, target, { includeQueued: true });
      const matchIds = new Set(matches.map(job => job.id));
      state.jobs = state.jobs
        .map(job => ({ ...job, status: matchIds.has(job.id) ? "matched" : "low-match" }))
        .sort((a, b) => {
          const aMatch = matchIds.has(a.id) ? 1 : 0;
          const bMatch = matchIds.has(b.id) ? 1 : 0;
          return bMatch - aMatch || b.score - a.score || dateValue(b.postedAt) - dateValue(a.postedAt);
        });
      addActivity(state, `Automatic resume search found ${matches.length} matching job${matches.length === 1 ? "" : "s"} for ${target.role}.`);
      writeState(state);
      return sendJson(res, 200, {
        ...publicState(state),
        autoMatch: {
          role: target.role,
          location: target.location,
          count: matches.length,
          scan
        }
      });
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
          replaceResults: true,
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
      const openUrl = applicationUrlFor(state, item);
      if (!openUrl) return sendJson(res, 400, { error: "This draft does not have a valid official application URL." });

      const payload = buildAutofillPayload(state, item);
      if (body.dryRun === true) {
        return sendJson(res, 200, {
          queueItem: {
            id: item.id,
            title: item.title,
            company: item.company,
            applyUrl: openUrl
          },
          payload,
          safety: "Dry run only. No browser was opened and no form was filled."
        });
      }

      const result = browserAutofillAvailable()
        ? await openAndAutofillApplication(state, { ...item, applyUrl: openUrl })
        : {
            mode: "hosted-assist",
            openedUrl: openUrl,
            payload,
            filled: [],
            skipped: [],
            warnings: ["Direct cross-site autofill requires the local desktop app. Prepared answers were copied for pasting."]
          };
      item.status = result.mode === "hosted-assist" ? "approved" : "autofilled";
      item.autofilledAt = new Date().toISOString();
      item.audit = [
        ...(item.audit || []),
        {
          at: item.autofilledAt,
          message: result.mode === "hosted-assist"
            ? "Opened official application page and prepared a reusable answer package."
            : `Opened official application page and autofilled ${result.filled?.length || 0} field(s). Final submit left for manual review.`
        }
      ];
      addActivity(state, result.mode === "hosted-assist"
        ? `Opened application page and prepared answers for ${item.title} at ${item.company}.`
        : `Opened and autofilled application page for ${item.title} at ${item.company}.`);
      writeState(state);
      return sendJson(res, 200, { ...publicState(state), autofill: result, openUrl: result.mode === "hosted-assist" ? openUrl : "" });
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
      const openUrl = applicationUrlFor(state, item);
      if (!openUrl) return sendJson(res, 400, { error: "This draft does not have a valid employer career-page URL." });
      item.applyUrl = openUrl;
      item.status = "approved";
      item.approvedAt = new Date().toISOString();
      item.audit = [
        ...(item.audit || []),
        { at: item.approvedAt, message: "User approved opening the official application page." }
      ];
      addActivity(state, `Approved for application: ${item.title} at ${item.company}.`);
      writeState(state);
      return sendJson(res, 200, { ...publicState(state), openUrl });
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
