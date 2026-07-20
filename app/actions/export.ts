'use server'

import ExcelJS from 'exceljs'
import type { ExportEntry } from '@/components/LeaderGrid'

const NAVY = 'FF0B1460'
const HEADER_TEXT = 'FFFFFFFF'
const DATE_SUBTOTAL_FILL = 'FFF1F5F9'
const SUBTOTAL_FILL = 'FFE2E8F0'
const GRAND_TOTAL_FILL = 'FF0B1460'
const BAND_FILL = 'FFF8FAFC'
const BORDER_COLOR = 'FFD9DEE7'

const THIN_BORDER: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: BORDER_COLOR } }

const COLUMNS: { header: string; width: number }[] = [
  { header: 'Employee', width: 22 },
  { header: 'Date', width: 13 },
  { header: 'Email', width: 28 },
  { header: 'Day', width: 8 },
  { header: 'Client', width: 20 },
  { header: 'Project', width: 20 },
  { header: 'Task', width: 24 },
  { header: 'Category', width: 16 },
  { header: 'Hours', width: 10 },
  { header: 'Notes', width: 34 },
]

function formatDateLabel(iso: string): { date: string; day: string } {
  const d = new Date(iso + 'T00:00:00')
  return {
    date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    day: d.toLocaleDateString('en-US', { weekday: 'short' }),
  }
}

function sum(entries: ExportEntry[]): number {
  return Math.round(entries.reduce((s, e) => s + e.hours, 0) * 100) / 100
}

export async function generatePayrollWorkbook(
  entries: ExportEntry[],
  title: string
): Promise<string> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'PDDS Time Tracker'
  workbook.created = new Date(0)

  const sheet = workbook.addWorksheet('Payroll Export', {
    views: [{ state: 'frozen', ySplit: 5 }],
  })
  sheet.columns = COLUMNS.map(c => ({ width: c.width }))
  sheet.properties.outlineProperties = { summaryBelow: true, summaryRight: false }
  // Must match the deepest outlineLevel used below (task rows = 2), or Excel
  // never reserves the outline gutter and the +/- expand controls don't render.
  sheet.properties.outlineLevelRow = 2

  // Title block
  sheet.mergeCells(1, 1, 1, COLUMNS.length)
  const titleCell = sheet.getCell(1, 1)
  titleCell.value = 'PDDS Time Tracker — Payroll Export'
  titleCell.font = { bold: true, size: 14, color: { argb: NAVY } }

  sheet.mergeCells(2, 1, 2, COLUMNS.length)
  const subtitleCell = sheet.getCell(2, 1)
  subtitleCell.value = title
  subtitleCell.font = { bold: true, size: 11, color: { argb: 'FF475569' } }

  sheet.mergeCells(3, 1, 3, COLUMNS.length)
  const totalEntriesCell = sheet.getCell(3, 1)
  totalEntriesCell.value = `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} · ${sum(entries)} total hours`
  totalEntriesCell.font = { size: 10, italic: true, color: { argb: 'FF94A3B8' } }

  // Header row (row 5)
  const headerRowIndex = 5
  const headerRow = sheet.getRow(headerRowIndex)
  COLUMNS.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.value = c.header
    cell.font = { bold: true, color: { argb: HEADER_TEXT } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
    cell.alignment = { vertical: 'middle', horizontal: c.header === 'Hours' ? 'center' : 'left' }
    cell.border = { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER }
  })
  headerRow.height = 20

  // Group entries by employee, preserving each employee's entries sorted by date
  const byEmployee = new Map<string, ExportEntry[]>()
  for (const e of entries) {
    const key = e.userEmail
    if (!byEmployee.has(key)) byEmployee.set(key, [])
    byEmployee.get(key)!.push(e)
  }
  const employees = Array.from(byEmployee.entries()).sort((a, b) =>
    (a[1][0]?.userName ?? '').localeCompare(b[1][0]?.userName ?? '')
  )
  for (const [, group] of employees) {
    group.sort((a, b) => a.date.localeCompare(b.date))
  }

  let rowIndex = headerRowIndex + 1
  let bandOn = false

  for (const [, group] of employees) {
    bandOn = !bandOn

    // Sub-group each employee's entries by date, preserving ascending date order
    const byDate = new Map<string, ExportEntry[]>()
    for (const e of group) {
      if (!byDate.has(e.date)) byDate.set(e.date, [])
      byDate.get(e.date)!.push(e)
    }

    for (const [dateIso, dayEntries] of Array.from(byDate.entries())) {
      for (const e of dayEntries) {
        const { date, day } = formatDateLabel(e.date)
        const row = sheet.getRow(rowIndex)
        row.outlineLevel = 2
        row.hidden = true
        const values = [
          e.userName,
          date,
          e.userEmail,
          day,
          e.clientName,
          e.projectName ?? '—',
          e.taskName,
          e.taskCategory,
          e.hours,
          e.notes ?? '',
        ]
        values.forEach((v, i) => {
          const cell = row.getCell(i + 1)
          cell.value = v
          cell.border = { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER }
          cell.alignment = { vertical: 'middle', horizontal: i === 8 ? 'center' : 'left', wrapText: i === 9 }
          if (i === 8) cell.numFmt = '0.00'
          if (bandOn) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BAND_FILL } }
        })
        rowIndex++
      }

      // Summary row for this date. Sits at outlineLevel 1 (nested inside the
      // employee's level-0 section) so collapsing the employee also hides these.
      const { date: dateLabel, day: dayLabel } = formatDateLabel(dateIso)
      const dateRow = sheet.getRow(rowIndex)
      dateRow.outlineLevel = 1
      sheet.mergeCells(rowIndex, 1, rowIndex, 8)
      const dateLabelCell = dateRow.getCell(1)
      dateLabelCell.value = `${group[0]?.userName ?? ''} — ${dateLabel} (${dayLabel}) — ${dayEntries.length} ${dayEntries.length === 1 ? 'entry' : 'entries'}`
      dateLabelCell.font = { bold: true, color: { argb: 'FF1E293B' } }
      dateLabelCell.alignment = { horizontal: 'right' }

      const dateHoursCell = dateRow.getCell(9)
      dateHoursCell.value = sum(dayEntries)
      dateHoursCell.numFmt = '0.00'
      dateHoursCell.font = { bold: true, color: { argb: 'FF1E293B' } }
      dateHoursCell.alignment = { horizontal: 'center' }

      for (let i = 1; i <= COLUMNS.length; i++) {
        const cell = dateRow.getCell(i)
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DATE_SUBTOTAL_FILL } }
        cell.border = { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER }
      }
      rowIndex++
    }

    // Subtotal row for this employee
    const subtotalRow = sheet.getRow(rowIndex)
    sheet.mergeCells(rowIndex, 1, rowIndex, 8)
    const labelCell = subtotalRow.getCell(1)
    labelCell.value = `Subtotal — ${group[0]?.userName ?? ''}`
    labelCell.font = { bold: true, color: { argb: 'FF334155' } }
    labelCell.alignment = { horizontal: 'right' }

    const hoursCell = subtotalRow.getCell(9)
    hoursCell.value = sum(group)
    hoursCell.numFmt = '0.00'
    hoursCell.font = { bold: true, color: { argb: 'FF334155' } }
    hoursCell.alignment = { horizontal: 'center' }

    for (let i = 1; i <= COLUMNS.length; i++) {
      const cell = subtotalRow.getCell(i)
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SUBTOTAL_FILL } }
      cell.border = { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER }
    }
    rowIndex++
  }

  // Grand total row
  const grandRow = sheet.getRow(rowIndex)
  sheet.mergeCells(rowIndex, 1, rowIndex, 8)
  const grandLabel = grandRow.getCell(1)
  grandLabel.value = 'Grand Total'
  grandLabel.font = { bold: true, size: 11, color: { argb: HEADER_TEXT } }
  grandLabel.alignment = { horizontal: 'right' }

  const grandHours = grandRow.getCell(9)
  grandHours.value = sum(entries)
  grandHours.numFmt = '0.00'
  grandHours.font = { bold: true, size: 11, color: { argb: HEADER_TEXT } }
  grandHours.alignment = { horizontal: 'center' }

  for (let i = 1; i <= COLUMNS.length; i++) {
    grandRow.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAND_TOTAL_FILL } }
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer).toString('base64')
}
