import { makeStyles } from '@/shared/config/theme-provider';
import { errorMessage } from '@/shared/lib/errors';
import { MESSAGES } from '@/shared/config/messages';
import { Button } from './button';
import { Card } from './card';
import { ErrorText } from './text';

/**
 * 조회가 실패했을 때 화면 자리에 놓는 카드.
 *
 * 빈 화면을 남기지 않는다 — 서버가 죽었을 때 아무것도 안 보이면 사용자는
 * "데이터가 없구나"로 읽고, 다시 적거나 가족에게 없다고 말한다. (M단계 진단 C-1)
 * 무엇이 안 됐는지 한 줄, 그리고 할 수 있는 일(다시 시도) 하나.
 */
export function QueryError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const styles = useStyles();
  return (
    <Card style={styles.card}>
      <ErrorText>{errorMessage(error, MESSAGES.loadFailed)}</ErrorText>
      <Button label={MESSAGES.retry} variant="ghost" onPress={onRetry} />
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  card: { gap: t.space.md },
}));
