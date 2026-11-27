import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../lib/auth';
import { colors, fonts } from '../lib/theme';
import { initials } from '../lib/time';
import { useUnread } from '../lib/useUnread';
import { BellIcon, LogoMark } from './icons';

export function BrandHeader() {
  const unread = useUnread();
  const { profile } = useAuth();
  return (
    <View style={styles.wrap}>
      <View style={styles.brand}>
        <LogoMark height={18} />
        <View>
          <Text style={styles.name}>MUNAZURI</Text>
          <Text style={styles.sub}>Design Studio</Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Link href="/notifications" asChild>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={unread ? `Notifications, ${unread} unread` : 'Notifications'}
            style={styles.iconBtn}
          >
            <BellIcon />
            {unread > 0 && (
              <View style={styles.dot}>
                <Text style={styles.dotText}>{unread > 9 ? '9+' : unread}</Text>
              </View>
            )}
          </Pressable>
        </Link>
        <Link href="/account" asChild>
          <Pressable accessibilityRole="button" accessibilityLabel="Account" style={styles.me}>
            <Text style={styles.meText}>{profile ? initials(profile.full_name) : ''}</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { fontFamily: fonts.display, fontSize: 16, letterSpacing: 1, color: colors.plum, lineHeight: 18 },
  sub: { fontFamily: fonts.display, fontSize: 10, letterSpacing: 3.2, color: colors.muted },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  dot: {
    position: 'absolute', top: 5, right: 4, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9,
    backgroundColor: colors.orange, borderWidth: 2, borderColor: colors.cream, alignItems: 'center', justifyContent: 'center',
  },
  dotText: { fontFamily: fonts.bold, fontSize: 10, color: colors.plum },
  me: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.plum, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  meText: { fontFamily: fonts.bold, fontSize: 13, color: colors.cream },
});
