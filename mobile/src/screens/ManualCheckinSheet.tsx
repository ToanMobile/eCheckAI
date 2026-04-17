import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, Platform, SafeAreaView,
  ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { postManualCheckin } from '../api/attendanceApi';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type CheckType = 'checkin' | 'checkout' | 'both';

function todayStr(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
}

function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
}

function displayDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// Generate selectable dates: today + 6 days back (7 total)
function getDateOptions(): string[] {
  return Array.from({ length: 7 }, (_, i) => daysAgoStr(i));
}

export default function ManualCheckinSheet({ visible, onClose, onSuccess }: Props): JSX.Element {
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [checkType, setCheckType] = useState<CheckType>('both');
  const [checkinHH, setCheckinHH] = useState('08');
  const [checkinMM, setCheckinMM] = useState('00');
  const [checkoutHH, setCheckoutHH] = useState('17');
  const [checkoutMM, setCheckoutMM] = useState('30');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  function buildIso(date: string, hh: string, mm: string): string {
    const h = hh.padStart(2, '0');
    const m = mm.padStart(2, '0');
    return `${date}T${h}:${m}:00+07:00`;
  }

  async function onSubmit(): Promise<void> {
    if (!note.trim()) {
      Alert.alert('Thiếu lý do', 'Vui lòng nhập lý do chấm công bù');
      return;
    }
    const ciH = parseInt(checkinHH, 10);
    const ciM = parseInt(checkinMM, 10);
    const coH = parseInt(checkoutHH, 10);
    const coM = parseInt(checkoutMM, 10);
    if (isNaN(ciH) || isNaN(ciM) || isNaN(coH) || isNaN(coM)) {
      Alert.alert('Giờ không hợp lệ', 'Vui lòng nhập giờ đúng định dạng (0–23 / 0–59)');
      return;
    }
    if (checkType === 'both' && (ciH * 60 + ciM) >= (coH * 60 + coM)) {
      Alert.alert('Giờ không hợp lệ', 'Giờ vào phải nhỏ hơn giờ ra');
      return;
    }

    setLoading(true);
    try {
      await postManualCheckin({
        work_date: selectedDate,
        check_in: (checkType === 'checkin' || checkType === 'both')
          ? buildIso(selectedDate, checkinHH, checkinMM) : null,
        check_out: (checkType === 'checkout' || checkType === 'both')
          ? buildIso(selectedDate, checkoutHH, checkoutMM) : null,
        note: note.trim(),
      });
      Alert.alert('Đã gửi', 'Yêu cầu chấm công bù đã được ghi nhận. Chờ quản lý duyệt.', [
        { text: 'OK', onPress: onSuccess },
      ]);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? 'Gửi thất bại. Vui lòng thử lại.';
      Alert.alert('Lỗi', msg);
    } finally {
      setLoading(false);
    }
  }

  const dateOptions = getDateOptions();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.root}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} style={s.closeBtn}>
            <Text style={s.closeTxt}>Hủy</Text>
          </TouchableOpacity>
          <Text style={s.title}>📝 Chấm công bù</Text>
          <TouchableOpacity
            onPress={onSubmit}
            disabled={loading}
            style={[s.submitBtn, loading && { opacity: 0.5 }]}
          >
            {loading ? <ActivityIndicator color={TEAL} size="small" /> : <Text style={s.submitTxt}>Gửi</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          {/* Date picker */}
          <Text style={s.sectionLabel}>Ngày làm việc</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.dateScroll}>
            {dateOptions.map((d) => (
              <TouchableOpacity
                key={d}
                style={[s.dateChip, selectedDate === d && s.dateChipActive]}
                onPress={() => setSelectedDate(d)}
              >
                <Text style={[s.dateChipTxt, selectedDate === d && s.dateChipActiveTxt]}>
                  {d === todayStr() ? 'Hôm nay' : displayDate(d)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Check type */}
          <Text style={[s.sectionLabel, { marginTop: 20 }]}>Loại</Text>
          <View style={s.typeRow}>
            {([
              { key: 'both', label: 'Cả hai' },
              { key: 'checkin', label: 'Check-in' },
              { key: 'checkout', label: 'Check-out' },
            ] as { key: CheckType; label: string }[]).map(({ key, label }) => (
              <TouchableOpacity
                key={key}
                style={[s.typeBtn, checkType === key && s.typeBtnActive]}
                onPress={() => setCheckType(key)}
              >
                <Text style={[s.typeTxt, checkType === key && s.typeTxtActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Times */}
          {(checkType === 'checkin' || checkType === 'both') && (
            <TimeRow
              label="Giờ vào"
              hh={checkinHH} mm={checkinMM}
              onHH={setCheckinHH} onMM={setCheckinMM}
            />
          )}
          {(checkType === 'checkout' || checkType === 'both') && (
            <TimeRow
              label="Giờ ra"
              hh={checkoutHH} mm={checkoutMM}
              onHH={setCheckoutHH} onMM={setCheckoutMM}
            />
          )}

          {/* Note */}
          <Text style={[s.sectionLabel, { marginTop: 20 }]}>Lý do <Text style={{ color: '#ef4444' }}>*</Text></Text>
          <TextInput
            style={s.noteInput}
            placeholder="VD: WiFi chi nhánh bị lỗi, không check-in được tự động..."
            placeholderTextColor="#9ca3af"
            value={note}
            onChangeText={setNote}
            multiline
            numberOfLines={Platform.OS === 'ios' ? undefined : 4}
            textAlignVertical="top"
          />

          <View style={s.infoBox}>
            <Text style={s.infoTxt}>
              ℹ️  Yêu cầu sẽ được gửi cho quản lý chi nhánh xét duyệt. Chỉ được gửi bù trong vòng 7 ngày.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function TimeRow({
  label, hh, mm, onHH, onMM,
}: {
  label: string;
  hh: string; mm: string;
  onHH: (v: string) => void; onMM: (v: string) => void;
}): JSX.Element {
  return (
    <View style={{ marginTop: 16 }}>
      <Text style={s.sectionLabel}>{label}</Text>
      <View style={s.timeRow}>
        <TextInput
          style={s.timeInput}
          value={hh}
          onChangeText={(v) => onHH(v.replace(/\D/g, '').slice(0, 2))}
          keyboardType="number-pad"
          maxLength={2}
          placeholder="08"
          placeholderTextColor="#9ca3af"
        />
        <Text style={s.timeSep}>:</Text>
        <TextInput
          style={s.timeInput}
          value={mm}
          onChangeText={(v) => onMM(v.replace(/\D/g, '').slice(0, 2))}
          keyboardType="number-pad"
          maxLength={2}
          placeholder="00"
          placeholderTextColor="#9ca3af"
        />
      </View>
    </View>
  );
}

const TEAL = '#49B7C3';

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderColor: '#e5e7eb',
  },
  closeBtn: { padding: 4 },
  closeTxt: { color: '#374151', fontSize: 15 },
  title: { fontSize: 16, fontWeight: '700', color: '#111' },
  submitBtn: { padding: 4 },
  submitTxt: { color: TEAL, fontSize: 16, fontWeight: '700' },

  body: { padding: 20, paddingBottom: 60 },

  sectionLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },

  dateScroll: { marginHorizontal: -4 },
  dateChip: {
    marginHorizontal: 4, paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, backgroundColor: '#f3f4f6', borderWidth: 1.5, borderColor: 'transparent',
  },
  dateChipActive: { backgroundColor: TEAL + '15', borderColor: TEAL },
  dateChipTxt: { fontSize: 13, color: '#374151', fontWeight: '500' },
  dateChipActiveTxt: { color: TEAL, fontWeight: '700' },

  typeRow: { flexDirection: 'row', gap: 10 },
  typeBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
    backgroundColor: '#f3f4f6', borderWidth: 1.5, borderColor: 'transparent',
  },
  typeBtnActive: { backgroundColor: TEAL + '15', borderColor: TEAL },
  typeTxt: { fontSize: 14, color: '#374151', fontWeight: '500' },
  typeTxtActive: { color: TEAL, fontWeight: '700' },

  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeInput: {
    borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10,
    width: 70, paddingVertical: 12, textAlign: 'center',
    fontSize: 22, fontWeight: '600', color: '#111',
  },
  timeSep: { fontSize: 24, fontWeight: '300', color: '#6b7280' },

  noteInput: {
    borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: '#111', minHeight: 100,
  },
  infoBox: { marginTop: 20, backgroundColor: '#f0f9ff', borderRadius: 10, padding: 14 },
  infoTxt: { fontSize: 13, color: '#0369a1', lineHeight: 20 },
});
