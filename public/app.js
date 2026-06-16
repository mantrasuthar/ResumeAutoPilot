const state = {
  data: null,
  view: "dashboard",
  reviewItem: null,
  lastAutoTargetRole: "",
  forceNextTargetRole: false
};

const els = {
  serverStatus: document.querySelector("#serverStatus"),
  resumeForm: document.querySelector("#resumeForm"),
  resumeInput: document.querySelector("#resumeInput"),
  removeResumeBtn: document.querySelector("#removeResumeBtn"),
  uploadResumeBtn: document.querySelector("#uploadResumeBtn"),
  resumeFileName: document.querySelector("#resumeFileName"),
  resumeMeta: document.querySelector("#resumeMeta"),
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
  emailInput: document.querySelector("#emailInput"),
  phoneInput: document.querySelector("#phoneInput"),
  authorizationInput: document.querySelector("#authorizationInput"),
  sponsorshipInput: document.querySelector("#sponsorshipInput"),
  salaryInput: document.querySelector("#salaryInput"),
  availabilityInput: document.querySelector("#availabilityInput"),
  portfolioInput: document.querySelector("#portfolioInput"),
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
  try {
    await api("/api/auth/me");
    document.querySelector("#auth-screen").style.display = "none";
    document.querySelector(".app-shell").style.display = "grid";
    await loadState();
  } catch (err) {
    document.querySelector("#auth-screen").style.display = "flex";
    document.querySelector(".app-shell").style.display = "none";
  }
}

async function loadState() {
  try {
    state.data = await api("/api/state");
    els.serverStatus.textContent = state.data.capabilities?.hostedMode ? "Hosted website" : "Running locally";
    render();
  } catch (error) {
    els.serverStatus.textContent = "Server unavailable";
    showToast(error.message);
  }
}

function render() {
  if (!state.data) return;
  renderPreferences();
  renderResume();
  renderStats();
  renderTargetDefaults();
  renderJobs();
  renderSources();
  renderQueue();
  renderProfile();
  renderActivity();
  renderAnswers();
  if (window.lucide) lucide.createIcons();
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
    els.resumeMeta.textContent = "TXT parses best; PDF and Word get a rough local extraction.";
    els.removeResumeBtn.style.display = "none";
    els.uploadResumeBtn.innerHTML = '<i data-lucide="upload-cloud" size="16"></i> Upload';
    return;
  }
  els.resumeFileName.textContent = resume.filename;
  els.resumeSubtitle.textContent = `${resume.skills.length} skills, ${resume.roles.length} role hints, ${resume.wordCount} words.`;
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
        <a class="secondary link-button" href="${escapeAttr(job.url || job.applyUrl || "#")}" target="_blank" rel="noreferrer">
          <i data-lucide="external-link" size="14"></i>
          Open
        </a>
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
    const autofillDisabled = item.status === "submitted" || !canAutofill;
    const autofillTitle = canAutofill
      ? "Open and autofill in local Edge or Chrome"
      : "Desktop-only feature. Hosted websites cannot control your local browser.";
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
          Open + autofill
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
    ["Locations", resume.locations.length ? resume.locations.join(", ") : "None detected"]
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
  els.emailInput.value = answers.email || "";
  els.phoneInput.value = answers.phone || "";
  els.authorizationInput.value = answers.authorization || "";
  els.sponsorshipInput.value = answers.sponsorship || "";
  els.salaryInput.value = answers.salary || "";
  els.availabilityInput.value = answers.availability || "";
  els.portfolioInput.value = answers.portfolio || "";
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
  const original = button.textContent;
  button.disabled = true;
  button.textContent = busyText;
  return () => {
    button.disabled = false;
    button.textContent = original;
  };
}

async function uploadResume(event) {
  event.preventDefault();
  if (!els.resumeInput.files.length) {
    showToast("Choose a resume file first.");
    return;
  }
  const done = setBusy(event.submitter, "Uploading...");
  try {
    const form = new FormData();
    form.append("resume", els.resumeInput.files[0]);
    state.data = await api("/api/upload-resume", { method: "POST", body: form });
    state.forceNextTargetRole = true;
    render();
    const role = state.data.resume?.roles?.[0];
    showToast(role ? `Resume uploaded. Target role set to ${role}.` : "Resume uploaded. No target role was inferred.");
  } catch (error) {
    showToast(error.message);
  } finally {
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
    render();
    showToast("Preferences saved.");
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
        email: els.emailInput.value,
        phone: els.phoneInput.value,
        authorization: els.authorizationInput.value,
        sponsorship: els.sponsorshipInput.value,
        salary: els.salaryInput.value,
        availability: els.availabilityInput.value,
        portfolio: els.portfolioInput.value
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
  try {
    const data = await api(`/api/queue/${queueId}/approve`, { method: "POST", body: "{}" });
    state.data = data;
    render();
    if (data.openUrl) {
      window.open(data.openUrl, "_blank", "noreferrer");
      showToast("Official application page opened.");
    }
  } catch (error) {
    showToast(error.message);
  }
}

async function autofillQueue(queueId) {
  try {
    showToast("Opening browser and autofilling the application page...");
    const data = await api(`/api/queue/${queueId}/autofill`, { method: "POST", body: "{}" });
    state.data = data;
    render();
    const filled = data.autofill?.filled?.length || 0;
    const warnings = data.autofill?.warnings?.length || 0;
    showToast(`Autofilled ${filled} field${filled === 1 ? "" : "s"}. Review before submitting.${warnings ? ` ${warnings} warning${warnings === 1 ? "" : "s"}.` : ""}`);
  } catch (error) {
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
  document.querySelectorAll(".workspace").forEach(panel => panel.classList.toggle("hidden", panel.id !== workspaceView));
  document.querySelectorAll(".rail-button").forEach(button => button.classList.toggle("active", button.dataset.target === view));
  const titles = {
    dashboard: ["Dashboard", "Real scan and application preparation for your local profile."],
    resume: ["Resume", "Resume settings live in the left panel."],
    sources: ["Sources", "Add company career pages and ATS job boards."],
    queue: ["Queue", "Review drafts before opening official application pages."],
    answers: ["Answer bank", "Reusable answers for application drafts."]
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
      els.resumeMeta.textContent = "Selected locally. Click Upload to parse.";
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

initAuth();
if (window.lucide) lucide.createIcons();

// --- Mouse Attraction Canvas Particle Engine ---
function initParticles() {
  const canvas = document.getElementById('particle-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  let width, height;
  let particles = [];
  
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
    const density = Math.floor((width * height) / 12000); 
    for (let i = 0; i < density; i++) {
      particles.push(new Particle());
    }
  }
  
  function animate() {
    time += 0.016;
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
    requestAnimationFrame(animate);
  }
  
  resize();
  animate();
}

initParticles();
