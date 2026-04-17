import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadQueue, flush } from '../services/OfflineQueueManager';
import { syncSchedule } from '../services/BackgroundScheduler';

export default function SettingsScreen(): JSX.Element {
  const [queueSize, setQueueSize] = useState(0);
  const [deviceId, setDeviceId] = useState('—');
  const [branchName, setBranchName] = useState('—');

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh(): Promise<void> {
    const queue = await loadQueue();
    const id = (await AsyncStorage.getItem('sa:device_id')) ?? '—';
    const branchRaw = await AsyncStorage.getItem('sa:cached_branch');
    const branch = branchRaw ? (JSON.parse(branchRaw) as { name?: string }) : null;
    setQueueSize(queue.length);
    setDeviceId(id);
    setBranchName(branch?.name ?? '—');
  }

  async function onSync(): Promise<void> {
    try {
      await syncSchedule();
      Alert.alert('Sync', 'Đã đồng bộ lịch làm việc');
    } catch (e) {
      Alert.alert('Sync lỗi', String(e));
    }
  }

  async function onFlush(): Promise<void> {
    const employeeId = (await AsyncStorage.getItem('sa:employee_id')) ?? '';
    if (!employeeId) return;
    const res = await flush(employeeId);
    Alert.alert(
      'Offline queue',
      `Processed ${res.processed}, failed ${res.failed}, remaining ${res.remaining}`,
    );
    await refresh();
  }

  async function onLogout(): Promise<void> {
    await AsyncStorage.multiRemove([
      'access_token',
      'refresh_token',
      'sa:employee_id',
    ]);
    Alert.alert('Logged out');
  }

  return (
    <SafeAreaView style={styles.root}>
      <Text style={styles.title}>Cài đặt</Text>

      <View style={styles.card}>
        <Info label="Thiết bị đã đăng ký" value={deviceId} />
        <Info label="Chi nhánh" value={branchName} />
        <Info label="Queue offline" value={String(queueSize)} />
      </View>

      <TouchableOpacity style={styles.button} onPress={onSync}>
        <Text style={styles.buttonText}>Đồng bộ lịch</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={onFlush}>
        <Text style={styles.buttonText}>Flush offline queue</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.logout]}
        onPress={onLogout}
      >
        <Text style={[styles.buttonText, styles.logoutText]}>Đăng xuất</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function Info({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f6f7f9', padding: 20 },
  title: { fontSize: 22, fontWeight: '700', color: '#111', marginBottom: 20 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  rowLabel: { color: '#374151', fontSize: 13 },
  rowValue: {
    color: '#111',
    fontSize: 13,
    fontFamily: 'Menlo',
    maxWidth: '60%',
    textAlign: 'right',
  },
  button: {
    marginTop: 14,
    backgroundColor: '#49B7C3',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '600' },
  logout: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ef4444' },
  logoutText: { color: '#ef4444' },
});
