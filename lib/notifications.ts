import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Reminder, updateReminderSchedule } from './db';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// Finds the next occurrence of startDate + k*intervalDays that is >= now.
export function computeNextDueDate(startDate: Date, intervalDays: number, now: Date): Date {
  if (startDate.getTime() >= now.getTime()) return startDate;

  const elapsedDays = (now.getTime() - startDate.getTime()) / MS_PER_DAY;
  const intervalsPassed = Math.ceil(elapsedDays / intervalDays);
  return new Date(startDate.getTime() + intervalsPassed * intervalDays * MS_PER_DAY);
}

export async function scheduleOneShot(title: string, dueDate: Date): Promise<string> {
  const seconds = Math.max(1, Math.round((dueDate.getTime() - Date.now()) / 1000));
  return Notifications.scheduleNotificationAsync({
    content: { title, body: "It's time!" },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
    },
  });
}

export async function cancelNotification(notificationId: string | null) {
  if (!notificationId) return;
  await Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => {});
}

// Call on app launch/foreground: catches up any reminder whose due date has
// passed while the app wasn't running, and rolls it forward to the next one.
export async function resyncReminder(reminder: Reminder, now: Date) {
  const dueDate = new Date(reminder.nextDueDate);
  if (dueDate.getTime() > now.getTime()) return;

  const nextDueDate = computeNextDueDate(
    new Date(dueDate.getTime() + 1),
    reminder.intervalDays,
    now
  );

  await cancelNotification(reminder.notificationId);
  const notificationId = await scheduleOneShot(reminder.title, nextDueDate);
  await updateReminderSchedule(reminder.id, nextDueDate.toISOString(), notificationId);
}

export function androidChannelSetup() {
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}
