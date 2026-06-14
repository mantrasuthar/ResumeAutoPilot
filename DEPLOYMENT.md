# ApplyPilot Hosting

ApplyPilot is now deployable as a Node web service. It is not a static-only site because resume uploads, live job scans, queue state, and API routes run on the backend.

## Recommended Hosts

Use one of these:

- Render web service
- Railway Node service
- Fly.io app
- VPS with Node 22+
- Docker-capable host

Static-only hosting such as plain Netlify static hosting, GitHub Pages, or basic shared HTML hosting will not run the backend.

## Required Environment

Set these variables on the host:

```text
NODE_ENV=production
HOST=0.0.0.0
DATA_DIR=/path/to/persistent/data
DISABLE_BROWSER_AUTOFILL=1
APP_PASSWORD=choose-a-strong-password
```

Most hosts provide `PORT` automatically. Do not hardcode it unless your host requires that.

`APP_PASSWORD` enables browser basic authentication. Use it before putting resumes on a public URL.

## Persistence

The app stores uploaded resumes, cached jobs, queue drafts, and settings under `DATA_DIR`.

Use a persistent disk or volume. If you deploy without persistent storage, the app can still run, but data may disappear after redeploys or restarts.

## Desktop Autofill Limitation

Hosted deployments can scan jobs, match roles, prepare drafts, and open official application links. They cannot control your local Edge or Chrome browser.

The `Open + autofill` feature remains available only when the app runs on your Windows desktop. Hosted deployments disable it with `DISABLE_BROWSER_AUTOFILL=1`.

## Render

1. Push `outputs/app` to a Git repository, or make it the root of the repository.
2. Create a new Render Blueprint from `render.yaml`, or create a web service manually.
3. Add a persistent disk mounted at `/var/data`.
4. Set `APP_PASSWORD` in Render environment variables.
5. Deploy.

Health check:

```text
/api/health
```

## Railway

1. Create a Railway project from the app folder.
2. Set the environment variables listed above.
3. Add a volume and set `DATA_DIR` to the mounted path.
4. Deploy with `npm start`.

## Fly.io

From `outputs/app`:

```powershell
fly launch
fly volumes create applypilot_data --size 1 --region yyz
fly secrets set APP_PASSWORD="your-password"
fly deploy
```

Change the `app` name in `fly.toml` before deploying if Fly asks for a unique name.

## Docker

Build and run:

```powershell
docker build -t applypilot .
docker run --rm -p 4757:4757 -e APP_PASSWORD="your-password" -v applypilot-data:/data applypilot
```

Open:

```text
http://127.0.0.1:4757
```

## Security Notes

- Do not deploy publicly without `APP_PASSWORD` or another authentication layer.
- Resume files are private data. Treat the hosting account, persistent disk, and logs accordingly.
- The app does not click final submit buttons for applications.
