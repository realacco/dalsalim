// 기능: F-SES-01 F-SES-02 F-SES-07
import { prisma } from '../lib/db.js';

/*
  ★ 닉네임 규칙은 이 파일 한 곳에 있다 — 처음 가입할 때만 로그인 플랫폼에서 받고, 그 뒤로는 앱의 것이다.

  로그인할 때마다 플랫폼 값으로 덮으면 내 정보에서 바꾼 이름(F-SES-07)이 다음 로그인에 사라진다.
  그래서 로그인 upsert 의 update 에는 닉네임을 넣지 않는다. 다른 로그인 수단이 붙어도 같은 모양이다:
  create 에서 처음 값만 그 플랫폼에서 받는다.

  가족 안에서 불리는 이름(Membership.displayName)과는 별개다. 닉네임은 가족을 만들거나 참여할 때
  「내 이름」 칸의 처음 값이 될 뿐이고, 바꿔도 이미 정한 가족 안 이름은 안 바뀐다.
*/

/** 카카오 로그인 — 없으면 만들고, 있으면 프로필 이미지만 맞춘다 (F-SES-01) */
export function upsertKakaoUser(profile: {
  kakaoId: string;
  nickname: string;
  profileImageUrl: string | null;
}) {
  return prisma.user.upsert({
    where: { kakaoId: profile.kakaoId },
    update: { profileImageUrl: profile.profileImageUrl },
    create: {
      kakaoId: profile.kakaoId,
      nickname: profile.nickname,
      profileImageUrl: profile.profileImageUrl,
    },
  });
}

/** 개발용 로그인 — 없으면 이름을 닉네임 삼아 만들고, 있으면 아무것도 안 바꾼다 (F-SES-02) */
export function upsertDevUser(name: string) {
  const devKey = `dev:${name}`;
  return prisma.user.upsert({
    where: { devKey },
    update: {},
    create: { devKey, nickname: name },
  });
}

/** 앱 닉네임 바꾸기 (F-SES-07) */
export function renameUser(userId: string, nickname: string) {
  return prisma.user.update({ where: { id: userId }, data: { nickname } });
}
