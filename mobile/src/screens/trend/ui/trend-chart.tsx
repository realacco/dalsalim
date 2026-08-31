import { useMemo, useState } from 'react';
import { LayoutChangeEvent, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import type { TrendPoint } from '@/entities/book';
import { makeStyles, useTheme } from '@/shared/config/theme-provider';
import { formatMonthShort } from '@/shared/lib/format';

const HEIGHT = 190;
const PAD_TOP = 14;
const PAD_BOTTOM = 24;
/** 양 끝 점이 반쯤 잘리지 않게 하는 좌우 여백 (점 반지름 + 선 두께) */
const PAD_X = 6;

type SeriesKey = 'income' | 'fixedTotal' | 'surplus';

/**
 * 라인 3개짜리 추이 차트. 차트 라이브러리를 얹지 않고 react-native-svg 로 직접 그린다 —
 * 선 셋에 라이브러리를 들일 이유가 없고, Expo Go 런타임에 이미 있는 것이라 prebuild 도 안 는다.
 */
export function TrendChart({ points }: { points: TrendPoint[] }) {
  const styles = useStyles();
  const { colors, space } = useTheme();
  const [width, setWidth] = useState(0);

  // 색이 테마에 따라 바뀌므로 모듈 최상단에 굳히면 다크 모드에서 옛 색이 남는다
  const series = useMemo(
    () =>
      [
        { key: 'income' as SeriesKey, label: '수입', color: colors.chartIncome },
        { key: 'fixedTotal' as SeriesKey, label: '고정비', color: colors.chartFixed },
        { key: 'surplus' as SeriesKey, label: '남은 돈', color: colors.chartSurplus },
      ] as const,
    [colors],
  );

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  // 남은 돈은 음수일 수 있다. 0 을 바닥으로 고정하면 적자가 선 밖으로 나간다.
  const values = points.flatMap((p) => [p.income, p.fixedTotal, p.surplus]);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;

  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const plotWidth = Math.max(width - PAD_X * 2, 1);
  const x = (index: number) =>
    points.length === 1 ? width / 2 : PAD_X + (index / (points.length - 1)) * plotWidth;
  const y = (value: number) => PAD_TOP + (1 - (value - min) / span) * plotHeight;

  return (
    <View style={{ gap: space.md }}>
      <View onLayout={onLayout} style={{ height: HEIGHT }}>
        {width > 0 ? (
          <Svg width={width} height={HEIGHT}>
            {/* 0원 기준선 — 남은 돈이 아래로 내려가면 적자다 */}
            {min < 0 ? (
              <Line
                x1={0}
                y1={y(0)}
                x2={width}
                y2={y(0)}
                stroke={colors.lineStrong}
                strokeDasharray="4 4"
                strokeWidth={1}
              />
            ) : null}

            {series.map((s) => (
              <Polyline
                key={s.key}
                points={points.map((p, i) => `${x(i)},${y(p[s.key])}`).join(' ')}
                fill="none"
                stroke={s.color}
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}

            {series.map((s) =>
              points.map((p, i) => (
                <Circle
                  key={`${s.key}-${p.yearMonth}`}
                  cx={x(i)}
                  cy={y(p[s.key])}
                  r={3.5}
                  fill={colors.surface}
                  stroke={s.color}
                  strokeWidth={2.5}
                />
              )),
            )}
          </Svg>
        ) : null}
      </View>

      <View style={styles.months}>
        {points.map((p) => (
          <Text key={p.yearMonth} style={styles.monthLabel}>
            {formatMonthShort(p.yearMonth)}
          </Text>
        ))}
      </View>

      <View style={styles.legend}>
        {series.map((s) => (
          <View key={s.key} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: s.color }]} />
            <Text style={styles.legendLabel}>{s.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  months: { flexDirection: 'row', justifyContent: 'space-between' },
  monthLabel: { ...t.font.caption, color: t.colors.inkFaint },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: t.space.lg },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: t.space.xs },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { ...t.font.caption, color: t.colors.inkSoft },
}));
