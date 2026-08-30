import { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import type { TrendPoint } from '@/entities/book';
import { colors, font, space } from '@/shared/config/theme';
import { formatMonthShort } from '@/shared/lib/format';

const HEIGHT = 180;
const PAD_TOP = 12;
const PAD_BOTTOM = 22;

type Series = { key: 'income' | 'fixedTotal' | 'surplus'; label: string; color: string };

const SERIES: Series[] = [
  { key: 'income', label: '수입', color: colors.chartIncome },
  { key: 'fixedTotal', label: '고정비', color: colors.chartFixed },
  { key: 'surplus', label: '남은 돈', color: colors.chartSurplus },
];

/**
 * 라인 3개짜리 추이 차트. 차트 라이브러리를 얹지 않고 react-native-svg 로 직접 그린다 —
 * 선 셋에 라이브러리를 들일 이유가 없고, Expo Go 런타임에 이미 있는 것이라 prebuild 도 안 는다.
 */
export function TrendChart({ points }: { points: TrendPoint[] }) {
  const [width, setWidth] = useState(0);

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  // 남은 돈은 음수일 수 있다. 0 을 바닥으로 고정하면 적자가 선 밖으로 나간다.
  const values = points.flatMap((p) => [p.income, p.fixedTotal, p.surplus]);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;

  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const x = (index: number) =>
    points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
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

            {SERIES.map((series) => (
              <Polyline
                key={series.key}
                points={points.map((p, i) => `${x(i)},${y(p[series.key])}`).join(' ')}
                fill="none"
                stroke={series.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}

            {SERIES.map((series) =>
              points.map((p, i) => (
                <Circle
                  key={`${series.key}-${p.yearMonth}`}
                  cx={x(i)}
                  cy={y(p[series.key])}
                  r={3}
                  fill={colors.surface}
                  stroke={series.color}
                  strokeWidth={2}
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
        {SERIES.map((series) => (
          <View key={series.key} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: series.color }]} />
            <Text style={styles.legendLabel}>{series.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  months: { flexDirection: 'row', justifyContent: 'space-between' },
  monthLabel: { ...font.caption, color: colors.inkFaint },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: space.lg },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { ...font.caption, color: colors.inkSoft },
});
