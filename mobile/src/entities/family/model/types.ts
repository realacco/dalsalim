import type { Role, Settlement } from '@/shared/model/types';

export type Family = { id: string; name: string; inviteCode: string };

/** 가족을 없앨 때 무엇이 사라지는지 (F-FAM-11). 확인 다이얼로그가 세어 보여준다 */
export type FamilyContents = { months: number; fixedExpenses: number };

export type FamilyDetail = {
  family: Family;
  contents: FamilyContents;
  myMembershipId: string;
  members: {
    id: string;
    displayName: string;
    role: Role;
    isMe: boolean;
    /** 남의 정산일도 보인다 — 언제쯤 적을지 서로 안다 (F-FAM-10) */
    settlement: Settlement | null;
  }[];
};

/**
 * 초대코드를 넣었다고 바로 구성원이 되지 않는다. 가족장이 승인해야 들어간다.
 * 코드는 카톡으로 오가다 새어나갈 수 있는데, 그것 하나로 남의 가계부가 열리면 안 된다.
 * 그래서 참여 요청의 결과는 "대기 중인 멤버십"이다.
 */
export type PendingMembership = {
  id: string;
  status: 'PENDING';
  displayName: string;
  /** 아직 구성원이 아니라 이름만 알려준다. 초대코드는 오지 않는다. */
  family: { id: string; name: string };
};

/** 내가 승인을 기다리고 있는 가족 */
export type MyPendingRequest = {
  membershipId: string;
  displayName: string;
  requestedAt: string | null;
  family: { id: string; name: string };
};

/** 가족장에게 들어온 참여 요청 */
export type JoinRequest = {
  id: string;
  displayName: string;
  requestedAt: string | null;
};
