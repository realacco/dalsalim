import type { Role, Settlement } from '@/shared/model/types';

export type Me = {
  user: { id: string; nickname: string; isDev: boolean };
  memberships: {
    id: string;
    role: Role;
    displayName: string;
    settlement: Settlement | null;
    /** 이번 달 알림이 이미 갔거나 (지난 시각으로 정해) 건너뛴 달 `YYYY-MM`. 없으면 null */
    settlementNotifiedFor: string | null;
    family: { id: string; name: string; inviteCode: string };
  }[];
};

/** 로그인 화면이 어떤 버튼을 그릴지 정하는 서버 설정 */
export type AuthConfig = { kakao: boolean; dev: boolean };
