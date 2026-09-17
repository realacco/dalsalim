// 기능: F-SES-09
import * as SplashScreen from 'expo-splash-screen';

/*
  스플래시를 테마 저장값을 읽고 창 배경을 테마 색으로 칠할 때까지 붙잡아 둔다. 그냥 두면 루트 뷰가
  붙는 순간 내려가고, 테마를 읽는 동안 안드로이드 창 배경(app.json 의 밝은 색 한 벌)이 비친다 —
  「어둡게」 를 고른 사람에게는 켤 때마다 밝은 판이 번쩍인다.
  이미 내려갔거나 못 붙잡는 환경이면 던지는데, 그때는 붙잡지 않은 것과 같아 버린다.

  테마가 아니라 앱 셸의 수명이라 여기 따로 둔다. 테마 공급자는 거의 모든 화면이 임포트하므로
  거기 두면 임포트만으로 네이티브 호출과 타이머가 따라붙는다. 이 파일은 앱 셸만 임포트한다.
*/
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

/** 무슨 일이 있어도 이 시간 뒤에는 스플래시를 내린다 — 렌더가 던지면 에러 화면을 덮고 남기 때문이다 */
const SPLASH_MAX_MS = 3000;

let hidden = false;
let hiding = false;

/**
 * 스플래시를 내린다. 여러 번 불러도 한 번 내려가면 그만이다.
 * 부르는 곳은 앱 셸이다 — 창 배경을 테마 색으로 칠한 **뒤에** 불러야 두 네이티브 호출의 순서가 보장된다.
 *
 * 성공했을 때만 잠근다. 먼저 잠그고 실패를 삼키면 첫 시도가 실패한 순간 뒤의 상한 타이머까지
 * 아무것도 안 해서 스플래시가 남는다
 */
export function hideSplash() {
  if (hidden || hiding) return;
  hiding = true;
  SplashScreen.hideAsync()
    .then(() => {
      hidden = true;
    })
    .catch(() => undefined)
    .finally(() => {
      hiding = false;
    });
}

setTimeout(hideSplash, SPLASH_MAX_MS);
