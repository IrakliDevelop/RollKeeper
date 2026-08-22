export function isCalendarServerEnabled(): boolean {
  return process.env.SUPABASE_CALENDAR_SYNC_ENABLED === 'true';
}

export function isCalendarWorkerEnabled(): boolean {
  return process.env.CALENDAR_PROJECTION_WORKER_ENABLED === 'true';
}

export function isCalendarClientVisible(): boolean {
  return process.env.NEXT_PUBLIC_CALENDAR_SYNC_VISIBLE === 'true';
}
