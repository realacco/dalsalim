/**
 * export-data.mjs 가 만든 JSON 을 빈 DB 에 넣는다.
 *
 *   node scripts/import-data.mjs [파일경로]     # 기본값 ./data-export.json
 *
 * 이미 있는 행은 건너뛴다(skipDuplicates). 몇 번을 다시 돌려도 같은 결과다.
 * 부모부터 넣는다 — 외래키 때문에 순서를 바꾸면 깨진다.
 */
import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const source = process.argv[2] ?? 'data-export.json';

if (!fs.existsSync(source)) {
  console.error(`${source} 가 없습니다. 먼저 scripts/export-data.mjs 를 돌리세요.`);
  process.exit(1);
}

const dump = JSON.parse(fs.readFileSync(source, 'utf8'));

/** DateTime 컬럼은 JSON 에서 문자열로 돌아온다. Prisma 는 Date 를 원한다. */
function revive(rows) {
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) =>
        typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(value)
          ? [key, new Date(value)]
          : [key, value],
      ),
    ),
  );
}

const order = [
  ['users', prisma.user],
  ['families', prisma.family],
  ['memberships', prisma.membership],
  ['fixedExpenses', prisma.fixedExpense],
  ['monthlyBooks', prisma.monthlyBook],
  ['memberEntries', prisma.memberEntry],
  ['entryLines', prisma.entryLine],
];

for (const [name, model] of order) {
  const rows = dump[name] ?? [];
  if (rows.length === 0) {
    console.log(`  ${name.padEnd(14)} 0`);
    continue;
  }

  const { count } = await model.createMany({ data: revive(rows), skipDuplicates: true });
  console.log(`  ${name.padEnd(14)} ${count} / ${rows.length}`);
}

console.log(`\n${source} 를 넣었습니다.`);
process.exit(0);
