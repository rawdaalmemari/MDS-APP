import { CameraView, useCameraPermissions } from 'expo-camera';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, ErrorBox } from '../components/ui';
import { endTrip, friendlyError, startTrip, uploadFuelPhoto } from '../lib/api';
import { useMe } from '../lib/auth';
import { colors, fonts } from '../lib/theme';

const DARK = '#1C171B';

export default function FuelPhoto() {
  const me = useMe();
  const { mode, carId, tripId } = useLocalSearchParams<{ mode: 'start' | 'end'; carId?: string; tripId?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [photo, setPhoto] = useState<{ uri: string; base64: string } | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const starting = mode !== 'end';

  async function shoot() {
    setError(null);
    try {
      const shot = await camera.current?.takePictureAsync({ quality: 0.8, shutterSound: false });
      if (!shot) return;
      // Shrink to keep uploads quick on mobile data.
      const ref = await ImageManipulator.manipulate(shot.uri).resize({ width: 1080 }).renderAsync();
      const saved = await ref.saveAsync({ compress: 0.6, format: SaveFormat.JPEG, base64: true });
      setPhoto({ uri: saved.uri, base64: saved.base64! });
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  async function confirm() {
    if (!photo) return;
    setBusy(true);
    setError(null);
    try {
      const path = await uploadFuelPhoto(me.id, photo.base64);
      if (starting) await startTrip(Number(carId), path, reason.trim());
      else await endTrip(Number(tripId), path);
      router.back();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.top}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.cancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Text style={styles.title}>{starting ? 'Start of trip' : 'End of trip'}</Text>
        <View style={{ width: 72 }} />
      </View>

      <View style={styles.middle}>
        <View style={[styles.frame, photo && { borderColor: colors.orange }]}>
          {photo ? (
            <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityLabel="Fuel gauge photo" />
          ) : permission?.granted ? (
            <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" />
          ) : (
            <View style={styles.permission}>
              <Text style={styles.hint}>Munazuri needs the camera to photograph the fuel gauge.</Text>
              <Button title="Allow camera" variant="accent" onPress={requestPermission} />
            </View>
          )}
        </View>
        <Text style={styles.hint}>
          {photo ? 'Check that the needle is clear, then continue.' : 'Point the camera at the fuel gauge so the needle is clearly visible.'}
        </Text>
      </View>

      <View style={styles.bottom}>
        {error && <ErrorBox message={error} />}
        {!photo && permission?.granted && (
          <View style={{ alignItems: 'center' }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Take photo" onPress={shoot} style={styles.shutter} />
          </View>
        )}
        {photo && starting && (
          <View style={{ gap: 6 }}>
            <Text style={styles.label}>Where are you going? (optional)</Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="e.g. Client meeting, Business Bay"
              placeholderTextColor="#9C8F95"
              style={styles.input}
              accessibilityLabel="Where are you going?"
            />
          </View>
        )}
        {photo && (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title="Retake" variant="dark" onPress={() => setPhoto(null)} style={{ flex: 1, backgroundColor: '#3A3036', borderColor: '#3A3036' }} />
            <Button title={starting ? 'Start trip' : 'End trip'} onPress={confirm} loading={busy} style={{ flex: 2 }} />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: DARK },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  cancel: { minHeight: 44, minWidth: 72, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#3A3036' },
  cancelText: { fontFamily: fonts.bold, color: '#FFFFFF', fontSize: 14, textAlign: 'center' },
  title: { fontFamily: fonts.bold, color: '#FFFFFF', fontSize: 16 },
  middle: { flex: 1, paddingHorizontal: 20, justifyContent: 'center', gap: 14 },
  frame: { aspectRatio: 3 / 4, borderRadius: 20, overflow: 'hidden', borderWidth: 2, borderColor: '#4A3F45', backgroundColor: '#2C2429' },
  permission: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  hint: { fontFamily: fonts.body, color: '#CDBFC5', fontSize: 14, textAlign: 'center' },
  bottom: { paddingHorizontal: 20, paddingBottom: 16, gap: 12 },
  shutter: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#FFFFFF', borderWidth: 4, borderColor: '#5A4D54' },
  label: { fontFamily: fonts.medium, color: '#EADFE3', fontSize: 14 },
  input: {
    height: 50, borderRadius: 12, borderWidth: 1.5, borderColor: '#4A3F45', backgroundColor: '#2C2429',
    paddingHorizontal: 12, color: '#FFFFFF', fontFamily: fonts.body, fontSize: 16,
  },
});
