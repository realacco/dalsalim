/**
 * 지금 폰이 **어느 번들을 보고 있는지** 한 줄로 만든다.
 *
 * 왜 필요한가: OTA 는 조용히 도는 물건이다. 발행이 초록이어도 그 번들이 이 폰에 적용됐는지는
 * 앱 밖에서 알 방법이 없고, `expo-updates` 를 앱 코드에서 쓰는 곳이 여태 한 곳도 없었다.
 * 시트 드래그 버그(#20)를 쫓을 때 시간의 절반이 "받은 건 맞나"를 가리느라 샜다.
 * 가족이 "이상해요" 할 때 물어볼 값이기도 하다.
 *
 * 값을 읽는 것은 `shared/ui/build-info` 가 하고, 여기는 **문자열 만들기만** 한다 —
 * 그래야 1층에서 잡힌다.
 */
export function formatBuildInfo({
  version,
  updateId,
  createdAt,
  isEmbedded,
}: {
  /** `app.json` 의 `version` */
  version: string | null;
  /** OTA 로 받은 번들의 id. 내장 번들이면 없다 */
  updateId: string | null;
  /** 그 번들이 발행된 시각 */
  createdAt: Date | null;
  /** APK 에 같이 구워진 번들로 떴는가 */
  isEmbedded: boolean;
}): string {
  const parts: string[] = [];
  if (version) parts.push(`v${version}`);

  if (!isEmbedded && updateId) {
    // 앞 7자리면 사람이 불러주고 받아적기에 충분하다. 전체는 대시까지 36자다
    const short = updateId.slice(0, 7);
    parts.push(createdAt ? `업데이트 ${short} (${formatWhen(createdAt)})` : `업데이트 ${short}`);
  } else {
    // 설치한 APK 에 들어 있던 번들 그대로다 — 아직 OTA 를 안 받았거나, 개발 중이거나
    parts.push('설치한 그대로');
  }

  return parts.join(' · ');
}

/** `9월 8일 20:34`. 연도는 뺀다 — 몇 달 단위로 갈아끼우는 값이라 자리만 차지한다 */
function formatWhen(at: Date): string {
  const minutes = String(at.getMinutes()).padStart(2, '0');
  return `${at.getMonth() + 1}월 ${at.getDate()}일 ${at.getHours()}:${minutes}`;
}
