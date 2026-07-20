'use server'

import ExcelJS from 'exceljs'
import type { ExportEntry, ExportClockSession } from '@/components/LeaderGrid'

const NAVY = 'FF0B1460'
const HEADER_TEXT = 'FFFFFFFF'
const SUBHEADER_TEXT = 'FF334155'
const DAY_TOTAL_FILL = 'FFF1F5F9'
const GRAND_TOTAL_FILL = 'FF0B1460'
const BORDER_COLOR = 'FFD9DEE7'
const NOTE_TEXT = 'FF94A3B8'

// Clock Sessions is the primary, at-a-glance information for each date —
// bold, larger, blue-accented. Task Log is secondary/supporting detail —
// smaller and muted grey, so the eye lands on clock times first.
const CLOCK_ACCENT_TEXT = 'FF1E3A8A'
const CLOCK_HEADER_FILL = 'FFDBEAFE'
const CLOCK_BAND_FILL = 'FFEFF6FF'
const CLOCK_TEXT = 'FF1E293B'

const TASK_CAPTION_TEXT = 'FF94A3B8'
const TASK_HEADER_FILL = 'FFF1F5F9'
const TASK_HEADER_TEXT = 'FF64748B'
const TASK_BAND_FILL = 'FFFAFAFA'
const TASK_TEXT = 'FF64748B'

const THIN_BORDER: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: BORDER_COLOR } }
const ALL_BORDERS = { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER }

// 6 columns shared by both the Clock Sessions and Task Log mini-tables on each
// date block. Clock Sessions only uses columns 1, 2 and 5; Task Log uses all six.
const COLUMN_WIDTHS = [22, 20, 24, 16, 12, 34]

function formatDateLabel(iso: string): { date: string; day: string } {
  const d = new Date(iso + 'T00:00:00')
  return {
    date: d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
    day: d.toLocaleDateString('en-US', { weekday: 'short' }),
  }
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const h = d.getHours()
  const m = d.getMinutes()
  const ampm = h >= 12 ? 'pm' : 'am'
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
}

function sumEntries(entries: ExportEntry[]): number {
  return Math.round(entries.reduce((s, e) => s + e.hours, 0) * 100) / 100
}

function sumSessions(sessions: ExportClockSession[]): number {
  return Math.round(sessions.reduce((s, sess) => s + (sess.hours ?? 0), 0) * 100) / 100
}

function sanitizeSheetName(name: string, used: Set<string>): string {
  const base = name.replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'Employee'
  let candidate = base
  let n = 2
  while (used.has(candidate.toLowerCase())) {
    const suffix = ` (${n})`
    candidate = base.slice(0, 31 - suffix.length) + suffix
    n++
  }
  used.add(candidate.toLowerCase())
  return candidate
}

function styleHeaderRow(
  row: ExcelJS.Row,
  labels: (string | null)[],
  opts: { fill: string; text: string; size: number }
) {
  labels.forEach((label, i) => {
    const cell = row.getCell(i + 1)
    if (label !== null) cell.value = label
    cell.font = { bold: true, size: opts.size, color: { argb: opts.text } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.fill } }
    cell.border = ALL_BORDERS
    cell.alignment = { vertical: 'middle' }
  })
}

function styleSectionCaption(sheet: ExcelJS.Worksheet, rowIndex: number, columnCount: number, text: string, color: string) {
  sheet.mergeCells(rowIndex, 1, rowIndex, columnCount)
  const cell = sheet.getCell(rowIndex, 1)
  cell.value = text
  cell.font = { bold: true, size: 9, color: { argb: color } }
  sheet.getRow(rowIndex).height = 14
}

function buildEmployeeSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  employeeName: string,
  employeeEmail: string,
  title: string,
  entries: ExportEntry[],
  sessions: ExportClockSession[]
) {
  const sheet = workbook.addWorksheet(sheetName, { views: [{ state: 'frozen', ySplit: 4 }] })
  sheet.columns = COLUMN_WIDTHS.map(width => ({ width }))
  const columnCount = COLUMN_WIDTHS.length

  // Title block
  sheet.mergeCells(1, 1, 1, columnCount)
  const titleCell = sheet.getCell(1, 1)
  titleCell.value = `PDDS Time Tracker — Payroll Export — ${employeeName}`
  titleCell.font = { bold: true, size: 14, color: { argb: NAVY } }

  sheet.mergeCells(2, 1, 2, columnCount)
  const subtitleCell = sheet.getCell(2, 1)
  subtitleCell.value = `${employeeEmail} · ${title}`
  subtitleCell.font = { bold: true, size: 11, color: { argb: 'FF475569' } }

  sheet.mergeCells(3, 1, 3, columnCount)
  const summaryCell = sheet.getCell(3, 1)
  summaryCell.value = `${sessions.length} clock ${sessions.length === 1 ? 'session' : 'sessions'} · ${entries.length} task ${entries.length === 1 ? 'entry' : 'entries'} · ${sumEntries(entries)} total hours`
  summaryCell.font = { size: 10, italic: true, color: { argb: NOTE_TEXT } }

  let rowIndex = 5

  // Union of every date that has either a clock session or a task entry
  const dates = Array.from(new Set([...entries.map(e => e.date), ...sessions.map(s => s.date)])).sort()

  let bandOn = false
  for (const dateIso of dates) {
    bandOn = !bandOn
    const dayEntries = entries.filter(e => e.date === dateIso)
    const daySessions = sessions.filter(s => s.date === dateIso)
    const { date: dateLabel } = formatDateLabel(dateIso)

    // Date section header
    sheet.mergeCells(rowIndex, 1, rowIndex, columnCount)
    const dateCell = sheet.getCell(rowIndex, 1)
    dateCell.value = dateLabel
    dateCell.font = { bold: true, size: 12, color: { argb: HEADER_TEXT } }
    dateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
    dateCell.border = ALL_BORDERS
    sheet.getRow(rowIndex).height = 20
    rowIndex++

    // Clock Sessions — the primary information for this date: bold, larger,
    // blue-accented so it reads first.
    styleSectionCaption(sheet, rowIndex, columnCount, 'CLOCK SESSIONS', CLOCK_ACCENT_TEXT)
    rowIndex++

    if (daySessions.length > 0) {
      styleHeaderRow(sheet.getRow(rowIndex), ['Clock In', 'Clock Out', null, null, 'Hours', null], {
        fill: CLOCK_HEADER_FILL,
        text: CLOCK_ACCENT_TEXT,
        size: 10,
      })
      rowIndex++

      for (const s of daySessions) {
        const row = sheet.getRow(rowIndex)
        row.height = 18
        row.getCell(1).value = formatTime(s.clockedInAt)
        row.getCell(2).value = s.clockedOutAt ? formatTime(s.clockedOutAt) : 'Currently clocked in'
        row.getCell(5).value = s.hours ?? ''
        if (s.hours !== null) row.getCell(5).numFmt = '0.00'
        for (let i = 1; i <= columnCount; i++) {
          const cell = row.getCell(i)
          cell.border = ALL_BORDERS
          cell.font = { bold: true, size: 11, color: { argb: CLOCK_TEXT } }
          cell.alignment = { vertical: 'middle', horizontal: i === 5 ? 'center' : 'left' }
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bandOn ? CLOCK_BAND_FILL : 'FFFFFFFF' } }
        }
        rowIndex++
      }
    } else {
      sheet.mergeCells(rowIndex, 1, rowIndex, columnCount)
      const noneCell = sheet.getCell(rowIndex, 1)
      noneCell.value = 'No clock sessions recorded'
      noneCell.font = { italic: true, size: 10, color: { argb: NOTE_TEXT } }
      rowIndex++
    }

    // Task Log — secondary, supporting detail: smaller and muted so it
    // reads as backup information behind the clock times above.
    styleSectionCaption(sheet, rowIndex, columnCount, 'TASK LOG', TASK_CAPTION_TEXT)
    rowIndex++

    if (dayEntries.length > 0) {
      styleHeaderRow(sheet.getRow(rowIndex), ['Client', 'Project', 'Task', 'Category', 'Hours', 'Notes'], {
        fill: TASK_HEADER_FILL,
        text: TASK_HEADER_TEXT,
        size: 9,
      })
      rowIndex++

      for (const e of dayEntries) {
        const row = sheet.getRow(rowIndex)
        row.height = 13
        const values = [e.clientName, e.projectName ?? '—', e.taskName, e.taskCategory, e.hours, e.notes ?? '']
        values.forEach((v, i) => {
          const cell = row.getCell(i + 1)
          cell.value = v
          cell.border = ALL_BORDERS
          cell.font = { size: 9, color: { argb: TASK_TEXT } }
          cell.alignment = { vertical: 'middle', horizontal: i === 4 ? 'center' : 'left', wrapText: i === 5 }
          if (i === 4) cell.numFmt = '0.00'
          if (bandOn) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TASK_BAND_FILL } }
        })
        rowIndex++
      }
    } else {
      sheet.mergeCells(rowIndex, 1, rowIndex, columnCount)
      const noneCell = sheet.getCell(rowIndex, 1)
      noneCell.value = 'No task entries logged'
      noneCell.font = { italic: true, size: 9, color: { argb: NOTE_TEXT } }
      rowIndex++
    }

    // Day total
    sheet.mergeCells(rowIndex, 1, rowIndex, 4)
    const dayTotalLabel = sheet.getCell(rowIndex, 1)
    dayTotalLabel.value = `Day Total (Clocked: ${sumSessions(daySessions)}h)`
    dayTotalLabel.font = { bold: true, color: { argb: SUBHEADER_TEXT } }
    dayTotalLabel.alignment = { horizontal: 'right' }

    const dayTotalHours = sheet.getCell(rowIndex, 5)
    dayTotalHours.value = sumEntries(dayEntries)
    dayTotalHours.numFmt = '0.00'
    dayTotalHours.font = { bold: true, color: { argb: SUBHEADER_TEXT } }
    dayTotalHours.alignment = { horizontal: 'center' }

    for (let i = 1; i <= columnCount; i++) {
      const cell = sheet.getCell(rowIndex, i)
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DAY_TOTAL_FILL } }
      cell.border = ALL_BORDERS
    }
    rowIndex++
    rowIndex++ // spacer row between dates
  }

  // Grand total for this employee
  sheet.mergeCells(rowIndex, 1, rowIndex, 4)
  const grandLabel = sheet.getCell(rowIndex, 1)
  grandLabel.value = `Grand Total — ${employeeName}`
  grandLabel.font = { bold: true, size: 11, color: { argb: HEADER_TEXT } }
  grandLabel.alignment = { horizontal: 'right' }

  const grandHours = sheet.getCell(rowIndex, 5)
  grandHours.value = sumEntries(entries)
  grandHours.numFmt = '0.00'
  grandHours.font = { bold: true, size: 11, color: { argb: HEADER_TEXT } }
  grandHours.alignment = { horizontal: 'center' }

  for (let i = 1; i <= columnCount; i++) {
    sheet.getCell(rowIndex, i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAND_TOTAL_FILL } }
  }
}

export async function generatePayrollWorkbook(
  entries: ExportEntry[],
  clockSessions: ExportClockSession[],
  title: string
): Promise<string> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'PDDS Time Tracker'
  workbook.created = new Date(0)

  const employees = new Map<string, { name: string; email: string }>()
  for (const e of entries) {
    if (!employees.has(e.userEmail)) employees.set(e.userEmail, { name: e.userName, email: e.userEmail })
  }
  for (const s of clockSessions) {
    if (!employees.has(s.userEmail)) employees.set(s.userEmail, { name: s.userEmail, email: s.userEmail })
  }

  const sortedEmployees = Array.from(employees.entries()).sort((a, b) => a[1].name.localeCompare(b[1].name))
  const usedSheetNames = new Set<string>()

  for (const [userEmail, { name, email }] of sortedEmployees) {
    const employeeEntries = entries.filter(e => e.userEmail === userEmail)
    const employeeSessions = clockSessions.filter(s => s.userEmail === userEmail)
    const sheetName = sanitizeSheetName(name, usedSheetNames)
    buildEmployeeSheet(workbook, sheetName, name, email, title, employeeEntries, employeeSessions)
  }

  if (sortedEmployees.length === 0) {
    workbook.addWorksheet('Payroll Export').getCell(1, 1).value = 'No entries for this export.'
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer).toString('base64')
}
