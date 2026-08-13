// Vercel serverless function — proxies Claude API calls so the Anthropic
// key stays server-side and is never exposed to the browser.

async function runDiagnosis({ riverName, actual, official, reports, trend }, apiKey) {
  const reportSummary = (reports || []).slice(0, 10)
    .map(r => `- ${r.symptom}${r.comment ? ' : ' + r.comment : ''}`).join('\n') || '(등록된 시민 제보 없음)';

  const trendBlock = (trend && trend.length)
    ? `\n[최근 24시간 실측 추이 (과거 -> 현재, 1시간 간격)]\n${JSON.stringify(trend)}`
    : '\n(24시간 추이 데이터 없음)';

  const prompt = `당신은 하천 수질 데이터를 검토하는 환경 감시관입니다. 아래 "${riverName}"의 데이터를 보고 시민에게 전달할 정밀 진단 브리핑을 작성하세요.

[공식 발표]
${JSON.stringify(official)}

[실측값(현재)]
${JSON.stringify(actual)}
${trendBlock}

[최근 시민 제보]
${reportSummary}

작성 규칙 (한국어, 총 6~9문장):
1. "① 현재 상태" — 공식 발표와 실측값이 다르면 구체적 수치를 근거로 왜 통계적/생태학적으로 이상한지 짚을 것 (예: DO 수치가 어류 생존 한계 이하인데 공식발표는 정상 범위인 경우). 실측값이 정상 범위라면 과장하지 말고 정상이라고 솔직하게 말할 것.
2. "② 향후 전망" — 24시간 추이 데이터가 있으면 최근 추세(상승/하락/급변)를 근거로 앞으로 몇 시간~하루 동안 어떻게 흘러갈 가능성이 있는지 간단히 예측할 것. 추이 데이터가 없으면 "추이 데이터 없어 예측 불가"라고 솔직히 밝힐 것. 확정적 예언이 아니라 "~할 가능성이 있습니다" 식으로 조심스럽게 표현할 것.
3. 마지막 줄에 "조작 의심도: 낮음/중간/높음" 한 줄 평가를 추가할 것.
각 섹션 앞에 ① ② 표시를 그대로 사용해 문단을 구분할 것.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 1100,
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

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY가 설정되지 않았습니다.');
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const diagnosis = await runDiagnosis(body, apiKey);
    res.status(200).json({ diagnosis });
  } catch (err) {
    res.status(500).json({ error: 'diagnose_failed', message: String(err.message || err) });
  }
};
