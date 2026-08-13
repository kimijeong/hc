// ---------------------------------------------------------
// FlowCheck 고정 데이터 / 수질 기준 / 공통 유틸
// ---------------------------------------------------------

const STANDARD = {
  bod:       { max:3.0, label:'BOD ≤ 3.0 mg/L' },
  do:        { min:5.0, label:'DO ≥ 5.0 mg/L' },
  ph:        { min:6.5, max:8.5, label:'pH 6.5~8.5' },
  turbidity: { max:15, label:'탁도 ≤ 15 NTU' },
  tds:       { max:500, label:'TDS ≤ 500 mg/L' }
};

const METRICS = [
  { key:'bod',       label:'BOD',         unit:'mg/L' },
  { key:'do',        label:'DO(용존산소)', unit:'mg/L' },
  { key:'ph',        label:'pH',          unit:'' },
  { key:'turbidity', label:'탁도',         unit:'NTU' },
  { key:'tds',       label:'TDS',         unit:'mg/L' },
  { key:'temp',      label:'수온',         unit:'℃' }
];

const GRADE_COLOR = {
  I:'#2a78d6',
  II:'#1baf7a',
  III:'#0ca30c',
  IV:'#fab219',
  V:'#ec835a',
  VI:'#d03b3b'
};

const GRADE_LABEL = {
  I:'매우좋음(청정)',
  II:'좋음(양호)',
  III:'보통',
  IV:'약간나쁨',
  V:'나쁨',
  VI:'매우나쁨(극도오염)'
};

function gradeFromBOD(bod){
  if(bod <= 3) return 'I';
  if(bod <= 5) return 'II';
  if(bod <= 8) return 'III';
  if(bod <= 10) return 'IV';
  if(bod <= 15) return 'V';
  return 'VI';
}

// 현재는 기존 HTML의 예시 값을 그대로 둡니다.
// 실제 API 연결 후 actual 값은 api.js가 덮어쓸 수 있습니다.
const RIVERS = [
  {
    id:'oncheon',
    name:'온천천',
    district:'부산 동래구',
    lat:35.2075,
    lng:129.0864,
    manipulated:true,
    actual:{
      bod:18.7,
      do:0.8,
      ph:4.3,
      turbidity:87.4,
      tds:1920,
      temp:31.4
    },
    official:{
      bod:2.8,
      do:7.2,
      ph:7.4,
      turbidity:5.2,
      tds:180,
      temp:22.5
    }
  },
  {
    id:'dongcheon',
    name:'동천',
    district:'부산 부산진구',
    lat:35.1367,
    lng:129.0398,
    manipulated:false,
    actual:{
      bod:6.5,
      do:3.8,
      ph:6.8,
      turbidity:22.4,
      tds:420,
      temp:24.5
    },
    official:{
      bod:6.5,
      do:3.8,
      ph:6.8,
      turbidity:22.4,
      tds:420,
      temp:24.5
    }
  },
  {
    id:'goejeong',
    name:'괴정천',
    district:'부산 사하구',
    lat:35.0992,
    lng:128.9878,
    manipulated:false,
    actual:{
      bod:3.8,
      do:6.5,
      ph:7.6,
      turbidity:9.8,
      tds:210,
      temp:20.4
    },
    official:{
      bod:3.8,
      do:6.5,
      ph:7.6,
      turbidity:9.8,
      tds:210,
      temp:20.4
    }
  }
];

function recalculateRiverGrades(){
  RIVERS.forEach(river => {
    river.actualGrade = gradeFromBOD(river.actual.bod);
    river.officialGrade = gradeFromBOD(river.official.bod);
  });
}

recalculateRiverGrades();

function exceeds(key, value){
  const standard = STANDARD[key];

  if(!standard) return false;
  if(standard.max != null && value > standard.max) return true;
  if(standard.min != null && value < standard.min) return true;

  return false;
}

function escapeHtml(text){
  return String(text).replace(
    /[&<>"']/g,
    char => ({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#39;'
    }[char])
  );
}
