// 기능: F-SES-08
import { prisma } from '../lib/db.js';
import { fail } from '../lib/http.js';
import { ACTIVE_MEMBER, DELETED_NICKNAME } from '../lib/shared.js';
import { refreshFamilyBooks } from './family.js';

/**
 * 회원 탈퇴 (F-SES-08).
 *
 * ★ 지우는 것은 **계정**이지 기록이 아니다.
 *
 * `User` 행을 통째로 지우지 않는 이유가 이 함수의 전부다 — `Membership.user` 가
 * `onDelete: Cascade` 라, 행을 지우면 멤버십이 따라가고 그 아래 `MemberEntry` ·
 * `EntryLine` 까지 사라진다. 그건 **내가 있던 달의 가족 합계를 바꾸는 일**이고
 * 하드룰 6 이 막는 바로 그것이다 (F-BOOK-02 가 나간 사람에 대해 지키는 것과 같다).
 *
 * 그래서 신원만 지운다. 남는 것은 이름도 식별자도 없는 빈 행 하나이고,
 * 그 행은 더 이상 사람을 가리키지 않는다 — 과거 기록을 붙들어 두는 고리일 뿐이다.
 * 개인정보처리방침에 이 문장을 적는다.
 *
 * 하드룰 8 은 저절로 지켜진다: `kakaoId` 가 없어지므로 다시 로그인하면 **새 사용자**가
 * 만들어지고, 가족에 돌아가려면 초대코드부터 다시 밟아 승인을 받는다.
 */
export async function deleteAccount(userId: string) {
  const memberships = await prisma.membership.findMany({
    where: { userId, ...ACTIVE_MEMBER },
    select: { id: true, familyId: true, role: true },
  });

  // 가족장은 그냥 못 나간다 — 나가기(F-FAM-08)와 같은 가드다. 탈퇴는 모든 가족에서
  // 한꺼번에 나가는 것이라 한 가족이라도 걸리면 전체를 막는다.
  // 안 막으면 승인할 가족장이 없는 가족이 남는다 (F-FAM-11 이 막으려던 상태).
  for (const membership of memberships) {
    if (membership.role !== 'OWNER') continue;

    const activeCount = await prisma.membership.count({
      where: { familyId: membership.familyId, ...ACTIVE_MEMBER },
    });

    // 남은 사람이 있으면 넘기고, 나 혼자면 나가는 게 아니라 가족을 없애는 것이다
    throw fail(activeCount > 1 ? 'TRANSFER_OWNER_FIRST' : 'LAST_OWNER_MUST_DELETE');
  }

  await prisma.$transaction([
    // 안 지우면 탈퇴한 폰에 다음 정산일 알림이 그대로 간다 (F-FAM-10)
    prisma.pushToken.deleteMany({ where: { userId } }),

    // 승인 전 요청은 매달린 기록이 없으므로 실제로 지운다 (하드룰 6 근거 ①).
    // LEFT 로 남기면 가족장의 요청 목록에 이름 없는 줄이 남는다
    prisma.membership.deleteMany({ where: { userId, status: 'PENDING' } }),

    // 내보내기와 같다 — 앞으로의 장부에서 빠지고 지난 기록은 그대로 남는다
    prisma.membership.updateMany({
      where: { userId, ...ACTIVE_MEMBER },
      data: { status: 'LEFT', leftAt: new Date() },
    }),

    prisma.user.update({
      where: { id: userId },
      data: {
        // 이 둘이 계정이다. 지워야 다시 로그인했을 때 남이 된다
        kakaoId: null,
        devKey: null,
        nickname: DELETED_NICKNAME,
        profileImageUrl: null,
      },
    }),
  ]);

  // 구성원이 줄었으니 정원이 바뀐다. 완성 판정은 한 곳에서만 한다 (하드룰 7)
  for (const familyId of new Set(memberships.map((m) => m.familyId))) {
    await refreshFamilyBooks(familyId);
  }
}
