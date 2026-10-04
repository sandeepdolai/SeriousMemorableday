import express from 'express';
import multer from 'multer';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const DATA_DIR = path.join(__dirname, 'data');
const IMAGE_DIR = path.join(DATA_DIR, 'images');
fs.mkdirSync(IMAGE_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'memorableday.sqlite'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    name_a TEXT NOT NULL DEFAULT 'Alex',
    name_b TEXT NOT NULL DEFAULT 'Jamie',
    date_text TEXT NOT NULL DEFAULT '12 October 2026',
    caption TEXT NOT NULL DEFAULT 'A tiny chapter of a very big love.',
    photo_1 TEXT,
    photo_2 TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

const storage = multer.diskStorage({
  destination: IMAGE_DIR,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase().slice(0, 8) || '.jpg';
    cb(null, `${Date.now()}-${crypto.randomBytes(5).toString('hex')}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { files: 2, fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, /^image\/(jpeg|png|webp|gif|avif)$/.test(file.mimetype));
  }
});

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/media', express.static(IMAGE_DIR, { maxAge: '7d' }));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

function cleanUsername(value = '') {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32);
}

function publicTemplate(row) {
  if (!row) return null;
  return {
    username: row.username,
    nameA: row.name_a,
    nameB: row.name_b,
    date: row.date_text,
    caption: row.caption,
    photo1: row.photo_1 ? `${BASE_URL}/media/${row.photo_1}` : null,
    photo2: row.photo_2 ? `${BASE_URL}/media/${row.photo_2}` : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

app.get('/api/templates/:username', (req, res) => {
  const username = cleanUsername(req.params.username);
  const row = db.prepare('SELECT * FROM templates WHERE username = ?').get(username);
  if (!row) return res.status(404).json({ error: 'Template not found' });
  res.json(publicTemplate(row));
});

app.post('/api/templates', upload.fields([
  { name: 'photo1', maxCount: 1 },
  { name: 'photo2', maxCount: 1 }
]), (req, res) => {
  const username = cleanUsername(req.body.username);
  if (!/^[a-z0-9_-]{3,32}$/.test(username)) {
    return res.status(400).json({ error: 'Username must be 3–32 characters using letters, numbers, _ or -.' });
  }

  const existing = db.prepare('SELECT * FROM templates WHERE username = ?').get(username);
  const now = new Date().toISOString();
  const data = {
    nameA: String(req.body.nameA || 'Alex').trim().slice(0, 40) || 'Alex',
    nameB: String(req.body.nameB || 'Jamie').trim().slice(0, 40) || 'Jamie',
    date: String(req.body.date || '12 October 2026').trim().slice(0, 80) || 'A day to remember',
    caption: String(req.body.caption || 'A tiny chapter of a very big love.').trim().slice(0, 280) || 'A tiny chapter of a very big love.'
  };

  const photo1 = req.files?.photo1?.[0]?.filename || existing?.photo_1 || null;
  const photo2 = req.files?.photo2?.[0]?.filename || existing?.photo_2 || null;

  try {
    if (existing) {
      db.prepare(`UPDATE templates SET name_a=?, name_b=?, date_text=?, caption=?, photo_1=?, photo_2=?, updated_at=? WHERE username=?`)
        .run(data.nameA, data.nameB, data.date, data.caption, photo1, photo2, now, username);
    } else {
      db.prepare(`INSERT INTO templates (username,name_a,name_b,date_text,caption,photo_1,photo_2,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)`)
        .run(username, data.nameA, data.nameB, data.date, data.caption, photo1, photo2, now, now);
    }
  } catch (error) {
    return res.status(500).json({ error: 'Could not save template.' });
  }

  const row = db.prepare('SELECT * FROM templates WHERE username = ?').get(username);
  res.json({ template: publicTemplate(row), url: `${BASE_URL}/${username}`, editUrl: `${BASE_URL}/edit/${username}` });
});

app.delete('/api/templates/:username', (req, res) => {
  const username = cleanUsername(req.params.username);
  const row = db.prepare('SELECT * FROM templates WHERE username = ?').get(username);
  if (!row) return res.status(404).json({ error: 'Template not found' });
  db.prepare('DELETE FROM templates WHERE username = ?').run(username);
  for (const filename of [row.photo_1, row.photo_2].filter(Boolean)) {
    try { fs.unlinkSync(path.join(IMAGE_DIR, filename)); } catch {}
  }
  res.json({ ok: true });
});

app.get('/create', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'editor.html')));
app.get('/edit/:username', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'editor.html')));
app.get('/:username', (req, res, next) => {
  const username = cleanUsername(req.params.username);
  if (!username || username !== req.params.username) return next();
  const row = db.prepare('SELECT id FROM templates WHERE username = ?').get(username);
  if (!row) return res.status(404).sendFile(path.join(__dirname, 'public', 'not-found.html'));
  res.sendFile(path.join(__dirname, 'public', 'viewer.html'));
});

app.listen(PORT, () => {
  console.log(`MemorableDay running at ${BASE_URL}`);
});
