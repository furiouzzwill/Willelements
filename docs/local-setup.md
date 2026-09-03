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
└── assets/         uploaded and generated files
```

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
| `OPENAI_API_KEY` | Phase 9 | Image generation (the only paid part) |
| `APP_URL` | If not on port 3000 | Overlay and OAuth URLs |

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
