# Local setup

## Running it

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. The database is created on first page load. There
is no account, no login, and no configuration required.

For day-to-day streaming use, the production build is faster:

```bash
npm run build
npm run start
```

## Where your data lives

```
data/
├── app.db          SQLite database
├── app.db-wal      write-ahead log (normal, don't delete separately)
├── app.db-shm      shared memory index (same)
├── assets/         uploaded and generated files
└── renders/        generated compositions, one folder per render
```

- `renders/` is **not** in a backup, on purpose. The finished video from every
  render is stored as an asset and *is* backed up; the folder beside it holds
  the HTML that produced it, which is reproducible and only useful for working
  out why a video came out wrong. It is safe to delete at any time.
- **Back up:** use **Settings → Backup → Download backup**. It produces a zip of
  the database and every asset, captured as a consistent snapshot, so it is safe
  to do while the app is running. Copying the `data/` folder by hand also works,
  but stop the app first so the write-ahead log is checkpointed.
- **Restore:** **Settings → Backup**, choose the zip, confirm. Your current
  database is saved beside the restored one as `app.db.before-restore-…`, so
  restoring the wrong file is recoverable.
- **Move machines:** copy the folder, install dependencies on the new machine,
  run.
- **Start fresh:** delete the folder. It is recreated on next run.
- **Keep it elsewhere:** set `WILLELEMENTS_DATA_DIR=/path/to/somewhere` in
  `.env.local`.

The folder is gitignored — it is your data, not part of the project.

## Configuration

Nothing is required. Copy `.env.example` to `.env.local` when you reach a phase
that needs a key:

| Variable | Needed from | For |
| --- | --- | --- |
| `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET` | Phase 4 | Connecting Twitch |
| `TOKEN_ENCRYPTION_KEY` | Optional | Overrides the auto-generated key |
| `OPENAI_API_KEY` | Phase 10 | Image generation (the only paid part) |
| `HYPERFRAMES_CLI` | Optional | A specific HyperFrames CLI, instead of `npx` |
| `APP_URL` | If not on port 3000 | Overlay and OAuth URLs |

## Rendering motion graphics

**Create → Animations** renders an animated logo, a looping scene card and a
transparent lower third from your Brand DNA. That part needs software the app
does not ship:

| | How to get it |
| --- | --- |
| **FFmpeg** and `ffprobe` | macOS `brew install ffmpeg` · Windows `winget install Gyan.FFmpeg` · Debian/Ubuntu `sudo apt install ffmpeg` |
| **Headless Chrome** | Fetched by the CLI itself: `npx hyperframes browser ensure` |
| **HyperFrames CLI** | Nothing to do — `npx` fetches `hyperframes@0.8.27` on first use. Install it globally or into the project if you would rather pin it. |

`npm run dev` alone will not render video on a machine without FFmpeg. The
animations page checks for all of this and tells you exactly what is missing, so
you find out there rather than from a failed render.

A render pins the CPU for tens of seconds to a couple of minutes. It runs one at
a time, in the background, and the page warns you if you are live — it is the
same processor encoding your stream.

### Restoring the agent skills

`skills-lock.json` pins the HyperFrames authoring skills. The skill files
themselves are not committed — 900-odd files is not something to carry in this
repository — so restore them with:

```bash
npx skills experimental_install
```

You only need this if you are editing composition templates.

## Connecting Twitch

1. Register an app at [dev.twitch.tv/console](https://dev.twitch.tv/console/apps/create)
2. OAuth Redirect URL — exactly this, Twitch matches it character for character:
   `http://localhost:3000/api/twitch/callback`
3. Client Type: **Confidential**
4. Put the Client ID and Secret in `.env.local`, restart, then press Connect on
   **Integrations → Twitch**

Tokens are encrypted before they are stored. The key lives in `data/.token-key`
and is generated on first use — it is deliberately outside the database, so a
copied `app.db` or a backup zip does not carry your channel credentials with it.

If you lose that key, reconnect Twitch. Nothing else is affected.

To keep the key somewhere else, set `TOKEN_ENCRYPTION_KEY` instead:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Adding an overlay to OBS

*Available from Phase 5.*

1. Create an overlay in the app and copy its browser-source URL. It looks like
   `http://localhost:3000/overlay/<token>`.
2. In OBS: **Sources → + → Browser**.
3. Paste the URL. Set width and height to match your canvas (1920×1080).
4. Leave **Shutdown source when not visible** unchecked, so the overlay keeps
   its connection while you switch scenes.

The token is opaque and rotatable. If you show the URL on stream by accident,
rotate it in the app and paste the new one — nothing else breaks.

## Keeping it running while you stream

The app has to be running for alerts to fire. Start it before you go live.

If it stops mid-stream, alerts stop — the same as any local streaming tool. From
Phase 6 the overlay indicates a lost connection rather than silently doing
nothing, so you can see the problem on your preview instead of discovering it
from chat.

## Troubleshooting

**`better-sqlite3` fails after a Node upgrade.** It is a native module compiled
against a specific Node version:

```bash
npm rebuild better-sqlite3
```

**"Cannot render: FFmpeg is missing".** Install FFmpeg (see above) and press
**Check again** on the animations page. The check is cached for the life of the
process, so the button is how you tell the app to look again.

**A render sat at "Rendering" and then said the app restarted.** Renders run as
a child process of the app. Restarting the server kills them, and the job is
closed out at boot rather than left showing a progress bar that can never move.
Render it again.

**Port 3000 is taken.** `npm run dev -- -p 3001`, and set `APP_URL` to match so
overlay URLs are generated correctly.

**Starting over.** Stop the app, delete `data/`, start it again. A fresh
starter brand is created automatically.

**Twitch says the redirect URL is invalid.** It must match your registered app
exactly — same scheme, host, port and path, no trailing slash. If you run on a
port other than 3000, set `APP_URL` to match and register that URL with Twitch.

**"Reconnect the platform".** The stored token could not be read or was
rejected. Usually a changed `TOKEN_ENCRYPTION_KEY`, a Twitch password change, or
the app being disconnected from your Twitch account. Press Connect again.

**Restore did not seem to take.** Restoring closes the database connection and
replaces the file, so it should apply immediately. If the app was mid-write,
restart it — and check for an `app.db.before-restore-…` file, which is your
previous data.
