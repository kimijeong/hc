// ---------------------------------------------------------
// 시민 제보 / localStorage
// ---------------------------------------------------------

const REPORT_KEY = 'busan-river-reports';

function loadReports(){
  try{
    return JSON.parse(
      localStorage.getItem(REPORT_KEY)
    ) || [];
  }catch(error){
    console.error('[FlowCheck] 제보 데이터 로딩 실패', error);
    return [];
  }
}

function saveReports(list){
  localStorage.setItem(
    REPORT_KEY,
    JSON.stringify(list)
  );
}

let reports = loadReports();

// 예전 제보 데이터에 좌표가 없으면 하천 주변 임시 좌표 생성
reports.forEach(report => {
  if(typeof report.lat !== 'number'){
    const river = RIVERS.find(
      item => item.id === report.riverId
    );

    if(river){
      report.lat =
        river.lat + (Math.random() - 0.5) * 0.006;

      report.lng =
        river.lng + (Math.random() - 0.5) * 0.006;
    }
  }
});

saveReports(reports);

function addReport(riverId, symptom, comment){
  const river = RIVERS.find(
    item => item.id === riverId
  );

  if(!river){
    throw new Error('선택한 하천을 찾을 수 없습니다.');
  }

  const jitter = () =>
    (Math.random() - 0.5) * 0.006;

  const report = {
    id:
      Date.now() +
      '-' +
      Math.random().toString(36).slice(2, 7),

    riverId,
    symptom,
    comment,

    lat:river.lat + jitter(),
    lng:river.lng + jitter(),

    time:new Date().toISOString()
  };

  reports.unshift(report);

  saveReports(reports);

  renderReportFeed();
  renderCommunityStats();

  if(
    typeof mapReady !== 'undefined' &&
    mapReady &&
    typeof addReportMarker === 'function'
  ){
    addReportMarker(report);
  }

  return report;
}

function fmtTime(iso){
  const date = new Date(iso);

  return (
    date.getFullYear() +
    '.' +
    String(date.getMonth() + 1).padStart(2, '0') +
    '.' +
    String(date.getDate()).padStart(2, '0') +
    ' ' +
    String(date.getHours()).padStart(2, '0') +
    ':' +
    String(date.getMinutes()).padStart(2, '0')
  );
}

function renderReportFeed(){
  const feed =
    document.getElementById('reportFeed');

  const filterSelect =
    document.getElementById('communityFilter');

  const filter =
    filterSelect ? filterSelect.value : 'all';

  const filtered =
    filter === 'all'
      ? reports
      : reports.filter(
          report => report.riverId === filter
        );

  if(filtered.length === 0){
    feed.innerHTML =
      '<div class="report-empty">등록된 제보가 없습니다.</div>';

    return;
  }

  feed.innerHTML =
    filtered
      .slice(0, 50)
      .map(report => {
        const river = RIVERS.find(
          item => item.id === report.riverId
        );

        return `
          <div class="report-item">
            <div class="rf-head">
              <span class="rf-river">
                ${river ? river.name : '알수없음'}
              </span>

              <span class="rf-time">
                ${fmtTime(report.time)}
              </span>
            </div>

            <span class="rf-symptom">
              ${escapeHtml(report.symptom)}
            </span>

            ${
              report.comment
                ? `<div class="rf-comment">${escapeHtml(report.comment)}</div>`
                : ''
            }
          </div>
        `;
      })
      .join('');
}

function renderCommunityStats(){
  const wrap =
    document.getElementById('communityStats');

  if(!wrap) return;

  wrap.innerHTML =
    RIVERS.map(river => {
      const count =
        reports.filter(
          report => report.riverId === river.id
        ).length;

      return `
        <span class="stat-pill">
          <span
            class="dot"
            style="background:${GRADE_COLOR[river.actualGrade]}"
          ></span>

          ${river.name} ${count}
        </span>
      `;
    }).join('');
}
