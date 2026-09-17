// 기능: F-SES-07
import { prisma } from '../lib/db.js';

/**
 * 앱 닉네임 바꾸기.
 *
 * 닉네임은 처음 가입할 때 로그인 플랫폼(카카오)에서 한 번 받아 오고, 그 뒤로는 앱의 것이다.
 * 로그인할 때 다시 덮지 않으므로 여기서 바꾼 값이 남는다 (routes/auth.ts 카카오 콜백 주석 참조).
 * 가족 안에서 불리는 이름(표시 이름)과는 별개다 — 이 값은 가족을 만들거나 참여할 때 그 칸의 처음 값이 될 뿐이다.
 */
export function renameUser(userId: string, nickname: string) {
  return prisma.user.update({ where: { id: userId }, data: { nickname } });
}
