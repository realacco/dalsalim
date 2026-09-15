// 기능: F-FAM-10
import { create } from 'zustand';

/**
 * 이 기기가 알림을 받을 수 있는 상태.
 *  - granted     서버에 등록됐다
 *  - denied      알림 권한이 꺼져 있다 — 폰 설정에서 켜야 한다
 *  - unavailable 이 빌드·기기에서는 토큰이 안 나온다 (Expo Go · iOS · FCM 키 없는 빌드)
 *  - failed      토큰은 나왔는데 서버에 못 올렸다 — 다음에 앱을 열면 다시 한다
 *
 * 화면 상태가 아니라 앱 전체의 것이다. 앱을 켤 때의 조용한 재등록과 정산일 저장 때의 등록이
 * 같은 값을 갱신해야, 폰 설정에서 알림을 끈 사람에게 카드가 "꺼져 있어요" 를 보여줄 수 있다.
 */
export type PushState = 'granted' | 'denied' | 'unavailable' | 'failed';

type PushStore = {
  /** 아직 한 번도 시도 안 했으면 null */
  state: PushState | null;
  setState: (state: PushState | null) => void;
};

export const usePushStore = create<PushStore>((set) => ({
  state: null,
  setState: (state) => set({ state }),
}));
