import * as SQLite from 'expo-sqlite';

export type Reminder = {
  id: number;
  title: string;
  startDate: string; // ISO date string, date-only
  intervalDays: number;
  nextDueDate: string; // ISO date string, date-only
  notificationId: string | null;
};

const db = SQLite.openDatabaseSync('reminders.db');

export async function initDb() {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      startDate TEXT NOT NULL,
      intervalDays INTEGER NOT NULL,
      nextDueDate TEXT NOT NULL,
      notificationId TEXT
    );
  `);
}

export async function getReminders(): Promise<Reminder[]> {
  return db.getAllAsync<Reminder>('SELECT * FROM reminders ORDER BY nextDueDate ASC');
}

export async function insertReminder(
  title: string,
  startDate: string,
  intervalDays: number,
  nextDueDate: string,
  notificationId: string | null
): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO reminders (title, startDate, intervalDays, nextDueDate, notificationId) VALUES (?, ?, ?, ?, ?)',
    title,
    startDate,
    intervalDays,
    nextDueDate,
    notificationId
  );
  return result.lastInsertRowId;
}

export async function updateReminderSchedule(
  id: number,
  nextDueDate: string,
  notificationId: string | null
) {
  await db.runAsync(
    'UPDATE reminders SET nextDueDate = ?, notificationId = ? WHERE id = ?',
    nextDueDate,
    notificationId,
    id
  );
}

export async function deleteReminder(id: number) {
  await db.runAsync('DELETE FROM reminders WHERE id = ?', id);
}
