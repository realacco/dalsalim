// 기능: F-SES-03
import { Redirect } from 'expo-router';
import { Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { familyKeys, fetchMyPendingRequests } from '@/entities/family';
import { makeStyles } from '@/shared/config/theme-provider';
import { useSession } from '@/entities/session';
import { Loading, QueryError } from '@/shared/ui';

/**
 * 앱을 열면 여기로 온다. 토큰과 가족 유무만 보고 갈 곳을 정한다.
 *   서버에 못 닿음    → 여기서 [다시 시도] (로그인은 안 풀린다)
 *   토큰 없음        → 로그인
 *   승인 대기 중     → 대기 화면
 *   가족 없음        → 가족 만들기/참여
 *   가족 있음        → 이번 달
 */
export default function Gate() {
  const styles = useStyles();
  const { ready, token, me, bootError, hydrate } = useSession();

  const noFamily = Boolean(token) && me !== null && me.memberships.length === 0;

  // 훅은 조건 바깥에서 부른다 — 아래 early return 뒤에 두면 렌더마다 훅 개수가 달라진다
  const pending = useQuery({
    queryKey: familyKeys.myPending(),
    queryFn: fetchMyPendingRequests,
    enabled: noFamily,
  });

  // 가족이 없는 사람은 "승인 대기 중"일 수 있다. 확인 전에 온보딩으로 보내면
  // 이미 요청해 둔 사람이 초대코드 화면을 다시 만나 또 요청하게 된다.
  const undecided = !ready || (noFamily && pending.isLoading);

  if (undecided) {
    return (
      <View style={styles.splash}>
        <Text style={styles.logo}>달살림</Text>
        <Text style={styles.tagline}>우리 가족, 한 달 살림을 같이 적는다</Text>
        <Loading />
      </View>
    );
  }

  // 대기 목록을 못 받았으면 어디로 보낼지 모른다. 온보딩으로 보내면 이미 요청한 사람이
  // 초대코드 화면을 다시 만나 또 요청한다 — 보내지 말고 여기서 다시 시도하게 한다
  if (noFamily && pending.isError) {
    return (
      <View style={styles.splash}>
        <Text style={styles.logo}>달살림</Text>
        <View style={styles.errorBox}>
          <QueryError error={pending.error} onRetry={() => void pending.refetch()} />
        </View>
      </View>
    );
  }

  /*
    토큰은 있는데 켤 때 /me 가 401 이 아닌 이유로 실패했다 (#67). 어디로도 보내지 않는다 —
    로그인으로 보내면 멀쩡한 로그인이 풀린 것처럼 보이고, 온보딩으로 보내면 가족이 있는 사람이
    가족 만들기를 만난다. 무엇이 안 됐는지(주소가 붙은 네트워크 문장)와 다시 시도만 보여준다
  */
  if (token && bootError) {
    return (
      <View style={styles.splash}>
        <Text style={styles.logo}>달살림</Text>
        <View style={styles.errorBox}>
          <QueryError error={bootError} onRetry={() => void hydrate()} />
        </View>
      </View>
    );
  }

  if (!token) return <Redirect href="/login" />;

  if (noFamily) {
    return <Redirect href={pending.data && pending.data.length > 0 ? '/pending' : '/onboarding'} />;
  }

  if (!me) return <Redirect href="/onboarding" />;

  return <Redirect href="/(tabs)" />;
}

const useStyles = makeStyles((t) => ({
  splash: {
    flex: 1,
    backgroundColor: t.colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.space.sm,
  },
  logo: { ...t.font.display, fontWeight: t.weight.heavy, color: t.colors.ink },
  tagline: { ...t.font.small, color: t.colors.inkFaint, marginBottom: t.space.xl },
  errorBox: { alignSelf: 'stretch', paddingHorizontal: t.space.xl, marginTop: t.space.xl },
}));
