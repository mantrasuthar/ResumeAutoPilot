# ApplyPilot Local

ApplyPilot Local is a runnable Windows-friendly job application assistant.

## Start
Double-click `start-app.cmd`, or run:

```powershell
npm start
```

Then open:

```text
http://127.0.0.1:4757
```

## Stop
Double-click `stop-app.cmd`, or close the Node process running `outputs\app\server.js`.

## What Works
- Upload a resume and parse profile facts locally.
- Configure target roles, locations, score threshold, and queue limit.
- Scan live ATS/company sources:
  - OpenAI Ashby
  - Figma Greenhouse
  - Databricks Greenhouse
- Score jobs against the resume profile.
- Run a targeted application search for a specific role, company, location, score floor, and draft limit.
- Prepare application drafts with tailored notes and reusable answers.
- Review each draft before opening the official company application URL.
- Keep local state in `data\state.json`.

## Safety
The app does not silently submit applications. It prepares drafts and opens the official application page only after review/approval.
