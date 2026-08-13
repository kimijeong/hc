// ---------------------------------------------------------
// 카카오맵
// ---------------------------------------------------------

let map = null;
let mapReady = false;

let openPopup = null;

const riverOverlays = [];
const reportOverlays = [];

// 기존 HTML에 있던 JavaScript 키.
// 카카오 개발자센터의 JavaScript SDK 도메인 설정도 확인하세요.
const KAKAO_JAVASCRIPT_KEY =
  '38db833f1747297f55b45d683d0feb3f';

function initMap(){
  const container =
    document.getElementById('map');

  map = new kakao.maps.Map(
    container,
    {
      center:
        new kakao.maps.LatLng(
          35.1691,
          129.0480
        ),

      level:8
    }
  );

  mapReady = true;

  refreshRiverMarkers();
  refreshReportMarkers();
}

function clearOverlays(overlays){
  overlays.forEach(
    overlay => overlay.setMap(null)
  );

  overlays.length = 0;
}

function refreshRiverMarkers(){
  if(!mapReady) return;

  clearOverlays(riverOverlays);

  RIVERS.forEach(addRiverMarker);
}

function refreshReportMarkers(){
  if(!mapReady) return;

  clearOverlays(reportOverlays);

  reports.forEach(addReportMarker);
}

function addRiverMarker(river){
  const element =
    document.createElement('div');

  element.className =
    'river-marker' +
    (river.manipulated ? ' danger' : '');

  element.style.background =
    GRADE_COLOR[river.actualGrade];

  element.title =
    `${river.name} (${river.actualGrade}등급)` +
    (
      river.manipulated
        ? ' — 공식 발표와 불일치'
        : ''
    );

  element.addEventListener(
    'click',
    () => openDetail(river.id)
  );

  const overlay =
    new kakao.maps.CustomOverlay({
      map,
      position:
        new kakao.maps.LatLng(
          river.lat,
          river.lng
        ),

      content:element,
      yAnchor:0.5
    });

  riverOverlays.push(overlay);
}

function addReportMarker(report){
  const river =
    RIVERS.find(
      item => item.id === report.riverId
    );

  const element =
    document.createElement('div');

  element.className =
    'report-marker';

  element.title =
    `${river ? river.name : ''} 제보: ${report.symptom}`;

  element.addEventListener(
    'click',
    () => {
      if(openPopup){
        openPopup.setMap(null);
        openPopup = null;
      }

      const box =
        document.createElement('div');

      box.className =
        'kakao-popup';

      box.innerHTML = `
        <span class="close">✕</span>

        <b>
          ${river ? river.name : ''}
        </b>
        <br>

        <span
          style="
            color:#d03b3b;
            font-weight:700;
          "
        >
          ${escapeHtml(report.symptom)}
        </span>

        <br>

        ${
          report.comment
            ? escapeHtml(report.comment) + '<br>'
            : ''
        }

        <span style="color:#898781;">
          ${fmtTime(report.time)}
        </span>
      `;

      const popup =
        new kakao.maps.CustomOverlay({
          map,

          position:
            new kakao.maps.LatLng(
              report.lat,
              report.lng
            ),

          content:box,
          yAnchor:1.3
        });

      box
        .querySelector('.close')
        .addEventListener(
          'click',
          () => {
            popup.setMap(null);

            if(openPopup === popup){
              openPopup = null;
            }
          }
        );

      openPopup = popup;
    }
  );

  const overlay =
    new kakao.maps.CustomOverlay({
      map,

      position:
        new kakao.maps.LatLng(
          report.lat,
          report.lng
        ),

      content:element,
      yAnchor:0.5
    });

  reportOverlays.push(overlay);
}

function showMapFallback(){
  document
    .getElementById('mapFallback')
    .style.display = 'flex';

  document
    .getElementById('currentOrigin')
    .textContent = location.origin;
}

(function loadKakaoMap(){
  let resolved = false;

  const script =
    document.createElement('script');

  script.src =
    `https://dapi.kakao.com/v2/maps/sdk.js` +
    `?appkey=${KAKAO_JAVASCRIPT_KEY}` +
    `&autoload=false`;

  script.onload = () => {
    if(
      window.kakao &&
      kakao.maps
    ){
      kakao.maps.load(() => {
        resolved = true;
        initMap();
      });
    }
  };

  script.onerror = () => {
    console.error(
      '[FlowCheck] 카카오맵 SDK 스크립트 로딩 실패'
    );

    showMapFallback();
  };

  document.head.appendChild(script);

  setTimeout(
    () => {
      if(!resolved){
        showMapFallback();
      }
    },
    4000
  );
})();
