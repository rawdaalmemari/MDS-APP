import { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, radius } from '../lib/theme';

export function Screen({
  children,
  refreshing,
  onRefresh,
  header,
  scroll = true,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  header?: ReactNode;
  scroll?: boolean;
}) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {header}
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.maroon} /> : undefined}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, { flex: 1 }]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function H1(props: TextProps) {
  return <Text accessibilityRole="header" {...props} style={[styles.h1, props.style]} />;
}

export function H2(props: TextProps) {
  return <Text accessibilityRole="header" {...props} style={[styles.h2, props.style]} />;
}

export function Label(props: TextProps) {
  return <Text {...props} style={[styles.label, props.style]} />;
}

export function Body(props: TextProps & { muted?: boolean; bold?: boolean; size?: number }) {
  const { muted, bold, size, style, ...rest } = props;
  return (
    <Text
      {...rest}
      style={[styles.body, muted && { color: colors.muted }, bold && { fontFamily: fonts.bold }, size ? { fontSize: size } : null, style]}
    />
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

type Variant = 'primary' | 'dark' | 'ghost' | 'danger' | 'accent' | 'light';

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  small,
  icon,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const v = variants[variant];
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: v.bg, borderColor: v.border ?? v.bg },
        pressed && { opacity: 0.85 },
        off && { opacity: 0.6 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={v.fg} /> : icon}
      <Text style={[styles.buttonText, small && { fontSize: 14 }, { color: v.fg }]}>{title}</Text>
    </Pressable>
  );
}

const variants: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.maroon, fg: '#FFFFFF' },
  dark: { bg: colors.plum, fg: '#FFFFFF' },
  ghost: { bg: colors.chip, fg: colors.plum },
  danger: { bg: '#FFFFFF', fg: colors.rejectedFg, border: colors.rejectedFg },
  accent: { bg: colors.orange, fg: colors.plum },
  light: { bg: colors.cream, fg: colors.plum },
};

type Tone = 'pending' | 'approved' | 'rejected' | 'neutral' | 'in' | 'dark';
const tones: Record<Tone, { bg: string; fg: string }> = {
  pending: { bg: colors.pendingBg, fg: colors.pendingFg },
  approved: { bg: colors.approvedBg, fg: colors.approvedFg },
  rejected: { bg: colors.rejectedBg, fg: colors.rejectedFg },
  neutral: { bg: colors.chip, fg: colors.text2 },
  in: { bg: colors.softRose, fg: colors.maroonDark },
  dark: { bg: colors.plum, fg: colors.cream },
};

export function Badge({ text, tone = 'neutral', style }: { text: string; tone?: Tone; style?: StyleProp<ViewStyle> }) {
  const t = tones[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }, style]}>
      <Text style={[styles.badgeText, { color: t.fg }]}>{text}</Text>
    </View>
  );
}

export function Avatar({ text, size = 40 }: { text: string; size?: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.35 }]}>{text}</Text>
    </View>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export function ListRow({ children, first, style }: { children: ReactNode; first?: boolean; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.listRow, first && { borderTopWidth: 0 }, style]}>{children}</View>;
}

export function ErrorBox({ message, style }: { message: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View accessibilityRole="alert" style={[styles.error, style]}>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

export function Loading() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream }}>
      <ActivityIndicator color={colors.maroon} size="large" />
    </View>
  );
}

export const text: Record<string, TextStyle> = {
  bigNumber: { fontFamily: fonts.display, fontSize: 30, color: colors.plum, lineHeight: 34 },
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32, gap: 16 },
  h1: { fontFamily: fonts.display, fontSize: 28, color: colors.plum },
  h2: { fontFamily: fonts.display, fontSize: 20, color: colors.plum },
  label: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 0.7, textTransform: 'uppercase', color: colors.muted },
  body: { fontFamily: fonts.body, fontSize: 15, color: colors.plum, lineHeight: 21 },
  card: { backgroundColor: colors.card, borderColor: colors.line, borderWidth: 1, borderRadius: radius.card, padding: 16 },
  button: {
    minHeight: 50,
    borderRadius: radius.button,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
  },
  buttonSmall: { minHeight: 44, paddingHorizontal: 14, borderRadius: 10 },
  buttonText: { fontFamily: fonts.bold, fontSize: 16 },
  badge: { height: 24, paddingHorizontal: 9, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  badgeText: { fontFamily: fonts.bold, fontSize: 12 },
  avatar: { borderRadius: radius.pill, backgroundColor: colors.softRose, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.bold, color: colors.maroonDark },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.divider },
  error: { backgroundColor: colors.errorBg, borderRadius: 12, padding: 12 },
  errorText: { fontFamily: fonts.body, color: colors.errorFg, fontSize: 14, lineHeight: 20 },
});
