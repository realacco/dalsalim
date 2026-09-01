import type { Role } from '@/shared/model/types';

export type Family = { id: string; name: string; inviteCode: string };

export type FamilyDetail = {
  family: Family;
  myMembershipId: string;
  members: {
    id: string;
    displayName: string;
    role: Role;
    nickname: string;
    profileImageUrl: string | null;
    isMe: boolean;
  }[];
};

/**
 * 초대코드를 넣었다고 바로 구성원이 되지 않는다. 가족장이 승인해야 들어간다.
 * 코드는 카톡으로 오가다 새어나갈 수 있는데, 그것 하나로 남의 가계부가 열리면 안 된다.
 */
export type JoinResult = {
  status: 'PENDING';
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
  nickname: string;
  profileImageUrl: string | null;
  requestedAt: string | null;
};
