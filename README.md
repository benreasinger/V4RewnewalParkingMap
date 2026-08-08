# Renewal Christmas Store Parking 4.0

A fresh, mobile-first rebuild of the Renewal Neighborhood Church Christmas Store parking workflow.

## What changed

- One shared `script/main.js`; the old duplicate `wrap.js` was removed.
- Google sign-in and database-backed role authorization.
- Administrator-managed user permissions.
- One event data model shared by Parking, Shopper, Wrapper, Gift Wrap, Reindeer, and Admin.
- Automatic wrapping handoff and automatic Waiting for Reindeer status after every bag is complete.
- Delivered and administrator-removed records are separate, with undo actions for both.
- Live admin analytics, all 160 parking spots, activity history, and connected-device monitoring.
- A separate screenshot-matched Analytics page with average timing, live totals, and today's throughput.
- Card-click modals, role-limited next actions, admin full editing, search, and multi-status filters.
- A safe **Start Fresh Event** action that archives previous event data.
- Named PNG placeholders for the logo, church photo, parking map, and Settings decoration. See `assets/README.md` for the filenames.

## Run locally

Serve the repository over HTTP (Google sign-in does not work reliably from `file://`):

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080` and ensure `localhost` is an authorized Firebase Authentication domain.

See [docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md) before production use.
