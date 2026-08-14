// Vercel serverless function — proxies one river station's data from
// Busan's automated water-quality monitoring API. Response is edge-cached
// for 30 minutes (s-maxage) so repeat visits don't re-fetch the full table.

const STATIONS = {
  oncheon: '103',
  dongcheon: '111',
  oncheon_buguk: '101',
  oncheon_sebyeong: '102',
  suyeong_hoedong: '104',
  suyeong_sewol: '105',
  suyeong_dongcheongyo: '108',
  samrak_gangseon: '106',
  samrak_eumak: '107',
  seokdae_banseok: '109',
  chuncheon_samjeong: '110',
  jwagwang_jungang: '112',
  hakjang_hakjang: '113'
};

function encodeKeyIfNeeded(key) {
  // data.go.kr service keys never contain a literal '%'; if we see one,
  // the key is already percent-encoded (the "Encoding" form) — use as-is.
  return key.includes('%') ? key : encodeURIComponent(key);
}

async function fetchStationData(locCode, key) {
  const url = `https://apis.data.go.kr/6260000/RiverQualityService/getRiverQualityStation?serviceKey=${encodeKeyIfNeeded(key)}&pageNo=1&numOfRows=25000&resultType=json&locCode=${locCode}`;
  const res = await fetch(url);
  const json = await res.json();
  const upstreamErr = json?.OpenAPI_ServiceResponse?.cmmMsgHeader?.errMsg
    || (json?.response?.header?.resultCode && json.response.header.resultCode !== '00' ? json.response.header.resultMsg : null);
  if (upstreamErr) {
    const err = new Error(`upstream: ${upstreamErr}`);
    err.upstream = true;
    throw err;
  }
  const items = json?.response?.body?.items?.item || [];
  const valid = items.filter(it => it.temp && it.temp !== '-' && it.hourTime);
  valid.sort((a, b) => b.hourTime.localeCompare(a.hourTime));
  return valid;
}

function mapItem(it) {
  return {
    hourTime: it.hourTime,
    temp: Number(it.temp),
    ph: Number(it.ph),
    do: Number(it.do1),
    turbidity: Number(it.turbid),
    tds: Number(it.tds),
    ec: Number(it.ec),
    salt: Number(it.salt)
  };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const id = req.query.id;
  const locCode = STATIONS[id];
  if (!locCode) {
    res.status(400).json({ error: 'unknown_id' });
    return;
  }

  try {
    const key = process.env.DATA_GO_KR_KEY;
    if (!key) throw new Error('DATA_GO_KR_KEY가 설정되지 않았습니다.');
    const valid = await fetchStationData(locCode, key);
    const latest = valid[0] ? mapItem(valid[0]) : null;
    const trend24 = valid.slice(0, 24).reverse().map(mapItem);
    res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=3600');
    res.status(200).json({ latest, trend24 });
  } catch (err) {
    res.status(500).json({ error: 'fetch_failed', message: String(err.message || err) });
  }
};
