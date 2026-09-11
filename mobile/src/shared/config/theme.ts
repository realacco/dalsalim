import type { TextStyle } from 'react-native';

/**
 * 달살림 디자인 토큰.
 *
 * 가계부는 매달 열어야 하는 앱이라 화면이 피곤하면 안 쓴다.
 * 차가운 파스텔 회청색 바탕에 부드러운 남보라 하나로만 강조한다.
 *
 * ★ 색은 반드시 이 파일의 팔레트에서만 가져온다. 화면에 hex 를 직접 쓰지 않는다.
 *   런타임에 밝게/어둡게가 바뀌므로, 색을 모듈 최상단에서 굳히면 다크 모드가 깨진다.
 *   화면은 `useTheme()` 또는 `makeStyles()` 로 받아 쓴다. (shared/config/theme-provider.tsx)
 */

/** 밝게/어둡게에 따라 달라지는 것 — 색만 여기 들어간다. */
export type Palette = {
  /** 화면 바닥 */
  bg: string;
  /** 카드·입력창처럼 바닥 위에 뜬 면 */
  surface: string;
  /** 눌린 면, 강조 없는 블록 */
  surfaceMuted: string;
  /** 카드를 눌렀을 때 */
  surfacePressed: string;

  /** 본문 */
  ink: string;
  /** 보조 설명 */
  inkSoft: string;
  /** 캡션·플레이스홀더 */
  inkFaint: string;

  line: string;
  lineStrong: string;

  /** 확정·다음 */
  primary: string;
  primarySoft: string;
  /** primary 면 위에 얹는 글자색 — 다크에서 surface 를 쓰면 글자가 안 보인다 */
  primaryInk: string;

  /** 지난달보다 늘어남. "지출"이 아니다 — 지출 자체는 잘못이 아니다 */
  up: string;
  upSoft: string;
  /** 지난달보다 줄어듦 */
  down: string;
  downSoft: string;

  danger: string;
  /** 모달 뒤에 까는 막 */
  overlay: string;

  /** 브랜드 색이라 밝게/어둡게가 같다 */
  kakao: string;
  kakaoInk: string;

  /**
   * 추이 차트의 선 색. 셋을 구분하는 게 목적이라 의미(오름/내림)를 싣지 않는다.
   * up/down 을 그대로 쓰면 "고정비는 빨강 = 나쁨"으로 읽혀 잔소리처럼 보인다.
   */
  chartIncome: string;
  chartFixed: string;
  chartSurplus: string;
};

const light: Palette = {
  bg: '#F4F5FA',
  surface: '#FFFFFF',
  surfaceMuted: '#EDEFF7',
  surfacePressed: '#E7EAF5',

  ink: '#22242E',
  inkSoft: '#5A5F73',
  inkFaint: '#9599AD',

  line: '#E7E9F2',
  lineStrong: '#D3D7E5',

  primary: '#7B8CF4',
  primarySoft: '#E9ECFE',
  primaryInk: '#FFFFFF',

  up: '#EF8570',
  upSoft: '#FDEDE9',
  down: '#4CC3A0',
  downSoft: '#E5F7F1',

  danger: '#E4675C',
  overlay: 'rgba(24,26,34,0.45)',

  kakao: '#FEE500',
  kakaoInk: '#191600',

  chartIncome: '#7B8CF4',
  chartFixed: '#F0A868',
  chartSurplus: '#4CC3A0',
};

const dark: Palette = {
  bg: '#14151B',
  surface: '#1D1F28',
  surfaceMuted: '#262934',
  surfacePressed: '#2E3240',

  ink: '#EDEEF4',
  inkSoft: '#A4A9BD',
  inkFaint: '#6F7488',

  line: '#2A2D39',
  lineStrong: '#3B3F4E',

  primary: '#8E9CF7',
  primarySoft: '#262B47',
  primaryInk: '#14151B',

  up: '#F09A85',
  upSoft: '#3A2724',
  down: '#5FD0AE',
  downSoft: '#1D332C',

  danger: '#F0776B',
  overlay: 'rgba(0,0,0,0.62)',

  kakao: '#FEE500',
  kakaoInk: '#191600',

  chartIncome: '#8E9CF7',
  chartFixed: '#F3B67E',
  chartSurplus: '#5FD0AE',
};

export const palettes = { light, dark } as const;
export type ColorScheme = keyof typeof palettes;

export const space = {
  /** 이름과 그 설명처럼 **한 덩어리로 읽혀야 하는 두 줄** 사이. xs 는 이미 벌어져 보인다 */
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  /** 화면 바깥 여백. 토스처럼 넉넉하게 둔다 */
  screen: 20,
} as const;

/**
 * 테두리 두께.
 *
 * 두 값의 차이는 실수가 아니라 역할이다 — 가만히 있는 면은 얇게 두고,
 * 손이 닿는 컨트롤은 한 단계 굵게 잡아 "여기를 누르거나 입력한다"를 드러낸다.
 */
export const border = {
  /** 카드 · 리스트 행처럼 가만히 있는 면 */
  hairline: 1,
  /** 칩 · 입력창처럼 누르거나 입력하는 것 */
  control: 1.5,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  /** 카드 — 크게 둥글려야 부드럽게 읽힌다 */
  card: 20,
  sheet: 28,
  pill: 999,
} as const;

/**
 * 타이포 위계.
 * 헤딩은 과감하게 크게, 부가 정보는 작고 흐리게 — 그 대비가 화면을 정리한다.
 */
export const font = {
  caption: { fontSize: 12, lineHeight: 16 },
  small: { fontSize: 13, lineHeight: 18 },
  /**
   * 여러 줄로 감기는 보조 문구 — 힌트 · 안내 · 오류 한 줄.
   * caption·small 의 줄 간격은 한 줄짜리 라벨 기준이라, 문장이 감기면 답답하게 붙는다.
   * 화면 다섯 곳이 각자 lineHeight 를 덧칠하고 있어서 토큰으로 올렸다.
   */
  hint: { fontSize: 12, lineHeight: 18 },
  note: { fontSize: 13, lineHeight: 20 },
  body: { fontSize: 15, lineHeight: 22 },
  bodyLg: { fontSize: 17, lineHeight: 24 },
  title: { fontSize: 20, lineHeight: 28 },
  headline: { fontSize: 24, lineHeight: 32, letterSpacing: -0.3 },
  /** 위저드의 질문 */
  question: { fontSize: 26, lineHeight: 36, letterSpacing: -0.5 },
  /** 화면 제목 */
  display: { fontSize: 30, lineHeight: 38, letterSpacing: -0.8 },
  /** 로고·스플래시 */
  displayLg: { fontSize: 38, lineHeight: 46, letterSpacing: -1.2 },
  /** 금액 — 자릿수가 흔들리지 않게 tabular */
  amount: { fontSize: 34, lineHeight: 42, fontVariant: ['tabular-nums'] },
  amountLg: { fontSize: 38, lineHeight: 46, fontVariant: ['tabular-nums'] },
  /** 섹션 제목 — 작고 굵게, 자간을 살짝 벌려 라벨처럼 읽히게 한다 */
  sectionTitle: { fontSize: 13, lineHeight: 18, letterSpacing: 0.4 },
  /** 초대코드처럼 한 글자씩 읽는 것 */
  code: { fontSize: 30, lineHeight: 38, letterSpacing: 8 },
  /** 초대코드를 "입력"하는 칸. 표시용 code 보다 작고 자간도 그만큼 좁다 */
  codeInput: { fontSize: 17, lineHeight: 24, letterSpacing: 6 },
  /** 헤더의 ‹ › 같은 글리프 */
  glyph: { fontSize: 28, lineHeight: 32 },
} satisfies Record<string, TextStyle>;

/**
 * 흐리게 처리하는 정도.
 *
 * 비활성은 한 값으로 통일한다. 화살표 0.25 · [+] 0.35 · 버튼 0.4 로 제각각이었는데,
 * 같은 "눌러도 안 된다"를 세 가지 세기로 말할 이유가 없었다. 셋 다 그때그때 정한 값이지
 * 서로 다르게 두려고 정한 값이 아니다.
 *
 * 0.4 로 맞춘 이유: 눌러도 안 되는 건 맞지만 **무엇이 있었는지는 읽혀야** 한다.
 * 0.25 는 다음 달 화살표가 거의 사라져 "여기 버튼이 있다"는 것조차 안 보였다.
 */
export const opacity = {
  disabled: 0.4,
} as const;

export const weight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  heavy: '800',
} as const;

/**
 * 크기. 손가락이 닿는 것들.
 */
export const size = {
  /** 터치 최소 크기. iOS 44 · Material 48 중 작은 쪽 — 이보다 작은 버튼은 잘못 눌린다 */
  touch: 44,
  /** 아래 시트의 손잡이 알약 */
  grabberWidth: 40,
  grabberHeight: 4,
} as const;

/**
 * 움직임.
 * 누르면 살짝 들어가고, 상태가 바뀌면 부드럽게 넘어간다. 뚝뚝 끊기지 않게.
 */
export const motion = {
  fast: 120,
  base: 200,
  slow: 320,
  /** 누를 때 줄어드는 비율 */
  pressScale: 0.97,
  pressScaleSmall: 0.94,
  pressOpacity: 0.92,
  spring: { damping: 18, stiffness: 220, mass: 0.6 },
} as const;

type Shadow = {
  shadowColor: string;
  shadowOpacity: number;
  shadowRadius: number;
  shadowOffset: { width: number; height: number };
  elevation: number;
};

export type ShadowSet = { card: Shadow; sheet: Shadow };

/** 그림자는 밝은 테마에서만 의미가 있다. 어두운 배경에서는 대비가 안 생긴다. */
const shadow: Record<ColorScheme, ShadowSet> = {
  light: {
    card: {
      shadowColor: '#2B2F45',
      shadowOpacity: 0.06,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
    },
    sheet: {
      shadowColor: '#2B2F45',
      shadowOpacity: 0.16,
      shadowRadius: 28,
      shadowOffset: { width: 0, height: -8 },
      elevation: 12,
    },
  },
  dark: {
    card: {
      shadowColor: '#000000',
      shadowOpacity: 0,
      shadowRadius: 0,
      shadowOffset: { width: 0, height: 0 },
      elevation: 0,
    },
    sheet: {
      shadowColor: '#000000',
      shadowOpacity: 0.5,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: -8 },
      elevation: 12,
    },
  },
};

export type Theme = {
  scheme: ColorScheme;
  colors: Palette;
  space: typeof space;
  border: typeof border;
  radius: typeof radius;
  size: typeof size;
  font: typeof font;
  weight: typeof weight;
  opacity: typeof opacity;
  motion: typeof motion;
  shadow: ShadowSet;
};

export function buildTheme(scheme: ColorScheme): Theme {
  return {
    scheme,
    colors: palettes[scheme],
    space,
    border,
    radius,
    size,
    font,
    weight,
    opacity,
    motion,
    shadow: shadow[scheme],
  };
}
