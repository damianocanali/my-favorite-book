import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'

const REMINDER_CHANNEL_ID = 'writing-reminders'

// Kid-friendly reminder messages
const REMINDER_MESSAGES = [
  { title: "Your story is waiting! 📖", body: "Come back and keep writing your amazing book!" },
  { title: "Time to write! ✨", body: "Your characters miss you — jump back into your story!" },
  { title: "Keep going, author! 🌟", body: "Great stories are written one word at a time. You've got this!" },
  { title: "Your book needs you! 🚀", body: "Hop back in and add the next exciting chapter!" },
  { title: "Story time! 🎨", body: "Pick up where you left off and make something magical!" },
]

function pickMessage(id) {
  return REMINDER_MESSAGES[id % REMINDER_MESSAGES.length]
}

/**
 * Request notification permission. Returns true if granted.
 * Must be called in response to a user gesture on iOS.
 */
export async function requestNotificationPermission() {
  if (!Capacitor.isNativePlatform()) return false
  try {
    const { display } = await LocalNotifications.requestPermissions()
    return display === 'granted'
  } catch {
    return false
  }
}

/**
 * Check whether notification permission has already been granted.
 */
export async function hasNotificationPermission() {
  if (!Capacitor.isNativePlatform()) return false
  try {
    const { display } = await LocalNotifications.checkPermissions()
    return display === 'granted'
  } catch {
    return false
  }
}

/**
 * Schedule daily writing reminders at the given hour (24h, default 17:00).
 * Cancels any existing reminders first to avoid duplicates.
 */
export async function scheduleWritingReminders(hourOfDay = 17) {
  if (!Capacitor.isNativePlatform()) return

  try {
    // Cancel existing reminders before rescheduling
    await cancelWritingReminders()

    // On Android, a notification channel is required
    if (Capacitor.getPlatform() === 'android') {
      await LocalNotifications.createChannel({
        id: REMINDER_CHANNEL_ID,
        name: 'Writing Reminders',
        description: 'Daily reminders to keep writing your story',
        importance: 3, // IMPORTANCE_DEFAULT
        visibility: 1,
        sound: 'default',
        vibration: true,
      })
    }

    // Schedule one notification per day for the next 7 days, then they repeat weekly
    const notifications = []
    for (let day = 1; day <= 7; day++) {
      const scheduleAt = new Date()
      scheduleAt.setDate(scheduleAt.getDate() + day)
      scheduleAt.setHours(hourOfDay, 0, 0, 0)

      const msg = pickMessage(day)
      notifications.push({
        id: 1000 + day,
        title: msg.title,
        body: msg.body,
        schedule: { at: scheduleAt, repeats: true, every: 'week' },
        channelId: REMINDER_CHANNEL_ID,
        smallIcon: 'ic_stat_icon_config_sample',
        iconColor: '#6366F1',
      })
    }

    await LocalNotifications.schedule({ notifications })
  } catch (err) {
    console.warn('[notifications] Failed to schedule reminders:', err)
  }
}

/**
 * Cancel all scheduled writing reminders.
 */
export async function cancelWritingReminders() {
  if (!Capacitor.isNativePlatform()) return
  try {
    const pending = await LocalNotifications.getPending()
    const ours = pending.notifications.filter((n) => n.id >= 1000 && n.id < 2000)
    if (ours.length > 0) {
      await LocalNotifications.cancel({ notifications: ours })
    }
  } catch {
    // Silent fail
  }
}

/**
 * Initialize notifications: request permission on first launch, then schedule.
 * Safe to call on every app start — skips if already scheduled.
 */
export async function initNotifications() {
  if (!Capacitor.isNativePlatform()) return

  const granted = await hasNotificationPermission()
  if (!granted) {
    // Ask once; if denied, we won't reschedule
    const allowed = await requestNotificationPermission()
    if (!allowed) return
  }

  // Check if reminders are already scheduled to avoid rescheduling on every launch
  try {
    const pending = await LocalNotifications.getPending()
    const alreadyScheduled = pending.notifications.some((n) => n.id >= 1000 && n.id < 2000)
    if (!alreadyScheduled) {
      await scheduleWritingReminders()
    }
  } catch {
    await scheduleWritingReminders()
  }
}
