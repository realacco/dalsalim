import { Pressable, Text, View } from 'react-native';

import {
  contentsLine,
  type FamilyContents,
  type FamilyDetail,
  formatSettlement,
} from '@/entities/family';
import { makeStyles, useTheme } from '@/shared/config/theme-provider';
import { Button, Card, Divider, ErrorText, Input, Muted } from '@/shared/ui';
import { confirm } from '@/shared/lib/confirm';
import { NAME_MAX_LENGTH } from '@/shared/lib/format';

type Member = FamilyDetail['members'][number];

/** 구성원 목록. 가족장만 남을 다룰 수 있고, 되돌리기 어려운 동작은 항상 확인을 받는다. */
export function MembersCard({
  members,
  familyName,
  contents,
  iAmOwner,
  canLeave,
  ownerExit,
  busy,
  onManage,
  onLeave,
  onDeleteFamily,
  name,
}: {
  members: Member[];
  familyName: string;
  /** 없앨 때 사라지는 것의 수. 확인 다이얼로그가 세어 보여준다 (F-FAM-11) */
  contents: FamilyContents | null;
  iAmOwner: boolean;
  canLeave: boolean;
  /** 가족장이 나가기 전에 할 일. 남은 사람이 있으면 넘기고, 나 혼자면 없앤다 (F-FAM-11) */
  ownerExit: 'handover' | 'delete' | null;
  busy: boolean;
  /** 가족장이 남의 줄에서 [관리] 를 누르면 넘기기·내보내기 시트를 연다 (F-FAM-08 · F-FAM-09) */
  onManage: (membershipId: string) => void;
  onLeave: () => void;
  onDeleteFamily: () => void;
  /** 이 가족 안 내 이름 편집 (F-FAM-07). draft 가 null 이면 편집 중이 아니다 */
  name: {
    draft: string | null;
    error: string | null;
    saving: boolean;
    onEdit: () => void;
    onChange: (next: string) => void;
    onCancel: () => void;
    onSave: () => void;
  };
}) {
  const styles = useStyles();
  const { space } = useTheme();

  return (
    <Card style={{ gap: space.md }}>
      <Text style={styles.cardTitle}>구성원 {members.length}명</Text>
      <Divider />

      {members.map((member) => (
        <View key={member.id} style={styles.member}>
          <View style={styles.memberRow}>
            <View style={styles.memberInfo}>
              <Text style={styles.memberName}>
                {member.displayName}
                {member.isMe ? ' (나)' : ''}
              </Text>
              {/* 남의 정산일 — 언제쯤 적을지 서로 안다 (F-FAM-10) */}
              {member.settlement ? (
                <Text style={styles.memberMeta}>{formatSettlement(member.settlement)}</Text>
              ) : null}
            </View>
            <View style={styles.memberSide}>
              {member.role === 'OWNER' ? <Text style={styles.ownerTag}>가족장</Text> : null}
              {/*
                줄에 붙는 동작은 오른쪽 작은 글자 하나다. 큰 버튼을 줄마다 달면 목록이 버튼 더미가 된다
                (실사용 후기 2026-09-17). 내 이름은 내 줄에서 바꾼다 (F-FAM-07) — 이 가족 안에서만 쓰이는
                이름이라 내 정보가 아니라 여기다. 남의 이름은 가족장도 못 바꾼다
              */}
              {member.isMe && name.draft === null ? (
                <LinkText label="이름 바꾸기" disabled={busy} onPress={name.onEdit} />
              ) : null}
              {iAmOwner && !member.isMe ? (
                <LinkText
                  label="관리"
                  accessibilityLabel={`${member.displayName}님 관리`}
                  disabled={busy}
                  onPress={() => onManage(member.id)}
                />
              ) : null}
            </View>
          </View>

          {member.isMe && name.draft !== null ? (
            <View style={{ gap: space.sm }}>
              <Input
                value={name.draft}
                onChangeText={name.onChange}
                placeholder="아빠"
                maxLength={NAME_MAX_LENGTH}
                autoFocus
              />
              <ErrorText>{name.error}</ErrorText>
              <Muted>이 가족 안에서만 쓰이고, 지난 기록에도 새 이름으로 보여요.</Muted>
              <View style={styles.memberActions}>
                <Button
                  label="취소"
                  variant="ghost"
                  disabled={name.saving}
                  style={{ flex: 1 }}
                  onPress={name.onCancel}
                />
                <Button
                  label="저장"
                  loading={name.saving}
                  style={{ flex: 1 }}
                  onPress={name.onSave}
                />
              </View>
            </View>
          ) : null}
        </View>
      ))}

      <Divider />

      {/*
        가족장은 그냥 못 나간다. 주인 없는 가족이 남기 때문인데, 남은 사람이 있고 없고에 따라
        할 일이 다르다 — 있으면 넘기고, 나 혼자면 나가는 게 아니라 없애는 것이다 (F-FAM-11).
        서버가 막지만 버튼을 눌러보고 나서 알게 되면 늦으므로 여기서 먼저 갈라 보여준다.
      */}
      {ownerExit === 'handover' ? (
        <Muted>
          가족장은 바로 나갈 수 없어요. 구성원 옆 「관리」에서 가족장을 넘긴 뒤에 나갈 수 있어요.
        </Muted>
      ) : ownerExit === 'delete' ? (
        <View style={{ gap: space.sm }}>
          <Muted>구성원이 나 혼자예요. 나가는 대신 가족을 없앨 수 있어요.</Muted>
          <Button
            label="가족 없애기"
            variant="ghost"
            disabled={busy}
            onPress={() =>
              confirm({
                title: '가족 없애기',
                // "정말 삭제하시겠습니까" 보다 세어 보여주는 쪽이 한 번 더 생각하게 만든다
                // 가족 이름 뒤에 이/가 를 붙이지 않는다 — "김씨네가" 와 "우리집이" 로 갈린다
                body: `${familyName} 가족이 사라지고 되돌릴 수 없어요.${contentsLine(contents)}\n초대코드도 못 쓰게 돼요.`,
                confirmLabel: '없애기',
                destructive: true,
                onConfirm: onDeleteFamily,
              })
            }
          />
        </View>
      ) : (
        <Button
          label="가족에서 나가기"
          variant="ghost"
          disabled={busy || !canLeave}
          onPress={() =>
            confirm({
              title: '가족에서 나가기',
              body: '앞으로의 장부에서 빠져요. 지금까지 적은 기록은 그대로 남아요.',
              confirmLabel: '나가기',
              destructive: true,
              onConfirm: onLeave,
            })
          }
        />
      )}
    </Card>
  );
}

/** 줄 오른쪽에 붙는 글자 버튼. 글자만 작고 누르는 자리는 hitSlop 으로 넓힌다 */
function LinkText({
  label,
  accessibilityLabel,
  disabled,
  onPress,
}: {
  label: string;
  accessibilityLabel?: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={12}
      onPress={onPress}
    >
      <Text style={[styles.link, disabled && styles.linkDisabled]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  cardTitle: { ...t.font.bodyLg, fontWeight: t.weight.bold, color: t.colors.ink },
  member: { gap: t.space.sm, paddingVertical: t.space.xs },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: t.space.md,
  },
  // 이름은 20자까지 받는 입력이라 오른쪽 동작을 밀어낼 수 있다 — 줄어드는 쪽은 이름이다
  memberInfo: { gap: t.space.xxs, flexShrink: 1 },
  memberSide: { flexDirection: 'row', alignItems: 'center', gap: t.space.md, flexShrink: 0 },
  link: { ...t.font.body, fontWeight: t.weight.semibold, color: t.colors.primary },
  linkDisabled: { opacity: t.opacity.disabled },
  memberActions: { flexDirection: 'row', gap: t.space.sm },
  memberName: { ...t.font.body, fontWeight: t.weight.bold, color: t.colors.ink },
  memberMeta: { ...t.font.caption, color: t.colors.inkFaint },
  ownerTag: {
    ...t.font.caption,
    fontWeight: t.weight.bold,
    color: t.colors.primary,
    backgroundColor: t.colors.primarySoft,
    paddingHorizontal: t.space.md,
    paddingVertical: t.space.xs,
    borderRadius: t.radius.pill,
    overflow: 'hidden',
  },
}));
