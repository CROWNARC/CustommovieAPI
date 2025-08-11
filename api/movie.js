// api/movie.js
const fs = require('fs');
const path = require('path');

let moviesCache = null;

function normalize(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[\u2018\u2019\u201c\u201d]/g, "'")
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractExplicitUrls(text) {
  if (!text) return [];
  const urlRegex = /https?:\/\/[^\s,\)\]]+/gi;
  const matches = text.match(urlRegex) || [];
  return matches.map(u => u.replace(/[,\)\]]+$/g, ''));
}

function findDomainToken(text, domainPatterns) {
  if (!text) return null;
  for (const pat of domainPatterns) {
    // build a safe regex by escaping dots in pattern
    const patEsc = pat.replace(/\./g, '\\.');
    const re = new RegExp('(' + patEsc + '[^\\s,)]*)', 'i');
    const m = text.match(re);
    if (m && m[1]) return m[1];
  }
  return null;
}

function selectPreferredUrl(text) {
  const priorityDomains = ['short.icu', 'zoro.rpmplay.xyz', 'dorex', 'play.zep'];
  const explicit = extractExplicitUrls(text);

  // 1) Pick first explicit url containing any priority domain in order
  for (const pd of priorityDomains) {
    const found = explicit.find(u => u.toLowerCase().includes(pd));
    if (found) return found;
  }

  // 2) If no priority domain, pick first explicit url that's not dailymotion
  const nonDailymotion = explicit.find(u => !/dailymotion/i.test(u));
  if (nonDailymotion) return nonDailymotion;

  // 3) If no explicit urls, attempt to find domain tokens and construct a url (best-effort)
  const token = findDomainToken(text, priorityDomains);
  if (token) {
    return token.startsWith('http') ? token : `https://${token}`;
  }

  // 4) fallback: null
  return null;
}

function parseMoviesFile() {
  if (moviesCache) return moviesCache;
  const filePath = path.join(process.cwd(), 'movies_data.txt');
  if (!fs.existsSync(filePath)) throw new Error('movies_data.txt not found');

  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/);

  let section = null;
  const entries = [];
  let cur = null;

  const sectionCandidate = (ln) => {
    const t = ln.trim();
    if (!t) return false;
    const letters = t.replace(/[^A-Za-z]/g, '');
    return letters.length > 0 && letters === letters.toUpperCase();
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.replace(/\t/g, '    ');
    if (sectionCandidate(line)) {
      section = line.trim();
      continue;
    }

    const headingMatch = line.match(/^\s*(\d+)\.\s+(.*\S)\s*$/);
    if (headingMatch) {
      if (cur) entries.push(cur);
      cur = {
        index: parseInt(headingMatch[1], 10),
        title: headingMatch[2].trim(),
        section: section || 'Unknown',
        meta: {},
      };
      cur._norm = normalize(cur.title);
      continue;
    }

    if (!cur) continue;

    const dashMatch = line.match(/^\s*-\s*(.+)$/);
    if (dashMatch) {
      const kv = dashMatch[1].split(':');
      const key = kv.shift().trim().toLowerCase().replace(/\s+/g, '_');
      const value = kv.join(':').trim();
      if (!cur.meta[key]) cur.meta[key] = value;
      else cur.meta[key] = cur.meta[key] + ' | ' + value;
    } else {
      const trimmed = line.trim();
      if (trimmed && Object.keys(cur.meta).length) {
        const lastKey = Object.keys(cur.meta).slice(-1)[0];
        cur.meta[lastKey] = cur.meta[lastKey] + ' ' + trimmed;
      }
    }
  }
  if (cur) entries.push(cur);

  const map = entries.map((e) => {
    const watchRaw = e.meta.watch_sources || e.meta.watch || e.meta['watch_sources'] || '';
    const preferred = selectPreferredUrl(watchRaw);
    const explicitUrls = extractExplicitUrls(watchRaw);
    return {
      title: e.title,
      section: e.section,
      index: e.index,
      normalized: e._norm,
      watch_raw: watchRaw || null,
      watch_urls: explicitUrls,
      preferred_watch: preferred,
      download: e.meta.download || null,
      raw_meta: e.meta
    };
  });

  moviesCache = map;
  return moviesCache;
}

function searchMovies(query, limit = 8) {
  if (!query || !query.trim()) return [];
  const qnorm = normalize(query);
  const qTokens = qnorm.split(' ').filter(Boolean);

  const list = parseMoviesFile();

  const scored = list.map((m) => {
    const title = m.normalized;
    let score = 0;
    if (title === qnorm) score = 100;
    else if (title.includes(qnorm)) score = 90;
    else {
      const titleTokens = title.split(' ').filter(Boolean);
      let matched = 0;
      for (const t of qTokens) if (titleTokens.includes(t)) matched++;
      score = Math.round((matched / Math.max(qTokens.length, 1)) * 50);
      if (titleTokens[0] === qTokens[0]) score += 10;
    }
    return { movie: m, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const results = scored.filter(s => s.score > 0).slice(0, limit).map(s => ({
    title: s.movie.title,
    section: s.movie.section,
    index: s.movie.index,
    score: s.score,
    preferred_watch: s.movie.preferred_watch,
    watch_urls: s.movie.watch_urls,
    download: s.movie.download,
    raw_meta: s.movie.raw_meta
  }));
  return results;
}

module.exports = async function handler(req, res) {
  try {
    const name = (req.method === 'GET') ? (req.query.name || '') : (req.body && req.body.name ? req.body.name : '');
    if (!name) {
      res.status(400).json({ ok: false, message: 'Provide movie name as `name` query param or JSON body.' });
      return;
    }

    const results = searchMovies(String(name), 10);
    if (!results || results.length === 0) {
      res.status(404).json({ ok: true, query: name, results: [], message: 'No matches found.' });
      return;
    }

    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({ ok: true, query: name, matches: results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
};
