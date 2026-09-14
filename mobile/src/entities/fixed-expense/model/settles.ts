/**
 * 결산 스위치의 기본값 — server/src/lib/shared.ts 의 defaultSettles() 를 그대로 옮긴 것이다.
 *
 * 등록 시트에서 분류를 고르는 순간 스위치가 따라 켜지게 하려는 UX 용 사본이다.
 * 저장할 때 서버가 같은 규칙으로 다시 정하므로 여기가 틀려도 저장값은 안 틀리지만,
 * 화면과 저장값이 갈리면 "켜 놨는데 꺼져 있다"가 된다. tests/contract 가 둘을 맞춰본다.
 */
export function defaultSettles(category: string): boolean {
  return category === '생활비';
}
