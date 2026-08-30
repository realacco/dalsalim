/**
 * 달살림 디자인 토큰.
 *
 * 가계부는 매달 열어야 하는 앱이라 화면이 피곤하면 안 쓴다.
 * 종이 질감의 따뜻한 배경 + 진한 먹색 글자 + 초록 하나로만 강조한다.
 * 빨강은 "지출"이 아니라 "지난달보다 늘어난 것"에만 쓴다 — 지출 자체는 잘못이 아니다.
 */

export const colors = {
  bg: '#FBF7F0', // 따뜻한 종이
  surface: '#FFFFFF',
  surfaceMuted: '#F4EFE6',

  ink: '#231F1A', // 본문
  inkSoft: '#5E574D', // 보조 설명
  inkFaint: '#9A9086', // 캡션·플레이스홀더

  line: '#E7DFD2',
  lineStrong: '#D6CBB8',

  primary: '#2E7D5B', // 확정·다음
  primarySoft: '#E4F0EA',

  up: '#C0553B', // 지난달보다 늘어남
  upSoft: '#FBEAE5',
  down: '#2E7D5B', // 지난달보다 줄어듦

  kakao: '#FEE500',
  kakaoInk: '#191600',

  danger: '#C0392B',
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const font = {
  caption: { fontSize: 12, lineHeight: 16 },
  small: { fontSize: 13, lineHeight: 18 },
  body: { fontSize: 15, lineHeight: 22 },
  bodyLg: { fontSize: 17, lineHeight: 24 },
  title: { fontSize: 20, lineHeight: 28 },
  question: { fontSize: 24, lineHeight: 34 },
  amount: { fontSize: 34, lineHeight: 42 },
} as const;

export const shadow = {
  card: {
    shadowColor: '#4A3F2E',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
} as const;
