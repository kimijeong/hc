// Vercel Cron target — hits every station's /api/river-live endpoint on a
// schedule so the edge cache (s-maxage=1800) never fully expires before a
// real visitor arrives. Keeps first-load latency low without any paid tier.

const STATION_IDS = [
  'oncheon', 'dongcheon', 'oncheon_buguk', 'oncheon_sebyeong',
  'suyeong_hoedong', 'suyeong_sewol', 'suyeong_dongcheongyo',
  'samrak_gangseon', 'samrak_eumak', 'seokdae_banseok',
  'chuncheon_samjeong', 'jwagwang_jungang', 'hakjang_hakjang'
];

module.exports = async (req, res) => {
  const base = `https://${req.headers.host}`;
  const results = await Promise.allSettled(
    STATION_IDS.map(id => fetch(`${base}/api/river-live?id=${id}`))
  );
  const ok = results.filter(r => r.status === 'fulfilled' && r.value.ok).length;
  res.status(200).json({ warmed: ok, total: STATION_IDS.length, at: new Date().toISOString() });
};
