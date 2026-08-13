// Vercel serverless function — shared citizen reports, stored in Vercel KV
// so every visitor sees the same feed (not just their own browser).
const { kv } = require('@vercel/kv');

const REPORTS_KEY = 'bever:reports';
const MAX_REPORTS = 300;
const MAX_PHOTO_BYTES = 900000; // ~900KB base64 data URL

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  if (req.method === 'GET') {
    try {
      const reports = (await kv.get(REPORTS_KEY)) || [];
      res.status(200).json({ reports });
    } catch (err) {
      res.status(500).json({ error: 'kv_failed', message: String(err.message || err) });
    }
    return;
  }

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const { riverId, symptom, comment, photo, authorId } = body;
      if (!riverId || !symptom) { res.status(400).json({ error: 'missing_fields' }); return; }
      if (photo && photo.length > MAX_PHOTO_BYTES) { res.status(413).json({ error: 'photo_too_large' }); return; }

      const report = {
        id: Date.now() + '-' + Math.random().toString(36).slice(2, 7),
        riverId,
        symptom,
        comment: (comment || '').slice(0, 300),
        photo: photo || null,
        authorId: authorId || null,
        time: new Date().toISOString()
      };

      const existing = (await kv.get(REPORTS_KEY)) || [];
      existing.unshift(report);
      if (existing.length > MAX_REPORTS) existing.length = MAX_REPORTS;
      await kv.set(REPORTS_KEY, existing);

      res.status(200).json({ report });
    } catch (err) {
      res.status(500).json({ error: 'kv_failed', message: String(err.message || err) });
    }
    return;
  }

  if (req.method === 'DELETE') {
    try {
      const id = req.query.id;
      const authorId = req.query.authorId;
      if (!id) { res.status(400).json({ error: 'missing_id' }); return; }
      const existing = (await kv.get(REPORTS_KEY)) || [];
      const target = existing.find(r => r.id === id);
      if (!target) { res.status(404).json({ error: 'not_found' }); return; }
      if (target.authorId && target.authorId !== authorId) {
        res.status(403).json({ error: 'not_author' });
        return;
      }
      const next = existing.filter(r => r.id !== id);
      await kv.set(REPORTS_KEY, next);
      res.status(200).json({ deleted: true });
    } catch (err) {
      res.status(500).json({ error: 'kv_failed', message: String(err.message || err) });
    }
    return;
  }

  res.status(405).json({ error: 'method_not_allowed' });
};
