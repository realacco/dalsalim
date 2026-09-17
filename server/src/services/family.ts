// 기능: F-FAM-01 F-FAM-02 F-FAM-03 F-FAM-04 F-FAM-05 F-FAM-06 F-FAM-07 F-FAM-08 F-FAM-09 F-FAM-10 F-FAM-11
import type { Membership } from '@prisma/client';

import { prisma } from '../lib/db.js';
import { fail } from '../lib/http.js';
import { type Settlement, carriedNotifiedFor, localParts } from '../lib/schedule.js';
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

  // 승인해줄 가족장이 없는 가족 — 들어가봐야 영원히 대기다.
  // F-FAM-11 이전에 혼자 남은 가족장이 나가서 생긴 가족이 여기 걸린다 (지금은 그 길도 막혀 있다).
  //
  // "ACTIVE 가 하나라도 있나"가 아니라 가족장을 찾는 이유: 지금은 둘이 같지만
  // (가족장은 넘기지 않고는 못 나간다) F-SES-08 탈퇴가 User 를 지우면 Membership 이
  // Cascade 로 따라가, 구성원은 남고 가족장만 없는 가족이 생길 수 있다.
  // 막으려는 것은 "사람이 없다"가 아니라 "승인할 사람이 없다"이므로 그쪽을 본다.
  //
  // 내 상태(ALREADY_*)를 먼저 보는 이유: 그 가족에 이미 들어와 있는 사람에게는
  // 가족장이 있고 없고가 답이 아니다. 나에 대한 답을 먼저 주고, 가족 얘기는 그다음이다.
  if (!family.memberships.some((m) => m.status === ACTIVE_MEMBER.status && m.role === 'OWNER')) {
    throw fail('FAMILY_ABANDONED');
  }

  let membership: Membership;
  if (existing) {
    // 나갔던 사람이 돌아왔다. (familyId, userId) 가 unique 라 새로 만들 수 없고,
    // 지난 기록이 이 멤버십에 매달려 있으므로 되살리는 게 맞다.
    // 나갔던 사람도 다시 승인을 받는다 — 내보낸 사람이 코드만으로 돌아오면 안 되니까.
    membership = await prisma.membership.update({
      where: { id: existing.id },
      // leftAt 은 그대로 둔다 — 승인되면 approveJoinRequest 가 지우고,
      // 거절·취소되면 discardJoinRequest 가 이 행을 LEFT 로 되돌리므로 그때 그대로 맞다
      data: { status: 'PENDING', requestedAt: new Date(), displayName },
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

  await discardJoinRequest(mine.id);
}

/**
 * 참여 요청을 없던 일로 만든다 — 취소(F-FAM-04)와 거절(F-FAM-05)이 같이 쓴다.
 *
 * ★ 「승인 전이니 매달린 기록이 없다」가 **항상 참이 아니다.**
 *   `@@unique([familyId, userId])` 라 재참여가 행을 새로 만들지 못하고 requestJoin 이
 *   있던 행을 되살리므로, **지난 제출본이 달린 PENDING** 이 존재한다. 그 행을 지우면
 *   `MemberEntry` · `EntryLine` 이 Cascade 로 따라가 그 달 가족 합계가 바뀐다
 *   (하드룰 6 · F-BOOK-02). 거절은 가족장이 누르는 버튼이라, 그대로 두면 내보내기로는
 *   절대 못 하는 일을 거절로는 할 수 있게 된다.
 *
 * 두 갈래를 여기 한 곳에만 둔다 — 같은 판단이 취소·거절에 복사돼 있었고 둘 다 틀렸다.
 * 정원은 어느 갈래에서도 안 바뀐다(refreshBookStatus 는 ACTIVE 만 센다)므로 다시 안 센다.
 */
async function discardJoinRequest(membershipId: string) {
  /*
    「이 멤버십에 딸린 게 하나라도 있나」를 본다. 행을 지우면 Cascade 가 **아래를 다** 쓸어가므로
    기록만 세면 안 된다 — 고정비 항목도 `Membership` 에 딸려 있어서 같이 사라진다.

    `SUBMITTED` 가 아니라 **행 존재**로 보는 것은 의도다. `MemberEntry` 는 위저드를 열기만
    해도 생기므로(countFamilyContents 주석 참조) 열어만 본 사람도 여기서는 안 지워진다.
    하드룰 6 근거 ① 이 허용하는 것보다 한 뼘 좁지만 **덜 지우는 쪽**이라 안전하고, `DRAFT` 까지
    가르려면 「이번 달인가」(F-ENT-10)를 여기서 또 판정해야 해서 판단이 둘로 늘어난다.
  */
  const hasContents = await prisma.membership.count({
    where: {
      id: membershipId,
      OR: [{ entries: { some: {} } }, { fixedExpenses: { some: {} } }],
    },
  });

  // 딸린 게 없으면 집계에 한 줄도 안 들어간 행이다 — 지워도 바뀌는 게 없다 (근거 ①)
  if (hasContents === 0) return prisma.membership.delete({ where: { id: membershipId } });

  // 돌아오려다 만 사람이다. 요청하기 직전 자리인 LEFT 로 되돌린다
  return prisma.membership.update({ where: { id: membershipId }, data: { status: 'LEFT' } });
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

  await discardJoinRequest(target.id);
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

/**
 * 가족을 없앨 때 무엇이 사라지는지 세어 둔다 (F-FAM-11).
 * 확인 다이얼로그가 "기록한 달 7개월 · 고정비 9개"로 읽는다 — "정말 삭제하시겠습니까"보다
 * 숫자를 보여주는 쪽이 한 번 더 생각하게 만든다.
 */
export async function countFamilyContents(familyId: string) {
  const [months, fixedExpenses] = await Promise.all([
    // 한 줄이라도 금액을 적은 달만 센다. MonthlyBook 은 그 달을 열어보기만 해도 생기고
    // (getOrCreateBook), MemberEntry 는 위저드를 열기만 해도 프리필과 함께 생기므로
    // (openMyEntry) 둘 중 어느 것을 세도 "기록한 달"이 아니라 "열어본 달"이 나온다.
    // 확인창이 숫자를 보여주는 이유는 한 번 더 생각하게 하려는 것이지 부풀리려는 게 아니다.
    //
    // 구성원 상태는 보지 않는다 — 나간 사람이 적은 달도 요약·추이에 그대로 나오므로
    // (하드룰 8 의 예외) 화면에 보이는 숫자가 맞다
    prisma.monthlyBook.count({
      where: { familyId, entries: { some: { lines: { some: { actualAmount: { not: null } } } } } },
    }),
    // 고정비는 반대다. 목록이 ACTIVE 구성원의 active 항목만 보여주므로(listFixedExpensesByMember)
    // 같은 조건으로 센다 — 확인할 길이 없는 숫자는 "한 번 더 생각하게" 하지 못한다
    prisma.fixedExpense.count({ where: { familyId, active: true, membership: ACTIVE_MEMBER } }),
  ]);

  return { months, fixedExpenses };
}

/**
 * 가족 없애기 (F-FAM-11) — 구성원이 나 하나뿐인 가족장만. 권한은 라우트의 requireOwner 가 본다.
 *
 * ★ 여기서는 **실제로 지운다** (하드룰 6 의 세 번째 예외).
 *
 * 앞의 두 예외(PENDING 취소 · DRAFT 삭제)는 「집계에 한 줄도 안 들어간 것」이 근거였다.
 * 여기는 들어간 줄이 있는데도 지운다. 근거가 다르다 —
 * **그 집계를 보는 사람이 지우려는 본인뿐이기 때문이다.** 하드룰 6 이 지키려는 것은
 * "내 행동으로 남의 숫자가 바뀌지 않는다"인데, 구성원이 나 하나면 바뀔 남의 숫자가 없다.
 * 나갔던 사람(LEFT)에게도 이 가족은 이미 안 보인다 — /me 가 ACTIVE 만 보기 때문이다.
 * 초대코드로 되돌아올 수는 있지만 그건 내가 다시 승인해야 열리는 길이고(하드룰 8),
 * 없애기는 그 승인을 할 사람 본인의 결정이다.
 *
 * soft delete 를 안 쓰는 이유는 탈퇴 때문이다. 행을 남기면 "가족을 없앴는데 내 가계부가
 * 서버에 남아 있다"가 되고, 그러면 탈퇴도 반쪽이 된다.
 * Family 를 지우면 MonthlyBook · MemberEntry · EntryLine · FixedExpense · Membership 이
 * 스키마의 onDelete: Cascade 로 따라 사라진다.
 */
export async function deleteFamily(familyId: string, myMembershipId: string) {
  // 세고 나서 지우면 그 사이에 승인이 하나 끼어들 수 있다 (가족장이 두 기기를 쓸 때).
  // 이 가드는 위의 예외를 떠받치는 유일한 장치라 뚫리면 남의 과거 기록이 Cascade 로 사라지므로,
  // "나 말고 ACTIVE 가 없을 때만 지운다"를 한 문장에 넣어 틈을 실질적으로 없앴다.
  //
  // ⚠️ 완전히 닫힌 것은 아니다. READ COMMITTED 에서 이 where 의 서브질의는 문장 시작 시점
  // 스냅샷을 보므로, 그 뒤에 커밋된 승인은 못 본다. 남는 경로는 하나 —
  // 가족장이 한 기기에서 나갔던 사람(과거 제출본이 있다)의 재참여를 승인하는 바로 그 순간
  // 다른 기기에서 없애면, 갓 ACTIVE 가 된 그 사람의 기록까지 지워진다.
  // 닫으려면 승인 쪽에서도 Family 행을 잠가 두 경로를 같은 자물쇠에 묶어야 하는데,
  // 본인이 두 기기로 동시에 조작해야 하는 폭이라 승인 경로에 값을 치를 이유가 없다.
  const { count } = await prisma.family.deleteMany({
    where: {
      id: familyId,
      memberships: { none: { ...ACTIVE_MEMBER, id: { not: myMembershipId } } },
    },
  });

  // 가족이 있는 것은 requireOwner 가 이미 봤다. 안 지워졌으면 남은 사람이 있다는 뜻이다.
  // 다른 기기에서 방금 없앤 경우도 여기로 오는데, 그때는 이 문구가 사실과 어긋난다
  // ("아직 구성원이 남아 있어요"). 도달 폭이 거의 없고 다음 조회가 NOT_MEMBER 로 정리한다
  if (count === 0) throw fail('MEMBERS_REMAIN');
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
 * 정산일 저장 (F-FAM-10). null 이면 안 받기.
 * "이번 달에 보냈다" 표시를 어떻게 이어갈지는 lib/schedule 의 carriedNotifiedFor 가 정한다 —
 * 판정 규칙은 그 파일 한 곳에만 둔다.
 */
export function updateMemberSettlement(
  mine: Pick<Membership, 'id' | 'settlementNotifiedFor'>,
  settlement: Settlement | null,
) {
  const fields = {
    settlementDay: settlement?.day ?? null,
    settlementHour: settlement?.hour ?? null,
    settlementMinute: settlement?.minute ?? null,
  };
  return prisma.membership.update({
    where: { id: mine.id },
    data: {
      ...fields,
      settlementNotifiedFor: carriedNotifiedFor(
        mine.settlementNotifiedFor,
        fields,
        localParts(new Date()),
      ),
    },
  });
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

  // 가족장은 그냥 못 나간다. 주인 없는 가족이 남기 때문인데, 남은 사람이 있고 없고에 따라
  // 다음 할 일이 다르다 — 있으면 넘기고, 없으면 나가는 게 아니라 없애는 것이다 (F-FAM-11).
  // 혼자인 가족장을 막지 않으면 초대코드만 살아 있는 가족이 남아, 그 코드로 들어온 사람이
  // 승인해줄 가족장 없이 영원히 대기한다.
  if (target.role === 'OWNER') {
    throw fail(activeCount > 1 ? 'TRANSFER_OWNER_FIRST' : 'LAST_OWNER_MUST_DELETE');
  }

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
 *
 * 정산일(F-FAM-10)은 지우지 않는다. 재참여는 이 행이 PENDING 으로 돌아오는 것이라 승인되면 예전 정산일이
 * 그대로 살아난다 — 잘못 내보냈다 되돌린 사람이 알림을 다시 켜야 한다면 그게 더 이상하다.
 * LEFT 인 동안 안 가는 건 스케줄러의 ACTIVE_MEMBER 필터가 맡는다.
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
