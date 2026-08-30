import type { Role } from '@/shared/model/types';

export type Me = {
  user: { id: string; nickname: string; profileImageUrl: string | null; isDev: boolean };
  memberships: {
    id: string;
    role: Role;
    displayName: string;
    family: { id: string; name: string; inviteCode: string };
  }[];
};

/** 로그인 화면이 어떤 버튼을 그릴지 정하는 서버 설정 */
export type AuthConfig = { kakao: boolean; dev: boolean };
