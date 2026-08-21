import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import {
  Reminder,
  deleteReminder,
  getReminders,
  initDb,
  insertReminder,
  updateReminder,
} from './lib/db';
import {
  androidChannelSetup,
  cancelNotification,
  computeNextDueDate,
  requestNotificationPermissions,
  scheduleReminderNotifications,
} from './lib/notifications';

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function defaultNotificationTime(): Date {
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  return d;
}

function combineDateAndTime(date: Date, time: Date): Date {
  const combined = new Date(date);
  combined.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return combined;
}

function formatDateTime(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }) + ' · ' + date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ReminderApp />
    </SafeAreaProvider>
  );
}

function ReminderApp() {
  const insets = useSafeAreaInsets();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [ready, setReady] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(startOfDay(new Date()));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notificationTime, setNotificationTime] = useState(defaultNotificationTime());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [intervalDays, setIntervalDays] = useState('7');

  const loadReminders = useCallback(async () => {
    setReminders(await getReminders());
  }, []);

  useEffect(() => {
    (async () => {
      await initDb();
      androidChannelSetup();
      await requestNotificationPermissions();
      await loadReminders();
      setReady(true);
    })();
  }, [loadReminders]);

  function resetForm() {
    setTitle('');
    setStartDate(startOfDay(new Date()));
    setNotificationTime(defaultNotificationTime());
    setIntervalDays('7');
  }

  function openAddModal() {
    resetForm();
    setEditingId(null);
    setModalVisible(true);
  }

  function openEditModal(reminder: Reminder) {
    const anchor = new Date(reminder.startDate);
    setTitle(reminder.title);
    setStartDate(startOfDay(anchor));
    setNotificationTime(anchor);
    setIntervalDays(String(reminder.intervalDays));
    setEditingId(reminder.id);
    setModalVisible(true);
  }

  async function handleSubmit() {
    const interval = parseInt(intervalDays, 10);
    if (!title.trim() || !Number.isFinite(interval) || interval < 1) return;

    const anchor = combineDateAndTime(startDate, notificationTime);
    const now = new Date();
    const firstDueDate = computeNextDueDate(anchor, interval, now);

    if (editingId !== null) {
      const existing = reminders.find((r) => r.id === editingId);
      if (existing) {
        await cancelNotification(existing.notificationId);
        await cancelNotification(existing.repeatingNotificationId);
      }
      const { notificationId, repeatingNotificationId } = await scheduleReminderNotifications(
        title.trim(),
        firstDueDate,
        interval
      );
      await updateReminder(
        editingId,
        title.trim(),
        anchor.toISOString(),
        interval,
        notificationId,
        repeatingNotificationId
      );
    } else {
      const { notificationId, repeatingNotificationId } = await scheduleReminderNotifications(
        title.trim(),
        firstDueDate,
        interval
      );
      await insertReminder(
        title.trim(),
        anchor.toISOString(),
        interval,
        notificationId,
        repeatingNotificationId
      );
    }

    resetForm();
    setEditingId(null);
    setModalVisible(false);
    await loadReminders();
  }

  function handleDelete(reminder: Reminder) {
    Alert.alert(
      'Are you sure to delete this reminder?',
      undefined,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await cancelNotification(reminder.notificationId);
            await cancelNotification(reminder.repeatingNotificationId);
            await deleteReminder(reminder.id);
            await loadReminders();
          },
        },
      ]
    );
  }

  if (!ready) {
    return (
      <View style={styles.container}>
        <StatusBar style="auto" />
      </View>
    );
  }

  const now = new Date();
  const sortedReminders = [...reminders].sort((a, b) => {
    const aNext = computeNextDueDate(new Date(a.startDate), a.intervalDays, now).getTime();
    const bNext = computeNextDueDate(new Date(b.startDate), b.intervalDays, now).getTime();
    return aNext - bNext;
  });

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      <Text style={styles.header}>Reminders</Text>

      <FlatList
        style={styles.list}
        data={sortedReminders}
        keyExtractor={(item) => String(item.id)}
        ListEmptyComponent={
          <Text style={styles.empty}>No reminders yet. Tap + to add one.</Text>
        }
        renderItem={({ item }) => {
          const nextDue = computeNextDueDate(new Date(item.startDate), item.intervalDays, now);
          return (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <Text style={styles.rowSubtitle}>
                  Every {item.intervalDays} day{item.intervalDays === 1 ? '' : 's'} · next{' '}
                  {formatDateTime(nextDue)}
                </Text>
              </View>
              <Pressable
                onPress={() => openEditModal(item)}
                hitSlop={12}
                style={styles.iconButton}
              >
                <Ionicons name="pencil-outline" size={20} color="#2f6fed" />
              </Pressable>
              <Pressable onPress={() => handleDelete(item)} hitSlop={12} style={styles.iconButton}>
                <Ionicons name="trash-outline" size={20} color="#d33" />
              </Pressable>
            </View>
          );
        }}
      />

      <Pressable style={styles.fab} onPress={openAddModal}>
        <Text style={styles.fabText}>+</Text>
      </Pressable>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + 20 }]}>
            <Text style={styles.modalHeader}>
              {editingId !== null ? 'Edit Reminder' : 'New Reminder'}
            </Text>

            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Water the fern"
            />

            <Text style={styles.label}>Starting day</Text>
            <Pressable style={styles.input} onPress={() => setShowDatePicker(true)}>
              <Text>{startDate.toDateString()}</Text>
            </Pressable>
            {showDatePicker && (
              <DateTimePicker
                value={startDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                onValueChange={(_event, selected) => {
                  setShowDatePicker(Platform.OS === 'ios');
                  setStartDate(startOfDay(selected));
                }}
                onDismiss={() => setShowDatePicker(false)}
              />
            )}

            <Text style={styles.label}>Notification time</Text>
            <Pressable style={styles.input} onPress={() => setShowTimePicker(true)}>
              <Text>{formatTime(notificationTime)}</Text>
            </Pressable>
            {showTimePicker && (
              <DateTimePicker
                value={notificationTime}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onValueChange={(_event, selected) => {
                  setShowTimePicker(Platform.OS === 'ios');
                  setNotificationTime(selected);
                }}
                onDismiss={() => setShowTimePicker(false)}
              />
            )}

            <Text style={styles.label}>Repeat every (days)</Text>
            <TextInput
              style={styles.input}
              value={intervalDays}
              onChangeText={setIntervalDays}
              keyboardType="number-pad"
            />

            <View style={styles.modalActions}>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => {
                  resetForm();
                  setEditingId(null);
                  setModalVisible(false);
                }}
              >
                <Text>{editingId !== null ? 'Discard' : 'Cancel'}</Text>
              </Pressable>
              <Pressable style={styles.primaryButton} onPress={handleSubmit}>
                <Text style={styles.primaryButtonText}>
                  {editingId !== null ? 'Submit' : 'Save'}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  header: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 16,
  },
  list: {
    flex: 1,
  },
  empty: {
    color: '#888',
    marginTop: 40,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  rowTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  rowSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  iconButton: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 40,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2f6fed',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  fabText: {
    color: '#fff',
    fontSize: 30,
    lineHeight: 32,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
  },
  modalHeader: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    color: '#666',
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 24,
    gap: 12,
  },
  secondaryButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  primaryButton: {
    backgroundColor: '#2f6fed',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
