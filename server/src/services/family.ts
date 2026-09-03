import type { Membership } from '@prisma/client';

import { prisma } from '../lib/db.js';
import { fail } from '../lib/http.js';
import { ACTIVE_MEMBER, randomInviteCode } from '../lib/shared.js';
import { refreshBookStatus } from './book.js';

/** 새 초대코드 — 이미 쓰는 코드와 겹치지 않을 때까지 뽑는다 (규칙은 lib/shared 의 randomInviteCode) */
export async function generateInviteCode(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = randomInviteCode();
    const taken = await prisma.family.findUnique({ where: { inviteCode: code } });
    if (!taken) return code;
  }

  throw new Error('초대코드를 만들지 못했어요.');
}

/** 가족 만들기 — 만든 사람이 OWNER 가 된다 */
export async function createFamily(userId: string, name: string, displayName: string) {
  return prisma.family.create({
    data: {
      name,
      inviteCode: await generateInviteCode(),
      memberships: { create: { userId, displayName, role: 'OWNER', sortOrder: 0 } },
    },
  });
}

/**
 * 초대코드로 참여 요청하기.
 *
 * ★ 여기서 바로 구성원이 되지 않는다. PENDING 으로 들어가고 가족장이 승인해야 ACTIVE 가 된다 (하드룰 8).
 *   초대코드는 카톡으로 오가는 문자열이라 언제든 새어나갈 수 있는데,
 *   그것 하나로 남의 가계부가 통째로 열리면 안 된다.
 */
export async function requestJoin(userId: string, inviteCode: string, displayName: string) {
  const family = await prisma.family.findUnique({
    where: { inviteCode },
    include: { memberships: true },
  });
  if (!family) throw fail('INVITE_CODE_NOT_FOUND');

  const existing = family.memberships.find((m) => m.userId === userId);
  if (existing?.status === 'ACTIVE') throw fail('ALREADY_MEMBER');
  if (existing?.status === 'PENDING') throw fail('ALREADY_REQUESTED');

  let membership: Membership;
  if (existing) {
    // 나갔던 사람이 돌아왔다. (familyId, userId) 가 unique 라 새로 만들 수 없고,
    // 지난 기록이 이 멤버십에 매달려 있으므로 되살리는 게 맞다.
    // 나갔던 사람도 다시 승인을 받는다 — 내보낸 사람이 코드만으로 돌아오면 안 되니까.
    membership = await prisma.membership.update({
      where: { id: existing.id },
      data: { status: 'PENDING', requestedAt: new Date(), leftAt: null, displayName },
    });
  } else {
    membership = await prisma.membership.create({
      data: {
        familyId: family.id,
        userId,
        displayName,
        role: 'MEMBER',
        status: 'PENDING',
        requestedAt: new Date(),
        sortOrder: family.memberships.length,
      },
    });
  }

  return { membership, family };
}

/** 내가 승인을 기다리고 있는 가족들 */
export function listMyPendingRequests(userId: string) {
  return prisma.membership.findMany({
    where: { userId, status: 'PENDING' },
    include: { family: true },
    orderBy: { requestedAt: 'asc' },
  });
}

/** 기다리다 지쳤거나 코드를 잘못 넣었을 때, 요청을 스스로 무른다 */
export async function cancelJoinRequest(userId: string, membershipId: string) {
  const mine = await prisma.membership.findUnique({ where: { id: membershipId } });
  if (!mine || mine.userId !== userId || mine.status !== 'PENDING') {
    throw fail('REQUEST_NOT_FOUND');
  }

  // 승인 전이라 이 멤버십에 매달린 기록이 없다. 되살릴 게 없으니 그냥 지운다 (하드룰 6 의 예외).
  await prisma.membership.delete({ where: { id: mine.id } });
}

/** 들어온 참여 요청 목록 — 가족장이 본다 */
export function listJoinRequests(familyId: string) {
  return prisma.membership.findMany({
    where: { familyId, status: 'PENDING' },
    include: { user: true },
    orderBy: { requestedAt: 'asc' },
  });
}

async function findPendingRequest(familyId: string, membershipId: string) {
  const target = await prisma.membership.findUnique({ where: { id: membershipId } });
  if (!target || target.familyId !== familyId || target.status !== 'PENDING') {
    throw fail('REQUEST_NOT_FOUND');
  }
  return target;
}

export async function approveJoinRequest(familyId: string, membershipId: string) {
  const target = await findPendingRequest(familyId, membershipId);

  await prisma.membership.update({
    where: { id: target.id },
    data: { status: 'ACTIVE', joinedAt: new Date(), leftAt: null },
  });

  // 사람이 늘면 "전원 제출"에 필요한 정원도 늘어난다. 다시 계산하지 않으면
  // 먼저 있던 사람들만으로 완성돼 있던 장부가 완성인 채로 남는다 —
  // 방금 들어온 사람은 한 줄도 안 적었는데 홈에 '완성' 배지가 뜬다.
  await refreshFamilyBooks(familyId);
  return target;
}

export async function rejectJoinRequest(familyId: string, membershipId: string) {
  const target = await findPendingRequest(familyId, membershipId);

  // 승인 전이라 매달린 기록이 없다. LEFT 로 남기면 "한때 구성원이었던 사람"으로
  // 잘못 읽히고 다시 요청할 때도 걸리적거린다. 지우는 게 맞다.
  await prisma.membership.delete({ where: { id: target.id } });
  return target;
}

/** 가족 상세 — 구성원은 ACTIVE 만 (하드룰 8) */
export function getFamilyWithMembers(familyId: string) {
  return prisma.family.findUniqueOrThrow({
    where: { id: familyId },
    include: {
      memberships: {
        where: ACTIVE_MEMBER,
        include: { user: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });
}

/** 초대코드 재발급 — 예전 코드를 아는 사람을 막고 싶을 때 */
export async function rotateInviteCode(familyId: string) {
  return prisma.family.update({
    where: { id: familyId },
    data: { inviteCode: await generateInviteCode() },
  });
}

export function renameMember(membershipId: string, displayName: string) {
  return prisma.membership.update({ where: { id: membershipId }, data: { displayName } });
}

/**
 * 가족에서 빼기 — 본인이면 나가기, OWNER 가 남을 지목하면 내보내기.
 * 이게 없으면 안 쓰는 멤버 한 명이 장부를 영원히 막는다. 잘못 초대한 사람도 뺄 수 없다.
 */
export async function removeMember(familyId: string, mine: Membership, targetId: string) {
  const target = await prisma.membership.findUnique({ where: { id: targetId } });
  if (!target || target.familyId !== familyId || target.status !== 'ACTIVE') {
    throw fail('MEMBER_NOT_FOUND');
  }

  const isSelf = target.id === mine.id;
  if (!isSelf && mine.role !== 'OWNER') throw fail('OWNER_ONLY_REMOVE');

  const activeCount = await prisma.membership.count({
    where: { familyId, ...ACTIVE_MEMBER },
  });

  // 가족장이 그냥 나가면 주인 없는 가족이 남는다. 남은 사람이 있으면 먼저 넘겨야 한다.
  if (target.role === 'OWNER' && activeCount > 1) throw fail('TRANSFER_OWNER_FIRST');

  await deactivateMember(familyId, target.id);
  return target;
}

/**
 * 멤버를 가족에서 뺀다.
 *
 * ★ 실제로 지우지 않는다 (하드룰 6). Membership 을 지우면 MemberEntry 가 Cascade 로 딸려 나가
 * 그 사람이 참여했던 지난달 장부의 합계가 바뀐다. 과거는 그대로 두고 앞으로만 빼낸다.
 *
 * 뺀 뒤에는 그 가족의 장부 상태를 다시 계산해야 한다. 안 그러면 "완성"에 필요한
 * 인원수가 줄었는데도 장부가 계속 진행 중으로 남는다.
 */
export async function deactivateMember(familyId: string, membershipId: string) {
  await prisma.membership.update({
    where: { id: membershipId },
    data: { status: 'LEFT', leftAt: new Date() },
  });

  await refreshFamilyBooks(familyId);
}

/** 가족장 넘기기. 넘긴 사람은 일반 멤버가 된다. */
export async function transferOwnership(familyId: string, mine: Membership, targetId: string) {
  const target = await prisma.membership.findUnique({ where: { id: targetId } });
  if (!target || target.familyId !== familyId || target.status !== 'ACTIVE') {
    throw fail('MEMBER_NOT_FOUND');
  }
  if (target.id === mine.id) throw fail('ALREADY_OWNER');

  await prisma.$transaction([
    prisma.membership.update({ where: { id: mine.id }, data: { role: 'MEMBER' } }),
    prisma.membership.update({ where: { id: target.id }, data: { role: 'OWNER' } }),
  ]);
  return target;
}

/** 구성원이 바뀌면 모든 달의 완성 판정이 흔들린다. 한 번에 다시 계산한다. */
export async function refreshFamilyBooks(familyId: string) {
  const books = await prisma.monthlyBook.findMany({ where: { familyId }, select: { id: true } });
  for (const book of books) {
    await refreshBookStatus(book.id);
  }
}
