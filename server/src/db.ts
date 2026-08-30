import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

/** 초대코드: 사람이 카톡으로 불러줄 수 있어야 하므로 헷갈리는 글자(0/O, 1/I)를 뺀다. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export async function generateInviteCode(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    let code = '';
    for (let i = 0; i < 6; i += 1) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }

    const taken = await prisma.family.findUnique({ where: { inviteCode: code } });
    if (!taken) return code;
  }

  throw new Error('초대코드를 만들지 못했습니다.');
}
