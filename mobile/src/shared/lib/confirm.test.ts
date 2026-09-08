import { beforeEach, describe, expect, it, vi } from 'vitest';

import { type ConfirmOptions, confirm, setConfirmHandler } from './confirm';

const options: ConfirmOptions = {
  title: '고정비 지우기',
  body: '앞으로의 기록에서 빠져요.',
  confirmLabel: '지우기',
  destructive: true,
  onConfirm: () => {},
};

/** 등록은 모듈 전역이라 케이스마다 비우고 시작한다 */
beforeEach(() => {
  setConfirmHandler(() => {})();
  vi.restoreAllMocks();
});

describe('confirm', () => {
  it('등록된 호스트로 물어볼 내용을 넘긴다', () => {
    const host = vi.fn();
    setConfirmHandler(host);

    confirm(options);

    expect(host).toHaveBeenCalledWith(options);
  });

  it('나중에 등록한 호스트가 이긴다', () => {
    const old = vi.fn();
    const fresh = vi.fn();
    setConfirmHandler(old);
    setConfirmHandler(fresh);

    confirm(options);

    expect(old).not.toHaveBeenCalled();
    expect(fresh).toHaveBeenCalledOnce();
  });

  it('해제하면 더 넘기지 않는다', () => {
    const host = vi.fn();
    const release = setConfirmHandler(host);
    release();

    confirm(options);

    expect(host).not.toHaveBeenCalled();
  });

  /**
   * 언마운트가 다음 마운트보다 늦게 도는 순서가 실제로 있다.
   * 그때 옛 호스트의 해제 함수가 새 호스트를 지워버리면, 그 뒤로 모든 확인이 조용히 사라진다.
   */
  it('옛 호스트의 해제는 새 호스트를 지우지 않는다', () => {
    const old = vi.fn();
    const fresh = vi.fn();
    const releaseOld = setConfirmHandler(old);
    setConfirmHandler(fresh);

    releaseOld();
    confirm(options);

    expect(fresh).toHaveBeenCalledOnce();
  });

  it('호스트가 없으면 터지지 않고 경고만 남긴다', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(() => confirm(options)).not.toThrow();
    expect(warn).toHaveBeenCalledOnce();
  });
});
