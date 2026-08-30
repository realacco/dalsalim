import { prisma } from '../lib/db.js';
import { refreshBookStatus } from './book.js';

/**
 * 초대코드 규칙.
 *
 * 사람이 카톡으로 불러주거나 눈으로 읽어 옮겨 적는 코드라서, 헷갈리는 글자(0/O, 1/I)를 뺀다.
 * 인프라가 아니라 도메인 규칙이므로 db.ts 가 아니라 여기 있다.
 */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

export async function generateInviteCode(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i += 1) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }

    const taken = await prisma.family.findUnique({ where: { inviteCode: code } });
    if (!taken) return code;
  }

  throw new Error('초대코드를 만들지 못했습니다.');
}

/**
 * 멤버를 가족에서 뺀다 — 본인이면 나가기, OWNER 가 남을 빼면 내보내기.
 *
 * ★ 실제로 지우지 않는다. Membership 을 지우면 MemberEntry 가 Cascade 로 딸려 나가
 * 그 사람이 참여했던 지난달 장부의 합계가 바뀐다. 과거는 그대로 두고 앞으로만 빼낸다.
 *
 * 뺀 뒤에는 그 가족의 장부 상태를 다시 계산해야 한다. 안 그러면 "완성"에 필요한
 * 인원수가 줄었는데도 장부가 계속 진행 중으로 남는다.
 */
export async function deactivateMember(familyId: string, membershipId: string) {
  await prisma.membership.update({
    where: { id: membershipId },
    data: { active: false, leftAt: new Date() },
  });

  await refreshFamilyBooks(familyId);
}

/** 가족장을 넘긴다. 넘긴 사람은 일반 멤버가 된다. */
export async function transferOwner(fromMembershipId: string, toMembershipId: string) {
  await prisma.$transaction([
    prisma.membership.update({ where: { id: fromMembershipId }, data: { role: 'MEMBER' } }),
    prisma.membership.update({ where: { id: toMembershipId }, data: { role: 'OWNER' } }),
  ]);
}

/** 구성원이 바뀌면 모든 달의 완성 판정이 흔들린다. 한 번에 다시 계산한다. */
export async function refreshFamilyBooks(familyId: string) {
  const books = await prisma.monthlyBook.findMany({ where: { familyId }, select: { id: true } });
  for (const book of books) {
    await refreshBookStatus(book.id);
  }
}
