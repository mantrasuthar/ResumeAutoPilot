const state = {
  data: null,
  view: "dashboard",
  reviewItem: null,
  lastAutoTargetRole: "",
  forceNextTargetRole: false,
  uploadFromWelcome: false,
  autoSearching: false,
  lastAutoMatchCount: null,
  builderDraft: null,
  builderLoadedVersion: "",
  builderDirty: false
};

const CONSENT_VERSION = "2026-08-22";
const CONSENT_STORAGE_KEY = "applypilot-consent";

const els = {
  serverStatus: document.querySelector("#serverStatus"),
  resumeForm: document.querySelector("#resumeForm"),
  resumeInput: document.querySelector("#resumeInput"),
  removeResumeBtn: document.querySelector("#removeResumeBtn"),
  uploadResumeBtn: document.querySelector("#uploadResumeBtn"),
  resumeFileName: document.querySelector("#resumeFileName"),
  resumeMeta: document.querySelector("#resumeMeta"),
  quickUploadResume: document.querySelector("#quickUploadResume"),
  quickScanSources: document.querySelector("#quickScanSources"),
  gettingStarted: document.querySelector("#gettingStarted"),
  gettingStartedTitle: document.querySelector("#gettingStartedTitle"),
  gettingStartedText: document.querySelector("#gettingStartedText"),
  gettingStartedHint: document.querySelector("#gettingStartedHint"),
  resumeSubtitle: document.querySelector("#resumeSubtitle"),
  rolesInput: document.querySelector("#rolesInput"),
  locationsInput: document.querySelector("#locationsInput"),
  minimumScoreInput: document.querySelector("#minimumScoreInput"),
  maxQueueInput: document.querySelector("#maxQueueInput"),
  reviewToggle: document.querySelector("#reviewToggle"),
  savePreferences: document.querySelector("#savePreferences"),
  scanSources: document.querySelector("#scanSources"),
  startApplying: document.querySelector("#startApplying"),
  targetForm: document.querySelector("#targetForm"),
  targetRole: document.querySelector("#targetRole"),
  targetCompany: document.querySelector("#targetCompany"),
  targetLocation: document.querySelector("#targetLocation"),
  targetMinScore: document.querySelector("#targetMinScore"),
  targetLimit: document.querySelector("#targetLimit"),
  targetScanBefore: document.querySelector("#targetScanBefore"),
  targetApply: document.querySelector("#targetApply"),
  targetResult: document.querySelector("#targetResult"),
  refreshState: document.querySelector("#refreshState"),
  matchedStat: document.querySelector("#matchedStat"),
  queuedStat: document.querySelector("#queuedStat"),
  submittedStat: document.querySelector("#submittedStat"),
  sourcesStat: document.querySelector("#sourcesStat"),
  jobsList: document.querySelector("#jobsList"),
  jobsCaption: document.querySelector("#jobsCaption"),
  jobFilter: document.querySelector("#jobFilter"),
  sourceForm: document.querySelector("#sourceForm"),
  sourceName: document.querySelector("#sourceName"),
  sourceType: document.querySelector("#sourceType"),
  sourceValue: document.querySelector("#sourceValue"),
  sourcesList: document.querySelector("#sourcesList"),
  queueList: document.querySelector("#queueList"),
  profileCaption: document.querySelector("#profileCaption"),
  profileFacts: document.querySelector("#profileFacts"),
  activityList: document.querySelector("#activityList"),
  answersForm: document.querySelector("#answersForm"),
  firstNameInput: document.querySelector("#firstNameInput"),
  lastNameInput: document.querySelector("#lastNameInput"),
  emailInput: document.querySelector("#emailInput"),
  phoneInput: document.querySelector("#phoneInput"),
  addressInput: document.querySelector("#addressInput"),
  cityInput: document.querySelector("#cityInput"),
  provinceInput: document.querySelector("#provinceInput"),
  postalCodeInput: document.querySelector("#postalCodeInput"),
  countryInput: document.querySelector("#countryInput"),
  linkedinInput: document.querySelector("#linkedinInput"),
  githubInput: document.querySelector("#githubInput"),
  authorizationInput: document.querySelector("#authorizationInput"),
  sponsorshipInput: document.querySelector("#sponsorshipInput"),
  salaryInput: document.querySelector("#salaryInput"),
  availabilityInput: document.querySelector("#availabilityInput"),
  portfolioInput: document.querySelector("#portfolioInput"),
  currentCompanyInput: document.querySelector("#currentCompanyInput"),
  currentTitleInput: document.querySelector("#currentTitleInput"),
  schoolInput: document.querySelector("#schoolInput"),
  degreeInput: document.querySelector("#degreeInput"),
  yearsExperienceInput: document.querySelector("#yearsExperienceInput"),
  resumeBuilderForm: document.querySelector("#resumeBuilderForm"),
  builderFullName: document.querySelector("#builderFullName"),
  builderHeadline: document.querySelector("#builderHeadline"),
  builderEmail: document.querySelector("#builderEmail"),
  builderPhone: document.querySelector("#builderPhone"),
  builderLocation: document.querySelector("#builderLocation"),
  builderLinkedin: document.querySelector("#builderLinkedin"),
  builderPortfolio: document.querySelector("#builderPortfolio"),
  builderSummary: document.querySelector("#builderSummary"),
  builderSkills: document.querySelector("#builderSkills"),
  builderJobDescription: document.querySelector("#builderJobDescription"),
  builderDensity: document.querySelector("#builderDensity"),
  experienceEditor: document.querySelector("#experienceEditor"),
  educationEditor: document.querySelector("#educationEditor"),
  projectsEditor: document.querySelector("#projectsEditor"),
  certificationsEditor: document.querySelector("#certificationsEditor"),
  resumePreview: document.querySelector("#resumePreview"),
  builderChecklist: document.querySelector("#builderChecklist"),
  builderScore: document.querySelector("#builderScore"),
  builderScoreProgress: document.querySelector("#builderScoreProgress"),
  summaryCount: document.querySelector("#summaryCount"),
  keywordAnalysis: document.querySelector("#keywordAnalysis"),
  saveResumeBuilder: document.querySelector("#saveResumeBuilder"),
  copyResumeText: document.querySelector("#copyResumeText"),
  downloadResumeText: document.querySelector("#downloadResumeText"),
  downloadResumeWord: document.querySelector("#downloadResumeWord"),
  printResume: document.querySelector("#printResume"),
  addExperience: document.querySelector("#addExperience"),
  addEducation: document.querySelector("#addEducation"),
  addProject: document.querySelector("#addProject"),
  addCertification: document.querySelector("#addCertification"),
  reviewDialog: document.querySelector("#reviewDialog"),
  dialogTitle: document.querySelector("#dialogTitle"),
  dialogMeta: document.querySelector("#dialogMeta"),
  dialogCoverNote: document.querySelector("#dialogCoverNote"),
  dialogAnswers: document.querySelector("#dialogAnswers"),
  approveAndOpen: document.querySelector("#approveAndOpen"),
  toast: document.querySelector("#toast")
};

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    credentials: "same-origin",
    headers: options.body instanceof FormData
      ? options.headers
      : { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed: ${response.status}`);
  return data;
}

async function initAuth() {
  if (readLocalConsent()) document.querySelector("#consent-screen").hidden = true;
  try {
    await api("/api/auth/me");
    document.querySelector("#consent-screen").hidden = true;
    document.querySelector("#auth-screen").style.display = "none";
    document.querySelector(".app-shell").style.display = "grid";
    await loadState();
    setView(state.view);
  } catch (err) {
    document.querySelector("#auth-screen").style.display = "flex";
    document.querySelector(".app-shell").style.display = "none";
  }
}

async function loadState() {
  try {
    state.data = await api("/api/state");
    const localConsent = readLocalConsent();
    if (localConsent && state.data.consent?.version !== CONSENT_VERSION) {
      state.data = await api("/api/consent", {
        method: "POST",
        body: JSON.stringify({
          version: CONSENT_VERSION,
          dataProcessing: true,
          automationResponsibility: true
        })
      });
    }
    els.serverStatus.textContent = state.data.capabilities?.hostedMode ? "Hosted website" : "Running locally";
    if (state.data.resume) els.jobFilter.value = "matched";
    render();
  } catch (error) {
    els.serverStatus.textContent = "Server unavailable";
    showToast(error.message);
  }
}

function readLocalConsent() {
  try {
    const consent = JSON.parse(localStorage.getItem(CONSENT_STORAGE_KEY) || "null");
    return consent?.version === CONSENT_VERSION ? consent : null;
  } catch {
    return null;
  }
}

function rememberLocalConsent() {
  const consent = { version: CONSENT_VERSION, acceptedAt: new Date().toISOString() };
  localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consent));
  return consent;
}

async function startApp() {
  const consentScreen = document.querySelector("#consent-screen");
  if (!readLocalConsent()) {
    consentScreen.hidden = false;
    document.querySelector("#auth-screen").style.display = "none";
    document.querySelector(".app-shell").style.display = "none";
    if (window.lucide) lucide.createIcons();
    return;
  }
  consentScreen.hidden = true;
  await initAuth();
}

function render() {
  if (!state.data) return;
  renderPreferences();
  renderResume();
  renderGettingStarted();
  renderStats();
  renderTargetDefaults();
  renderJobs();
  renderSources();
  renderQueue();
  renderProfile();
  renderActivity();
  renderAnswers();
  renderResumeBuilder();
  if (window.lucide) lucide.createIcons();
}

function renderGettingStarted() {
  const resume = state.data.resume;
  const dashboard = document.querySelector("#dashboard");
  dashboard.classList.toggle("dashboard-first-run", !resume);
  els.targetApply.disabled = !resume;

  if (!resume) {
    els.gettingStartedTitle.textContent = "Upload your resume";
    els.gettingStartedText.textContent = "We will extract your experience and suggest a target role. You can change it any time.";
    els.gettingStartedHint.textContent = "PDF, Word, or TXT";
    els.quickUploadResume.style.display = "inline-flex";
    els.quickScanSources.style.display = "none";
    return;
  }

  if (state.autoSearching) {
    els.gettingStartedTitle.textContent = "Finding your best matches";
    els.gettingStartedText.textContent = "Your resume is ready. We are searching current jobs using the role and location found in it.";
    els.gettingStartedHint.textContent = "This can take a few seconds.";
    els.quickUploadResume.style.display = "none";
    els.quickScanSources.style.display = "none";
    return;
  }

  const role = resume.roles?.[0] || "your preferred role";
  els.gettingStartedTitle.textContent = "Your profile is ready";
  const matchText = state.lastAutoMatchCount === null
    ? "Your matching jobs are listed below."
    : `${state.lastAutoMatchCount} matching job${state.lastAutoMatchCount === 1 ? "" : "s"} found and listed below.`;
  els.gettingStartedText.textContent = `We identified ${role} from your resume. ${matchText}`;
  els.gettingStartedHint.textContent = "Use the Resume tab only when you want to change your file or preferences.";
  els.quickUploadResume.style.display = "none";
  els.quickScanSources.style.display = "inline-flex";
}

function renderTargetDefaults() {
  const prefs = state.data.preferences;
  const resumeRole = state.data.resume?.roles?.[0] || "";
  const inferredRole = resumeRole || prefs.roles[0] || "";
  const previousResumeRole = els.targetRole.dataset.resumeRole || "";
  const shouldAutofillRole = state.forceNextTargetRole
    || !els.targetRole.value.trim()
    || els.targetRole.value.trim() === state.lastAutoTargetRole
    || (resumeRole && resumeRole !== previousResumeRole);
  if (shouldAutofillRole) {
    els.targetRole.value = inferredRole;
    state.lastAutoTargetRole = inferredRole;
    state.forceNextTargetRole = false;
  } else if (!state.lastAutoTargetRole) {
    state.lastAutoTargetRole = inferredRole;
  }
  if (resumeRole) els.targetRole.dataset.resumeRole = resumeRole;
  else delete els.targetRole.dataset.resumeRole;
  if (!els.targetLocation.value) els.targetLocation.value = prefs.locations[0] || "";
  if (!els.targetMinScore.value) els.targetMinScore.value = prefs.minimumScore;
  if (!els.targetLimit.value) els.targetLimit.value = Math.min(5, prefs.maxQueue || 3);
}

function renderPreferences() {
  const prefs = state.data.preferences;
  els.rolesInput.value = prefs.roles.join(", ");
  els.locationsInput.value = prefs.locations.join(", ");
  els.minimumScoreInput.value = prefs.minimumScore;
  els.maxQueueInput.value = prefs.maxQueue;
  els.reviewToggle.checked = Boolean(prefs.reviewBeforeSubmit);
}

function renderResume() {
  const resume = state.data.resume;
  if (!resume) {
    els.resumeFileName.textContent = "No resume loaded";
    els.resumeSubtitle.textContent = "Upload a resume to build a matching profile.";
    els.resumeMeta.textContent = "PDF and TXT are fully parsed; Word extraction is limited.";
    els.removeResumeBtn.style.display = "none";
    els.uploadResumeBtn.innerHTML = '<i data-lucide="upload-cloud" size="16"></i> Upload';
    return;
  }
  els.resumeFileName.textContent = resume.filename;
  const roleText = resume.roles?.length ? `Target roles: ${resume.roles.slice(0, 3).join(", ")}.` : "No target role inferred.";
  els.resumeSubtitle.textContent = `${roleText} ${resume.skills.length} skills, ${resume.wordCount} words.`;
  els.resumeMeta.textContent = `${resume.parseQuality} parse, uploaded ${formatDate(resume.uploadedAt)}.`;
  els.removeResumeBtn.style.display = "inline-flex";
  els.uploadResumeBtn.innerHTML = '<i data-lucide="refresh-cw" size="16"></i> Replace';
}

function renderStats() {
  const summary = state.data.summary;
  els.matchedStat.textContent = summary.matched;
  els.queuedStat.textContent = summary.queued;
  els.submittedStat.textContent = summary.submitted;
  els.sourcesStat.textContent = summary.sources;
}

function renderJobs() {
  const filter = els.jobFilter.value;
  const total = state.data.jobs.length;
  const matchedCount = state.data.jobs.filter(job => job.status === "matched").length;
  const lowMatchCount = state.data.jobs.filter(job => job.status === "low-match").length;
  const minScore = state.data.preferences?.minimumScore ?? 0;
  els.jobFilter.querySelector('option[value="all"]').textContent = `All scanned (${total})`;
  els.jobFilter.querySelector('option[value="matched"]').textContent = `Matched (${matchedCount})`;
  els.jobFilter.querySelector('option[value="low-match"]').textContent = `Low match (${lowMatchCount})`;
  const jobs = state.data.jobs.filter(job => filter === "all" || job.status === filter);
  const hidden = total - jobs.length;
  els.jobsCaption.textContent = filter === "matched"
    ? `${matchedCount} matched above your ${minScore}% minimum score. ${lowMatchCount} lower-scoring jobs are hidden.`
    : filter === "low-match"
      ? `${lowMatchCount} below your ${minScore}% minimum score. These may still be worth reviewing.`
      : `${jobs.length} shown: ${matchedCount} matched, ${lowMatchCount} low match, ${total} scanned total.${hidden ? ` ${hidden} hidden by this filter.` : ""}`;
  if (!jobs.length) {
    els.jobsList.className = "job-list empty-state";
    els.jobsList.textContent = state.data.jobs.length
      ? `No jobs match this filter. Try All scanned, lower the minimum score, or rescan after updating your resume.`
      : "No scanned jobs yet.";
    return;
  }
  els.jobsList.className = "job-list";
  els.jobsList.innerHTML = jobs.map(job => `
    <article class="job-card">
      <div class="job-main">
        <div class="job-title">
          <strong>${escapeHtml(job.title)}</strong>
          ${job.status === "matched" ? '<span class="pill success">Matched</span>' : '<span class="pill muted">Low match</span>'}
          ${job.postedAt ? `<span class="pill">${escapeHtml(formatDate(job.postedAt))}</span>` : '<span class="pill muted">Date unknown</span>'}
        </div>
        <div class="meta-row">
          <span>${escapeHtml(job.company || "Unknown company")}</span>
          <span>${escapeHtml(job.location || "Location not listed")}</span>
          <span>${escapeHtml(job.sourceName || job.sourceType)}</span>
        </div>
        <div class="tag-row">
          ${tags(job.matchedSkills, "success")}
          ${tags(job.matchedKeywords.slice(0, 4), "")}
        </div>
        ${renderMatchCriteria(job)}
      </div>
      <div class="job-actions">
        <div class="score-ring" style="--score:${job.score}%">${job.score}</div>
        <button class="secondary queue-job" data-job-id="${job.id}">
          <i data-lucide="plus" size="14"></i>
          Queue
        </button>
        ${job.url || job.applyUrl ? `
          <a class="secondary link-button" href="${escapeAttr(job.url || job.applyUrl)}" target="_blank" rel="noopener noreferrer">
            <i data-lucide="external-link" size="14"></i>
            Open
          </a>
        ` : `
          <button class="secondary" type="button" disabled title="No valid employer link was found">
            <i data-lucide="unlink" size="14"></i>
            Link unavailable
          </button>
        `}
      </div>
    </article>
  `).join("");
  if (window.lucide) lucide.createIcons();
}

function renderMatchCriteria(job) {
  const criteria = [
    {
      label: "Resume skills",
      items: job.matchedSkills || [],
      empty: state.data.resume ? "No direct skill match found" : "Upload resume first"
    },
    {
      label: "Resume keywords",
      items: (job.matchedKeywords || []).slice(0, 6),
      empty: state.data.resume ? "No keyword overlap found" : "Upload resume first"
    },
    {
      label: "Target role",
      items: job.roleMatches || [],
      empty: "Outside selected role targets"
    },
    {
      label: "Target location",
      items: job.locationMatches || [],
      empty: "Outside selected locations"
    }
  ];

  return `
    <div class="match-criteria" aria-label="Resume match criteria">
      <div class="match-criteria-head">
        <span>Resume match</span>
        <strong>${Number(job.score || 0)}%</strong>
      </div>
      <div class="match-criteria-grid">
        ${criteria.map(group => `
          <div class="criteria-group ${group.items.length ? "has-match" : "no-match"}">
            <span>${escapeHtml(group.label)}</span>
            <div>
              ${group.items.length
                ? group.items.map(item => `<em>${escapeHtml(item)}</em>`).join("")
                : `<small>${escapeHtml(group.empty)}</small>`}
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function renderSources() {
  if (!state.data.sources.length) {
    els.sourcesList.innerHTML = '<div class="empty-state">No sources configured.</div>';
    return;
  }
  els.sourcesList.innerHTML = state.data.sources.map(source => `
    <article class="source-card">
      <div>
        <strong>${escapeHtml(source.name)}</strong>
        <code>${escapeHtml(source.type)}: ${escapeHtml(source.value)}</code>
        ${source.country || source.province ? `<div class="source-status">${escapeHtml([source.country, source.province].filter(Boolean).join(" - "))}</div>` : ""}
        <div class="source-status">${escapeHtml(source.lastStatus || "Not scanned yet")} ${source.lastScannedAt ? `- ${escapeHtml(formatDate(source.lastScannedAt))}` : ""}</div>
      </div>
      <div class="job-actions">
        <button class="secondary toggle-source" data-source-id="${source.id}">
          <i data-lucide="${source.enabled ? 'pause' : 'play'}" size="14"></i>
          ${source.enabled ? "Disable" : "Enable"}
        </button>
        <button class="danger delete-source" data-source-id="${source.id}">
          <i data-lucide="trash-2" size="14"></i>
          Remove
        </button>
      </div>
    </article>
  `).join("");
  if (window.lucide) lucide.createIcons();
}

function renderQueue() {
  if (!state.data.queue.length) {
    els.queueList.className = "queue-list empty-state";
    els.queueList.textContent = "No drafts queued yet.";
    return;
  }
  els.queueList.className = "queue-list";
  const canAutofill = Boolean(state.data.capabilities?.browserAutofill);
  els.queueList.innerHTML = state.data.queue.map(item => {
    const autofillDisabled = item.status === "submitted";
    const autofillTitle = canAutofill
      ? "Open and autofill in local Edge or Chrome"
      : "Open the official page and copy prepared answers";
    const autofillLabel = canAutofill ? "Open + autofill" : "Open + copy answers";
    return `
    <article class="queue-card">
      <div class="queue-top">
        <div>
          <strong>${escapeHtml(item.title)}</strong>
          <div class="meta-row">
            <span>${escapeHtml(item.company)}</span>
            <span>${escapeHtml(item.location || "Location not listed")}</span>
            <span>${escapeHtml(item.sourceName || "")}</span>
          </div>
        </div>
        <span class="pill ${item.status === "submitted" ? "success" : item.status === "needs-answer" ? "warn" : ""}">${escapeHtml(statusLabel(item.status))}</span>
      </div>
      <div class="cover-note">${escapeHtml(item.coverNote)}</div>
      <div class="queue-actions">
        <button class="secondary review-queue" data-queue-id="${item.id}">
          <i data-lucide="eye" size="14"></i>
          Review
        </button>
        <button class="secondary autofill-queue" data-queue-id="${item.id}" title="${escapeHtml(autofillTitle)}" ${autofillDisabled ? "disabled" : ""}>
          <i data-lucide="zap" size="14"></i>
          ${autofillLabel}
        </button>
        <button class="primary approve-queue" data-queue-id="${item.id}" ${item.status === "submitted" ? "disabled" : ""}>
          <i data-lucide="check" size="14"></i>
          Approve and open
        </button>
        <button class="secondary mark-submitted" data-queue-id="${item.id}" ${item.status === "submitted" ? "disabled" : ""}>
          <i data-lucide="send" size="14"></i>
          Mark submitted
        </button>
      </div>
    </article>
  `;
  }).join("");
  if (window.lucide) lucide.createIcons();
}

function renderProfile() {
  const resume = state.data.resume;
  if (!resume) {
    els.profileCaption.textContent = "No resume profile yet.";
    els.profileFacts.innerHTML = '<div class="empty-state">Upload a resume to populate profile facts.</div>';
    return;
  }

  els.profileCaption.textContent = `${resume.filename} parsed locally.`;
  const facts = [
    ["Email", resume.email || "Not found"],
    ["Phone", resume.phone || "Not found"],
    ["Skills", resume.skills.length ? resume.skills.join(", ") : "None detected"],
    ["Roles", resume.roles.length ? resume.roles.join(", ") : "None detected"],
    ["Locations", resume.locations.length ? resume.locations.join(", ") : "None detected"],
    ["Current company", resume.details?.currentCompany || "Not found"],
    ["Experience", resume.details?.yearsExperience ? `${resume.details.yearsExperience} years` : "Not found"],
    ["Education", resume.details?.degree || resume.details?.school || "Not found"]
  ];
  els.profileFacts.innerHTML = facts.map(([label, value]) => `
    <div class="fact-item">
      <strong>${escapeHtml(label)}</strong>
      <span>${escapeHtml(value)}</span>
    </div>
  `).join("");
}

function renderActivity() {
  const events = state.data.activity.slice(0, 12);
  els.activityList.innerHTML = events.map(event => `
    <div class="activity-item">
      <strong>${escapeHtml(event.message)}</strong>
      <span>${escapeHtml(formatDate(event.at))}</span>
    </div>
  `).join("");
}

function renderAnswers() {
  const answers = state.data.answerBank || {};
  els.firstNameInput.value = answers.firstName || "";
  els.lastNameInput.value = answers.lastName || "";
  els.emailInput.value = answers.email || "";
  els.phoneInput.value = answers.phone || "";
  els.addressInput.value = answers.address || "";
  els.cityInput.value = answers.city || "";
  els.provinceInput.value = answers.province || "";
  els.postalCodeInput.value = answers.postalCode || "";
  els.countryInput.value = answers.country || "";
  els.linkedinInput.value = answers.linkedin || "";
  els.githubInput.value = answers.github || "";
  els.authorizationInput.value = answers.authorization || "";
  els.sponsorshipInput.value = answers.sponsorship || "";
  els.salaryInput.value = answers.salary || "";
  els.availabilityInput.value = answers.availability || "";
  els.portfolioInput.value = answers.portfolio || "";
  els.currentCompanyInput.value = answers.currentCompany || "";
  els.currentTitleInput.value = answers.currentTitle || "";
  els.schoolInput.value = answers.school || "";
  els.degreeInput.value = answers.degree || "";
  els.yearsExperienceInput.value = answers.yearsExperience || "";
}

function emptyResumeBuilder() {
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

function builderId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function cloneBuilder(value) {
  return JSON.parse(JSON.stringify(value || emptyResumeBuilder()));
}

function renderResumeBuilder() {
  const serverDraft = state.data.resumeBuilder || emptyResumeBuilder();
  const version = serverDraft.updatedAt || "empty";
  if (!state.builderDraft || (state.builderLoadedVersion !== version && !state.builderDirty)) {
    state.builderDraft = cloneBuilder(serverDraft);
    state.builderLoadedVersion = version;
    state.builderDirty = false;
    populateBuilderForm();
  }
  renderBuilderOutput();
}

function populateBuilderForm() {
  const draft = state.builderDraft || emptyResumeBuilder();
  const contact = draft.contact || {};
  els.builderFullName.value = contact.fullName || "";
  els.builderHeadline.value = draft.headline || "";
  els.builderEmail.value = contact.email || "";
  els.builderPhone.value = contact.phone || "";
  els.builderLocation.value = contact.location || "";
  els.builderLinkedin.value = contact.linkedin || "";
  els.builderPortfolio.value = contact.portfolio || "";
  els.builderSummary.value = draft.summary || "";
  els.builderSkills.value = (draft.skills || []).join(", ");
  els.builderJobDescription.value = draft.targetJobDescription || "";
  els.builderDensity.value = draft.density || "standard";
  renderBuilderRepeaters();
}

function repeaterActions(type, id, index, length) {
  return `
    <div class="repeater-actions">
      <button class="icon-button move-builder-item" type="button" data-type="${type}" data-id="${id}" data-direction="-1" title="Move up" ${index === 0 ? "disabled" : ""}><i data-lucide="arrow-up" size="15"></i></button>
      <button class="icon-button move-builder-item" type="button" data-type="${type}" data-id="${id}" data-direction="1" title="Move down" ${index === length - 1 ? "disabled" : ""}><i data-lucide="arrow-down" size="15"></i></button>
      <button class="icon-button remove-builder-item" type="button" data-type="${type}" data-id="${id}" title="Remove"><i data-lucide="trash-2" size="15"></i></button>
    </div>`;
}

function renderBuilderRepeaters() {
  const draft = state.builderDraft;
  els.experienceEditor.innerHTML = draft.experience.length ? draft.experience.map((item, index) => `
    <article class="repeater-item" data-type="experience" data-id="${escapeAttr(item.id)}">
      <div class="repeater-heading"><strong>Role ${index + 1}</strong>${repeaterActions("experience", escapeAttr(item.id), index, draft.experience.length)}</div>
      <div class="builder-field-grid">
        <label>Job title<input data-field="title" value="${escapeAttr(item.title)}"></label>
        <label>Company<input data-field="company" value="${escapeAttr(item.company)}"></label>
        <label>Location<input data-field="location" value="${escapeAttr(item.location)}"></label>
        <label>Start date<input data-field="startDate" value="${escapeAttr(item.startDate)}" placeholder="Jan 2022"></label>
        <label>End date<input data-field="endDate" value="${escapeAttr(item.endDate)}" placeholder="Present" ${item.current ? "disabled" : ""}></label>
        <label class="builder-check"><input data-field="current" type="checkbox" ${item.current ? "checked" : ""}><span>Current role</span></label>
        <label class="wide-field">Achievement bullets<textarea data-field="bullets" rows="5" placeholder="Led...&#10;Improved...&#10;Delivered...">${escapeHtml((item.bullets || []).join("\n"))}</textarea></label>
      </div>
      <p class="builder-hint">One accomplishment per line. Start with an action verb and include scale or results when accurate.</p>
    </article>`).join("") : '<div class="builder-empty">Add your most recent role first.</div>';

  els.educationEditor.innerHTML = draft.education.length ? draft.education.map((item, index) => `
    <article class="repeater-item" data-type="education" data-id="${escapeAttr(item.id)}">
      <div class="repeater-heading"><strong>Education ${index + 1}</strong>${repeaterActions("education", escapeAttr(item.id), index, draft.education.length)}</div>
      <div class="builder-field-grid">
        <label>School<input data-field="school" value="${escapeAttr(item.school)}"></label>
        <label>Degree and field<input data-field="degree" value="${escapeAttr(item.degree)}"></label>
        <label>Location<input data-field="location" value="${escapeAttr(item.location)}"></label>
        <label>Graduation date<input data-field="graduationDate" value="${escapeAttr(item.graduationDate)}" placeholder="May 2024"></label>
        <label class="wide-field">Honors or relevant details<textarea data-field="details" rows="3">${escapeHtml((item.details || []).join("\n"))}</textarea></label>
      </div>
    </article>`).join("") : '<div class="builder-empty">Add education when it supports your target role.</div>';

  els.projectsEditor.innerHTML = draft.projects.length ? draft.projects.map((item, index) => `
    <article class="repeater-item" data-type="projects" data-id="${escapeAttr(item.id)}">
      <div class="repeater-heading"><strong>Project ${index + 1}</strong>${repeaterActions("projects", escapeAttr(item.id), index, draft.projects.length)}</div>
      <div class="builder-field-grid">
        <label>Project name<input data-field="name" value="${escapeAttr(item.name)}"></label>
        <label>Project link<input data-field="link" type="url" value="${escapeAttr(item.link)}"></label>
        <label class="wide-field">Technologies<input data-field="technologies" value="${escapeAttr(item.technologies)}"></label>
        <label class="wide-field">Achievement bullets<textarea data-field="bullets" rows="4">${escapeHtml((item.bullets || []).join("\n"))}</textarea></label>
      </div>
    </article>`).join("") : '<div class="builder-empty">Projects are useful for showing relevant work beyond job titles.</div>';

  els.certificationsEditor.innerHTML = draft.certifications.length ? draft.certifications.map((item, index) => `
    <article class="repeater-item" data-type="certifications" data-id="${escapeAttr(item.id)}">
      <div class="repeater-heading"><strong>Certification ${index + 1}</strong>${repeaterActions("certifications", escapeAttr(item.id), index, draft.certifications.length)}</div>
      <div class="builder-field-grid builder-cert-grid">
        <label>Name<input data-field="name" value="${escapeAttr(item.name)}"></label>
        <label>Issuer<input data-field="issuer" value="${escapeAttr(item.issuer)}"></label>
        <label>Date<input data-field="date" value="${escapeAttr(item.date)}"></label>
      </div>
    </article>`).join("") : '<div class="builder-empty">Add only current, relevant credentials.</div>';
  if (window.lucide) lucide.createIcons();
}

function splitBuilderLines(value) {
  return String(value || "").split(/\n/).map(item => item.trim().replace(/^[•*-]\s*/, "")).filter(Boolean);
}

function collectBuilderRepeater(container, type) {
  return [...container.querySelectorAll(`.repeater-item[data-type="${type}"]`)].map(card => {
    const value = field => card.querySelector(`[data-field="${field}"]`)?.value.trim() || "";
    const base = { id: card.dataset.id };
    if (type === "experience") return { ...base, title: value("title"), company: value("company"), location: value("location"), startDate: value("startDate"), endDate: value("endDate"), current: Boolean(card.querySelector('[data-field="current"]')?.checked), bullets: splitBuilderLines(value("bullets")) };
    if (type === "education") return { ...base, school: value("school"), degree: value("degree"), location: value("location"), graduationDate: value("graduationDate"), details: splitBuilderLines(value("details")) };
    if (type === "projects") return { ...base, name: value("name"), link: value("link"), technologies: value("technologies"), bullets: splitBuilderLines(value("bullets")) };
    return { ...base, name: value("name"), issuer: value("issuer"), date: value("date") };
  });
}

function syncBuilderFromForm() {
  if (!state.builderDraft) state.builderDraft = emptyResumeBuilder();
  state.builderDraft.contact = {
    fullName: els.builderFullName.value.trim(),
    email: els.builderEmail.value.trim(),
    phone: els.builderPhone.value.trim(),
    location: els.builderLocation.value.trim(),
    linkedin: els.builderLinkedin.value.trim(),
    portfolio: els.builderPortfolio.value.trim()
  };
  state.builderDraft.headline = els.builderHeadline.value.trim();
  state.builderDraft.summary = els.builderSummary.value.trim();
  state.builderDraft.skills = String(els.builderSkills.value).split(/,|\n/).map(item => item.trim()).filter(Boolean);
  state.builderDraft.experience = collectBuilderRepeater(els.experienceEditor, "experience");
  state.builderDraft.education = collectBuilderRepeater(els.educationEditor, "education");
  state.builderDraft.projects = collectBuilderRepeater(els.projectsEditor, "projects");
  state.builderDraft.certifications = collectBuilderRepeater(els.certificationsEditor, "certifications");
  state.builderDraft.targetJobDescription = els.builderJobDescription.value.trim();
  state.builderDraft.density = els.builderDensity.value;
  state.builderDirty = true;
  renderBuilderOutput();
}

function builderDateRange(item) {
  return [item.startDate, item.current ? "Present" : item.endDate].filter(Boolean).join(" - ");
}

function resumeSection(title, content) {
  return content ? `<section class="resume-section"><h2>${escapeHtml(title)}</h2>${content}</section>` : "";
}

function resumeContentHtml(draft) {
  const contact = draft.contact || {};
  const contactLine = [contact.email, contact.phone, contact.location, contact.linkedin, contact.portfolio].filter(Boolean);
  const experience = (draft.experience || []).filter(item => item.title || item.company || item.bullets?.length).map(item => `
    <div class="resume-entry">
      <div class="resume-entry-head"><strong>${escapeHtml(item.title || "Role")}${item.company ? `, ${escapeHtml(item.company)}` : ""}</strong><span>${escapeHtml(builderDateRange(item))}</span></div>
      ${item.location ? `<div class="resume-entry-meta">${escapeHtml(item.location)}</div>` : ""}
      ${(item.bullets || []).length ? `<ul>${item.bullets.map(bullet => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul>` : ""}
    </div>`).join("");
  const education = (draft.education || []).filter(item => item.school || item.degree).map(item => `
    <div class="resume-entry">
      <div class="resume-entry-head"><strong>${escapeHtml(item.degree || item.school)}${item.degree && item.school ? `, ${escapeHtml(item.school)}` : ""}</strong><span>${escapeHtml(item.graduationDate)}</span></div>
      ${item.location ? `<div class="resume-entry-meta">${escapeHtml(item.location)}</div>` : ""}
      ${(item.details || []).length ? `<ul>${item.details.map(detail => `<li>${escapeHtml(detail)}</li>`).join("")}</ul>` : ""}
    </div>`).join("");
  const projects = (draft.projects || []).filter(item => item.name || item.bullets?.length).map(item => `
    <div class="resume-entry">
      <div class="resume-entry-head"><strong>${escapeHtml(item.name || "Project")}</strong><span>${escapeHtml(item.link)}</span></div>
      ${item.technologies ? `<div class="resume-entry-meta">${escapeHtml(item.technologies)}</div>` : ""}
      ${(item.bullets || []).length ? `<ul>${item.bullets.map(bullet => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul>` : ""}
    </div>`).join("");
  const certifications = (draft.certifications || []).filter(item => item.name).map(item => `<div class="resume-inline-entry"><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml([item.issuer, item.date].filter(Boolean).join(" | "))}</span></div>`).join("");
  return `
    <header class="resume-header">
      <h1>${escapeHtml(contact.fullName || "Your Name")}</h1>
      ${draft.headline ? `<p class="resume-headline">${escapeHtml(draft.headline)}</p>` : ""}
      ${contactLine.length ? `<p class="resume-contact">${contactLine.map(escapeHtml).join(" | ")}</p>` : ""}
    </header>
    ${resumeSection("Professional Summary", draft.summary ? `<p>${escapeHtml(draft.summary)}</p>` : "")}
    ${resumeSection("Skills", draft.skills?.length ? `<p>${draft.skills.map(escapeHtml).join(" | ")}</p>` : "")}
    ${resumeSection("Experience", experience)}
    ${resumeSection("Education", education)}
    ${resumeSection("Projects", projects)}
    ${resumeSection("Certifications", certifications)}`;
}

function resumePlainText(draft) {
  const lines = [];
  const contact = draft.contact || {};
  lines.push((contact.fullName || "YOUR NAME").toUpperCase());
  if (draft.headline) lines.push(draft.headline);
  lines.push([contact.email, contact.phone, contact.location, contact.linkedin, contact.portfolio].filter(Boolean).join(" | "));
  const section = (title, content) => { if (content.length) lines.push("", title.toUpperCase(), ...content); };
  section("Professional Summary", draft.summary ? [draft.summary] : []);
  section("Skills", draft.skills?.length ? [draft.skills.join(" | ")] : []);
  section("Experience", (draft.experience || []).filter(item => item.title || item.company).flatMap(item => [
    [item.title, item.company].filter(Boolean).join(", ") + (builderDateRange(item) ? ` | ${builderDateRange(item)}` : ""),
    item.location || "",
    ...(item.bullets || []).map(bullet => `- ${bullet}`)
  ].filter(Boolean)));
  section("Education", (draft.education || []).filter(item => item.school || item.degree).flatMap(item => [
    [item.degree, item.school].filter(Boolean).join(", ") + (item.graduationDate ? ` | ${item.graduationDate}` : ""),
    ...(item.details || []).map(detail => `- ${detail}`)
  ]));
  section("Projects", (draft.projects || []).filter(item => item.name).flatMap(item => [item.name + (item.technologies ? ` | ${item.technologies}` : ""), ...(item.bullets || []).map(bullet => `- ${bullet}`)]));
  section("Certifications", (draft.certifications || []).filter(item => item.name).map(item => [item.name, item.issuer, item.date].filter(Boolean).join(" | ")));
  return lines.filter((line, index) => line || lines[index - 1]).join("\n").trim();
}

function analyzeBuilder(draft) {
  const contact = draft.contact || {};
  const bullets = [...(draft.experience || []), ...(draft.projects || [])].flatMap(item => item.bullets || []);
  const actionVerb = /^(achieved|analyzed|automated|built|created|delivered|designed|developed|drove|implemented|improved|increased|launched|led|managed|optimized|reduced|resolved|scaled|streamlined|supported)\b/i;
  const completeRoles = (draft.experience || []).filter(item => item.title && item.company);
  const hasDates = completeRoles.some(item => item.startDate && (item.current || item.endDate));
  const actionCount = bullets.filter(bullet => actionVerb.test(bullet)).length;
  const metricCount = bullets.filter(bullet => /(?:\b\d+[+x]?\b|\d+%|\$[\d,.]+)/i.test(bullet)).length;
  const summaryWords = draft.summary.trim().split(/\s+/).filter(Boolean).length;
  let score = 0;
  score += contact.fullName ? 4 : 0;
  score += /@/.test(contact.email) ? 4 : 0;
  score += contact.phone ? 3 : 0;
  score += contact.location ? 4 : 0;
  score += draft.headline ? 8 : 0;
  score += summaryWords >= 40 && summaryWords <= 100 ? 15 : draft.summary ? 7 : 0;
  score += Math.min(12, (draft.skills || []).length * 2);
  score += completeRoles.length ? 10 : 0;
  score += hasDates ? 5 : 0;
  score += bullets.length >= 3 ? 10 : bullets.length * 3;
  score += bullets.length && actionCount / bullets.length >= 0.6 ? 7 : 0;
  score += metricCount ? 8 : 0;
  score += (draft.education || []).some(item => item.school || item.degree) ? 5 : 0;
  score += contact.linkedin || contact.portfolio || draft.projects?.length ? 5 : 0;
  const checks = [
    { ok: Boolean(contact.fullName && contact.email && contact.phone && contact.location), label: "Complete contact details" },
    { ok: summaryWords >= 40 && summaryWords <= 100, label: "Focused 40-100 word summary" },
    { ok: (draft.skills || []).length >= 6, label: "At least six relevant hard skills" },
    { ok: Boolean(completeRoles.length && hasDates), label: "Experience includes titles, companies, and dates" },
    { ok: bullets.length >= 3 && actionCount / Math.max(1, bullets.length) >= 0.6, label: "Achievement bullets begin with action verbs" },
    { ok: metricCount > 0, label: "At least one truthful measurable result" },
    { ok: !/[\u2600-\u27BF]/.test(resumePlainText(draft)), label: "No icons or decorative symbols in resume text" }
  ];
  return { score: Math.min(100, score), checks };
}

function renderKeywordAnalysis(draft) {
  const description = draft.targetJobDescription || "";
  if (!description.trim()) {
    els.keywordAnalysis.textContent = "Paste a job description to see relevant missing keywords.";
    return;
  }
  const stop = new Set("about after also and are been being can company could from have into its job more most our role seeking should than that the their them they this through using was were what when where which will with work would years your required preferred qualifications responsibilities experience candidate team strong ability skills".split(" "));
  const counts = new Map();
  (description.toLowerCase().match(/[a-z][a-z0-9+#.-]{2,}/g) || []).forEach(word => {
    const clean = word.replace(/^[.-]+|[.-]+$/g, "");
    if (clean.length < 4 || stop.has(clean)) return;
    counts.set(clean, (counts.get(clean) || 0) + 1);
  });
  const resumeText = resumePlainText(draft).toLowerCase();
  const missing = [...counts.entries()].filter(([word]) => !resumeText.includes(word)).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 12).map(([word]) => word);
  els.keywordAnalysis.innerHTML = missing.length
    ? `<strong>Keywords to review</strong><p>Only add these when they truthfully match your experience.</p><div>${missing.map(word => `<span>${escapeHtml(word)}</span>`).join("")}</div>`
    : "Your resume already covers the strongest repeated terms detected in this job description.";
}

function renderBuilderOutput() {
  if (!state.builderDraft) return;
  const analysis = analyzeBuilder(state.builderDraft);
  els.builderScore.textContent = `${analysis.score}%`;
  els.builderScoreProgress.value = analysis.score;
  els.builderScoreProgress.textContent = `${analysis.score}%`;
  els.builderScoreProgress.setAttribute("aria-valuetext", `${analysis.score}% ATS readiness`);
  els.summaryCount.textContent = `${state.builderDraft.summary.length} characters`;
  els.resumePreview.classList.toggle("compact", state.builderDraft.density === "compact");
  els.resumePreview.innerHTML = resumeContentHtml(state.builderDraft);
  els.builderChecklist.innerHTML = analysis.checks.map(check => `<div class="checklist-item ${check.ok ? "complete" : ""}"><i data-lucide="${check.ok ? "check-circle-2" : "circle"}" size="16"></i><span>${escapeHtml(check.label)}</span></div>`).join("");
  renderKeywordAnalysis(state.builderDraft);
  if (window.lucide) lucide.createIcons();
}

function addBuilderItem(type) {
  syncBuilderFromForm();
  const templates = {
    experience: { id: builderId("exp"), title: "", company: "", location: "", startDate: "", endDate: "", current: false, bullets: [] },
    education: { id: builderId("edu"), school: "", degree: "", location: "", graduationDate: "", details: [] },
    projects: { id: builderId("project"), name: "", link: "", technologies: "", bullets: [] },
    certifications: { id: builderId("cert"), name: "", issuer: "", date: "" }
  };
  state.builderDraft[type].push(templates[type]);
  state.builderDirty = true;
  renderBuilderRepeaters();
  renderBuilderOutput();
  document.querySelector(`.repeater-item[data-id="${templates[type].id}"] input`)?.focus();
}

function changeBuilderItem(type, itemId, direction) {
  syncBuilderFromForm();
  const items = state.builderDraft[type] || [];
  const index = items.findIndex(item => item.id === itemId);
  const nextIndex = index + Number(direction);
  if (index < 0 || nextIndex < 0 || nextIndex >= items.length) return;
  [items[index], items[nextIndex]] = [items[nextIndex], items[index]];
  renderBuilderRepeaters();
  renderBuilderOutput();
}

function removeBuilderItem(type, itemId) {
  syncBuilderFromForm();
  state.builderDraft[type] = (state.builderDraft[type] || []).filter(item => item.id !== itemId);
  state.builderDirty = true;
  renderBuilderRepeaters();
  renderBuilderOutput();
}

async function saveBuilderDraft() {
  syncBuilderFromForm();
  const done = setBusy(els.saveResumeBuilder, "Saving...");
  try {
    state.data = await api("/api/resume-builder", { method: "PATCH", body: JSON.stringify(state.builderDraft) });
    state.builderDraft = cloneBuilder(state.data.resumeBuilder);
    state.builderLoadedVersion = state.data.resumeBuilder.updatedAt || "empty";
    state.builderDirty = false;
    showToast("Resume Builder draft saved.");
  } catch (error) {
    showToast(error.message);
  } finally {
    done();
  }
}

function resumeExportName(draft, extension) {
  const name = (draft.contact?.fullName || "resume").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${name || "resume"}.${extension}`;
}

function downloadBuilderFile(content, type, filename) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function resumeDocumentHtml(draft) {
  const compact = draft.density === "compact";
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(draft.contact?.fullName || "Resume")}</title><style>
    @page { size: Letter; margin: ${compact ? "0.45in" : "0.6in"}; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #111827; background: #fff; font: ${compact ? "9.5pt/1.3" : "10.5pt/1.42"} Arial, Helvetica, sans-serif; }
    article { max-width: 8.5in; margin: 0 auto; }
    h1 { margin: 0; font-size: ${compact ? "21pt" : "24pt"}; letter-spacing: 0; }
    h2 { margin: ${compact ? "10px" : "14px"} 0 5px; padding-bottom: 3px; border-bottom: 1px solid #111827; font-size: 10.5pt; letter-spacing: 0; text-transform: uppercase; }
    p { margin: 0 0 5px; }
    ul { margin: 4px 0 7px 18px; padding: 0; }
    li { margin: 0 0 3px; }
    .resume-header { text-align: center; }
    .resume-headline { margin-top: 3px; font-weight: 700; }
    .resume-contact { margin-top: 5px; font-size: 9pt; overflow-wrap: anywhere; }
    .resume-entry { margin-bottom: ${compact ? "6px" : "9px"}; break-inside: avoid; }
    .resume-entry-head, .resume-inline-entry { display: flex; justify-content: space-between; gap: 14px; }
    .resume-entry-head span, .resume-inline-entry span { flex: 0 0 auto; }
    .resume-entry-meta { margin-top: 2px; color: #374151; font-style: italic; }
  </style></head><body><article>${resumeContentHtml(draft)}</article></body></html>`;
}

function printBuilderResume() {
  syncBuilderFromForm();
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    showToast("Allow pop-ups to print or save this resume as PDF.");
    return;
  }
  printWindow.document.open();
  printWindow.document.write(resumeDocumentHtml(state.builderDraft));
  printWindow.document.close();
  window.setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 250);
}

function downloadBuilderText() {
  syncBuilderFromForm();
  downloadBuilderFile(resumePlainText(state.builderDraft), "text/plain;charset=utf-8", resumeExportName(state.builderDraft, "txt"));
}

function downloadBuilderWord() {
  syncBuilderFromForm();
  downloadBuilderFile(resumeDocumentHtml(state.builderDraft), "application/msword", resumeExportName(state.builderDraft, "doc"));
}

async function copyBuilderResume() {
  syncBuilderFromForm();
  const copied = await copyText(resumePlainText(state.builderDraft));
  showToast(copied ? "Resume text copied." : "Could not copy resume text.");
}

function tags(items, flavor) {
  return (items || []).slice(0, 6).map(item => `<span class="pill ${flavor}">${escapeHtml(item)}</span>`).join("");
}

function statusLabel(status) {
  return {
    ready: "Ready",
    "needs-answer": "Needs answer",
    approved: "Approved",
    autofilled: "Autofilled",
    submitted: "Submitted",
    skipped: "Skipped"
  }[status] || status;
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.toast.classList.remove("show"), 3000);
}

function setBusy(button, busyText) {
  const original = button.innerHTML;
  button.disabled = true;
  button.textContent = busyText;
  return () => {
    button.disabled = false;
    button.innerHTML = original;
    if (window.lucide) lucide.createIcons();
  };
}

async function findResumeMatches() {
  state.autoSearching = true;
  renderGettingStarted();
  const matchedState = await api("/api/jobs/match-resume", { method: "POST", body: "{}" });
  state.data = matchedState;
  state.lastAutoMatchCount = matchedState.autoMatch?.count ?? 0;
  state.autoSearching = false;
  els.jobFilter.value = "matched";
  render();
  const role = matchedState.autoMatch?.role || state.data.resume?.roles?.[0] || "your resume";
  const location = matchedState.autoMatch?.location || "any location";
  els.targetResult.textContent = `${state.lastAutoMatchCount} current match${state.lastAutoMatchCount === 1 ? "" : "es"} found for ${role} in ${location}.`;
  setView("dashboard");
  document.querySelector("#jobsList")?.scrollIntoView({ behavior: "smooth", block: "start" });
  return state.lastAutoMatchCount;
}

async function uploadResume(event) {
  event?.preventDefault();
  if (!els.resumeInput.files.length) {
    showToast("Choose a resume file first.");
    return;
  }
  const busyButton = event?.submitter || (state.uploadFromWelcome ? els.quickUploadResume : els.uploadResumeBtn);
  const done = setBusy(busyButton, "Uploading...");
  try {
    const form = new FormData();
    form.append("resume", els.resumeInput.files[0]);
    state.data = await api("/api/upload-resume", { method: "POST", body: form });
    state.builderDraft = null;
    state.builderLoadedVersion = "";
    state.builderDirty = false;
    state.forceNextTargetRole = true;
    const role = state.data.resume?.roles?.[0] || "";
    els.targetRole.value = role;
    els.targetRole.dataset.resumeRole = role;
    state.lastAutoTargetRole = role;
    render();
    if (!role) {
      showToast("Resume uploaded, but no target role could be identified.");
      return;
    }

    showToast(`Resume parsed. Searching current ${role} jobs now.`);
    const matchCount = await findResumeMatches();
    showToast(`${matchCount} resume-matched job${matchCount === 1 ? "" : "s"} found.`);
  } catch (error) {
    state.autoSearching = false;
    if (state.data) render();
    showToast(error.message);
  } finally {
    state.uploadFromWelcome = false;
    done();
  }
}

async function removeResume() {
  const done = setBusy(els.removeResumeBtn, "Removing...");
  try {
    state.data = await api("/api/resume", { method: "DELETE" });
    els.resumeInput.value = "";
    render();
    showToast("Resume removed.");
  } catch (error) {
    showToast(error.message);
  } finally {
    done();
  }
}

async function savePreferences() {
  const done = setBusy(els.savePreferences, "Saving...");
  try {
    state.data = await api("/api/preferences", {
      method: "PATCH",
      body: JSON.stringify({
        roles: els.rolesInput.value,
        locations: els.locationsInput.value,
        minimumScore: Number(els.minimumScoreInput.value),
        maxQueue: Number(els.maxQueueInput.value),
        reviewBeforeSubmit: els.reviewToggle.checked
      })
    });
    els.targetLocation.value = state.data.preferences.locations[0] || "";
    els.jobFilter.value = "matched";
    render();
    showToast("Preferences saved. Existing jobs were updated to the selected region.");
  } catch (error) {
    showToast(error.message);
  } finally {
    done();
  }
}

async function saveAnswers(event) {
  event.preventDefault();
  const done = setBusy(event.submitter, "Saving...");
  try {
    state.data = await api("/api/answers", {
      method: "PATCH",
      body: JSON.stringify({
        firstName: els.firstNameInput.value,
        lastName: els.lastNameInput.value,
        email: els.emailInput.value,
        phone: els.phoneInput.value,
        address: els.addressInput.value,
        city: els.cityInput.value,
        province: els.provinceInput.value,
        postalCode: els.postalCodeInput.value,
        country: els.countryInput.value,
        linkedin: els.linkedinInput.value,
        github: els.githubInput.value,
        authorization: els.authorizationInput.value,
        sponsorship: els.sponsorshipInput.value,
        salary: els.salaryInput.value,
        availability: els.availabilityInput.value,
        portfolio: els.portfolioInput.value,
        currentCompany: els.currentCompanyInput.value,
        currentTitle: els.currentTitleInput.value,
        school: els.schoolInput.value,
        degree: els.degreeInput.value,
        yearsExperience: els.yearsExperienceInput.value
      })
    });
    render();
    showToast("Answer bank saved.");
  } catch (error) {
    showToast(error.message);
  } finally {
    done();
  }
}

async function addSource(event) {
  event.preventDefault();
  const done = setBusy(event.submitter, "Adding...");
  
  let name = els.sourceName.value.trim();
  const type = els.sourceType.value;
  if (!name) {
    if (type === "linkedin") name = "LinkedIn Search";
    else if (type === "remotive") name = "Remotive";
    else name = els.sourceValue.value.trim();
  }

  try {
    state.data = await api("/api/sources", {
      method: "POST",
      body: JSON.stringify({
        name: name,
        type: type,
        value: els.sourceValue.value
      })
    });
    event.target.reset();
    render();
    showToast("Source added.");
  } catch (error) {
    showToast(error.message);
  } finally {
    done();
  }
}

async function scanSources() {
  const done = setBusy(els.scanSources, "Scanning...");
  try {
    const data = await api("/api/scan", { method: "POST", body: "{}" });
    state.data = data;
    render();
    const scan = data.scan || {};
    showToast(`Scan complete: ${scan.added || 0} new, ${scan.updated || 0} updated.`);
  } catch (error) {
    showToast(error.message);
  } finally {
    done();
  }
}

async function startApplying() {
  const done = setBusy(els.startApplying, "Preparing...");
  try {
    state.data = await api("/api/apply/start", { method: "POST", body: "{}" });
    render();
    showToast(`${state.data.created?.length || 0} application drafts prepared.`);
    setView("queue");
  } catch (error) {
    showToast(error.message);
  } finally {
    done();
  }
}

async function runTargetedApply(event) {
  event.preventDefault();
  const done = setBusy(els.targetApply || event.submitter, "Preparing...");
  try {
    const data = await api("/api/apply/target", {
      method: "POST",
      body: JSON.stringify({
        role: els.targetRole.value,
        company: els.targetCompany.value,
        location: els.targetLocation.value,
        minScore: Number(els.targetMinScore.value),
        limit: Number(els.targetLimit.value),
        scanBefore: els.targetScanBefore.checked
      })
    });
    state.data = data;
    render();
    const run = data.targetRun;
    const label = [run.target.role, run.target.company, run.target.location].filter(Boolean).join(" / ");
    els.targetResult.textContent = `${run.createdDrafts} draft${run.createdDrafts === 1 ? "" : "s"} prepared for ${label}. ${run.matchedJobs} matching unqueued job${run.matchedJobs === 1 ? "" : "s"} found.`;
    showToast(`${run.createdDrafts} targeted application draft${run.createdDrafts === 1 ? "" : "s"} prepared.`);
    setView("queue");
  } catch (error) {
    showToast(error.message);
  } finally {
    done();
  }
}

async function queueJob(jobId) {
  try {
    state.data = await api("/api/queue", {
      method: "POST",
      body: JSON.stringify({ jobId })
    });
    render();
    showToast("Draft queued for review.");
  } catch (error) {
    showToast(error.message);
  }
}

async function toggleSource(sourceId) {
  const source = state.data.sources.find(item => item.id === sourceId);
  if (!source) return;
  try {
    state.data = await api(`/api/sources/${sourceId}`, {
      method: "PATCH",
      body: JSON.stringify({ enabled: !source.enabled })
    });
    render();
  } catch (error) {
    showToast(error.message);
  }
}

async function deleteSource(sourceId) {
  try {
    state.data = await api(`/api/sources/${sourceId}`, { method: "DELETE" });
    render();
    showToast("Source removed.");
  } catch (error) {
    showToast(error.message);
  }
}

function openReview(queueId) {
  const item = state.data.queue.find(entry => entry.id === queueId);
  if (!item) return;
  state.reviewItem = item;
  els.dialogTitle.textContent = item.title;
  els.dialogMeta.textContent = `${item.company} - ${item.location || "Location not listed"} - score ${item.score}`;
  els.dialogCoverNote.value = item.coverNote || "";
  els.dialogAnswers.innerHTML = Object.entries(item.answers || {}).map(([key, value]) => `
    <div class="answer-chip">
      <strong>${escapeHtml(key)}</strong>
      <span>${escapeHtml(value || "Blank")}</span>
    </div>
  `).join("");
  if (window.lucide) lucide.createIcons();
  els.reviewDialog.showModal();
}

async function approveQueue(queueId) {
  const applicationWindow = window.open("about:blank", "_blank");
  if (applicationWindow) {
    applicationWindow.document.title = "Opening employer career page...";
    applicationWindow.document.body.textContent = "Opening the official employer career page...";
  }
  try {
    const data = await api(`/api/queue/${queueId}/approve`, { method: "POST", body: "{}" });
    state.data = data;
    render();
    if (data.openUrl) {
      if (applicationWindow) applicationWindow.location.replace(data.openUrl);
      else window.open(data.openUrl, "_blank", "noopener,noreferrer");
      showToast("Official application page opened.");
    } else {
      applicationWindow?.close();
    }
  } catch (error) {
    applicationWindow?.close();
    showToast(error.message);
  }
}

function formatAnswerPackage(payload = {}) {
  const labels = {
    fullName: "Full name", email: "Email", phone: "Phone", address: "Street address",
    city: "City", province: "Province/state", postalCode: "Postal/ZIP code", country: "Country",
    linkedin: "LinkedIn", github: "GitHub", portfolio: "Portfolio", currentCompany: "Current company",
    currentTitle: "Current title", school: "School", degree: "Degree", yearsExperience: "Years of experience",
    authorization: "Work authorization", sponsorship: "Sponsorship", salary: "Salary expectation",
    availability: "Availability", skills: "Skills", coverNote: "Cover note"
  };
  return Object.entries(labels)
    .filter(([key]) => String(payload[key] || "").trim())
    .map(([key, label]) => `${label}: ${String(payload[key]).trim()}`)
    .join("\n\n");
}

async function copyText(value) {
  if (!value) return false;
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  }
}

async function autofillQueue(queueId) {
  const hostedAssist = !state.data.capabilities?.browserAutofill;
  const applicationWindow = hostedAssist ? window.open("about:blank", "_blank") : null;
  if (applicationWindow) {
    applicationWindow.document.title = "Opening application...";
    applicationWindow.document.body.textContent = "Preparing your application details...";
  }
  try {
    showToast(hostedAssist ? "Preparing answers and opening the application..." : "Opening browser and autofilling the application page...");
    const data = await api(`/api/queue/${queueId}/autofill`, { method: "POST", body: "{}" });
    state.data = data;
    render();
    if (data.autofill?.mode === "hosted-assist") {
      const answerPackage = formatAnswerPackage(data.autofill.payload);
      const copied = await copyText(answerPackage);
      if (applicationWindow && data.openUrl) {
        applicationWindow.location.replace(data.openUrl);
      } else if (data.openUrl) {
        window.open(data.openUrl, "_blank", "noreferrer");
      }
      showToast(copied
        ? "Application opened. Your prepared answers are copied and ready to paste."
        : "Application opened. Review your saved answers in ApplyPilot while completing the form.");
      return;
    }
    applicationWindow?.close();
    const filled = data.autofill?.filled?.length || 0;
    const warnings = data.autofill?.warnings?.length || 0;
    showToast(`Autofilled ${filled} field${filled === 1 ? "" : "s"}. Review before submitting.${warnings ? ` ${warnings} warning${warnings === 1 ? "" : "s"}.` : ""}`);
  } catch (error) {
    applicationWindow?.close();
    showToast(error.message);
  }
}

async function markSubmitted(queueId) {
  try {
    state.data = await api(`/api/queue/${queueId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "submitted", submittedAt: new Date().toISOString() })
    });
    render();
    showToast("Application marked submitted.");
  } catch (error) {
    showToast(error.message);
  }
}

function setView(view) {
  state.view = view;
  const layout = document.querySelector(".layout");
  const isMobileResume = view === "resume" && window.matchMedia("(max-width: 900px)").matches;
  const workspaceView = view === "resume" ? "dashboard" : view;
  layout?.classList.toggle("show-mobile-resume", isMobileResume);
  layout?.classList.toggle("show-resume-panel", view === "resume");
  layout?.classList.toggle("builder-mode", view === "resume-builder");
  document.querySelectorAll(".workspace").forEach(panel => panel.classList.toggle("hidden", panel.id !== workspaceView));
  document.querySelectorAll(".rail-button").forEach(button => button.classList.toggle("active", button.dataset.target === view));
  const titles = {
    dashboard: ["Find your next role", "Upload your resume, choose a role, and review the matches."],
    resume: ["Your resume", "Update your file and matching preferences."],
    "resume-builder": ["Resume Builder", "Build a clean, single-column resume and check its ATS readiness."],
    sources: ["Job sources", "Add a company careers page when you need it."],
    queue: ["Your applications", "Review each draft before opening the official application page."],
    answers: ["Saved answers", "Optional details that speed up application drafts."]
  };
  const [title, subtitle] = titles[view] || titles.dashboard;
  document.querySelector("#viewTitle").textContent = title;
  document.querySelector("#viewSubtitle").textContent = subtitle;
}

function bindEvents() {
  els.resumeForm.addEventListener("submit", uploadResume);
  els.removeResumeBtn.addEventListener("click", removeResume);
  els.resumeInput.addEventListener("change", () => {
    if (els.resumeInput.files.length) {
      els.resumeFileName.textContent = els.resumeInput.files[0].name;
      els.resumeMeta.textContent = "Selected. Parsing and finding matching jobs...";
      uploadResume();
    }
  });

  els.quickUploadResume.addEventListener("click", () => {
    state.uploadFromWelcome = true;
    els.resumeInput.click();
  });
  els.quickScanSources.addEventListener("click", async () => {
    const done = setBusy(els.quickScanSources, "Searching...");
    try {
      const matchCount = await findResumeMatches();
      showToast(`${matchCount} resume-matched job${matchCount === 1 ? "" : "s"} found.`);
    } catch (error) {
      state.autoSearching = false;
      if (state.data) render();
      showToast(error.message);
    } finally {
      done();
    }
  });

  // Antigravity cursor glow tracking
  document.addEventListener("mousemove", (e) => {
    const x = e.clientX;
    const y = e.clientY;
    document.documentElement.style.setProperty('--mouse-x', `${x}px`);
    document.documentElement.style.setProperty('--mouse-y', `${y}px`);
  });

  els.savePreferences.addEventListener("click", savePreferences);
  els.answersForm.addEventListener("submit", saveAnswers);
  els.resumeBuilderForm.addEventListener("submit", event => event.preventDefault());
  els.resumeBuilderForm.addEventListener("input", event => {
    if (event.target.matches('[data-field="current"]')) {
      const card = event.target.closest(".repeater-item");
      const endDate = card?.querySelector('[data-field="endDate"]');
      if (endDate) {
        endDate.disabled = event.target.checked;
        if (event.target.checked) endDate.value = "";
      }
    }
    syncBuilderFromForm();
  });
  els.resumeBuilderForm.addEventListener("click", event => {
    const remove = event.target.closest(".remove-builder-item");
    const move = event.target.closest(".move-builder-item");
    if (remove) removeBuilderItem(remove.dataset.type, remove.dataset.id);
    if (move) changeBuilderItem(move.dataset.type, move.dataset.id, move.dataset.direction);
  });
  els.builderDensity.addEventListener("change", syncBuilderFromForm);
  els.addExperience.addEventListener("click", () => addBuilderItem("experience"));
  els.addEducation.addEventListener("click", () => addBuilderItem("education"));
  els.addProject.addEventListener("click", () => addBuilderItem("projects"));
  els.addCertification.addEventListener("click", () => addBuilderItem("certifications"));
  els.saveResumeBuilder.addEventListener("click", saveBuilderDraft);
  els.copyResumeText.addEventListener("click", copyBuilderResume);
  els.downloadResumeText.addEventListener("click", downloadBuilderText);
  els.downloadResumeWord.addEventListener("click", downloadBuilderWord);
  els.printResume.addEventListener("click", printBuilderResume);
  els.sourceType.addEventListener("change", () => {
    const val = els.sourceType.value;
    if (val === "linkedin" || val === "remotive") {
      els.sourceValue.placeholder = "Search query (e.g. Software Developer)";
    } else if (val === "generic") {
      els.sourceValue.placeholder = "https://company.com/careers";
    } else {
      els.sourceValue.placeholder = "openai, vercel, or slug";
    }
  });

  els.sourceForm.addEventListener("submit", addSource);
  els.targetForm.addEventListener("submit", runTargetedApply);
  els.scanSources.addEventListener("click", scanSources);
  els.startApplying.addEventListener("click", startApplying);
  els.refreshState.addEventListener("click", loadState);
  els.jobFilter.addEventListener("change", renderJobs);

  document.querySelectorAll(".rail-button").forEach(button => {
    button.addEventListener("click", () => {
      const target = button.dataset.target;
      setView(target);
    });
  });

  window.addEventListener("resize", () => setView(state.view));

  els.jobsList.addEventListener("click", event => {
    const queueButton = event.target.closest(".queue-job");
    if (queueButton) queueJob(queueButton.dataset.jobId);
  });

  els.sourcesList.addEventListener("click", event => {
    const toggle = event.target.closest(".toggle-source");
    const remove = event.target.closest(".delete-source");
    if (toggle) toggleSource(toggle.dataset.sourceId);
    if (remove) deleteSource(remove.dataset.sourceId);
  });

  els.queueList.addEventListener("click", event => {
    const review = event.target.closest(".review-queue");
    const autofill = event.target.closest(".autofill-queue");
    const approve = event.target.closest(".approve-queue");
    const submitted = event.target.closest(".mark-submitted");
    if (review) openReview(review.dataset.queueId);
    if (autofill) autofillQueue(autofill.dataset.queueId);
    if (approve) approveQueue(approve.dataset.queueId);
    if (submitted) markSubmitted(submitted.dataset.queueId);
  });

  els.approveAndOpen.addEventListener("click", event => {
    event.preventDefault();
    if (!state.reviewItem) return;
    els.reviewDialog.close();
    approveQueue(state.reviewItem.id);
  });
}

bindEvents();
let isSignupMode = false;
document.querySelector("#authToggleMode").addEventListener("click", (e) => {
  e.preventDefault();
  isSignupMode = !isSignupMode;
  e.target.textContent = isSignupMode ? "Sign in to account" : "Create an account";
  document.querySelector("#authBtn").textContent = isSignupMode ? "Sign Up" : "Sign In";
});

document.querySelector("#authForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.querySelector("#authEmail").value;
  const password = document.querySelector("#authPassword").value;
  const errorEl = document.querySelector("#authError");
  const btn = document.querySelector("#authBtn");
  
  errorEl.style.display = "none";
  btn.disabled = true;
  btn.textContent = "Loading...";
  
  try {
    const endpoint = isSignupMode ? "/api/auth/signup" : "/api/auth/login";
    await api(endpoint, {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
    await initAuth();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = "block";
  } finally {
    btn.disabled = false;
    btn.textContent = isSignupMode ? "Sign Up" : "Sign In";
  }
});

document.querySelector("#logoutBtn").addEventListener("click", async () => {
  try {
    await api("/api/auth/logout", { method: "POST" });
    window.location.reload();
  } catch (err) {
    console.error("Logout failed", err);
  }
});

document.querySelector("#consentForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (!document.querySelector("#consentData").checked || !document.querySelector("#consentAutomation").checked) return;
  rememberLocalConsent();
  document.querySelector("#particle-canvas").hidden = false;
  initParticles();
  await initAuth();
});

startApp();
if (window.lucide) lucide.createIcons();

// --- Mouse Attraction Canvas Particle Engine ---
function initParticles() {
  const canvas = document.getElementById('particle-canvas');
  if (!canvas) return;
  if (!readLocalConsent()) {
    canvas.hidden = true;
    return;
  }
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const compactDevice = window.matchMedia('(max-width: 900px), (pointer: coarse)').matches;
  const saveData = Boolean(navigator.connection?.saveData);
  if (reducedMotion || compactDevice || saveData) {
    canvas.hidden = true;
    return;
  }
  const ctx = canvas.getContext('2d');
  
  let width, height;
  let particles = [];
  let animationFrame = null;
  let lastFrameAt = 0;
  
  // Google Colors: Blue, Red, Yellow, Green, Purple
  const colors = ['#4285F4', '#EA4335', '#FBBC05', '#34A853', '#A142F4'];
  
  let mouse = { x: -1000, y: -1000, active: false };
  let field = { x: window.innerWidth * 0.5, y: window.innerHeight * 0.45 };
  let time = 0;
  
  document.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.active = true;
  });

  document.addEventListener('mouseleave', () => {
    mouse.active = false;
  });

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    createParticles();
  }
  
  window.addEventListener('resize', resize);

  function smoothstep(edge0, edge1, value) {
    const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }

  function waveNoise(x, y, offset, speed = 1) {
    return Math.sin(x * 0.012 + y * 0.006 + time * speed + offset)
      * Math.cos(x * 0.004 - y * 0.01 + time * speed * 0.7 + offset);
  }
  
  class Particle {
    constructor() {
      const theta = Math.random() * Math.PI * 2;
      
      this.baseX = Math.random() * width;
      this.baseY = Math.random() * height;
      
      this.x = this.baseX;
      this.y = this.baseY;
      this.vx = 0;
      this.vy = 0;
      this.color = colors[Math.floor(Math.random() * colors.length)];
      this.size = Math.random() * 2 + 1.5;
      this.angle = theta + (Math.PI / 4);
      this.seed = Math.random() * Math.PI * 2;
      this.scale = 0.35;
      this.velocity = 0;
    }
    
    update() {
      const dx = field.x - this.baseX;
      const dy = field.y - this.baseY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const safeDistance = Math.max(distance, 0.001);
      const forceDirectionX = dx / safeDistance;
      const forceDirectionY = dy / safeDistance;
      const ringRadius = Math.min(width, height) * 0.18
        + Math.sin(time) * 16
        + Math.cos(time * 3) * 10;
      const ringWidth = Math.max(42, Math.min(width, height) * 0.075);
      const innerWidth = Math.max(18, ringWidth * 0.34);
      const noisyDistance = distance + waveNoise(this.baseX, this.baseY, this.seed, 0.35) * 7;
      const ring = smoothstep(ringRadius - ringWidth * 2, ringRadius, distance)
        - smoothstep(ringRadius, ringRadius + ringWidth, noisyDistance);
      const inner = smoothstep(ringRadius + innerWidth, ringRadius, distance);
      const ringForce = Math.pow(Math.max(0, ring), 3);
      const innerForce = Math.max(0, inner) * 0.22;
      const distantDrift = mouse.active ? Math.max(0, 1 - distance / Math.hypot(width, height)) * 0.018 : 0;
      const midNoiseX = waveNoise(this.baseX, this.baseY, this.seed + 1.7, 0.32) * 0.42;
      const midNoiseY = waveNoise(this.baseY, this.baseX, this.seed + 4.2, 0.3) * 0.42;

      if (mouse.active) {
        const pull = innerForce + distantDrift;
        this.vx += forceDirectionX * pull;
        this.vy += forceDirectionY * pull;
        this.vx -= forceDirectionX * ringForce * 1.65;
        this.vy -= forceDirectionY * ringForce * 1.65;
      }

      this.vx += midNoiseX * (0.03 + ringForce * 0.12);
      this.vy += midNoiseY * (0.03 + ringForce * 0.12);

      this.vx += (this.baseX - this.x) * 0.018;
      this.vy += (this.baseY - this.y) * 0.018;
      
      this.vx *= 0.86; // Friction
      this.vy *= 0.86;
      
      this.x += this.vx;
      this.y += this.vy;
      this.velocity = this.velocity * 0.62 + Math.min(1, Math.hypot(this.vx, this.vy) * 0.28);
      this.scale += ((0.42 + ring * 1.1 + inner * 0.5) - this.scale) * 0.18;
      this.angle = Math.atan2(this.y - field.y, this.x - field.x)
        + waveNoise(this.baseX, this.baseY, this.seed + 8.1, 0.6) * 0.8;
    }
    
    draw() {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      ctx.beginPath();
      ctx.lineCap = "round";
      ctx.lineWidth = this.size * (0.75 + this.velocity * 0.8);
      const length = this.size * (1.2 + this.scale * 1.7);
      ctx.moveTo(-length * 0.42, 0);
      ctx.lineTo(length, 0);
      ctx.strokeStyle = this.color;
      ctx.stroke();
      ctx.restore();
    }
  }
  
  function createParticles() {
    particles = [];
    const density = Math.min(90, Math.floor((width * height) / 24000));
    for (let i = 0; i < density; i++) {
      particles.push(new Particle());
    }
  }
  
  function animate(timestamp) {
    if (document.hidden) {
      animationFrame = null;
      return;
    }
    animationFrame = requestAnimationFrame(animate);
    if (timestamp - lastFrameAt < 33) return;
    const elapsed = lastFrameAt ? Math.min(50, timestamp - lastFrameAt) : 33;
    lastFrameAt = timestamp;
    time += elapsed / 1000;
    const idleX = width * 0.5 + Math.sin(time * 0.66 + 94.234) * width * 0.08;
    const idleY = height * 0.45 + Math.sin(time * 0.75 + 21.028) * height * 0.04;
    const targetX = mouse.active ? mouse.x + Math.sin(time * 0.66 + 94.234) * 18 : idleX;
    const targetY = mouse.active ? mouse.y + Math.sin(time * 0.75 + 21.028) * 12 : idleY;
    field.x += (targetX - field.x) * (mouse.active ? 0.045 : 0.018);
    field.y += (targetY - field.y) * (mouse.active ? 0.045 : 0.018);
    ctx.clearRect(0, 0, width, height);
    particles.forEach(p => {
      p.update();
      p.draw();
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && animationFrame === null) {
      lastFrameAt = 0;
      animationFrame = requestAnimationFrame(animate);
    }
  });
  
  resize();
  animationFrame = requestAnimationFrame(animate);
}

initParticles();
