/**
 * API 전체 흐름 스모크 테스트.
 *
 *   node scripts/smoke.mjs            # 서버가 localhost:4000 에 떠 있어야 한다
 *
 * 기획서 10장의 성공 기준을 그대로 따라간다:
 * 로그인 → 가족 → 고정비 → 스텝 입력(사유 강제 포함) → 전원 제출 → 요약 열림
 */
const BASE = process.env.BASE ?? 'http://localhost:4000';

let passed = 0;
let failed = 0;

function check(label, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`  ✅ ${label}`);
  } else {
    failed += 1;
    console.log(`  ❌ ${label}${detail ? ` — ${JSON.stringify(detail)}` : ''}`);
  }
}

async function call(method, path, { token, body } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }

  return { status: response.status, body: json };
}

const thisMonth = (() => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
})();

/** 한 사람이 위저드를 처음부터 끝까지 밟는다 */
async function runWizard(name, { changeFirstFixed }) {
  console.log(`\n[${name}]`);

  const login = await call('POST', '/auth/dev', { body: { name } });
  check('개발용 로그인', login.status === 200 && login.body.token, login.body);
  const token = login.body.token;

  const me = await call('GET', '/me', { token });
  check('내 가족이 있다', me.body.memberships.length === 1, me.body);
  const familyId = me.body.memberships[0].family.id;

  const start = await call('POST', `/families/${familyId}/books/${thisMonth}/my-entry`, { token });
  check('기록 시작', start.status === 200, start.body);
  const entry = start.body.entry;

  const income = entry.lines.find((l) => l.kind === 'INCOME');
  check('지난달 월급이 기본값으로 깔린다', income.plannedAmount > 0, income);

  const fixedLines = entry.lines.filter((l) => l.kind === 'FIXED');
  check('내 고정비가 스텝으로 펼쳐진다', fixedLines.length > 0, fixedLines.length);
  check(
    '고정비 기본값이 채워져 있다',
    fixedLines.every((l) => l.plannedAmount !== null),
    fixedLines,
  );

  // 1) 월급 — 지난달과 같게. 사유 없이 통과해야 한다.
  const sameIncome = await call('PATCH', `/entries/${entry.id}/lines/${income.id}`, {
    token,
    body: { actualAmount: income.plannedAmount },
  });
  check('같은 금액은 사유 없이 통과', sameIncome.status === 200, sameIncome.body);

  // 2) 고정비 첫 항목 — 금액을 바꾸고 사유를 뺀다. 막혀야 한다.
  const first = fixedLines[0];
  const changed = first.plannedAmount + 60_000;

  if (changeFirstFixed) {
    const noReason = await call('PATCH', `/entries/${entry.id}/lines/${first.id}`, {
      token,
      body: { actualAmount: changed },
    });
    check(
      '★ 금액이 달라지면 사유 없이는 막힌다',
      noReason.status === 400 && noReason.body.code === 'REASON_REQUIRED',
      noReason.body,
    );

    const withReason = await call('PATCH', `/entries/${entry.id}/lines/${first.id}`, {
      token,
      body: { actualAmount: changed, changeReason: '이번 달에 크게 나왔다' },
    });
    check('사유를 적으면 통과', withReason.status === 200, withReason.body);

    const revert = await call('PATCH', `/entries/${entry.id}/lines/${first.id}`, {
      token,
      body: { actualAmount: first.plannedAmount },
    });
    check(
      '금액을 되돌리면 사유도 지워진다',
      revert.status === 200 && revert.body.line.changeReason === null,
      revert.body,
    );

    await call('PATCH', `/entries/${entry.id}/lines/${first.id}`, {
      token,
      body: { actualAmount: changed, changeReason: '이번 달에 크게 나왔다' },
    });
  }

  // 3) 나머지 고정비 — 그대로 확정
  for (const line of fixedLines) {
    if (changeFirstFixed && line.id === first.id) continue;
    await call('PATCH', `/entries/${entry.id}/lines/${line.id}`, {
      token,
      body: { actualAmount: line.plannedAmount },
    });
  }

  // 4) 추가 지출 — 이름부터
  const extra = await call('POST', `/entries/${entry.id}/lines`, {
    token,
    body: { name: '경조사비', category: '기타', actualAmount: 100_000 },
  });
  check('추가 지출은 이름부터 적는다', extra.status === 200, extra.body);

  const badExtra = await call('POST', `/entries/${entry.id}/lines`, {
    token,
    body: { name: '', category: '기타', actualAmount: 1000 },
  });
  check('이름 없는 추가 지출은 막힌다', badExtra.status === 400, badExtra.body);

  // 5) 특이사항
  const note = await call('PATCH', `/entries/${entry.id}`, {
    token,
    body: { note: `${name}의 이번 달 메모`, cursor: 99 },
  });
  check('특이사항 저장', note.status === 200, note.body);

  // 6) 제출
  const submit = await call('POST', `/entries/${entry.id}/submit`, { token });
  check('제출', submit.status === 200, submit.body);

  return { token, familyId, entryId: entry.id, bookStatus: submit.body.bookStatus };
}

/**
 * 이 스크립트는 몇 번이고 다시 돌 수 있어야 한다.
 * 앞선 실행이 남긴 제출 기록이 있으면 이번 달을 다시 열어 초기 상태로 되돌린다.
 * (안 그러면 두 번째 실행부터 "한 명만 제출하면 진행 중" 같은 전제가 무너진다)
 */
async function resetMonth(names) {
  for (const name of names) {
    const login = await call('POST', '/auth/dev', { body: { name } });
    if (login.status !== 200) continue;

    const token = login.body.token;
    const me = await call('GET', '/me', { token });
    const familyId = me.body.memberships?.[0]?.family.id;
    if (!familyId) continue;

    const start = await call('POST', `/families/${familyId}/books/${thisMonth}/my-entry`, { token });
    if (start.body?.entry?.status === 'SUBMITTED') {
      await call('POST', `/entries/${start.body.entry.id}/reopen`, { token });
    }
  }
}

async function main() {
  console.log(`달살림 API 스모크 테스트 · ${BASE} · ${thisMonth}`);

  const health = await call('GET', '/health');
  check('서버 살아 있음', health.status === 200, health.body);

  await resetMonth(['아빠', '엄마']);

  const dad = await runWizard('아빠', { changeFirstFixed: true });
  check('한 명만 제출하면 장부는 아직 진행 중', dad.bookStatus === 'OPEN', dad.bookStatus);

  const dadEntry = await call('GET', `/entries/${dad.entryId}`, { token: dad.token });
  const dadIncome = dadEntry.body.entry.summary.income;

  // 전원이 안 적었어도 요약은 열린다. 한 명이 앱을 안 쓰기 시작하면 그 달부터
  // 아무도 아무것도 못 보게 되는 게 예전 구조였다. (기획서 3장)
  const partial = await call('GET', `/families/${dad.familyId}/books/${thisMonth}/summary`, {
    token: dad.token,
  });
  check('★ 전원 제출 전에도 요약이 열린다', partial.status === 200, partial.body);
  check(
    '미제출자를 progress 로 알려준다',
    partial.body.progress?.submittedCount === 1 &&
      partial.body.progress?.memberCount === 2 &&
      partial.body.progress?.pendingMembers?.length === 1,
    partial.body.progress,
  );
  check(
    '★ 부분 제출 합계는 제출한 사람 것만 센다',
    partial.body.totals.income === dadIncome,
    { got: partial.body.totals.income, expected: dadIncome },
  );
  check(
    '미제출자는 0원으로 서 있고 submitted=false 다',
    partial.body.perMember?.length === 2 &&
      partial.body.perMember.filter((m) => m.submitted === false).length === 1,
    partial.body.perMember,
  );

  const mom = await runWizard('엄마', { changeFirstFixed: false });
  check('★ 전원 제출 → 장부 완성', mom.bookStatus === 'COMPLETE', mom.bookStatus);

  console.log('\n[요약]');
  const summary = await call('GET', `/families/${dad.familyId}/books/${thisMonth}/summary`, {
    token: dad.token,
  });
  check('요약이 열린다', summary.status === 200, summary.body);

  const s = summary.body;
  check('사람별 집계 2명', s.perMember?.length === 2, s.perMember);
  check('전원 제출이면 pendingMembers 가 비어 있다', s.progress?.pendingMembers?.length === 0, s.progress);
  check(
    '합계가 맞는다',
    s.totals.surplus === s.totals.income - s.totals.fixedTotal - s.totals.extraTotal,
    s.totals,
  );
  check('달라진 것에 사유가 붙어 있다', s.changes?.some((c) => c.reason), s.changes);
  check('특이사항이 모인다', s.notes?.length === 2, s.notes);
  console.log(
    `     수입 ${s.totals.income.toLocaleString()} / 고정비 ${s.totals.fixedTotal.toLocaleString()} / ` +
      `추가 ${s.totals.extraTotal.toLocaleString()} → 남은 돈 ${s.totals.surplus.toLocaleString()}`,
  );

  console.log('\n[제출 후 수정]');
  const locked = await call('PATCH', `/entries/${dad.entryId}`, {
    token: dad.token,
    body: { note: '몰래 고치기' },
  });
  check('제출한 기록은 바로 못 고친다', locked.status === 403, locked.body);

  const reopen = await call('POST', `/entries/${dad.entryId}/reopen`, { token: dad.token });
  check(
    '★ 다시 열면 장부도 진행 중으로 내려간다',
    reopen.status === 200 && reopen.body.bookStatus === 'OPEN',
    reopen.body,
  );

  await call('POST', `/entries/${dad.entryId}/submit`, { token: dad.token });

  console.log('\n[권한]');
  const stranger = await call('POST', '/auth/dev', { body: { name: '남남' } });
  const peek = await call('GET', `/families/${dad.familyId}/books/${thisMonth}`, {
    token: stranger.body.token,
  });
  check('남의 가족은 못 본다', peek.status === 403, peek.body);

  const peekEntry = await call('GET', `/entries/${dad.entryId}`, { token: stranger.body.token });
  check('남의 기록은 못 본다', peekEntry.status === 403, peekEntry.body);

  console.log('\n[추이]');
  const trend = await call('GET', `/families/${dad.familyId}/trend?months=12`, {
    token: dad.token,
  });
  check('추이가 열린다', trend.status === 200, trend.body);
  check(
    '★ 지난달과 이번 달 두 점이 찍힌다',
    trend.body.months?.length >= 2,
    trend.body.months?.map((m) => m.yearMonth),
  );
  check(
    '추이 합계도 제출된 기록만 센다',
    trend.body.months?.every(
      (m) => m.surplus === m.income - m.fixedTotal - m.extraTotal && m.submittedCount > 0,
    ),
    trend.body.months,
  );
  check(
    '오래된 달이 앞에 온다',
    trend.body.months?.[0]?.yearMonth < trend.body.months?.at(-1)?.yearMonth,
    trend.body.months?.map((m) => m.yearMonth),
  );

  console.log('\n[멤버 관리]');
  // 안 쓰는 멤버 한 명이 장부를 영원히 막던 문제. 뺄 수 있어야 한다.
  const family = await call('GET', `/families/${dad.familyId}`, { token: dad.token });
  const momMembership = family.body.members.find((m) => m.displayName === '엄마');
  const dadMembership = family.body.members.find((m) => m.isMe);

  const ownerLeave = await call('DELETE', `/families/${dad.familyId}/members/${dadMembership.id}`, {
    token: dad.token,
  });
  check(
    '가족장은 넘기기 전에 못 나간다',
    ownerLeave.status === 400 && ownerLeave.body.code === 'TRANSFER_OWNER_FIRST',
    ownerLeave.body,
  );

  const kickByMember = await call(
    'DELETE',
    `/families/${dad.familyId}/members/${dadMembership.id}`,
    { token: mom.token },
  );
  check('일반 멤버는 남을 못 내보낸다', kickByMember.status === 403, kickByMember.body);

  const kick = await call('DELETE', `/families/${dad.familyId}/members/${momMembership.id}`, {
    token: dad.token,
  });
  check('★ 가족장이 멤버를 내보낸다', kick.status === 200, kick.body);

  const kickedPeek = await call('GET', `/families/${dad.familyId}`, { token: mom.token });
  check('나간 사람은 가족을 못 본다', kickedPeek.status === 403, kickedPeek.body);

  const afterKick = await call('GET', `/families/${dad.familyId}/books/${thisMonth}`, {
    token: dad.token,
  });
  check(
    '★ 남은 사람만으로 장부가 완성된다',
    afterKick.body.book.status === 'COMPLETE' && afterKick.body.members.length === 1,
    { status: afterKick.body.book.status, members: afterKick.body.members.length },
  );

  const afterKickSummary = await call(
    'GET',
    `/families/${dad.familyId}/books/${thisMonth}/summary`,
    { token: dad.token },
  );
  check(
    '나간 사람은 요약에서도 빠진다',
    afterKickSummary.body.perMember.length === 1,
    afterKickSummary.body.perMember,
  );

  // 되돌린다 — 이 스크립트는 몇 번이고 다시 돌 수 있어야 한다
  const rejoin = await call('POST', '/families/join', {
    token: mom.token,
    body: { inviteCode: family.body.family.inviteCode, displayName: '엄마' },
  });
  check('★ 나갔던 사람이 초대코드로 돌아온다', rejoin.status === 200, rejoin.body);

  const momEntryAgain = await call('GET', `/entries/${mom.entryId}`, { token: mom.token });
  check(
    '돌아오면 지난 기록이 그대로 남아 있다',
    momEntryAgain.status === 200 && momEntryAgain.body.entry.status === 'SUBMITTED',
    momEntryAgain.body,
  );

  console.log(`\n${failed === 0 ? '✅ 전부 통과' : '❌ 실패 있음'} — ${passed}개 통과, ${failed}개 실패`);
  process.exitCode = failed === 0 ? 0 : 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
