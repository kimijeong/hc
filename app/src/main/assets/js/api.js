// ---------------------------------------------------------
// FlowCheck 실시간 수질 API
// ---------------------------------------------------------
//
// 나중에 실제 수질 API를 붙일 때 가장 많이 수정할 파일입니다.
//
// 현재는 API를 비활성화해 둬서 data.js의 기존 예시 데이터로 앱이 동작합니다.
// 실제 API 주소/응답 구조를 알려주면 이 파일만 맞춰서 연결할 수 있습니다.
//

const WATER_API = {
  enabled:false,

  // 예:
  // baseUrl:'https://example.com/api/water-quality'
  baseUrl:'',

  // 중요:
  // 실제 서비스용 비밀 API 키를 JavaScript에 직접 넣는 것은 권장하지 않습니다.
  // 테스트용 공공 API라면 임시로 사용할 수 있습니다.
  apiKey:''
};

// ---------------------------------------------------------
// 1개 하천의 실시간 수질 데이터 요청
// ---------------------------------------------------------
async function fetchRiverWaterQuality(river){
  if(!WATER_API.enabled){
    return null;
  }

  // TODO:
  // 실제 API가 정해지면 여기 URL 형식을 맞춥니다.
  //
  // 예시:
  // const url =
  //   `${WATER_API.baseUrl}?river=${encodeURIComponent(river.name)}` +
  //   `&serviceKey=${encodeURIComponent(WATER_API.apiKey)}`;

  const url = WATER_API.baseUrl;

  const response = await fetch(url);

  if(!response.ok){
    throw new Error(
      `수질 API 오류: HTTP ${response.status}`
    );
  }

  const rawData = await response.json();

  return normalizeWaterQualityResponse(rawData, river);
}

// ---------------------------------------------------------
// API 응답 → FlowCheck 형식 변환
// ---------------------------------------------------------
function normalizeWaterQualityResponse(rawData, river){
  // 실제 API마다 JSON 필드명이 다르므로
  // API를 정한 다음 여기만 수정하면 됩니다.
  //
  // FlowCheck가 최종적으로 필요로 하는 형식:
  //
  // return {
  //   bod: 3.2,
  //   do: 6.8,
  //   ph: 7.1,
  //   turbidity: 8.4,
  //   tds: 210,
  //   temp: 22.5
  // };

  console.warn(
    '[FlowCheck] API 응답 매핑이 아직 설정되지 않았습니다.',
    river.name,
    rawData
  );

  return null;
}

// ---------------------------------------------------------
// 모든 하천 데이터 갱신
// ---------------------------------------------------------
async function refreshAllWaterQuality(){
  if(!WATER_API.enabled){
    console.log(
      '[FlowCheck] 실시간 수질 API가 아직 비활성화되어 있습니다.'
    );
    return;
  }

  const jobs = RIVERS.map(async river => {
    try{
      const latest = await fetchRiverWaterQuality(river);

      if(latest){
        river.actual = {
          ...river.actual,
          ...latest
        };
      }
    }catch(error){
      console.error(
        `[FlowCheck] ${river.name} 수질 데이터 갱신 실패`,
        error
      );
    }
  });

  await Promise.all(jobs);

  recalculateRiverGrades();

  // 화면 다시 그리기
  if(typeof renderRiverList === 'function'){
    renderRiverList();
  }

  if(typeof renderCommunityStats === 'function'){
    renderCommunityStats();
  }

  if(typeof renderAlertBanner === 'function'){
    renderAlertBanner();
  }

  // 지도가 이미 떠 있으면 마커도 새 등급으로 다시 그리기
  if(
    typeof mapReady !== 'undefined' &&
    mapReady &&
    typeof refreshRiverMarkers === 'function'
  ){
    refreshRiverMarkers();
  }
}

// ---------------------------------------------------------
// 자동 갱신
// ---------------------------------------------------------
function startWaterQualityAutoRefresh(intervalMs = 60 * 1000){
  if(!WATER_API.enabled){
    return;
  }

  refreshAllWaterQuality();

  setInterval(
    refreshAllWaterQuality,
    intervalMs
  );
}
