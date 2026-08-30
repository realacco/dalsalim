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
