import { prisma } from '../lib/db.js';

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
