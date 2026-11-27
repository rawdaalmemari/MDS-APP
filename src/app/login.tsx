import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LogoMark } from '../components/icons';
import { Body, Button, ErrorBox } from '../components/ui';
import { supabase } from '../lib/supabase';
import { colors, fonts } from '../lib/theme';

// Staff sign in with a 6-digit code sent to their email. Nobody can sign up on their own:
// the CEO adds people from the Account screen.
export default function Login() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: false } });
    setBusy(false);
    if (error) setError(error.message.includes('Signups not allowed') ? 'This email isn’t registered. Ask the CEO to add you.' : error.message);
    else setStep('code');
  }

  async function verify() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) setError('That code didn’t work. Check it, or send a new one.');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
        <View style={styles.brand}>
          <LogoMark height={44} />
          <Text style={styles.name}>MUNAZURI</Text>
          <Text style={styles.sub}>Design Studio</Text>
        </View>

        <View style={{ gap: 14 }}>
          {step === 'email' ? (
            <>
              <Text style={styles.fieldLabel}>Work email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                placeholder="name@munazuri.ae"
                placeholderTextColor={colors.muted}
                style={styles.input}
                accessibilityLabel="Work email"
              />
              <Button title="Send me a sign-in code" onPress={sendCode} loading={busy} disabled={!email.includes('@')} />
            </>
          ) : (
            <>
              <Body muted>We sent a 6-digit code to {email}.</Body>
              <TextInput
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                maxLength={6}
                placeholder="123456"
                placeholderTextColor={colors.muted}
                style={[styles.input, { letterSpacing: 8, textAlign: 'center', fontSize: 22 }]}
                accessibilityLabel="Sign-in code"
              />
              <Button title="Sign in" onPress={verify} loading={busy} disabled={code.trim().length < 6} />
              <Button title="Use a different email" variant="ghost" onPress={() => setStep('email')} />
            </>
          )}
          {error && <ErrorBox message={error} />}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  wrap: { flex: 1, padding: 24, justifyContent: 'center', gap: 48 },
  brand: { alignItems: 'center', gap: 6 },
  name: { fontFamily: fonts.display, fontSize: 34, letterSpacing: 3, color: colors.plum, marginTop: 14 },
  sub: { fontFamily: fonts.display, fontSize: 13, letterSpacing: 6, color: colors.muted },
  fieldLabel: { fontFamily: fonts.medium, fontSize: 14, color: colors.text2 },
  input: {
    height: 52, borderRadius: 12, borderWidth: 1.5, borderColor: '#DCCDBE', backgroundColor: '#FFFFFF',
    paddingHorizontal: 14, fontFamily: fonts.body, fontSize: 16, color: colors.plum,
  },
});
