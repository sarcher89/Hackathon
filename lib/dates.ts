// Rounds to the nearest quarter hour (15 minutes) — used when comparing
// clocked hours against task-logged hours so stray minutes don't show up
// as a mismatch.
export function roundToQuarterHour(hours: number): number {
  return Math.round(hours * 4) / 4
}

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

// Bi-weekly period helpers (1st–15th and 16th–end of month)

export function getPeriodStart(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() <= 15 ? 1 : 16)
  return d
}

export function getPeriodDates(periodStart: Date): Date[] {
  const year = periodStart.getFullYear()
  const month = periodStart.getMonth()
  const startDay = periodStart.getDate()
  const endDay = startDay === 1 ? 15 : new Date(year, month + 1, 0).getDate()
  return Array.from({ length: endDay - startDay + 1 }, (_, i) => {
    const d = new Date(year, month, startDay + i)
    return d
  })
}

export function offsetPeriod(periodStart: Date, offset: number): Date {
  let year = periodStart.getFullYear()
  let month = periodStart.getMonth()
  let startDay = periodStart.getDate() // 1 or 16
  let periods = offset

  while (periods > 0) {
    if (startDay === 1) {
      startDay = 16
    } else {
      startDay = 1
      month += 1
      if (month > 11) { month = 0; year += 1 }
    }
    periods--
  }
  while (periods < 0) {
    if (startDay === 16) {
      startDay = 1
    } else {
      month -= 1
      if (month < 0) { month = 11; year -= 1 }
      startDay = 16
    }
    periods++
  }

  return new Date(year, month, startDay)
}

export function formatPeriodRange(periodStart: Date): string {
  const dates = getPeriodDates(periodStart)
  const last = dates[dates.length - 1]
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  const start = periodStart.toLocaleDateString('en-US', opts)
  const end = last.toLocaleDateString('en-US', { ...opts, year: 'numeric' })
  return `${start} – ${end}`
}
