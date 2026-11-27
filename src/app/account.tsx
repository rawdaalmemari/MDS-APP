import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { BackIcon } from '../components/icons';
import { Avatar, Body, Button, Card, ErrorBox, H1, H2, Label } from '../components/ui';
import { Screen } from '../components/ui';
import { friendlyError, inviteStaff } from '../lib/api';
import { useAuth } from '../lib/auth';
import { startOfficeGeofence } from '../lib/location';
import { colors, fonts } from '../lib/theme';
import { initials } from '../lib/time';

export default function Account() {
  const { profile, session, signOut } = useAuth();
  const [reminders, setReminders] = useState<'on' | 'no-permission' | 'no-office' | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.role === 'staff') startOfficeGeofence().then(setReminders).catch(() => setReminders('no-permission'));
  }, [profile]);

  if (!profile) return null;

  async function invite() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await inviteStaff(name.trim(), email.trim());
      setMsg(`Invite sent to ${email.trim()}. They can sign in with their email once they accept it.`);
      setName('');
      setEmail('');
    } catch (e) {
      setErr(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
        <BackIcon />
        <Text style={styles.backText}>Back</Text>
      </Pressable>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Avatar text={initials(profile.full_name)} size={56} />
        <View>
          <H1 style={{ fontSize: 24 }}>{profile.full_name}</H1>
          <Body muted size={14}>
            {profile.role === 'ceo' ? 'CEO' : 'Staff'} · {session?.user.email}
          </Body>
        </View>
      </View>

      {profile.role === 'staff' && (
        <Card style={{ gap: 8 }}>
          <Label>Arrival and leaving reminders</Label>
          <Body size={14}>
            {reminders === 'on'
              ? 'On. You’ll get a reminder to clock in when you’re near the studio, and to clock out when you leave.'
              : reminders === 'no-office'
                ? 'The studio location hasn’t been set yet.'
                : 'Off. Allow location “Always” in your phone’s Settings so reminders and automatic clock-out work.'}
          </Body>
        </Card>
      )}

      {profile.role === 'ceo' && (
        <Card style={{ gap: 12 }}>
          <H2>Add a staff member</H2>
          <Body muted size={14}>They’ll get an email invite, then sign in with a code sent to that email.</Body>
          <TextInput value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor={colors.muted} style={styles.input} accessibilityLabel="Full name" />
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            placeholderTextColor={colors.muted}
            style={styles.input}
            accessibilityLabel="Email"
          />
          {err && <ErrorBox message={err} />}
          {msg && <Body size={14} style={{ color: colors.approvedFg }}>{msg}</Body>}
          <Button title="Send invite" onPress={invite} loading={busy} disabled={!name.trim() || !email.includes('@')} />
        </Card>
      )}

      <Button title="Sign out" variant="ghost" onPress={signOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, alignSelf: 'flex-start', marginTop: 8 },
  backText: { fontFamily: fonts.bold, fontSize: 15, color: colors.maroon },
  input: {
    height: 50, borderRadius: 12, borderWidth: 1.5, borderColor: '#DCCDBE', backgroundColor: '#FFFFFF',
    paddingHorizontal: 12, fontFamily: fonts.body, fontSize: 16, color: colors.plum,
  },
});
