const http = require('http');
const fs = require('fs');
const path = require('path');

// --- .env loader (no dependency) ---
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (m) {
      const key = m[1];
      let val = (m[2] || '').trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  }
}

const PORT = process.env.PORT || 8787;
const DATA_GO_KR_KEY = process.env.DATA_GO_KR_KEY || '';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';

let kv = null;
try { kv = require('@vercel/kv').kv; } catch (e) { /* run `npm install` to enable shared reports */ }

const REPORTS_KEY = 'bever:reports';
const MAX_REPORTS = 300;
const MAX_PHOTO_BYTES = 900000;

// 부산광역시 하천수질 자동측정망 13개 관측소 코드 (8개 하천)
const STATIONS = {
  oncheon: '103',              // 온천천 이섭교
  dongcheon: '111',            // 동천 성서교
  oncheon_buguk: '101',        // 온천천 부곡교
  oncheon_sebyeong: '102',     // 온천천 세병교
  suyeong_hoedong: '104',      // 수영강 회동교d
  suyeong_sewol: '105',        // 수영강 세월교
  suyeong_dongcheongyo: '108', // 수영강 동천교
  samrak_gangseon: '106',      // 삼락천 강선교
  samrak_eumak: '107',         // 삼락천 음악분수
  seokdae_banseok: '109',      // 석대천 반석2호교
  chuncheon_samjeong: '110',   // 춘천 삼정그린코아
  jwagwang_jungang: '112',     // 좌광천 중앙공원
  hakjang_hakjang: '113'       // 학장천 학장교
};

const CACHE_TTL_MS = 30 * 60 * 1000; // 30분 캐시
const cache = {};

function encodeKeyIfNeeded(key) {
  // data.go.kr service keys never contain a literal '%'; if we see one,
  // the key is already percent-encoded (the "Encoding" form) — use as-is.
  return key.includes('%') ? key : encodeURIComponent(key);
}

async function fetchStationData(locCode) {
  const url = `https://apis.data.go.kr/6260000/RiverQualityService/getRiverQualityStation?serviceKey=${encodeKeyIfNeeded(DATA_GO_KR_KEY)}&pageNo=1&numOfRows=25000&resultType=json&locCode=${locCode}`;
  const res = await fetch(url);
  const json = await res.json();
  const items = json?.response?.body?.items?.item || [];
  const valid = items.filter(it => it.temp && it.temp !== '-' && it.hourTime);
  valid.sort((a, b) => b.hourTime.localeCompare(a.hourTime)); // 최신 -> 과거
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

async function getRiverLive(riverId) {
  const now = Date.now();
  const cached = cache[riverId];
  if (cached && (now - cached.fetchedAt) < CACHE_TTL_MS) return cached.data;

  const locCode = STATIONS[riverId];
  const valid = await fetchStationData(locCode);
  const latest = valid[0] ? mapItem(valid[0]) : null;
  const trend24 = valid.slice(0, 24).reverse().map(mapItem); // 과거 -> 최신

  const data = { latest, trend24 };
  cache[riverId] = { fetchedAt: now, data };
  return data;
}

function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  });
  res.end(body);
}

async function runDiagnosis({ riverName, actual, official, reports, trend }) {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('서버에 ANTHROPIC_API_KEY가 설정되어 있지 않습니다. .env 파일을 확인하세요.');
  }
  const reportSummary = (reports || []).slice(0, 10)
    .map(r => `- ${r.symptom}${r.comment ? ' : ' + r.comment : ''}`).join('\n') || '(등록된 시민 제보 없음)';

  const trendBlock = (trend && trend.length)
    ? `\n[최근 24시간 실측 추이 (과거 -> 현재, 1시간 간격)]\n${JSON.stringify(trend)}`
    : '\n(24시간 추이 데이터 없음)';

  const prompt = `당신은 하천 수질 데이터를 검토하고 실제 대응 방안까지 제시하는 환경 전문가입니다. 아래 "${riverName}"의 데이터를 근거로 시민이 실제로 행동할 수 있는 정밀 진단 브리핑을 작성하세요.

[공식 발표]
${JSON.stringify(official)}

[실측값(현재)]
${JSON.stringify(actual)}
${trendBlock}

[최근 시민 제보]
${reportSummary}

[환경기준] BOD≤3.0mg/L, DO≥5.0mg/L, pH 6.5~8.5, 탁도≤15NTU, TDS≤500mg/L

작성 규칙 (한국어, 각 섹션 2~4문장, 앞에 ①②③④ 표시를 그대로 사용해 문단을 구분):
1. "① 현재 상태" — 공식 발표와 실측값이 다르면 구체적 수치를 근거로 왜 통계적/생태학적으로 이상한지 짚을 것 (예: DO 수치가 어류 생존 한계 이하인데 공식발표는 정상 범위인 경우). 실측값이 정상 범위라면 과장하지 말고 정상이라고 솔직하게 말할 것.
2. "② 원인 추정" — 수치 패턴을 근거로 가장 가능성 높은 원인을 1~2가지 추정할 것 (예: TDS·염분이 함께 급등 = 해수 역류 가능성, DO 급락+탁도 급등 = 유기물·생활폐수 유입 가능성, pH만 단독으로 이상 = 화학물질 유입 가능성). 확정이 아니라 "~일 가능성이 있습니다"로 조심스럽게 표현하고, 패턴이 애매하면 "특정하기 어렵다"고 솔직히 밝힐 것.
3. "③ 향후 전망" — 24시간 추이 데이터가 있으면 최근 추세(상승/하락/급변)를 근거로 앞으로 몇 시간~하루 동안 어떻게 흘러갈 가능성이 있는지 간단히 예측할 것. 추이 데이터가 없으면 "추이 데이터 없어 예측 불가"라고 솔직히 밝힐 것.
4. "④ 해결방안" — 다음 세 가지를 구분해서 구체적으로 제시할 것: (a) 시민 행동요령 — 지금 당장 해야/하지 말아야 할 행동 (예: 접촉·취수 자제, 반려동물 접근 금지 등), (b) 신고 — 부산시 120 콜센터 또는 관할 구청 환경위생과/환경보전과에 어떤 내용으로 신고하면 좋을지, (c) 당국에 요청할 추가 조사 — 원인을 확정하려면 무엇을 점검해야 하는지 (예: 상류 배출원 점검, 중금속 추가 분석 등). 실측값이 전부 정상 범위면 "특별한 조치가 필요하지 않습니다"라고 명시할 것.

마지막 줄에 "조작 의심도: 낮음/중간/높음" 한 줄 평가를 추가할 것.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API 오류 (${res.status}): ${text}`);
  }
  const data = await res.json();
  return data.content?.[0]?.text || '(응답 없음)';
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
    });
    return res.end();
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === 'GET' && url.pathname === '/api/river-live') {
    const id = url.searchParams.get('id');
    if (!STATIONS[id]) return sendJSON(res, 400, { error: 'unknown_id' });
    try {
      const data = await getRiverLive(id);
      return sendJSON(res, 200, data);
    } catch (err) {
      console.error(err);
      return sendJSON(res, 500, { error: 'fetch_failed', message: String(err.message || err) });
    }
  }

  if (req.method === 'GET' && url.pathname === '/api/rivers/live') {
    try {
      const ids = Object.keys(STATIONS);
      const results = {};
      await Promise.all(ids.map(async id => {
        results[id] = await getRiverLive(id);
      }));
      return sendJSON(res, 200, results);
    } catch (err) {
      console.error(err);
      return sendJSON(res, 500, { error: 'fetch_failed', message: String(err.message || err) });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/diagnose') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const diagnosis = await runDiagnosis(payload);
        sendJSON(res, 200, { diagnosis });
      } catch (err) {
        console.error(err);
        sendJSON(res, 500, { error: 'diagnose_failed', message: String(err.message || err) });
      }
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/reports') {
    if (!kv) return sendJSON(res, 500, { error: 'kv_unavailable', message: '@vercel/kv가 설치되지 않았습니다. npm install을 실행하세요.' });
    try {
      const reports = (await kv.get(REPORTS_KEY)) || [];
      return sendJSON(res, 200, { reports });
    } catch (err) {
      console.error(err);
      return sendJSON(res, 500, { error: 'kv_failed', message: String(err.message || err) });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/reports') {
    if (!kv) return sendJSON(res, 500, { error: 'kv_unavailable', message: '@vercel/kv가 설치되지 않았습니다. npm install을 실행하세요.' });
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { riverId, symptom, comment, photo, authorId } = JSON.parse(body || '{}');
        if (!riverId || !symptom) return sendJSON(res, 400, { error: 'missing_fields' });
        if (photo && photo.length > MAX_PHOTO_BYTES) return sendJSON(res, 413, { error: 'photo_too_large' });

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

        sendJSON(res, 200, { report });
      } catch (err) {
        console.error(err);
        sendJSON(res, 500, { error: 'kv_failed', message: String(err.message || err) });
      }
    });
    return;
  }

  if (req.method === 'DELETE' && url.pathname === '/api/reports') {
    if (!kv) return sendJSON(res, 500, { error: 'kv_unavailable', message: '@vercel/kv가 설치되지 않았습니다. npm install을 실행하세요.' });
    try {
      const id = url.searchParams.get('id');
      const authorId = url.searchParams.get('authorId');
      if (!id) return sendJSON(res, 400, { error: 'missing_id' });
      const existing = (await kv.get(REPORTS_KEY)) || [];
      const target = existing.find(r => r.id === id);
      if (!target) return sendJSON(res, 404, { error: 'not_found' });
      if (target.authorId && target.authorId !== authorId) {
        return sendJSON(res, 403, { error: 'not_author' });
      }
      const next = existing.filter(r => r.id !== id);
      await kv.set(REPORTS_KEY, next);
      return sendJSON(res, 200, { deleted: true });
    } catch (err) {
      console.error(err);
      return sendJSON(res, 500, { error: 'kv_failed', message: String(err.message || err) });
    }
  }

  sendJSON(res, 404, { error: 'not_found' });
});

server.listen(PORT, () => {
  console.log(`프록시 서버 실행 중: http://localhost:${PORT}`);
  if (!DATA_GO_KR_KEY) console.warn('⚠ DATA_GO_KR_KEY가 설정되지 않았습니다 (.env 확인)');
  if (!ANTHROPIC_API_KEY) console.warn('⚠ ANTHROPIC_API_KEY가 설정되지 않았습니다 (.env 확인) — /api/diagnose는 이 키가 있어야 동작합니다');

  console.log(`${Object.keys(STATIONS).length}개 관측소 데이터 미리 불러오는 중... (최초 1회, 최대 1~2분 소요)`);
  const ids = Object.keys(STATIONS);
  let done = 0;
  ids.forEach(id => {
    getRiverLive(id)
      .catch(err => console.warn(`[예열 실패] ${id}:`, err.message))
      .finally(() => {
        done++;
        if (done === ids.length) console.log('✅ 관측소 데이터 예열 완료 — 이제 브라우저에서 바로 실시간 데이터를 받습니다.');
      });
  });
});
