import * as SQLite from 'expo-sqlite';

export type Reminder = {
  id: number;
  title: string;
  startDate: string; // ISO datetime — the chosen starting day combined with the chosen notification time
  intervalDays: number;
  notificationId: string | null; // one-shot notification for the first occurrence
  repeatingNotificationId: string | null; // native repeating notification for every occurrence after that
};

const db = SQLite.openDatabaseSync('reminders.db');

export async function initDb() {
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(reminders)');
  const hasCurrentSchema = columns.some((c) => c.name === 'repeatingNotificationId');
  if (columns.length > 0 && !hasCurrentSchema) {
    await db.execAsync('DROP TABLE reminders');
  }

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      startDate TEXT NOT NULL,
      intervalDays INTEGER NOT NULL,
      notificationId TEXT,
      repeatingNotificationId TEXT
    );
  `);
}

export async function getReminders(): Promise<Reminder[]> {
  return db.getAllAsync<Reminder>('SELECT * FROM reminders ORDER BY id ASC');
}

export async function insertReminder(
  title: string,
  startDate: string,
  intervalDays: number,
  notificationId: string | null,
  repeatingNotificationId: string | null
): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO reminders (title, startDate, intervalDays, notificationId, repeatingNotificationId) VALUES (?, ?, ?, ?, ?)',
    title,
    startDate,
    intervalDays,
    notificationId,
    repeatingNotificationId
  );
  return result.lastInsertRowId;
}

export async function updateReminder(
  id: number,
  title: string,
  startDate: string,
  intervalDays: number,
  notificationId: string | null,
  repeatingNotificationId: string | null
) {
  await db.runAsync(
    'UPDATE reminders SET title = ?, startDate = ?, intervalDays = ?, notificationId = ?, repeatingNotificationId = ? WHERE id = ?',
    title,
    startDate,
    intervalDays,
    notificationId,
    repeatingNotificationId,
    id
  );
}

export async function deleteReminder(id: number) {
  await db.runAsync('DELETE FROM reminders WHERE id = ?', id);
}
