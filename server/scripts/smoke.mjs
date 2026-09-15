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

const lastMonth = (() => {
  const [y, m] = thisMonth.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
})();

/**
 * 스모크는 자기 가족을 직접 만들어 쓴다.
 *
 * 예전엔 시드 데이터(김씨네)에 얹혀 있었는데, 실기기로 앱을 써 보다 가족에 사람이 한 명 늘자
 * "남은 사람만으로 장부가 완성된다" 같은 전제가 통째로 깨졌다. 테스트가 사람이 만지는
 * 데이터에 기대면 안 된다. 이 가족은 스모크만 쓰고, 없으면 만들고, 있으면 그대로 재사용한다.
 */
const FAMILY_NAME = '스모크네';
const OWNER = '스모크아빠';
const MEMBER = '스모크엄마';

async function login(name) {
  const response = await call('POST', '/auth/dev', { body: { name } });
  if (response.status !== 200)
    throw new Error(`로그인 실패: ${name} ${JSON.stringify(response.body)}`);
  return response.body.token;
}

/** 그 사람이 스모크 가족에 속해 있으면 familyId, 아니면 null */
async function findFamily(token) {
  const me = await call('GET', '/me', { token });
  return me.body.memberships?.find((m) => m.family.name === FAMILY_NAME)?.family.id ?? null;
}

/** 들어온 요청 중 그 이름의 것을 승인한다 */
async function approve(ownerToken, familyId, displayName) {
  const requests = await call('GET', `/families/${familyId}/join-requests`, { token: ownerToken });
  const target = requests.body.requests?.find((r) => r.displayName === displayName);
  if (!target) return false;

  const result = await call('POST', `/families/${familyId}/join-requests/${target.id}/approve`, {
    token: ownerToken,
  });
  return result.status === 200;
}

/** 아직 안 적은 줄을 기본값으로 채우고 제출한다 (지난달 기록을 만들 때 쓴다) */
async function fillAndSubmit(token, entry, incomeAmount) {
  for (const line of entry.lines) {
    if (line.actualAmount !== null) continue;
    // plannedAmount 가 null 인 건 비교 대상이 없다는 뜻이라 사유가 필요 없다
    const value =
      line.kind === 'INCOME' ? (line.plannedAmount ?? incomeAmount) : (line.plannedAmount ?? 0);
    await call('PATCH', `/entries/${entry.id}/lines/${line.id}`, {
      token,
      body: { actualAmount: value },
    });
  }

  await call('POST', `/entries/${entry.id}/submit`, { token });
}

/**
 * 스모크 가족을 있어야 할 모양으로 맞춰 둔다 — 가족 · 두 사람 · 사람별 고정비 · 지난달 기록.
 * 처음 한 번만 실제로 만들고, 그 뒤로는 전부 건너뛴다.
 */
async function bootstrap() {
  const ownerToken = await login(OWNER);
  let familyId = await findFamily(ownerToken);

  if (!familyId) {
    const created = await call('POST', '/families', {
      token: ownerToken,
      body: { name: FAMILY_NAME, displayName: OWNER },
    });
    familyId = created.body.family.id;
  }

  const family = await call('GET', `/families/${familyId}`, { token: ownerToken });
  const inviteCode = family.body.family.inviteCode;

  const memberToken = await login(MEMBER);
  if (!family.body.members.some((m) => m.displayName === MEMBER)) {
    await call('POST', '/families/join', {
      token: memberToken,
      body: { inviteCode, displayName: MEMBER },
    });
    await approve(ownerToken, familyId, MEMBER);
  }

  // 사람별 고정비 — 위저드가 펼칠 스텝이 된다
  const fixed = await call('GET', `/families/${familyId}/fixed-expenses`, { token: ownerToken });
  const preset = [
    { name: '월세', category: '주거', defaultAmount: 600_000 },
    { name: '통신비', category: '통신', defaultAmount: 55_000 },
  ];

  for (const group of fixed.body.groups) {
    if (group.items.length > 0) continue;
    for (const item of preset) {
      await call('POST', `/families/${familyId}/fixed-expenses`, {
        token: ownerToken,
        body: { membershipId: group.membershipId, ...item },
      });
    }
  }

  // 지난달 기록 — "지난달 월급이 기본값으로 깔린다"와 추이 검사가 이걸 본다
  for (const [token, incomeAmount] of [
    [ownerToken, 3_000_000],
    [memberToken, 2_000_000],
  ]) {
    const start = await call('POST', `/families/${familyId}/books/${lastMonth}/my-entry`, {
      token,
    });
    if (start.body.entry.status !== 'SUBMITTED') {
      await fillAndSubmit(token, start.body.entry, incomeAmount);
    }
  }

  return { familyId, inviteCode, ownerToken };
}

/** 한 사람이 위저드를 처음부터 끝까지 밟는다 */
async function runWizard(name, { changeFirstFixed }) {
  console.log(`\n[${name}]`);

  const login = await call('POST', '/auth/dev', { body: { name } });
  check('F-SES-02 개발용 로그인', login.status === 200 && login.body.token, login.body);
  const token = login.body.token;

  const me = await call('GET', '/me', { token });
  const membership = me.body.memberships?.find((m) => m.family.name === FAMILY_NAME);
  check('F-SES-03 내 가족이 있다', Boolean(membership), me.body);
  check(
    'F-FAM-01 가족은 이름과 6자리 초대코드를 갖고 만들어진다',
    membership?.family?.name === FAMILY_NAME &&
      /^[A-Z0-9]{6}$/.test(membership?.family?.inviteCode ?? ''),
    membership?.family,
  );
  const familyId = membership.family.id;

  const start = await call('POST', `/families/${familyId}/books/${thisMonth}/my-entry`, { token });
  check('F-ENT-01 기록 시작', start.status === 200, start.body);
  const entry = start.body.entry;

  const income = entry.lines.find((l) => l.kind === 'INCOME');
  check(
    '★ F-ENT-01 · F-ENT-03 지난달에 적은 금액이 이번 달 기본값으로 깔린다',
    income.plannedAmount > 0,
    income,
  );

  const fixedLines = entry.lines.filter((l) => l.kind === 'FIXED');
  check('F-ENT-04 내 고정비가 스텝으로 펼쳐진다', fixedLines.length > 0, fixedLines.length);
  check(
    'F-ENT-01 고정비 기본값이 채워져 있다',
    fixedLines.every((l) => l.plannedAmount !== null),
    fixedLines,
  );

  // 1) 월급 — 지난달과 같게. 사유 없이 통과해야 한다.
  const sameIncome = await call('PATCH', `/entries/${entry.id}/lines/${income.id}`, {
    token,
    body: { actualAmount: income.plannedAmount },
  });
  check('★ F-ENT-04 같은 금액은 아무것도 묻지 않는다', sameIncome.status === 200, sameIncome.body);

  // 2) 고정비 첫 항목 — 금액을 바꾸고 사유를 뺀다. 막혀야 한다.
  const first = fixedLines[0];
  const changed = first.plannedAmount + 60_000;

  if (changeFirstFixed) {
    const noReason = await call('PATCH', `/entries/${entry.id}/lines/${first.id}`, {
      token,
      body: { actualAmount: changed },
    });
    check(
      '★ F-ENT-04 금액이 달라지면 사유 없이는 막힌다',
      noReason.status === 400 && noReason.body.code === 'REASON_REQUIRED',
      noReason.body,
    );

    const withReason = await call('PATCH', `/entries/${entry.id}/lines/${first.id}`, {
      token,
      body: { actualAmount: changed, changeReason: '이번 달에 크게 나왔다' },
    });
    check('F-ENT-04 사유를 적으면 통과', withReason.status === 200, withReason.body);

    const revert = await call('PATCH', `/entries/${entry.id}/lines/${first.id}`, {
      token,
      body: { actualAmount: first.plannedAmount },
    });
    check(
      '★ F-ENT-04 금액을 되돌리면 사유도 같이 지워진다',
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
  check('F-ENT-05 추가 지출은 이름부터 적는다', extra.status === 200, extra.body);

  const badExtra = await call('POST', `/entries/${entry.id}/lines`, {
    token,
    body: { name: '', category: '기타', actualAmount: 1000 },
  });
  check('F-ENT-05 이름 없는 추가 지출은 막힌다', badExtra.status === 400, badExtra.body);

  // '생활' 을 '생활비' 로 고쳤다. 서버가 옛 이름을 계속 받아주면 앱과 갈라진다.
  const livingExtra = await call('POST', `/entries/${entry.id}/lines`, {
    token,
    body: { name: '장보기', category: '생활비', actualAmount: 30_000 },
  });
  check('★ F-FIX-06 생활비 분류로 적을 수 있다', livingExtra.status === 200, livingExtra.body);

  const oldLiving = await call('POST', `/entries/${entry.id}/lines`, {
    token,
    body: { name: '장보기', category: '생활', actualAmount: 30_000 },
  });
  check('★ F-FIX-06 옛 이름 생활 은 더 이상 받지 않는다', oldLiving.status === 400, oldLiving.body);

  await call('DELETE', `/entries/${entry.id}/lines/${livingExtra.body.line.id}`, { token });

  // 저축·투자 — 월급에서 빠지지만 소비가 아닌 돈에 이름표를 붙인다. 목록을 늘린 것뿐이라 남은 돈 식은 그대로다
  const savingExtra = await call('POST', `/entries/${entry.id}/lines`, {
    token,
    body: { name: '청약 추가 납입', category: '저축', actualAmount: 100_000 },
  });
  check('★ F-FIX-08 저축 분류로 적을 수 있다', savingExtra.status === 200, savingExtra.body);
  await call('DELETE', `/entries/${entry.id}/lines/${savingExtra.body.line?.id}`, { token });

  // 5) 특이사항
  const note = await call('PATCH', `/entries/${entry.id}`, {
    token,
    body: { note: `${name}의 이번 달 메모`, cursor: 99 },
  });
  check('F-ENT-06 특이사항 저장', note.status === 200, note.body);

  // 6) 제출
  const submit = await call('POST', `/entries/${entry.id}/submit`, { token });
  check('F-ENT-07 제출', submit.status === 200, submit.body);

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
    const familyId = await findFamily(token);
    if (!familyId) continue;

    const start = await call('POST', `/families/${familyId}/books/${thisMonth}/my-entry`, {
      token,
    });
    if (start.body?.entry?.status === 'SUBMITTED') {
      await call('POST', `/entries/${start.body.entry.id}/reopen`, { token });
    }
  }
}

/**
 * '이웃' 같은 임시 참여자를 가족에서 완전히 걷어낸다.
 * 승인 구조가 생기면서 앞선 실행이 ACTIVE 나 PENDING 을 남길 수 있어졌다.
 */
async function clearOutsider(ownerToken, familyId, displayName) {
  const family = await call('GET', `/families/${familyId}`, { token: ownerToken });
  const member = family.body.members?.find((m) => m.displayName === displayName);
  if (member) {
    await call('DELETE', `/families/${familyId}/members/${member.id}`, { token: ownerToken });
  }

  const requests = await call('GET', `/families/${familyId}/join-requests`, { token: ownerToken });
  for (const request of requests.body.requests ?? []) {
    if (request.displayName !== displayName) continue;
    await call('POST', `/families/${familyId}/join-requests/${request.id}/reject`, {
      token: ownerToken,
    });
  }
}

async function main() {
  console.log(`달살림 API 스모크 테스트 · ${BASE} · ${thisMonth}`);

  const health = await call('GET', '/health');
  check('서버 살아 있음', health.status === 200, health.body);
  check(
    '/health 의 sha 는 null 이거나 7자 해시다 — 빈 문자열이 새면 안 된다',
    health.body.sha === null || /^[0-9a-f]{7}$/.test(health.body.sha),
    health.body,
  );
  const nowhere = await call('GET', '/nowhere');
  check(
    '없는 주소도 { code, message } 로 답한다',
    nowhere.status === 404 && nowhere.body.code === 'NOT_FOUND',
    nowhere.body,
  );

  await bootstrap();
  await resetMonth([OWNER, MEMBER]);

  const dad = await runWizard(OWNER, { changeFirstFixed: true });
  check(
    'F-BOOK-04 한 명만 제출하면 장부는 아직 진행 중',
    dad.bookStatus === 'OPEN',
    dad.bookStatus,
  );

  const dadEntry = await call('GET', `/entries/${dad.entryId}`, { token: dad.token });
  const dadIncome = dadEntry.body.entry.summary.income;

  // 전원이 안 적었어도 요약은 열린다. 한 명이 앱을 안 쓰기 시작하면 그 달부터
  // 아무도 아무것도 못 보게 되는 게 예전 구조였다. (기획서 3장)
  const partial = await call('GET', `/families/${dad.familyId}/books/${thisMonth}/summary`, {
    token: dad.token,
  });
  check('★ F-BOOK-02 전원 제출 전에도 요약이 열린다', partial.status === 200, partial.body);
  check(
    'F-BOOK-02 미제출자를 progress 로 알려준다',
    partial.body.progress?.submittedCount === 1 &&
      partial.body.progress?.memberCount === 2 &&
      partial.body.progress?.pendingMembers?.length === 1,
    partial.body.progress,
  );
  check(
    '★ F-BOOK-02 부분 제출 합계는 제출한 사람 것만 센다',
    partial.body.totals.income === dadIncome,
    {
      got: partial.body.totals.income,
      expected: dadIncome,
    },
  );
  check(
    'F-BOOK-02 미제출자는 0원으로 서 있고 submitted=false 다',
    partial.body.perMember?.length === 2 &&
      partial.body.perMember.filter((m) => m.submitted === false).length === 1,
    partial.body.perMember,
  );

  const mom = await runWizard(MEMBER, { changeFirstFixed: false });
  check('★ F-BOOK-04 전원 제출 → 장부 완성', mom.bookStatus === 'COMPLETE', mom.bookStatus);

  console.log('\n[요약]');
  const summary = await call('GET', `/families/${dad.familyId}/books/${thisMonth}/summary`, {
    token: dad.token,
  });
  check('F-BOOK-02 요약이 열린다', summary.status === 200, summary.body);

  const s = summary.body;
  check('F-BOOK-02 사람별 집계 2명', s.perMember?.length === 2, s.perMember);
  check(
    'F-BOOK-04 전원 제출이면 pendingMembers 가 비어 있다',
    s.progress?.pendingMembers?.length === 0,
    s.progress,
  );
  check(
    'F-BOOK-02 합계가 맞는다',
    s.totals.surplus ===
      s.totals.income - s.totals.fixedTotal - s.totals.extraTotal - s.totals.settlementTotal,
    s.totals,
  );
  check(
    'F-BOOK-02 달라진 것에 사유가 붙어 있다',
    s.changes?.some((c) => c.reason),
    s.changes,
  );
  check('F-BOOK-02 특이사항이 모인다', s.notes?.length === 2, s.notes);
  console.log(
    `     수입 ${s.totals.income.toLocaleString()} / 고정비 ${s.totals.fixedTotal.toLocaleString()} / ` +
      `추가 ${s.totals.extraTotal.toLocaleString()} → 남은 돈 ${s.totals.surplus.toLocaleString()}`,
  );

  console.log('\n[제출 후 수정]');
  const locked = await call('PATCH', `/entries/${dad.entryId}`, {
    token: dad.token,
    body: { note: '몰래 고치기' },
  });
  check('F-ENT-08 제출한 기록은 바로 못 고친다', locked.status === 403, locked.body);

  const reopen = await call('POST', `/entries/${dad.entryId}/reopen`, { token: dad.token });
  check(
    '★ F-ENT-08 다시 열면 장부도 진행 중으로 내려간다',
    reopen.status === 200 && reopen.body.bookStatus === 'OPEN',
    reopen.body,
  );

  await call('POST', `/entries/${dad.entryId}/submit`, { token: dad.token });

  console.log('\n[권한]');
  const stranger = await call('POST', '/auth/dev', { body: { name: '남남' } });
  const peek = await call('GET', `/families/${dad.familyId}/books/${thisMonth}`, {
    token: stranger.body.token,
  });
  check('F-FAM-06 남의 가족은 못 본다', peek.status === 403, peek.body);

  const peekEntry = await call('GET', `/entries/${dad.entryId}`, { token: stranger.body.token });
  check('F-BOOK-01 남의 기록은 못 본다', peekEntry.status === 403, peekEntry.body);

  console.log('\n[추이]');
  const trend = await call('GET', `/families/${dad.familyId}/trend?months=12`, {
    token: dad.token,
  });
  check('F-BOOK-03 추이가 열린다', trend.status === 200, trend.body);
  check(
    '★ F-BOOK-03 지난달과 이번 달 두 점이 찍힌다',
    trend.body.months?.length >= 2,
    trend.body.months?.map((m) => m.yearMonth),
  );
  check(
    'F-BOOK-03 추이 합계도 제출된 기록만 센다',
    trend.body.months?.every(
      (m) =>
        m.surplus === m.income - m.fixedTotal - m.extraTotal - m.settlementTotal &&
        m.submittedCount > 0,
    ),
    trend.body.months,
  );
  check(
    'F-BOOK-03 오래된 달이 앞에 온다',
    trend.body.months?.[0]?.yearMonth < trend.body.months?.at(-1)?.yearMonth,
    trend.body.months?.map((m) => m.yearMonth),
  );

  console.log('\n[멤버 관리]');
  // 안 쓰는 멤버 한 명이 장부를 영원히 막던 문제. 뺄 수 있어야 한다.
  const family = await call('GET', `/families/${dad.familyId}`, { token: dad.token });
  const momMembership = family.body.members.find((m) => m.displayName === MEMBER);
  const dadMembership = family.body.members.find((m) => m.isMe);

  const ownerLeave = await call('DELETE', `/families/${dad.familyId}/members/${dadMembership.id}`, {
    token: dad.token,
  });
  check(
    'F-FAM-08 가족장은 넘기기 전에 못 나간다',
    ownerLeave.status === 400 && ownerLeave.body.code === 'TRANSFER_OWNER_FIRST',
    ownerLeave.body,
  );

  const kickByMember = await call(
    'DELETE',
    `/families/${dad.familyId}/members/${dadMembership.id}`,
    { token: mom.token },
  );
  check('F-FAM-08 일반 멤버는 남을 못 내보낸다', kickByMember.status === 403, kickByMember.body);

  // 나가기 전 숫자를 적어 둔다 — 나간 뒤에도 같아야 한다 (하드룰 6 · F-FAM-08)
  const summaryPathThisMonth = `/families/${dad.familyId}/books/${thisMonth}/summary`;
  const beforeKickSummary = (await call('GET', summaryPathThisMonth, { token: dad.token })).body;
  const beforeKickTrend = (
    await call('GET', `/families/${dad.familyId}/trend?months=2`, { token: dad.token })
  ).body.months?.find((m) => m.yearMonth === thisMonth);

  const kick = await call('DELETE', `/families/${dad.familyId}/members/${momMembership.id}`, {
    token: dad.token,
  });
  check('★ F-FAM-08 가족장이 멤버를 내보낸다', kick.status === 200, kick.body);

  const kickedPeek = await call('GET', `/families/${dad.familyId}`, { token: mom.token });
  check('F-FAM-08 나간 사람은 가족을 못 본다', kickedPeek.status === 403, kickedPeek.body);

  const afterKick = await call('GET', `/families/${dad.familyId}/books/${thisMonth}`, {
    token: dad.token,
  });
  check(
    '★ F-BOOK-02 홈이 말하는 "N명 기준"도 요약과 같은 축이다 — 나간 사람의 제출본을 센다',
    afterKick.body.submittedCount === 2,
    { submittedCount: afterKick.body.submittedCount, members: afterKick.body.members.length },
  );
  check(
    '★ F-BOOK-04 남은 사람만으로 장부가 완성된다',
    afterKick.body.book.status === 'COMPLETE' && afterKick.body.members.length === 1,
    { status: afterKick.body.book.status, members: afterKick.body.members.length },
  );

  const afterKickSummary = await call('GET', summaryPathThisMonth, { token: dad.token });
  const afterKickTrend = (
    await call('GET', `/families/${dad.familyId}/trend?months=2`, { token: dad.token })
  ).body.months?.find((m) => m.yearMonth === thisMonth);
  const pickTotals = (s) => ({
    income: s.totals?.income,
    fixedTotal: s.totals?.fixedTotal,
    extraTotal: s.totals?.extraTotal,
    extraIncomeTotal: s.totals?.extraIncomeTotal,
    settlementTotal: s.totals?.settlementTotal,
    surplus: s.totals?.surplus,
    byCategory: s.byCategory,
    changes: s.changes?.length,
  });
  check(
    '★ F-BOOK-02 나간 사람이 그 달에 낸 기록은 요약 합계에 그대로 남는다 (하드룰 6)',
    beforeKickSummary.totals !== undefined &&
      JSON.stringify(pickTotals(afterKickSummary.body)) ===
        JSON.stringify(pickTotals(beforeKickSummary)),
    { before: pickTotals(beforeKickSummary), after: pickTotals(afterKickSummary.body) },
  );
  const momRow = afterKickSummary.body.perMember?.find((m) => m.membershipId === momMembership.id);
  check(
    '★ F-BOOK-02 그 달에 낸 사람은 나갔어도 사람별에 남는다 — 사람별 합이 총계여야 한다',
    momRow?.submitted === true &&
      afterKickSummary.body.perMember.reduce((sum, m) => sum + m.income, 0) ===
        afterKickSummary.body.totals.income,
    afterKickSummary.body.perMember,
  );
  check(
    '★ F-BOOK-02 정원은 현재 구성원 + 그 달에 낸 나간 사람 — 미제출자에는 나간 사람이 안 들어간다',
    // perMember.length 와 비교하면 서버가 그렇게 만들어 주므로 늘 참이다 — 값으로 못 박는다
    afterKickSummary.body.progress.memberCount === 2 &&
      afterKickSummary.body.progress.memberCount === beforeKickSummary.progress.memberCount &&
      !afterKickSummary.body.progress.pendingMembers.some(
        (m) => m.membershipId === momMembership.id,
      ),
    afterKickSummary.body.progress,
  );
  check(
    '★ F-BOOK-03 추이의 그 달 점도 안 내려앉는다',
    // 둘 다 없으면 undefined === undefined 로 조용히 통과한다 — 점이 실제로 잡혔는지부터 본다
    beforeKickTrend !== undefined &&
      afterKickTrend !== undefined &&
      afterKickTrend.income === beforeKickTrend.income &&
      afterKickTrend.surplus === beforeKickTrend.surplus &&
      afterKickTrend.submittedCount === beforeKickTrend.submittedCount &&
      afterKickTrend.memberCount === beforeKickTrend.memberCount,
    { before: beforeKickTrend, after: afterKickTrend },
  );

  // 되돌린다 — 이 스크립트는 몇 번이고 다시 돌 수 있어야 한다
  const inviteCode = family.body.family.inviteCode;
  const rejoin = await call('POST', '/families/join', {
    token: mom.token,
    body: { inviteCode, displayName: MEMBER },
  });
  check(
    '★ F-FAM-03 나갔던 사람도 다시 승인을 받는다',
    rejoin.status === 200 && rejoin.body.membership?.status === 'PENDING',
    rejoin.body,
  );

  const stillOne = await call('GET', `/families/${dad.familyId}/books/${thisMonth}`, {
    token: dad.token,
  });
  check(
    '★ F-FAM-04 대기 중인 사람은 장부 정원에 안 들어간다',
    stillOne.body.members.length === 1 && stillOne.body.book.status === 'COMPLETE',
    { members: stillOne.body.members.length, status: stillOne.body.book.status },
  );
  // 재참여 대기(PENDING) 중이라도 그 달에 낸 기록은 요약에 그대로다 — 하드룰 8 이 아니라 6 의 자리 (F-BOOK-02)
  const pendingSummary = (await call('GET', summaryPathThisMonth, { token: dad.token })).body;
  const pendingMomRow = pendingSummary.perMember?.find((m) => m.membershipId === momMembership.id);
  check(
    '★ F-BOOK-02 다시 신청해 대기 중인 사람도 그 달에 낸 기록은 요약에 남는다',
    pendingMomRow?.submitted === true &&
      pendingSummary.progress.memberCount === 2 &&
      pendingSummary.progress.memberCount === beforeKickSummary.progress.memberCount &&
      !pendingSummary.progress.pendingMembers.some((m) => m.membershipId === momMembership.id) &&
      pendingSummary.totals.income === beforeKickSummary.totals.income,
    { progress: pendingSummary.progress, mom: pendingMomRow },
  );

  const momRequests = await call('GET', `/families/${dad.familyId}/join-requests`, {
    token: dad.token,
  });
  const momRequest = momRequests.body.requests.find((r) => r.displayName === MEMBER);
  await call('POST', `/families/${dad.familyId}/join-requests/${momRequest.id}/approve`, {
    token: dad.token,
  });

  const momEntryAgain = await call('GET', `/entries/${mom.entryId}`, { token: mom.token });
  check(
    'F-FAM-05 돌아오면 지난 기록이 그대로 남아 있다',
    momEntryAgain.status === 200 && momEntryAgain.body.entry.status === 'SUBMITTED',
    momEntryAgain.body,
  );

  const afterRejoin = await call('GET', `/families/${dad.familyId}/books/${thisMonth}`, {
    token: dad.token,
  });
  check('★ F-BOOK-04 사람이 늘면 장부가 다시 열린다', afterRejoin.body.members.length === 2, {
    members: afterRejoin.body.members.length,
    status: afterRejoin.body.book.status,
  });

  console.log('\n[참여 승인]');
  // 초대코드는 카톡으로 오가다 새어나갈 수 있다. 코드를 맞혔다고 바로 들어오면 안 된다.
  const neighbor = await call('POST', '/auth/dev', { body: { name: '이웃' } });
  const neighborToken = neighbor.body.token;
  await clearOutsider(dad.token, dad.familyId, '이웃');

  const request = await call('POST', '/families/join', {
    token: neighborToken,
    body: { inviteCode, displayName: '이웃' },
  });
  // 참여 요청의 결과는 "대기 중인 멤버십"이다 — 만들어진 리소스를 그대로 돌려준다 (응답 형태 규칙)
  check(
    '★ F-FAM-03 초대코드를 맞혀도 바로 들어오지 못한다',
    request.status === 200 && request.body.membership?.status === 'PENDING',
    request.body,
  );
  check(
    'F-FAM-04 대기자에게는 초대코드를 알려주지 않는다',
    request.body.membership?.family?.inviteCode === undefined,
    request.body,
  );

  const peekWhilePending = await call('GET', `/families/${dad.familyId}`, {
    token: neighborToken,
  });
  check(
    '★ F-FAM-04 승인 전에는 가계부를 한 줄도 못 본다',
    peekWhilePending.status === 403 && peekWhilePending.body.code === 'PENDING_APPROVAL',
    peekWhilePending.body,
  );

  const bookWhilePending = await call('GET', `/families/${dad.familyId}/books/${thisMonth}`, {
    token: neighborToken,
  });
  check(
    'F-FAM-04 승인 전에는 장부도 못 본다',
    bookWhilePending.status === 403,
    bookWhilePending.body,
  );

  const myPending = await call('GET', '/families/pending', { token: neighborToken });
  check(
    'F-FAM-04 대기 화면이 어느 가족인지는 안다',
    myPending.body.requests?.[0]?.family?.name === family.body.family.name,
    myPending.body,
  );

  const again = await call('POST', '/families/join', {
    token: neighborToken,
    body: { inviteCode, displayName: '이웃' },
  });
  check(
    'F-FAM-03 두 번 요청해도 중복으로 쌓이지 않는다',
    again.status === 409 && again.body.code === 'ALREADY_REQUESTED',
    again.body,
  );

  const memberPeeksRequests = await call('GET', `/families/${dad.familyId}/join-requests`, {
    token: mom.token,
  });
  check(
    'F-FAM-05 일반 멤버는 요청 목록을 못 본다',
    memberPeeksRequests.status === 403,
    memberPeeksRequests.body,
  );

  const requests = await call('GET', `/families/${dad.familyId}/join-requests`, {
    token: dad.token,
  });
  const pendingId = requests.body.requests.find((r) => r.displayName === '이웃')?.id;
  check('F-FAM-05 가족장에게 요청이 보인다', Boolean(pendingId), requests.body);

  const memberApproves = await call(
    'POST',
    `/families/${dad.familyId}/join-requests/${pendingId}/approve`,
    { token: mom.token },
  );
  check('F-FAM-05 일반 멤버는 승인하지 못한다', memberApproves.status === 403, memberApproves.body);

  const reject = await call('POST', `/families/${dad.familyId}/join-requests/${pendingId}/reject`, {
    token: dad.token,
  });
  check('★ F-FAM-05 가족장이 거절한다', reject.status === 200, reject.body);

  const afterReject = await call('GET', `/families/${dad.familyId}`, { token: neighborToken });
  check('F-FAM-05 거절당하면 여전히 못 본다', afterReject.status === 403, afterReject.body);
  check(
    'F-FAM-05 거절당하면 대기 목록에서도 사라진다',
    (await call('GET', '/families/pending', { token: neighborToken })).body.requests.length === 0,
  );

  // 다시 요청해서 이번엔 승인까지 간다
  await call('POST', '/families/join', {
    token: neighborToken,
    body: { inviteCode, displayName: '이웃' },
  });
  const secondRequests = await call('GET', `/families/${dad.familyId}/join-requests`, {
    token: dad.token,
  });
  const approveId = secondRequests.body.requests.find((r) => r.displayName === '이웃').id;

  const approve = await call(
    'POST',
    `/families/${dad.familyId}/join-requests/${approveId}/approve`,
    { token: dad.token },
  );
  check('★ F-FAM-05 가족장이 승인한다', approve.status === 200, approve.body);

  const afterApprove = await call('GET', `/families/${dad.familyId}/books/${thisMonth}`, {
    token: dad.token,
  });
  check('★ F-FAM-05 승인해야 비로소 정원에 들어간다', afterApprove.body.members.length === 3, {
    members: afterApprove.body.members.length,
    status: afterApprove.body.book.status,
  });

  // 원래대로 두 명으로 되돌린다
  await clearOutsider(dad.token, dad.familyId, '이웃');

  console.log('\n[초대코드 재발급]');
  const memberRotates = await call('POST', `/families/${dad.familyId}/invite-code`, {
    token: mom.token,
  });
  check(
    'F-FAM-02 일반 멤버는 초대코드를 새로 만들지 못한다',
    memberRotates.status === 403,
    memberRotates.body,
  );

  const rotated = await call('POST', `/families/${dad.familyId}/invite-code`, { token: dad.token });
  // 바뀐 리소스는 그 리소스로 돌려준다 — 가족 만들기와 같은 { family } 모양이다
  check(
    'F-FAM-02 가족장이 새 코드를 만들면 가족 모양으로 돌려준다',
    rotated.status === 200 &&
      rotated.body.family?.id === dad.familyId &&
      /^[A-Z0-9]{6}$/.test(rotated.body.family?.inviteCode ?? ''),
    rotated.body,
  );
  check(
    'F-FAM-02 새 코드는 예전 코드와 다르다',
    rotated.body.family?.inviteCode !== inviteCode,
    rotated.body,
  );

  console.log('\n[고정비 목록 · 표시 이름]');
  // F-FIX-01 — 목록은 "사람별"이 축이다. 가족 전체를 한 덩어리로 보여주지 않는다
  const listed = await call('GET', `/families/${dad.familyId}/fixed-expenses`, {
    token: dad.token,
  });
  check(
    'F-FIX-01 사람별 그룹으로 나온다',
    listed.status === 200 &&
      Array.isArray(listed.body.groups) &&
      listed.body.groups.length >= 2 &&
      listed.body.groups.every((g) => g.membershipId && Array.isArray(g.items)),
    listed.body,
  );
  check(
    'F-FIX-01 isMe 는 정확히 하나다 — 내 것이 어느 그룹인지 화면이 안다',
    (listed.body.groups ?? []).filter((g) => g.isMe).length === 1,
    (listed.body.groups ?? []).map((g) => ({ name: g.displayName, isMe: g.isMe })),
  );
  check(
    'F-FIX-01 monthlyTotal 은 그 사람 항목의 합이다',
    (listed.body.groups ?? []).every(
      (g) => g.monthlyTotal === g.items.reduce((sum, i) => sum + i.defaultAmount, 0),
    ),
    (listed.body.groups ?? []).map((g) => ({ total: g.monthlyTotal, n: g.items.length })),
  );

  // F-FAM-07 — 바꾼 리소스를 돌려준다 ({ membership }). 끝나면 원래 이름으로 되돌려
  //   스모크를 몇 번이고 다시 돌릴 수 있게 한다
  const renamed = await call('PATCH', `/families/${dad.familyId}/me`, {
    token: dad.token,
    body: { displayName: '스모크아빠2' },
  });
  check(
    'F-FAM-07 이름을 바꾸면 { membership } 으로 돌려준다',
    renamed.status === 200 && renamed.body.membership?.displayName === '스모크아빠2',
    renamed.body,
  );

  const afterRename = await call('GET', `/families/${dad.familyId}`, { token: dad.token });
  check(
    'F-FAM-07 구성원 목록에도 새 이름으로 보인다',
    (afterRename.body.members ?? []).some((m) => m.displayName === '스모크아빠2'),
    afterRename.body.members,
  );

  const restored = await call('PATCH', `/families/${dad.familyId}/me`, {
    token: dad.token,
    body: { displayName: OWNER },
  });
  check('F-FAM-07 되돌릴 수 있다', restored.body.membership?.displayName === OWNER, restored.body);

  console.log('\n[고정비 설명]');
  // F-FIX-02 · F-FIX-03 — 설명은 선택이고, 빈 문자열은 null 로 저장한다.
  //   여기서 만드는 항목은 이 절 끝에서 지운다 — 스모크는 몇 번이고 다시 돌 수 있어야 한다.
  const descGroup = (
    await call('GET', `/families/${dad.familyId}/fixed-expenses`, { token: dad.token })
  ).body.groups?.[0];

  const withDesc = await call('POST', `/families/${dad.familyId}/fixed-expenses`, {
    token: dad.token,
    body: {
      membershipId: descGroup?.membershipId,
      name: '보험료',
      description: '  엄마 실손 · 2031년 만기  ',
      category: '보험',
      defaultAmount: 88_000,
    },
  });
  const withDescId = withDesc.body.fixedExpense?.id;
  check(
    'F-FIX-02 설명을 적어 등록하면 앞뒤 공백이 다듬어져 저장된다',
    withDesc.status === 200 &&
      withDesc.body.fixedExpense?.description === '엄마 실손 · 2031년 만기',
    withDesc.body,
  );

  const descListed = await call('GET', `/families/${dad.familyId}/fixed-expenses`, {
    token: dad.token,
  });
  const descItem = (descListed.body.groups ?? [])
    .flatMap((g) => g.items ?? [])
    .find((i) => i.id === withDescId);
  check(
    'F-FIX-01 목록에도 설명이 실려 온다',
    descItem?.description === '엄마 실손 · 2031년 만기',
    descItem,
  );

  const blankDesc = await call('POST', `/families/${dad.familyId}/fixed-expenses`, {
    token: dad.token,
    body: {
      membershipId: descGroup?.membershipId,
      name: '적금',
      description: '   ',
      category: '저축',
      defaultAmount: 300_000,
    },
  });
  check(
    'F-FIX-02 공백만 적은 설명은 null 로 저장한다 — 안 적음을 두 가지로 표현하지 않는다',
    blankDesc.status === 200 && blankDesc.body.fixedExpense?.description === null,
    blankDesc.body,
  );

  const tooLong = await call('POST', `/families/${dad.familyId}/fixed-expenses`, {
    token: dad.token,
    body: {
      membershipId: descGroup?.membershipId,
      name: '긴설명',
      description: '가'.repeat(61),
      category: '기타',
      defaultAmount: 1000,
    },
  });
  check(
    'F-FIX-02 설명이 60자를 넘으면 VALIDATION',
    tooLong.body.code === 'VALIDATION',
    tooLong.body,
  );

  // 길이를 재는 순서 — 다듬고 나서 재야 한다.
  //   61자만 보면 trim 과 max 의 순서가 뒤바뀜을 때 아무것도 빨개지지 않는다.
  const exact60 = await call('POST', `/families/${dad.familyId}/fixed-expenses`, {
    token: dad.token,
    body: {
      membershipId: descGroup?.membershipId,
      name: '경계',
      description: `  ${'가'.repeat(60)}  `,
      category: '기타',
      defaultAmount: 1000,
    },
  });
  check(
    'F-FIX-02 앞뒤 공백을 다듬으면 60자인 설명은 통과한다',
    exact60.status === 200 && exact60.body.fixedExpense?.description?.length === 60,
    { status: exact60.status, length: exact60.body.fixedExpense?.description?.length },
  );

  const descPatched = await call('PATCH', `/fixed-expenses/${withDescId}`, {
    token: dad.token,
    body: { description: '엄마 실손 · 2035년 만기' },
  });
  check(
    'F-FIX-03 설명만 보내면 설명만 바뀐다',
    descPatched.body.fixedExpense?.description === '엄마 실손 · 2035년 만기' &&
      descPatched.body.fixedExpense?.name === '보험료',
    descPatched.body,
  );

  const nameOnly = await call('PATCH', `/fixed-expenses/${withDescId}`, {
    token: dad.token,
    body: { name: '엄마 보험료' },
  });
  check(
    'F-FIX-03 설명을 안 보내면 지워지지 않는다 — 안 건드림과 지움은 다르다',
    nameOnly.body.fixedExpense?.description === '엄마 실손 · 2035년 만기',
    nameOnly.body,
  );

  const cleared = await call('PATCH', `/fixed-expenses/${withDescId}`, {
    token: dad.token,
    body: { description: '' },
  });
  check(
    'F-FIX-03 빈 문자열을 보내면 설명이 지워진다',
    cleared.body.fixedExpense?.description === null,
    cleared.body,
  );

  // 설명이 위저드 줄에도 실려 온다. 그리고 ★ 이름과 달리 스냅샷이 아니다 —
  //   줄에 복사돼 있지 않고 지금의 고정비에서 읽어오므로, 항목을 고치면 이미 적은 달에도 새 설명이 보인다.
  const dadEntryForDesc = await call('GET', `/entries/${dad.entryId}`, { token: dad.token });
  const fixedLine = (dadEntryForDesc.body.entry?.lines ?? []).find(
    (l) => l.kind === 'FIXED' && l.fixedExpenseId,
  );
  check(
    'F-ENT-04 고정비 줄에 설명 칸이 실려 온다',
    fixedLine !== undefined && 'description' in fixedLine,
    fixedLine,
  );

  await call('PATCH', `/fixed-expenses/${fixedLine?.fixedExpenseId}`, {
    token: dad.token,
    body: { description: '스모크가 붙인 설명' },
  });
  const afterDesc = await call('GET', `/entries/${dad.entryId}`, { token: dad.token });
  const sameLine = (afterDesc.body.entry?.lines ?? []).find((l) => l.id === fixedLine?.id);
  check(
    'F-FIX-03 설명은 스냅샷이 아니다 — 항목을 고치면 이미 적은 달에도 새 설명이 보인다',
    sameLine?.description === '스모크가 붙인 설명',
    sameLine,
  );
  check(
    '★ F-ENT-04 그래도 이름은 그 달의 스냅샷이라 안 바뀐다',
    sameLine?.name === fixedLine?.name,
    { before: fixedLine?.name, after: sameLine?.name },
  );
  // 다시 돌 수 있게 되돌린다
  await call('PATCH', `/fixed-expenses/${fixedLine?.fixedExpenseId}`, {
    token: dad.token,
    body: { description: '' },
  });

  for (const id of [withDescId, blankDesc.body.fixedExpense?.id, exact60.body.fixedExpense?.id]) {
    if (id) await call('DELETE', `/fixed-expenses/${id}`, { token: dad.token });
  }

  console.log('\n[결산 스위치]');
  // F-FIX-07 — 다음 달에 실제 쓴 금액을 되물을지. 안 보내면 등록 때는 분류가 정하고 수정 때는 안 건드린다.
  //   여기서 만드는 항목은 이 절 끝에서 지운다 — 스모크는 몇 번이고 다시 돌 수 있어야 한다.
  const settleGroup = (
    await call('GET', `/families/${dad.familyId}/fixed-expenses`, { token: dad.token })
  ).body.groups?.[0];
  const settleBase = { membershipId: settleGroup?.membershipId, defaultAmount: 300_000 };

  const living = await call('POST', `/families/${dad.familyId}/fixed-expenses`, {
    token: dad.token,
    body: { ...settleBase, name: '생활비', category: '생활비' },
  });
  check(
    '★ F-FIX-07 생활비 분류로 등록하면 스위치가 켜진 채 저장된다',
    living.status === 200 && living.body.fixedExpense?.settles === true,
    living.body,
  );

  const telecom = await call('POST', `/families/${dad.familyId}/fixed-expenses`, {
    token: dad.token,
    body: { ...settleBase, name: '통신비', category: '통신' },
  });
  check(
    'F-FIX-07 다른 분류는 꺼진 채 저장된다',
    telecom.status === 200 && telecom.body.fixedExpense?.settles === false,
    telecom.body,
  );

  const investing = await call('POST', `/families/${dad.familyId}/fixed-expenses`, {
    token: dad.token,
    body: { ...settleBase, name: '연금저축펀드', category: '투자' },
  });
  check(
    'F-FIX-08 투자 분류로 등록되고 결산 스위치는 꺼진 채다 — 옮기면 끝나는 돈이다',
    investing.status === 200 && investing.body.fixedExpense?.settles === false,
    investing.body,
  );

  const livingOff = await call('POST', `/families/${dad.familyId}/fixed-expenses`, {
    token: dad.token,
    body: { ...settleBase, name: '식비 정산', category: '생활비', settles: false },
  });
  check(
    'F-FIX-07 보낸 값이 있으면 분류보다 앞선다 — 생활비라도 끌 수 있다',
    livingOff.status === 200 && livingOff.body.fixedExpense?.settles === false,
    livingOff.body,
  );

  const allowance = await call('POST', `/families/${dad.familyId}/fixed-expenses`, {
    token: dad.token,
    body: { ...settleBase, name: '용돈', category: '기타', settles: true },
  });
  check(
    'F-FIX-07 기타에 든 용돈도 직접 켤 수 있다',
    allowance.status === 200 && allowance.body.fixedExpense?.settles === true,
    allowance.body,
  );

  const settleListed = await call('GET', `/families/${dad.familyId}/fixed-expenses`, {
    token: dad.token,
  });
  const listedLiving = (settleListed.body.groups ?? [])
    .flatMap((g) => g.items ?? [])
    .find((i) => i.id === living.body.fixedExpense?.id);
  check('F-FIX-01 목록에도 스위치가 실려 온다', listedLiving?.settles === true, listedLiving);

  const settleRenamed = await call('PATCH', `/fixed-expenses/${living.body.fixedExpense?.id}`, {
    token: dad.token,
    body: { name: '생활비 이체' },
  });
  check(
    '★ F-FIX-07 스위치를 안 보내면 이름만 고쳐도 스위치는 그대로다 — 안 건드림과 끔은 다르다',
    settleRenamed.body.fixedExpense?.settles === true &&
      settleRenamed.body.fixedExpense?.name === '생활비 이체',
    settleRenamed.body,
  );

  const recategorized = await call('PATCH', `/fixed-expenses/${telecom.body.fixedExpense?.id}`, {
    token: dad.token,
    body: { category: '생활비' },
  });
  check(
    'F-FIX-07 저장한 뒤에는 분류와 스위치가 독립이다 — 분류를 생활비로 바꿔도 스위치는 안 켜진다',
    recategorized.body.fixedExpense?.settles === false,
    recategorized.body,
  );

  const turnedOff = await call('PATCH', `/fixed-expenses/${living.body.fixedExpense?.id}`, {
    token: dad.token,
    body: { settles: false },
  });
  check(
    'F-FIX-07 스위치만 보내면 스위치만 바뀐다',
    turnedOff.body.fixedExpense?.settles === false,
    turnedOff.body,
  );

  const notBool = await call('POST', `/families/${dad.familyId}/fixed-expenses`, {
    token: dad.token,
    body: { ...settleBase, name: '이상한값', category: '기타', settles: 'yes' },
  });
  check('F-FIX-07 불리언이 아니면 VALIDATION', notBool.body.code === 'VALIDATION', notBool.body);

  for (const item of [living, telecom, investing, livingOff, allowance]) {
    const id = item.body.fixedExpense?.id;
    if (id) await call('DELETE', `/fixed-expenses/${id}`, { token: dad.token });
  }

  console.log('\n[고정비 삭제]');
  // ★ 하드룰 6 — 이 기능이 존재하는 이유가 곧 하드룰 6 이다.
  //   실제 삭제는 과거 장부의 합계를 바꾼다. 지운 뒤에도 지난달이 그대로여야 한다.
  const summaryPath = `/families/${dad.familyId}/books/${lastMonth}/summary`;
  const beforeSummary = await call('GET', summaryPath, { token: dad.token });
  const fixedTotalBefore = beforeSummary.body.totals?.fixedTotal;

  const fixedList = await call('GET', `/families/${dad.familyId}/fixed-expenses`, {
    token: dad.token,
  });
  const myGroup = fixedList.body.groups?.[0];

  const created = await call('POST', `/families/${dad.familyId}/fixed-expenses`, {
    token: dad.token,
    body: {
      membershipId: myGroup?.membershipId,
      name: '넷플릭스',
      category: '구독',
      defaultAmount: 17_000,
    },
  });
  const createdId = created.body.fixedExpense?.id;
  check(
    'F-FIX-04 지울 항목을 하나 만든다',
    created.status === 200 && Boolean(createdId),
    created.body,
  );

  const deleted = await call('DELETE', `/fixed-expenses/${createdId}`, { token: dad.token });
  // 리소스가 없어지는 동작이라 돌려줄 리소스가 없다 — { ok: true } 만 온다
  check(
    'F-FIX-04 지우면 { ok: true } 만 돌아온다',
    deleted.status === 200 && deleted.body.ok === true,
    deleted.body,
  );

  const fixedAfter = await call('GET', `/families/${dad.familyId}/fixed-expenses`, {
    token: dad.token,
  });
  const stillListed = (fixedAfter.body.groups ?? []).some((g) =>
    (g.items ?? []).some((i) => i.id === createdId),
  );
  check('F-FIX-04 목록에서 빠진다', stillListed === false, fixedAfter.body);

  const afterSummary = await call('GET', summaryPath, { token: dad.token });
  check(
    '★ F-FIX-04 지워도 지난달 합계가 안 바뀐다 — 과거를 지우지 않는다',
    afterSummary.body.totals?.fixedTotal === fixedTotalBefore,
    { before: fixedTotalBefore, after: afterSummary.body.totals?.fixedTotal },
  );

  // 명세의 예외표 — 없는 항목
  const ghost = await call('DELETE', `/fixed-expenses/${createdId}-없는것`, { token: dad.token });
  check(
    'F-FIX-04 없는 항목을 지우면 FIXED_EXPENSE_NOT_FOUND',
    ghost.body.code === 'FIXED_EXPENSE_NOT_FOUND',
    ghost.body,
  );

  console.log('\n[기록 지우기]');
  // ★ 하드룰 6 — 이 기능의 경계가 곧 하드룰 6 이다.
  //   초안은 요약·추이 어디에도 안 들어가므로 지워도 바뀌는 숫자가 없다.
  //   반대로 제출본과 지난 달은 이미 집계에 들어가 있어 못 지운다.
  const lastMonthSummaryPath = `/families/${dad.familyId}/books/${lastMonth}/summary`;
  const lastMonthBefore = await call('GET', lastMonthSummaryPath, { token: dad.token });
  const lastMonthIncomeBefore = lastMonthBefore.body.totals?.income;

  const deleteSubmitted = await call('DELETE', `/entries/${dad.entryId}`, { token: dad.token });
  check(
    '★ F-ENT-10 제출한 기록은 못 지운다',
    deleteSubmitted.status === 403 && deleteSubmitted.body.code === 'ENTRY_SUBMITTED',
    deleteSubmitted.body,
  );

  const deleteOthers = await call('DELETE', `/entries/${mom.entryId}`, { token: dad.token });
  check(
    'F-ENT-10 남의 기록은 못 지운다 — 가족장도 예외 없다',
    deleteOthers.status === 403 && deleteOthers.body.code === 'NOT_MY_ENTRY',
    deleteOthers.body,
  );

  // 지난 달은 제출본이든 초안이든 같은 이유로 막힌다.
  // 제출본에 ENTRY_SUBMITTED("되열어주세요")가 나가면 시킨 대로 해도 결국 못 지우게 되므로,
  // 월 검사가 초안 검사보다 먼저다. 아래 두 케이스가 그 순서를 고정한다.
  const lastEntry = await call('POST', `/families/${dad.familyId}/books/${lastMonth}/my-entry`, {
    token: dad.token,
  });
  const lastEntryId = lastEntry.body.entry.id;

  const deletePastSubmitted = await call('DELETE', `/entries/${lastEntryId}`, {
    token: dad.token,
  });
  check(
    '★ F-ENT-10 지난 달 제출본은 되열라고 하지 않고 바로 막는다',
    deletePastSubmitted.status === 403 && deletePastSubmitted.body.code === 'PAST_MONTH_ENTRY',
    deletePastSubmitted.body,
  );

  await call('POST', `/entries/${lastEntryId}/reopen`, { token: dad.token });

  const deletePast = await call('DELETE', `/entries/${lastEntryId}`, { token: dad.token });
  check(
    '★ F-ENT-10 지난 달 기록은 되열어도 못 지운다',
    deletePast.status === 403 && deletePast.body.code === 'PAST_MONTH_ENTRY',
    deletePast.body,
  );
  await call('POST', `/entries/${lastEntryId}/submit`, { token: dad.token });

  // 여기부터 성공 경로 — 제출본을 되열어 초안으로 만든 뒤에 지운다
  const thisMonthSummaryPath = `/families/${dad.familyId}/books/${thisMonth}/summary`;
  const thisMonthBefore = await call('GET', thisMonthSummaryPath, { token: dad.token });
  const thisMonthIncomeBefore = thisMonthBefore.body.totals?.income;
  const dadIncomeBefore =
    thisMonthBefore.body.perMember?.find((m) => m.displayName === OWNER)?.income ?? 0;

  await call('POST', `/entries/${dad.entryId}/reopen`, { token: dad.token });
  const removed = await call('DELETE', `/entries/${dad.entryId}`, { token: dad.token });
  // 리소스가 없어지는 동작이라 돌려줄 리소스가 없다 — { ok: true } 와 이어서 필요한 장부 상태만 온다
  check(
    '★ F-ENT-10 작성 중인 이번 달 기록을 지운다',
    removed.status === 200 && removed.body.ok === true && removed.body.bookStatus === 'OPEN',
    removed.body,
  );

  const gone = await call('GET', `/entries/${dad.entryId}`, { token: dad.token });
  check(
    'F-ENT-10 지운 기록은 줄까지 통째로 사라진다',
    gone.status === 404 && gone.body.code === 'ENTRY_NOT_FOUND',
    gone.body,
  );

  // 짝이 되는 두 케이스 — 지운 달은 바뀌고, 지난 달은 안 바뀐다.
  // 한쪽만 두면 "지워도 합계가 안 바뀐다"가 마치 삭제가 아무 일도 안 하는 것처럼 읽힌다.
  //
  // ⚠️ 되열기(F-ENT-08)가 이미 집계에서 빼내므로, 아래 첫 케이스가 고정하는 것은
  //    "삭제가 합계를 바꿨다"는 인과가 아니라 **지운 뒤의 최종 상태**다 —
  //    지운 사람의 숫자가 유령처럼 요약에 남아 있지 않은지를 본다.
  const thisMonthAfter = await call('GET', thisMonthSummaryPath, { token: dad.token });
  check(
    '★ F-ENT-10 지운 사람은 이번 달 합계에서 빠진다',
    thisMonthAfter.body.totals?.income === thisMonthIncomeBefore - dadIncomeBefore &&
      thisMonthAfter.body.perMember?.find((m) => m.displayName === OWNER)?.submitted === false,
    {
      before: thisMonthIncomeBefore,
      dad: dadIncomeBefore,
      after: thisMonthAfter.body.totals?.income,
    },
  );

  const lastMonthAfter = await call('GET', lastMonthSummaryPath, { token: dad.token });
  check(
    '★ F-ENT-10 이번 달을 지워도 지난달 합계는 그대로다 — 과거를 지우지 않는다',
    lastMonthAfter.body.totals?.income === lastMonthIncomeBefore,
    { before: lastMonthIncomeBefore, after: lastMonthAfter.body.totals?.income },
  );

  const homeAfter = await call('GET', `/families/${dad.familyId}/books/${thisMonth}`, {
    token: dad.token,
  });
  const meAfter = homeAfter.body.members?.find((m) => m.isMe);
  check(
    '★ F-ENT-10 홈이 다시 시작 안 함 으로 돌아간다',
    meAfter?.status === 'NONE' && meAfter?.entryId === null,
    meAfter,
  );

  // plannedAmount 가 null 이 아닌 것만 보면 고정비 등록 금액(FIXED_DEFAULT)으로 채워져도 통과한다.
  // plannedSource 까지 봐야 "지난달 실제 금액 → 없으면 등록 금액"이라는 프리필 우선순위(F-ENT-01)가
  // 지운 뒤에도 살아 있다는 것이 고정된다.
  const dadLastMonthIncome =
    lastMonthAfter.body.perMember?.find((m) => m.displayName === OWNER)?.income ?? 0;
  const restarted = await call('POST', `/families/${dad.familyId}/books/${thisMonth}/my-entry`, {
    token: dad.token,
  });
  const restartedIncome = restarted.body.entry?.lines?.find((l) => l.kind === 'INCOME');
  check(
    '★ F-ENT-10 다시 시작해도 프리필 근거가 지난달 기록이다',
    restarted.status === 200 &&
      restarted.body.entry.id !== dad.entryId &&
      restarted.body.entry.status === 'DRAFT' &&
      restartedIncome?.plannedSource === 'LAST_MONTH' &&
      restartedIncome?.plannedAmount === dadLastMonthIncome,
    { id: restarted.body.entry?.id, status: restarted.body.entry?.status, line: restartedIncome },
  );

  console.log('\n[기타 수입]');
  // ★ F-ENT-12 — 월급 말고 그 달만 들어온 돈. 추가 지출의 수입판이라 기본값도 사유도 없고,
  //   월급 줄은 월급만 남아 다음 달 기본값이 상여금으로 굳지 않는다.
  const incomeEntry = restarted.body.entry;
  const bonus = await call('POST', `/entries/${incomeEntry.id}/lines`, {
    token: dad.token,
    body: { kind: 'EXTRA_INCOME', name: '추석 상여금', actualAmount: 500_000 },
  });
  check(
    '★ F-ENT-12 기타 수입은 분류 없이 이름과 금액으로 적는다',
    bonus.status === 200 &&
      bonus.body.line?.kind === 'EXTRA_INCOME' &&
      bonus.body.line?.category === '수입' &&
      bonus.body.line?.plannedAmount === null &&
      bonus.body.line?.changeReason === null,
    bonus.body,
  );
  const noCategoryExpense = await call('POST', `/entries/${incomeEntry.id}/lines`, {
    token: dad.token,
    body: { name: '분류 없는 지출', actualAmount: 1000 },
  });
  check(
    'F-ENT-12 추가 지출은 여전히 분류가 필수다 — 기타 수입만 예외다',
    noCategoryExpense.status === 400 && noCategoryExpense.body.code === 'VALIDATION',
    noCategoryExpense.body,
  );
  // 가운데 줄을 지우고 다시 적어도 번호가 겹치지 않는다 — 개수가 아니라 마지막 번호 다음이다
  const refund = await call('POST', `/entries/${incomeEntry.id}/lines`, {
    token: dad.token,
    body: { kind: 'EXTRA_INCOME', name: '환급금', actualAmount: 30_000 },
  });
  await call('DELETE', `/entries/${incomeEntry.id}/lines/${bonus.body.line?.id}`, {
    token: dad.token,
  });
  const bonusAgain = await call('POST', `/entries/${incomeEntry.id}/lines`, {
    token: dad.token,
    body: { kind: 'EXTRA_INCOME', name: '추석 상여금', actualAmount: 500_000 },
  });
  check(
    'F-ENT-12 줄을 지우고 다시 적어도 순서 번호가 겹치지 않는다',
    bonusAgain.body.line?.sortOrder > refund.body.line?.sortOrder,
    { refund: refund.body.line?.sortOrder, again: bonusAgain.body.line?.sortOrder },
  );
  await call('DELETE', `/entries/${incomeEntry.id}/lines/${refund.body.line?.id}`, {
    token: dad.token,
  });
  bonus.body.line = bonusAgain.body.line;
  const withBonus = (await call('GET', `/entries/${incomeEntry.id}`, { token: dad.token })).body
    .entry;
  const kinds = withBonus.lines.map((l) => l.kind);
  check(
    'F-ENT-12 기타 수입 줄은 수입 뒤, 고정비 앞에 온다 — 위저드 순서 그대로다',
    kinds.indexOf('EXTRA_INCOME') > kinds.indexOf('INCOME') &&
      kinds.indexOf('EXTRA_INCOME') < kinds.indexOf('FIXED'),
    kinds,
  );
  const homeWithBonus = await call('GET', `/families/${dad.familyId}/books/${thisMonth}`, {
    token: dad.token,
  });
  const bonusLineSteps = withBonus.lines.filter(
    (l) => l.kind === 'FIXED' || l.kind === 'SETTLEMENT',
  ).length;
  check(
    'F-ENT-12 기타 수입은 진행 표시에서 늘 한 스텝이다 (줄 스텝 + 5)',
    homeWithBonus.body.members?.find((m) => m.isMe)?.progress?.total === bonusLineSteps + 5,
    homeWithBonus.body.members?.find((m) => m.isMe)?.progress,
  );

  await fillAndSubmit(dad.token, withBonus, 3_000_000);
  const bonusSummary = (
    await call('GET', `/families/${dad.familyId}/books/${thisMonth}/summary`, { token: dad.token })
  ).body;
  const dadBonus = bonusSummary.perMember?.find((m) => m.displayName === OWNER);
  const dadSalary = withBonus.lines.find((l) => l.kind === 'INCOME');
  check(
    '★ F-ENT-12 수입 = 월급 + 기타 수입이고 기타 수입은 따로도 보인다',
    dadBonus?.extraIncomeTotal === 500_000 &&
      dadBonus?.income === (dadSalary?.actualAmount ?? dadSalary?.plannedAmount ?? 0) + 500_000 &&
      bonusSummary.totals?.extraIncomeTotal === 500_000,
    { dad: dadBonus, totals: bonusSummary.totals },
  );
  check(
    'F-ENT-12 요약에 기타 수입 블록이 따로 실리고, 분류별 지출과 달라진 것에는 안 섞인다',
    bonusSummary.extraIncomes?.length === 1 &&
      bonusSummary.extraIncomes[0].name === '추석 상여금' &&
      bonusSummary.extraIncomes[0].displayName === OWNER &&
      !bonusSummary.byCategory?.some((c) => c.category === '수입') &&
      !bonusSummary.changes?.some((c) => c.kind === 'EXTRA_INCOME'),
    { extraIncomes: bonusSummary.extraIncomes, byCategory: bonusSummary.byCategory },
  );

  // 되돌려 놓는다 — 다음 절이 이번 달 초안을 기대한다. 줄을 지워서 다음 실행에 상여금이 남지 않게 한다
  await call('POST', `/entries/${incomeEntry.id}/reopen`, { token: dad.token });
  const removedBonus = await call(
    'DELETE',
    `/entries/${incomeEntry.id}/lines/${bonus.body.line?.id}`,
    {
      token: dad.token,
    },
  );
  check(
    'F-ENT-12 기타 수입 줄은 그 달 안에서 실제로 지운다',
    removedBonus.status === 200,
    removedBonus.body,
  );

  console.log('\n[지난달 결산]');
  // ★ F-ENT-11 — 지난달에 옮겨둔 돈(결산 스위치가 켜진 고정비)을 실제로 얼마나 썼는지 이번 달 첫 스텝에서 묻는다.
  //   결산 줄은 사유를 안 받고(하드룰 2 의 "차이" 는 계획 대비 변화다), 옮긴 것보다 더 쓴 만큼만 남은 돈에서 뺀다.
  //   여기서 만드는 항목과 줄은 이 절 끝에서 원래대로 돌려놓는다 — 스모크는 몇 번이고 다시 돌 수 있어야 한다.
  const settleGroups = (
    await call('GET', `/families/${dad.familyId}/fixed-expenses`, { token: dad.token })
  ).body.groups;
  const settleMembershipId = settleGroups?.[0]?.membershipId;

  // 지난 실행이 중간에 죽었으면 '결산 …' 항목이 남아 다음 실행을 통째로 흔든다 — 먼저 치운다
  const leftovers = (settleGroups ?? [])
    .flatMap((g) => g.items ?? [])
    .filter((item) => item.name.startsWith('결산 '));
  for (const item of leftovers) {
    await call('PATCH', `/fixed-expenses/${item.id}`, {
      token: dad.token,
      body: { settles: false },
    });
    await call('DELETE', `/fixed-expenses/${item.id}`, { token: dad.token });
  }

  async function addItem(name, category, defaultAmount, settles) {
    const created = await call('POST', `/families/${dad.familyId}/fixed-expenses`, {
      token: dad.token,
      body: { membershipId: settleMembershipId, name, category, defaultAmount, settles },
    });
    return created.body.fixedExpense;
  }
  const s1 = await addItem('결산 생활비', '생활비', 300_000, true); // 지난달 30만 → 결산 대상
  const s2 = await addItem('결산 용돈', '기타', 200_000, true); // 지난달 0원 → 물을 게 없다
  const s3 = await addItem('결산 통신', '통신', 55_000, false); // 스위치 꺼짐 → 안 묻는다
  const s4 = await addItem('결산 나중', '생활비', 100_000, true); // 지난달에 아직 안 적음 → 안 묻는다

  // 지난달 기록을 되열어 새 항목의 줄을 채운다. 줄은 초안일 때만 맞춰지므로 되열고 나서 다시 연다. s4 는 일부러 비워 둔다
  const lastSettleEntryId = (
    await call('POST', `/families/${dad.familyId}/books/${lastMonth}/my-entry`, {
      token: dad.token,
    })
  ).body.entry.id;
  await call('POST', `/entries/${lastSettleEntryId}/reopen`, { token: dad.token });
  const lastSynced = (
    await call('POST', `/families/${dad.familyId}/books/${lastMonth}/my-entry`, {
      token: dad.token,
    })
  ).body.entry;
  const lastLineOf = (item) => lastSynced.lines.find((l) => l.fixedExpenseId === item?.id);
  await call('PATCH', `/entries/${lastSettleEntryId}/lines/${lastLineOf(s1)?.id}`, {
    token: dad.token,
    body: { actualAmount: 300_000 },
  });
  await call('PATCH', `/entries/${lastSettleEntryId}/lines/${lastLineOf(s2)?.id}`, {
    token: dad.token,
    body: { actualAmount: 0, changeReason: '이번 달은 안 옮겼다' },
  });
  await call('PATCH', `/entries/${lastSettleEntryId}/lines/${lastLineOf(s3)?.id}`, {
    token: dad.token,
    body: { actualAmount: 55_000 },
  });

  // 이번 달 초안을 지우고 새로 열어야 결산 줄이 붙는다 — 결산 줄은 기록을 처음 만들 때만 붙는다
  const openSettleEntry = async () => {
    const current = await call('POST', `/families/${dad.familyId}/books/${thisMonth}/my-entry`, {
      token: dad.token,
    });
    const id = current.body.entry.id;
    if (current.body.entry.status !== 'DRAFT') {
      await call('POST', `/entries/${id}/reopen`, { token: dad.token });
    }
    await call('DELETE', `/entries/${id}`, { token: dad.token });
    const fresh = await call('POST', `/families/${dad.familyId}/books/${thisMonth}/my-entry`, {
      token: dad.token,
    });
    return fresh.body.entry;
  };

  const settleEntry = await openSettleEntry();
  const settlementLines = settleEntry.lines.filter((l) => l.kind === 'SETTLEMENT');
  const settlement = settlementLines[0];
  check(
    '★ F-ENT-11 스위치가 켜진 항목의 지난달 금액마다 결산 줄이 하나 생긴다',
    settlementLines.length === 1 && settlement?.fixedExpenseId === s1.id,
    settlementLines,
  );
  check(
    '★ F-ENT-11 결산 줄의 이름·분류는 지난달 줄의 것이고 기본값은 지난달에 옮긴 금액이다 (하드룰 4)',
    settlement?.name === '결산 생활비' &&
      settlement?.category === '생활비' &&
      settlement?.plannedAmount === 300_000 &&
      settlement?.plannedSource === 'LAST_MONTH' &&
      settlement?.actualAmount === null,
    settlement,
  );
  check(
    'F-ENT-11 결산 줄이 수입보다 앞에 온다 — 지난달 이야기를 먼저 끝낸다',
    settleEntry.lines[0]?.kind === 'SETTLEMENT' && settleEntry.lines[1]?.kind === 'INCOME',
    settleEntry.lines.map((l) => l.kind),
  );
  check(
    '★ F-ENT-11 0원을 옮긴 항목 · 스위치가 꺼진 항목 · 지난달에 안 적은 항목은 묻지 않는다',
    !settlementLines.some((l) => [s2.id, s3.id, s4.id].includes(l.fixedExpenseId)),
    settlementLines,
  );
  check(
    'F-ENT-11 결산 줄이 있어도 이번 달 고정비 줄은 그대로 있다 — 둘은 다른 질문이다',
    settleEntry.lines.some((l) => l.kind === 'FIXED' && l.fixedExpenseId === s1.id),
    settleEntry.lines.filter((l) => l.fixedExpenseId === s1.id).map((l) => l.kind),
  );

  // 지난달의 빈 줄을 이제 채우고 다시 제출한다 — 아래 하드룰 6 비교의 기준점
  await call('PATCH', `/entries/${lastSettleEntryId}/lines/${lastLineOf(s4)?.id}`, {
    token: dad.token,
    body: { actualAmount: 100_000 },
  });
  await call('POST', `/entries/${lastSettleEntryId}/submit`, { token: dad.token });
  const lastSummaryPath = `/families/${dad.familyId}/books/${lastMonth}/summary`;
  const lastBeforeSettle = (await call('GET', lastSummaryPath, { token: dad.token })).body;

  const homeWithSettle = await call('GET', `/families/${dad.familyId}/books/${thisMonth}`, {
    token: dad.token,
  });
  const lineSteps = settleEntry.lines.filter(
    (l) => l.kind === 'FIXED' || l.kind === 'SETTLEMENT',
  ).length;
  check(
    'F-ENT-11 결산 줄도 진행 표시의 한 스텝이다',
    homeWithSettle.body.members?.find((m) => m.isMe)?.progress?.total === lineSteps + 5,
    { progress: homeWithSettle.body.members?.find((m) => m.isMe)?.progress, lineSteps },
  );

  const overspent = await call('PATCH', `/entries/${settleEntry.id}/lines/${settlement?.id}`, {
    token: dad.token,
    body: { actualAmount: 350_000 },
  });
  check(
    '★ F-ENT-11 결산 줄은 금액이 달라도 사유 없이 저장된다 — 정정이지 변화가 아니다',
    overspent.status === 200 && overspent.body.line?.changeReason === null,
    overspent.body,
  );
  const reasonIgnored = await call('PATCH', `/entries/${settleEntry.id}/lines/${settlement?.id}`, {
    token: dad.token,
    body: { actualAmount: 350_000, changeReason: '외식이 많았다' },
  });
  check(
    'F-ENT-11 결산 줄에 사유를 보내도 저장하지 않는다 — "이번 달 달라진 것" 에 섞이면 안 된다',
    reasonIgnored.status === 200 && reasonIgnored.body.line?.changeReason === null,
    reasonIgnored.body,
  );

  const settleFilled = (await call('GET', `/entries/${settleEntry.id}`, { token: dad.token })).body
    .entry;
  await fillAndSubmit(dad.token, settleFilled, 3_000_000);
  const thisSummaryPath = `/families/${dad.familyId}/books/${thisMonth}/summary`;
  const overSummary = (await call('GET', thisSummaryPath, { token: dad.token })).body;
  const dadOver = overSummary.perMember?.find((m) => m.displayName === OWNER);
  check(
    '★ F-ENT-11 옮긴 것보다 더 쓴 만큼만 남은 돈에서 빠진다 (30만 옮기고 35만 씀 → 5만)',
    dadOver?.settlementTotal === 50_000 &&
      dadOver?.surplus === dadOver?.income - dadOver?.fixedTotal - dadOver?.extraTotal - 50_000 &&
      overSummary.totals?.settlementTotal === 50_000,
    { dad: dadOver, totals: overSummary.totals },
  );
  check(
    '★ F-ENT-11 결산 금액은 고정비에도 추가 지출에도 섞이지 않는다 — 지난달에 이미 나간 돈이다',
    dadOver?.fixedTotal ===
      settleFilled.lines
        .filter((l) => l.kind === 'FIXED')
        .reduce((sum, l) => sum + (l.actualAmount ?? l.plannedAmount ?? 0), 0) &&
      dadOver?.extraTotal ===
        settleFilled.lines
          .filter((l) => l.kind === 'EXTRA')
          .reduce((sum, l) => sum + (l.actualAmount ?? 0), 0),
    dadOver,
  );
  check(
    'F-ENT-11 요약에 "지난달 결산" 이 따로 실린다',
    overSummary.settlements?.length === 1 &&
      overSummary.settlements[0].displayName === OWNER &&
      overSummary.settlements[0].name === '결산 생활비' &&
      overSummary.settlements[0].planned === 300_000 &&
      overSummary.settlements[0].actual === 350_000 &&
      overSummary.settlements[0].delta === 50_000,
    overSummary.settlements,
  );
  check(
    '★ F-ENT-11 결산 줄은 "이번 달 달라진 것" 에 들어가지 않는다 — 사유가 없는 줄이다',
    !overSummary.changes?.some((c) => c.kind === 'SETTLEMENT'),
    overSummary.changes,
  );
  const livingByCategory = overSummary.byCategory?.find((c) => c.category === '생활비')?.amount;
  const livingFixedThisMonth = overSummary.perMember
    ? settleFilled.lines
        .filter((l) => l.kind === 'FIXED' && l.category === '생활비')
        .reduce((sum, l) => sum + (l.actualAmount ?? l.plannedAmount ?? 0), 0)
    : null;
  check(
    '★ F-ENT-11 분류별 지출에 결산 금액이 두 번 들어가지 않는다',
    livingByCategory === livingFixedThisMonth,
    { byCategory: livingByCategory, fixedOnly: livingFixedThisMonth },
  );
  const trendWithSettle = await call('GET', `/families/${dad.familyId}/trend?months=2`, {
    token: dad.token,
  });
  const thisPoint = trendWithSettle.body.months?.find((m) => m.yearMonth === thisMonth);
  check(
    'F-ENT-11 추이도 같은 규칙으로 센다',
    thisPoint?.settlementTotal === overSummary.totals?.settlementTotal &&
      thisPoint?.surplus === overSummary.totals?.surplus,
    { trend: thisPoint, totals: overSummary.totals },
  );

  // 덜 쓴 달 — 남은 돈이 늘지는 않는다. 안 쓴 돈은 옮겨둔 통장에 그대로 있다
  await call('POST', `/entries/${settleEntry.id}/reopen`, { token: dad.token });
  await call('PATCH', `/entries/${settleEntry.id}/lines/${settlement?.id}`, {
    token: dad.token,
    body: { actualAmount: 250_000 },
  });
  await call('POST', `/entries/${settleEntry.id}/submit`, { token: dad.token });
  const underSummary = (await call('GET', thisSummaryPath, { token: dad.token })).body;
  const dadUnder = underSummary.perMember?.find((m) => m.displayName === OWNER);
  check(
    '★ F-ENT-11 덜 썼다고 남은 돈이 늘지는 않는다 (30만 옮기고 25만 씀 → 0)',
    dadUnder?.settlementTotal === 0 &&
      dadUnder?.surplus === dadUnder?.income - dadUnder?.fixedTotal - dadUnder?.extraTotal &&
      underSummary.settlements?.[0]?.delta === -50_000,
    { dad: dadUnder, settlements: underSummary.settlements },
  );

  const lastAfterSettle = (await call('GET', lastSummaryPath, { token: dad.token })).body;
  check(
    '★ F-ENT-11 결산을 적어도 지난달 장부는 그대로다 — 정정은 이번 달에 적힌다 (하드룰 6)',
    JSON.stringify(lastAfterSettle.totals) === JSON.stringify(lastBeforeSettle.totals) &&
      JSON.stringify(lastAfterSettle.byCategory) === JSON.stringify(lastBeforeSettle.byCategory),
    { before: lastBeforeSettle.totals, after: lastAfterSettle.totals },
  );

  // 안 적으면 제출이 막힌다 — 건너뛰기는 없다. 기본값 그대로 [다음] 을 누르는 것이 곧 확정이다
  await call('POST', `/entries/${settleEntry.id}/reopen`, { token: dad.token });
  const settleAgain = await openSettleEntry();
  const settlementAgain = settleAgain.lines.find((l) => l.kind === 'SETTLEMENT');
  // 결산 줄 하나만 비워 두고 나머지는 전부 채운다
  for (const line of settleAgain.lines) {
    if (line.id === settlementAgain?.id || line.actualAmount !== null) continue;
    await call('PATCH', `/entries/${settleAgain.id}/lines/${line.id}`, {
      token: dad.token,
      body: { actualAmount: line.kind === 'INCOME' ? 3_000_000 : (line.plannedAmount ?? 0) },
    });
  }
  const blocked = await call('POST', `/entries/${settleAgain.id}/submit`, { token: dad.token });
  check(
    '★ F-ENT-11 결산 줄을 안 적으면 제출이 막힌다 — 건너뛰기는 없다',
    blocked.status === 400 && blocked.body.code === 'INCOMPLETE',
    blocked.body,
  );
  await call('PATCH', `/entries/${settleAgain.id}/lines/${settlementAgain?.id}`, {
    token: dad.token,
    body: { actualAmount: settlementAgain?.plannedAmount },
  });
  const confirmed = await call('POST', `/entries/${settleAgain.id}/submit`, { token: dad.token });
  check(
    'F-ENT-11 기본값 그대로 확정하면 통과하고 더 쓴 것은 0 이다',
    confirmed.status === 200 &&
      (await call('GET', `/entries/${settleAgain.id}`, { token: dad.token })).body.entry.summary
        .settlementTotal === 0,
    confirmed.body,
  );

  // 항목을 지워도 지난달에 옮긴 돈은 묻는다 — 얼마나 썼는지는 항목을 지웠다고 없어지는 사실이 아니다
  await call('DELETE', `/fixed-expenses/${s1.id}`, { token: dad.token });
  // 이미 적는 중인 기록에는 안 끼어든다 — 스위치를 나중에 켜도 다음 달부터 묻는다
  await call('PATCH', `/fixed-expenses/${s3.id}`, { token: dad.token, body: { settles: true } });
  await call('POST', `/entries/${settleAgain.id}/reopen`, { token: dad.token });
  const syncedAgain = await call('POST', `/families/${dad.familyId}/books/${thisMonth}/my-entry`, {
    token: dad.token,
  });
  const settlementCountBefore = settleAgain.lines.filter((l) => l.kind === 'SETTLEMENT').length;
  const settlementsAfterSync = syncedAgain.body.entry?.lines.filter((l) => l.kind === 'SETTLEMENT');
  check(
    'F-ENT-11 적는 중인 기록에는 결산 줄이 새로 끼어들지 않는다 — 다음 달부터 묻는다',
    settlementsAfterSync?.length === settlementCountBefore &&
      !settlementsAfterSync.some((l) => l.fixedExpenseId === s3.id),
    settlementsAfterSync,
  );
  const afterDelete = await openSettleEntry();
  const settlementsAfterDelete = afterDelete.lines.filter((l) => l.kind === 'SETTLEMENT');
  check(
    '★ F-ENT-11 항목을 지워도 지난달에 옮긴 돈은 묻는다 · 지난달을 채운 항목은 이제 묻는다 (하드룰 6)',
    settlementsAfterDelete.some((l) => l.fixedExpenseId === s1.id && l.name === '결산 생활비') &&
      settlementsAfterDelete.some((l) => l.fixedExpenseId === s4.id) &&
      settlementsAfterDelete.some((l) => l.fixedExpenseId === s3.id) &&
      !afterDelete.lines.some((l) => l.kind === 'FIXED' && l.fixedExpenseId === s1.id),
    settlementsAfterDelete,
  );

  // 정리 — 지난달 줄을 0 으로 돌리고 항목을 지운 뒤 이번 달 초안을 새로 연다.
  // 지난달 금액이 0 이면 다음 실행에서 결산 줄이 안 생기므로 처음과 같은 상태로 돌아간다
  await call('POST', `/entries/${lastSettleEntryId}/reopen`, { token: dad.token });
  for (const item of [s1, s3, s4]) {
    await call('PATCH', `/entries/${lastSettleEntryId}/lines/${lastLineOf(item)?.id}`, {
      token: dad.token,
      body: { actualAmount: 0, changeReason: '결산 스모크 정리' },
    });
  }
  await call('POST', `/entries/${lastSettleEntryId}/submit`, { token: dad.token });
  for (const item of [s1, s2, s3, s4]) {
    await call('PATCH', `/fixed-expenses/${item.id}`, {
      token: dad.token,
      body: { settles: false },
    });
    await call('DELETE', `/fixed-expenses/${item.id}`, { token: dad.token });
  }
  const settleCleaned = await openSettleEntry();
  check(
    'F-ENT-11 정리 — 다음 실행을 위해 결산 줄 없는 초안으로 돌아간다',
    settleCleaned.status === 'DRAFT' && !settleCleaned.lines.some((l) => l.kind === 'SETTLEMENT'),
    settleCleaned.lines?.map((l) => l.kind),
  );

  console.log('\n[가족 없애기]');
  // 스모크네를 건드리면 안 되므로 이 절은 자기 가족을 따로 만들어 쓰고 마지막에 없앤다.
  const LONER = '스모크외톨이';
  const LONER_FAMILY = '외톨이네';
  const COMPANION = '스모크곁님';
  const lonerToken = await login(LONER);

  // 지난 실행이 중간에 끊겼으면 가족이 남아 있다. 있으면 비우고 없앤 뒤에 시작한다
  for (const stale of (await call('GET', '/me', { token: lonerToken })).body.memberships?.filter(
    (m) => m.family.name === LONER_FAMILY,
  ) ?? []) {
    const detail = await call('GET', `/families/${stale.family.id}`, { token: lonerToken });
    for (const other of detail.body.members?.filter((m) => !m.isMe) ?? []) {
      await call('DELETE', `/families/${stale.family.id}/members/${other.id}`, {
        token: lonerToken,
      });
    }
    await call('DELETE', `/families/${stale.family.id}`, { token: lonerToken });
  }

  const lonerFamily = await call('POST', '/families', {
    token: lonerToken,
    body: { name: LONER_FAMILY, displayName: '외톨이' },
  });
  const lonerFamilyId = lonerFamily.body.family?.id;
  const lonerInviteCode = lonerFamily.body.family?.inviteCode;
  check('F-FAM-11 (준비) 혼자인 가족을 만든다', lonerFamily.status === 200, lonerFamily.body);

  const lonerMe = await call('GET', `/families/${lonerFamilyId}`, { token: lonerToken });
  check(
    'F-FAM-11 가족 상세에 없앨 때 사라지는 것의 수가 실린다',
    typeof lonerMe.body.contents?.months === 'number' &&
      typeof lonerMe.body.contents?.fixedExpenses === 'number',
    lonerMe.body.contents,
  );

  // 홈을 한 번 열기만 해도 MonthlyBook 이 생긴다. 그걸 세면 아무것도 안 적은 사람에게
  // "기록한 달 1개월이 지워져요" 라고 겁을 주게 되므로, 기록이 있는 달만 세는지 본다
  await call('GET', `/families/${lonerFamilyId}/books/${thisMonth}`, { token: lonerToken });
  const lonerAfterPeek = await call('GET', `/families/${lonerFamilyId}`, { token: lonerToken });
  check(
    '★ F-FAM-11 열어보기만 한 달은 "기록한 달"에 들지 않는다',
    lonerAfterPeek.body.contents?.months === 0,
    lonerAfterPeek.body.contents,
  );

  // 위저드를 열면 프리필 줄과 함께 MemberEntry 가 생긴다. 그것도 "기록한 달"이 아니다 —
  // 금액을 한 줄이라도 적어야 잡힌다
  const lonerEntry = (
    await call('POST', `/families/${lonerFamilyId}/books/${thisMonth}/my-entry`, {
      token: lonerToken,
    })
  ).body.entry;
  const lonerAfterOpen = await call('GET', `/families/${lonerFamilyId}`, { token: lonerToken });
  check(
    '★ F-FAM-11 위저드를 열기만 한 달도 "기록한 달"에 안 든다',
    lonerAfterOpen.body.contents?.months === 0,
    lonerAfterOpen.body.contents,
  );

  const lonerIncome = lonerEntry?.lines?.find((l) => l.kind === 'INCOME');
  await call('PATCH', `/entries/${lonerEntry?.id}/lines/${lonerIncome?.id}`, {
    token: lonerToken,
    body: { actualAmount: 1_000_000 },
  });
  const lonerAfterEntry = await call('GET', `/families/${lonerFamilyId}`, { token: lonerToken });
  check(
    'F-FAM-11 한 줄이라도 금액을 적으면 그 달이 잡힌다',
    lonerAfterEntry.body.contents?.months === 1,
    lonerAfterEntry.body.contents,
  );

  // ★ 여기가 이 절의 핵심이다. 막지 않으면 초대코드만 살아 있는 유령 가족이 남고,
  //   그 코드로 들어온 사람은 승인해줄 가족장이 없어 영원히 대기한다
  const lonerMembershipId = lonerMe.body.myMembershipId;
  const soloLeave = await call(
    'DELETE',
    `/families/${lonerFamilyId}/members/${lonerMembershipId}`,
    {
      token: lonerToken,
    },
  );
  check(
    '★ F-FAM-11 혼자 남은 가족장은 나갈 수 없다 — 없애는 것이다',
    soloLeave.status === 400 && soloLeave.body.code === 'LAST_OWNER_MUST_DELETE',
    soloLeave.body,
  );

  // 구성원이 하나 늘면 없애기가 막히고, 나가기는 넘기라는 쪽으로 바뀐다
  const companionToken = await login(COMPANION);
  await call('POST', '/families/join', {
    token: companionToken,
    body: { inviteCode: lonerInviteCode, displayName: '곁님' },
  });
  // 파일 위의 approve() 헬퍼는 main() 안에서 같은 이름의 상수에 가려진다 — 여기서는 직접 부른다
  const lonerRequests = await call('GET', `/families/${lonerFamilyId}/join-requests`, {
    token: lonerToken,
  });
  const companionRequestId = lonerRequests.body.requests?.find((r) => r.displayName === '곁님')?.id;
  const companionApproved = await call(
    'POST',
    `/families/${lonerFamilyId}/join-requests/${companionRequestId}/approve`,
    { token: lonerToken },
  );
  check(
    'F-FAM-11 (준비) 한 사람을 승인해 둘이 된다',
    companionApproved.status === 200,
    companionApproved.body,
  );

  // 나간 사람의 고정비는 목록에 안 보이므로 세어서도 안 된다 — 확인할 길이 없는 숫자다
  const companionMembership = (
    await call('GET', `/families/${lonerFamilyId}`, { token: lonerToken })
  ).body.members?.find((m) => !m.isMe);
  await call('POST', `/families/${lonerFamilyId}/fixed-expenses`, {
    token: companionToken,
    body: {
      membershipId: companionMembership?.id,
      name: '곁님 통신비',
      category: '통신',
      defaultAmount: 30_000,
    },
  });
  const withCompanionItem = await call('GET', `/families/${lonerFamilyId}`, { token: lonerToken });
  check(
    'F-FAM-11 (준비) 곁님의 고정비가 수에 든다',
    withCompanionItem.body.contents?.fixedExpenses === 1,
    withCompanionItem.body.contents,
  );

  const deleteWithMembers = await call('DELETE', `/families/${lonerFamilyId}`, {
    token: lonerToken,
  });
  check(
    '★ F-FAM-11 구성원이 남아 있으면 없앨 수 없다',
    deleteWithMembers.status === 400 && deleteWithMembers.body.code === 'MEMBERS_REMAIN',
    deleteWithMembers.body,
  );

  const deleteByMember = await call('DELETE', `/families/${lonerFamilyId}`, {
    token: companionToken,
  });
  check(
    '★ F-FAM-11 가족장이 아니면 없앨 수 없다',
    deleteByMember.status === 403 && deleteByMember.body.code === 'OWNER_ONLY',
    deleteByMember.body,
  );

  const twoLeave = await call('DELETE', `/families/${lonerFamilyId}/members/${lonerMembershipId}`, {
    token: lonerToken,
  });
  check(
    'F-FAM-11 사람이 있을 때는 넘기라고 한다 — 없애라가 아니라',
    twoLeave.status === 400 && twoLeave.body.code === 'TRANSFER_OWNER_FIRST',
    twoLeave.body,
  );

  // 다시 혼자로 만들고 없앤다
  await call('DELETE', `/families/${lonerFamilyId}/members/${companionMembership?.id}`, {
    token: lonerToken,
  });

  const afterKickOut = await call('GET', `/families/${lonerFamilyId}`, { token: lonerToken });
  check(
    '★ F-FAM-11 나간 사람의 고정비는 수에서 빠진다 — 목록에 없는 것은 안 센다',
    afterKickOut.body.contents?.fixedExpenses === 0,
    afterKickOut.body.contents,
  );

  const familyGone = await call('DELETE', `/families/${lonerFamilyId}`, { token: lonerToken });
  check('★ F-FAM-11 혼자 남은 가족장은 가족을 없앤다', familyGone.status === 200, familyGone.body);

  const goneForOwner = await call('GET', `/families/${lonerFamilyId}`, { token: lonerToken });
  check(
    '★ F-FAM-11 없앤 가족은 만든 사람도 못 본다',
    goneForOwner.status === 403 && goneForOwner.body.code === 'NOT_MEMBER',
    goneForOwner.body,
  );

  const meAfterDelete = await call('GET', '/me', { token: lonerToken });
  check(
    'F-FAM-11 없앤 가족은 내 가족 목록에서 사라진다',
    !meAfterDelete.body.memberships?.some((m) => m.family.id === lonerFamilyId),
    meAfterDelete.body.memberships?.map((m) => m.family.name),
  );

  const codeAfterDelete = await call('POST', '/families/join', {
    token: companionToken,
    body: { inviteCode: lonerInviteCode, displayName: '곁님' },
  });
  check(
    '★ F-FAM-11 없앤 가족의 초대코드는 안 통한다',
    codeAfterDelete.status === 404 && codeAfterDelete.body.code === 'INVITE_CODE_NOT_FOUND',
    codeAfterDelete.body,
  );

  console.log('\n[레이트리밋]');
  // 초대코드를 계속 찍어보는 걸 막는다. 이 검사는 그 사람의 한도를 소진하므로 맨 마지막에 둔다.
  const attacker = await call('POST', '/auth/dev', { body: { name: '침입자' } });
  let limited = null;
  for (let i = 0; i < 15 && !limited; i += 1) {
    const attempt = await call('POST', '/families/join', {
      token: attacker.body.token,
      body: { inviteCode: 'ZZZZZZ', displayName: '침입자' },
    });
    if (attempt.status === 429) limited = attempt;
  }
  check(
    '★ F-FAM-03 초대코드를 연달아 찍으면 막힌다',
    limited?.body?.code === 'RATE_LIMITED',
    limited?.body,
  );

  console.log(
    `\n${failed === 0 ? '✅ 전부 통과' : '❌ 실패 있음'} — ${passed}개 통과, ${failed}개 실패`,
  );
  process.exitCode = failed === 0 ? 0 : 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
