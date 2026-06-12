const state = {
  data: null,
  view: "dashboard",
  reviewItem: null
};

const els = {
  serverStatus: document.querySelector("#serverStatus"),
  resumeForm: document.querySelector("#resumeForm"),
  resumeInput: document.querySelector("#resumeInput"),
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
    headers: options.body instanceof FormData
      ? options.headers
      : { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed: ${response.status}`);
  return data;
}

async function loadState() {
  try {
    state.data = await api("/api/state");
    els.serverStatus.textContent = "Running locally";
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
}

function renderTargetDefaults() {
  const prefs = state.data.preferences;
  if (!els.targetRole.value) els.targetRole.value = prefs.roles[0] || "";
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
    return;
  }
  els.resumeFileName.textContent = resume.filename;
  els.resumeSubtitle.textContent = `${resume.skills.length} skills, ${resume.roles.length} role hints, ${resume.wordCount} words.`;
  els.resumeMeta.textContent = `${resume.parseQuality} parse, uploaded ${formatDate(resume.uploadedAt)}.`;
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
  const jobs = state.data.jobs.filter(job => filter === "all" || job.status === filter);
  els.jobsCaption.textContent = `${jobs.length} shown, ${state.data.jobs.length} scanned total.`;
  if (!jobs.length) {
    els.jobsList.className = "job-list empty-state";
    els.jobsList.textContent = state.data.jobs.length ? "No jobs match this filter." : "No scanned jobs yet.";
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
      </div>
      <div class="job-actions">
        <div class="score-ring" style="--score:${job.score}%">${job.score}</div>
        <button class="secondary queue-job" data-job-id="${job.id}">Queue</button>
        <a class="secondary link-button" href="${escapeAttr(job.url || job.applyUrl || "#")}" target="_blank" rel="noreferrer">Open</a>
      </div>
    </article>
  `).join("");
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
        <div class="source-status">${escapeHtml(source.lastStatus || "Not scanned yet")} ${source.lastScannedAt ? `- ${escapeHtml(formatDate(source.lastScannedAt))}` : ""}</div>
      </div>
      <div class="job-actions">
        <button class="secondary toggle-source" data-source-id="${source.id}">${source.enabled ? "Disable" : "Enable"}</button>
        <button class="danger delete-source" data-source-id="${source.id}">Remove</button>
      </div>
    </article>
  `).join("");
}

function renderQueue() {
  if (!state.data.queue.length) {
    els.queueList.className = "queue-list empty-state";
    els.queueList.textContent = "No drafts queued yet.";
    return;
  }
  els.queueList.className = "queue-list";
  els.queueList.innerHTML = state.data.queue.map(item => `
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
        <button class="secondary review-queue" data-queue-id="${item.id}">Review</button>
        <button class="primary approve-queue" data-queue-id="${item.id}" ${item.status === "submitted" ? "disabled" : ""}>Approve and open</button>
        <button class="secondary mark-submitted" data-queue-id="${item.id}" ${item.status === "submitted" ? "disabled" : ""}>Mark submitted</button>
      </div>
    </article>
  `).join("");
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
  const answers = state.data.answerBank;
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
    render();
    showToast("Resume uploaded and parsed.");
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
  try {
    state.data = await api("/api/sources", {
      method: "POST",
      body: JSON.stringify({
        name: els.sourceName.value,
        type: els.sourceType.value,
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
  document.querySelectorAll(".workspace").forEach(panel => panel.classList.toggle("hidden", panel.id !== view));
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
  els.savePreferences.addEventListener("click", savePreferences);
  els.answersForm.addEventListener("submit", saveAnswers);
  els.sourceForm.addEventListener("submit", addSource);
  els.targetForm.addEventListener("submit", runTargetedApply);
  els.scanSources.addEventListener("click", scanSources);
  els.startApplying.addEventListener("click", startApplying);
  els.refreshState.addEventListener("click", loadState);
  els.jobFilter.addEventListener("change", renderJobs);

  document.querySelectorAll(".rail-button").forEach(button => {
    button.addEventListener("click", () => {
      const target = button.dataset.target;
      setView(target === "resume" ? "dashboard" : target);
    });
  });

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
    const approve = event.target.closest(".approve-queue");
    const submitted = event.target.closest(".mark-submitted");
    if (review) openReview(review.dataset.queueId);
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
loadState();
