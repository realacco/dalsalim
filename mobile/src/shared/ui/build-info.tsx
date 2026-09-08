import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { Text, View } from 'react-native';

import { makeStyles } from '@/shared/config/theme-provider';
import { formatBuildInfo } from '@/shared/lib/build-info';

/**
 * 지금 폰이 어느 번들을 보고 있는지 알려주는 한 줄. 화면 맨 아래에 조용히 둔다.
 *
 * OTA 는 조용히 도는 물건이라, 이게 없으면 "안 바뀐 건지 · 안 받은 건지 · 받고 아직
 * 적용이 안 된 건지"를 가릴 수가 없다 (#20 에서 실제로 반나절이 샜다).
 * 가족이 "이상해요" 할 때 물어볼 값이기도 하다.
 *
 * 문장 만들기는 `shared/lib/build-info` 에 있다 — 여기는 **값을 읽어오기만** 한다.
 */
export function BuildInfo() {
  const styles = useStyles();
  const line = read();

  // 읽을 게 없으면 여백도 남기지 않는다 — 진단용 한 줄이 화면을 건드리면 안 된다
  if (!line) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>{line}</Text>
    </View>
  );
}

/**
 * ⚠️ try/catch 로 감싼다. 이 값들은 네이티브 모듈에서 오는데, Expo Go 나 웹처럼
 * 업데이트가 꺼진 환경에서는 읽는 것만으로 던질 수 있다.
 * **진단용 한 줄 때문에 가족 탭이 통째로 안 뜨면 본말전도다.**
 */
function read(): string {
  try {
    return formatBuildInfo({
      version: Constants.expoConfig?.version ?? null,
      updateId: Updates.updateId,
      createdAt: Updates.createdAt,
      isEmbedded: Updates.isEmbeddedLaunch,
    });
  } catch {
    return '';
  }
}

const useStyles = makeStyles((t) => ({
  wrap: { alignItems: 'center', paddingTop: t.space.md },
  text: { ...t.font.caption, color: t.colors.inkFaint },
}));
