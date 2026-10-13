export function summarizeRecurringSchedules(schedules, today) {
  const activeSchedules = schedules.filter(schedule =>
    schedule.active && (!schedule.end_date || schedule.end_date >= schedule.next_date));
  const dueCount = activeSchedules.filter(schedule => schedule.next_date <= today).length;
  const nextDate = activeSchedules
    .map(schedule => schedule.next_date)
    .sort((left, right) => left.localeCompare(right))[0] || null;

  return { dueCount, nextDate };
}
