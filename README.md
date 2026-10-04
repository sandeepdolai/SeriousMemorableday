# MemorableDay · Lovers Template

Full-stack prototype for a single Lovers template.

## What changed
- No Export PNG button.
- Creator chooses a username such as `yourname`.
- Publishing saves the template and photos on the server.
- The public page is available at `https://memorableday.in/yourname` when hosted on that domain.
- Editing is available at `/edit/yourname`.
- Public viewer is intentionally free of MemorableDay branding and looks like a standalone love website.
- Only the editor uses the black / white / blue MemorableDay palette. The Lovers template uses its own warm palette.

## Run locally
1. Install Node.js 20+.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and change `BASE_URL` if needed.
4. Run `npm start`.
5. Open `http://localhost:3000/create`.

## Deployment note
A static-only host cannot persist uploaded photos and map `/username` pages without a data service. This project is therefore a small Node/Express + SQLite app with local image storage. Put it on a server/VM/container and point `memorableday.in` at it.
