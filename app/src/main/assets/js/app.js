// ---------------------------------------------------------
// FlowCheck 화면/UI
// ---------------------------------------------------------

let compareMode = false;

// ---------------------------------------------------------
// 탭
// ---------------------------------------------------------
function initTabs(){
  document
    .querySelectorAll('.tab-btn')
    .forEach(button => {
      button.addEventListener('click', () => {
        document
          .querySelectorAll('.tab-btn')
          .forEach(item =>
            item.classList.remove('active')
          );

        document
          .querySelectorAll('.tab-panel')
          .forEach(panel =>
            panel.classList.remove('active')
          );

        button.classList.add('active');

        document
          .querySelector(
            `.tab-panel[data-panel="${button.dataset.tab}"]`
          )
          .classList.add('active');
      });
    });
}

// ---------------------------------------------------------
// 하천 목록
// ---------------------------------------------------------
function renderRiverList(){
  const list =
    document.getElementById('riverList');

  list.innerHTML =
    RIVERS.map(river => `
      <div
        class="river-card"
        data-id="${river.id}"
      >
        <span
          class="dot"
          style="background:${GRADE_COLOR[river.actualGrade]}"
        ></span>

        <div class="info">
          <div class="name">
            ${river.name}
          </div>

          <div class="sub">
            ${river.district}
            · 실측 ${river.actualGrade}등급
          </div>

          ${
            river.manipulated
              ? '<div class="warn-flag">⚠ 공식 발표와 불일치</div>'
              : ''
          }
        </div>

        <span
          class="badge"
          style="background:${GRADE_COLOR[river.actualGrade]}"
        >
          ${river.actualGrade}
        </span>
      </div>
    `).join('');

  list
    .querySelectorAll('.river-card')
    .forEach(card => {
      card.addEventListener(
        'click',
        () => openDetail(card.dataset.id)
      );
    });

  const reportRiver =
    document.getElementById('reportRiver');

  reportRiver.innerHTML =
    RIVERS.map(river =>
      `<option value="${river.id}">${river.name}</option>`
    ).join('');

  const filterSelect =
    document.getElementById('communityFilter');

  const previousFilter =
    filterSelect.value || 'all';

  filterSelect.innerHTML =
    '<option value="all">전체 하천</option>' +
    RIVERS.map(river =>
      `<option value="${river.id}">${river.name}</option>`
    ).join('');

  if(
    previousFilter === 'all' ||
    RIVERS.some(river => river.id === previousFilter)
  ){
    filterSelect.value = previousFilter;
  }
}

// ---------------------------------------------------------
// 상세 화면
// ---------------------------------------------------------
function openDetail(riverId){
  const river =
    RIVERS.find(item => item.id === riverId);

  if(!river) return;

  compareMode = false;

  renderDetail(river);

  document
    .getElementById('detailDrawer')
    .classList.add('open');

  document
    .getElementById('overlayBg')
    .classList.add('open');
}

function closeDetail(){
  document
    .getElementById('detailDrawer')
    .classList.remove('open');

  document
    .getElementById('overlayBg')
    .classList.remove('open');
}

function renderDetail(river){
  const drawer =
    document.getElementById('detailDrawer');

  drawer.innerHTML = `
    <div class="detail-head">
      <div>
        <h2>${river.name}</h2>
        <div class="loc">${river.district}</div>
      </div>

      <button
        class="detail-close"
        id="closeDetailBtn"
      >
        ✕
      </button>
    </div>

    <div class="grade-hero">
      <div
        class="badge-lg"
        style="background:${GRADE_COLOR[river.actualGrade]}"
      >
        ${river.actualGrade}
      </div>

      <div class="glabel">
        실측 기준 통합 등급
        <b>
          ${GRADE_LABEL[river.actualGrade]}
        </b>
      </div>
    </div>

    ${
      river.manipulated
        ? `
          <div class="manip-banner">
            ⚠ 공식 발표(
            ${river.officialGrade}등급 ·
            ${GRADE_LABEL[river.officialGrade]}
            )와 실측(
            ${river.actualGrade}등급 ·
            ${GRADE_LABEL[river.actualGrade]}
            )이 다릅니다.
          </div>
        `
        : ''
    }

    <div class="compare-toggle">
      <label class="switch-row">
        <span class="switch">
          <input
            type="checkbox"
            id="compareToggle"
            ${compareMode ? 'checked' : ''}
          >
          <span class="slider"></span>
        </span>

        공식 발표와 나란히 비교하기
      </label>
    </div>

    <div id="metricsArea"></div>

    <div class="section-title">
      최근 24시간 추이 (실측)
    </div>

    <div
      class="trend-grid"
      id="trendGrid"
    ></div>
  `;

  document
    .getElementById('closeDetailBtn')
    .addEventListener(
      'click',
      closeDetail
    );

  document
    .getElementById('compareToggle')
    .addEventListener(
      'change',
      event => {
        compareMode =
          event.target.checked;

        renderMetricsArea(river);
      }
    );

  renderMetricsArea(river);
  renderTrends(river);
}

function renderMetricsArea(river){
  const area =
    document.getElementById('metricsArea');

  if(!compareMode){
    area.innerHTML = `
      <div class="metrics-grid">
        ${
          METRICS.map(metric => {
            const value =
              river.actual[metric.key];

            const bad =
              exceeds(metric.key, value);

            return `
              <div class="metric-card">
                <div class="m-label">
                  ${metric.label}
                </div>

                <div
                  class="m-value ${bad ? 'exceed' : ''}"
                >
                  ${value}${metric.unit}
                </div>

                ${
                  STANDARD[metric.key]
                    ? `
                      <div class="m-std">
                        기준:
                        ${STANDARD[metric.key].label}
                      </div>
                    `
                    : ''
                }
              </div>
            `;
          }).join('')
        }
      </div>
    `;

    return;
  }

  const rows =
    METRICS.map(metric => {
      const actual =
        river.actual[metric.key];

      const official =
        river.official[metric.key];

      const mismatch =
        actual !== official;

      return `
        <tr class="${mismatch ? 'mismatch' : ''}">
          <td>${metric.label}</td>
          <td>${official}${metric.unit}</td>
          <td>${actual}${metric.unit}</td>

          <td>
            ${
              mismatch
                ? '<span class="status-bad">⚠ 조작 의심</span>'
                : '<span class="status-ok">일치</span>'
            }
          </td>
        </tr>
      `;
    }).join('');

  const gradeMismatch =
    river.actualGrade !== river.officialGrade;

  area.innerHTML = `
    <table class="compare-table">
      <thead>
        <tr>
          <th>지표</th>
          <th>공식 발표</th>
          <th>실측</th>
          <th>상태</th>
        </tr>
      </thead>

      <tbody>
        <tr class="${gradeMismatch ? 'mismatch' : ''}">
          <td>
            <b>통합 등급</b>
          </td>

          <td>
            <b>${river.officialGrade}</b>
            (${GRADE_LABEL[river.officialGrade]})
          </td>

          <td>
            <b>${river.actualGrade}</b>
            (${GRADE_LABEL[river.actualGrade]})
          </td>

          <td>
            ${
              gradeMismatch
                ? '<span class="status-bad">⚠ 조작 의심</span>'
                : '<span class="status-ok">일치</span>'
            }
          </td>
        </tr>

        ${rows}
      </tbody>
    </table>
  `;
}

// ---------------------------------------------------------
// 최근 24시간 그래프
// ---------------------------------------------------------
function seeded(number){
  const value =
    Math.sin(number * 12.9898) *
    43758.5453;

  return value - Math.floor(value);
}

function genSeries(base, noise, seedBase){
  const values = [];

  for(let i = 0; i < 24; i++){
    const wave =
      Math.sin(
        (i / 24) * Math.PI * 2 +
        seedBase
      ) *
      noise *
      0.5;

    const random =
      (
        seeded(seedBase * 97 + i) -
        0.5
      ) *
      noise;

    values.push(
      Math.max(
        0,
        base + wave + random
      )
    );
  }

  values[23] = base;

  return values;
}

function sparklineSVG(values, color, thresholdLine){
  const width = 220;
  const height = 56;
  const padding = 6;

  let min =
    Math.min(...values);

  let max =
    Math.max(...values);

  if(thresholdLine != null){
    min =
      Math.min(min, thresholdLine);

    max =
      Math.max(max, thresholdLine);
  }

  if(max === min){
    max += 1;
    min -= 1;
  }

  const x = index =>
    padding +
    (index / (values.length - 1)) *
    (width - padding * 2);

  const y = value =>
    height -
    padding -
    (
      (value - min) /
      (max - min)
    ) *
    (height - padding * 2);

  const path =
    values
      .map(
        (value, index) =>
          (
            index === 0 ? 'M' : 'L'
          ) +
          x(index).toFixed(1) +
          ',' +
          y(value).toFixed(1)
      )
      .join(' ');

  let threshold = '';

  if(thresholdLine != null){
    const thresholdY =
      y(thresholdLine).toFixed(1);

    threshold = `
      <line
        x1="${padding}"
        y1="${thresholdY}"
        x2="${width - padding}"
        y2="${thresholdY}"
        stroke="#d03b3b"
        stroke-width="1"
        stroke-dasharray="3,3"
        opacity="0.6"
      />
    `;
  }

  const lastX =
    x(values.length - 1);

  const lastY =
    y(values[values.length - 1]);

  return `
    <svg
      viewBox="0 0 ${width} ${height}"
      preserveAspectRatio="none"
    >
      ${threshold}

      <path
        d="${path}"
        fill="none"
        stroke="${color}"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />

      <circle
        cx="${lastX.toFixed(1)}"
        cy="${lastY.toFixed(1)}"
        r="3"
        fill="${color}"
      />
    </svg>
  `;
}

function renderTrends(river){
  const grid =
    document.getElementById('trendGrid');

  grid.innerHTML =
    METRICS.map((metric, index) => {
      const base =
        river.actual[metric.key];

      const noise =
        Math.max(base * 0.08, 0.15);

      const series =
        genSeries(
          base,
          noise,
          index + 1 + river.name.length
        );

      const bad =
        exceeds(metric.key, base);

      const color =
        bad ? '#d03b3b' : '#2a78d6';

      const standard =
        STANDARD[metric.key];

      const threshold =
        standard
          ? (
              standard.max != null
                ? standard.max
                : standard.min
            )
          : null;

      return `
        <div class="trend-card">
          <div class="t-head">
            <span>${metric.label}</span>
            <span>24h</span>
          </div>

          <div
            class="t-now"
            style="color:${bad ? '#d03b3b' : '#0b0b0b'}"
          >
            ${base}${metric.unit}
          </div>

          ${
            sparklineSVG(
              series,
              color,
              threshold
            )
          }
        </div>
      `;
    }).join('');
}

// ---------------------------------------------------------
// 경고 배너
// ---------------------------------------------------------
function renderAlertBanner(){
  const manipulated =
    RIVERS.filter(
      river => river.manipulated
    );

  const banner =
    document.getElementById('alertBanner');

  if(manipulated.length === 0){
    banner.classList.remove('show');
    return;
  }

  banner.classList.add('show');

  banner.innerHTML = `
    ⚠ 검증이 필요한 하천:
    ${manipulated.map(river => river.name).join(', ')}
    <span class="ab-cta">
      자세히 보기 ›
    </span>
  `;

  banner.onclick = () =>
    openDetail(manipulated[0].id);
}

// ---------------------------------------------------------
// 토스트
// ---------------------------------------------------------
function showToast(message){
  const toast =
    document.getElementById('toast');

  toast.textContent = message;

  toast.classList.add('show');

  setTimeout(
    () => toast.classList.remove('show'),
    2200
  );
}

// ---------------------------------------------------------
// 이벤트 연결
// ---------------------------------------------------------
document
  .getElementById('overlayBg')
  .addEventListener(
    'click',
    closeDetail
  );

document
  .getElementById('reportForm')
  .addEventListener(
    'submit',
    event => {
      event.preventDefault();

      const riverId =
        document.getElementById('reportRiver').value;

      const symptom =
        document.getElementById('reportSymptom').value;

      const comment =
        document
          .getElementById('reportComment')
          .value
          .trim();

      addReport(
        riverId,
        symptom,
        comment
      );

      document
        .getElementById('reportComment')
        .value = '';

      showToast(
        '제보가 등록되었습니다. 감사합니다!'
      );
    }
  );

document
  .getElementById('communityFilter')
  .addEventListener(
    'change',
    renderReportFeed
  );

// ---------------------------------------------------------
// 앱 시작
// ---------------------------------------------------------
initTabs();
renderRiverList();
renderReportFeed();
renderCommunityStats();
renderAlertBanner();

// 실제 API 사용 시 api.js에서 WATER_API.enabled = true 로 바꾼 뒤
// 아래 함수가 데이터를 갱신합니다.
startWaterQualityAutoRefresh(60 * 1000);
