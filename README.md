# ApplyPilot

ApplyPilot is a runnable job application assistant. It can run as a Windows-friendly local app or as a hosted Node website.

## Start
Double-click `start-app.cmd`, or run:

```powershell
npm start
```

Then open:

```text
http://127.0.0.1:4757
```

## Host as a Website

Deploy `outputs/app` as a Node web service, not static-only hosting. See `DEPLOYMENT.md` for Render, Railway, Fly.io, Docker, and VPS instructions.

Use these environment variables on a hosted deployment:

```text
NODE_ENV=production
HOST=0.0.0.0
DATA_DIR=/path/to/persistent/data
DISABLE_BROWSER_AUTOFILL=1
APP_PASSWORD=choose-a-strong-password
```

## Stop
Double-click `stop-app.cmd`, or close the Node process running `outputs\app\server.js`.

## What Works
- Upload a resume and parse profile facts locally.
- Configure target roles, locations, score threshold, and queue limit.
- Scan live ATS/company sources:
  - Saskatchewan: 7shifts, Vendasta, Coconut Software, Nutrien, Cameco, SaskPower, SaskTel, Federated Co-operatives, Conexus
  - Ontario: Shopify, Wealthsimple, Cohere, Waabi, D2L, Geotab
  - Canada-wide: CGI Canada
- Filter scans to Canada-relevant postings and drop US-only locations.
- Score jobs against the resume profile.
- Run a targeted application search for a specific role, company, location, score floor, and draft limit.
- Prepare application drafts with tailored notes and reusable answers.
- Open queued application pages in Edge/Chrome and autofill obvious fields from the resume, answer bank, and cover note.
- Review each draft before opening the official company application URL.
- Keep local state in `data\state.json`.

## Safety
The app does not silently submit applications. Browser autofill opens the official page and fills likely fields, but it does not upload files, solve CAPTCHA, answer unknown custom questions, or click the final submit button.

Browser autofill is desktop-only. Hosted deployments can scan jobs, match roles, prepare drafts, and open official links, but they cannot control your local Edge or Chrome browser.

Set `APP_PASSWORD` before deploying publicly because uploaded resumes and application drafts are private data.
