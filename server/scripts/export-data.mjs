/**
 * 지금 DB의 내용을 JSON 한 파일로 빼낸다.
 *
 *   node scripts/export-data.mjs [파일경로]     # 기본값 ./data-export.json
 *
 * SQLite -> Postgres 로 옮기면서 만든 것이지만, 엔진과 무관하게 돈다.
 * 관리형 백업이 붙기 전까지는 이게 유일한 안전망이라 남겨둔다.
 *
 * 짝: scripts/import-data.mjs
 */
import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const target = process.argv[2] ?? 'data-export.json';

// 부모가 먼저 와야 한다. 넣을 때 이 순서를 그대로 쓴다 (외래키)
const dump = {
  exportedAt: new Date().toISOString(),
  users: await prisma.user.findMany(),
  families: await prisma.family.findMany(),
  memberships: await prisma.membership.findMany(),
  fixedExpenses: await prisma.fixedExpense.findMany(),
  monthlyBooks: await prisma.monthlyBook.findMany(),
  memberEntries: await prisma.memberEntry.findMany(),
  entryLines: await prisma.entryLine.findMany(),
};

fs.writeFileSync(target, JSON.stringify(dump, null, 2), 'utf8');

for (const [name, rows] of Object.entries(dump)) {
  if (Array.isArray(rows)) console.log(`  ${name.padEnd(14)} ${rows.length}`);
}
console.log(`\n${target} 에 저장했습니다.`);

process.exit(0);
