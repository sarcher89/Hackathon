export function getMondayOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay() // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function getWeekDates(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

export function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function formatDayHeader(date: Date): { day: string; shortDate: string } {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return {
    day: days[date.getDay()],
    shortDate: `${date.getMonth() + 1}/${date.getDate()}`,
  }
}

export function formatWeekRange(monday: Date): string {
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  const start = monday.toLocaleDateString('en-US', opts)
  const end = sunday.toLocaleDateString('en-US', { ...opts, year: 'numeric' })
  return `${start} – ${end}`
}

export function offsetWeek(monday: Date, weeks: number): Date {
  const d = new Date(monday)
  d.setDate(d.getDate() + weeks * 7)
  return d
}
