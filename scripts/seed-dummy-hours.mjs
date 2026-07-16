#!/usr/bin/env node
/**
 * Seeds dummy time_entries for a regular user (role = 'ic') over the last 2 months.
 *
 * Usage:
 *   SEED_USER_EMAIL=someone@example.com node scripts/seed-dummy-hours.mjs
 *
 * If SEED_USER_EMAIL is omitted and exactly one 'ic' user exists, that user is used.
 * Requires .env.local (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY) to be present,
 * or the same vars exported in the environment.
 *
 * Safe to re-run: it first deletes any time_entries it previously created for the target
 * user in the seeded date range (identified by notes = SEED_MARKER) before inserting fresh ones.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const SEED_MARKER = 'dummy-seed'
const MONTHS_BACK = 2

function loadDotEnvLocal() {
  const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env.local')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim()
    if (!(key in process.env)) process.env[key] = value
  }
}

loadDotEnvLocal()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

function toISODate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function weekdaysBack(months) {
  const end = new Date()
  end.setHours(0, 0, 0, 0)
  const start = new Date(end)
  start.setMonth(start.getMonth() - months)

  const dates = []
  const cur = new Date(start)
  while (cur <= end) {
    const day = cur.getDay()
    if (day !== 0 && day !== 6) dates.push(toISODate(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

function tasksForClient(tasks, client) {
  return tasks.filter(t => {
    if (t.system === 'both') return true
    if (client.system === 'denticon') return t.system === 'denticon'
    if (client.system === 'cloud9') return t.system === 'cloud9'
    return true
  })
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

async function main() {
  let userQuery = supabase.from('users').select('*').eq('role', 'ic')
  const targetEmail = process.env.SEED_USER_EMAIL
  if (targetEmail) userQuery = userQuery.eq('email', targetEmail)

  const { data: icUsers, error: userErr } = await userQuery
  if (userErr) throw userErr

  if (!icUsers || icUsers.length === 0) {
    console.error(
      targetEmail
        ? `No 'ic' user found with email ${targetEmail}.`
        : `No 'ic' (regular) users found in the users table.`
    )
    process.exit(1)
  }

  if (icUsers.length > 1 && !targetEmail) {
    console.error('Multiple ic users found — re-run with SEED_USER_EMAIL set to one of:')
    icUsers.forEach(u => console.error(`  ${u.email}`))
    process.exit(1)
  }

  const user = icUsers[0]
  console.log(`Seeding dummy hours for ${user.full_name || user.email} (${user.id})`)

  const [{ data: clients, error: clientErr }, { data: projects, error: projectErr }, { data: tasks, error: taskErr }] =
    await Promise.all([
      supabase.from('clients').select('*').eq('active', true),
      supabase.from('projects').select('*').eq('active', true),
      supabase.from('tasks').select('*'),
    ])
  if (clientErr) throw clientErr
  if (projectErr) throw projectErr
  if (taskErr) throw taskErr

  if (!clients?.length || !tasks?.length) {
    console.error('No active clients or tasks found — cannot generate entries.')
    process.exit(1)
  }

  const projectsByClient = new Map()
  for (const p of projects ?? []) {
    if (!projectsByClient.has(p.client_id)) projectsByClient.set(p.client_id, [])
    projectsByClient.get(p.client_id).push(p)
  }

  const dates = weekdaysBack(MONTHS_BACK)
  console.log(`Generating entries for ${dates.length} weekdays over the last ${MONTHS_BACK} months.`)

  // Clean up any previously seeded rows for this user/date range so the script is re-runnable.
  const { error: delErr } = await supabase
    .from('time_entries')
    .delete()
    .eq('user_id', user.id)
    .eq('notes', SEED_MARKER)
    .gte('entry_date', dates[0])
    .lte('entry_date', dates[dates.length - 1])
  if (delErr) throw delErr

  const rows = []
  for (const date of dates) {
    // 1-2 client/task combos per day, totaling ~6.5-8.5 hours.
    const numRows = Math.random() < 0.7 ? 1 : 2
    let remaining = Math.round((Math.random() * 2 + 6.5) * 2) / 2 // 6.5–8.5 in 0.5 steps

    for (let i = 0; i < numRows; i++) {
      const client = pick(clients)
      const clientTasks = tasksForClient(tasks, client)
      const task = pick(clientTasks.length ? clientTasks : tasks)
      const clientProjects = projectsByClient.get(client.id) ?? []
      const project = clientProjects.length && Math.random() < 0.5 ? pick(clientProjects) : null

      const hours =
        i === numRows - 1 ? remaining : Math.round((remaining / 2) * 2) / 2
      remaining = Math.round((remaining - hours) * 2) / 2

      rows.push({
        user_id: user.id,
        client_id: client.id,
        project_id: project ? project.id : null,
        task_id: task.id,
        entry_date: date,
        hours: Math.max(0.5, hours),
        notes: SEED_MARKER,
        exported: false,
      })
    }
  }

  const BATCH = 200
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const { error } = await supabase.from('time_entries').insert(batch)
    if (error) throw error
    console.log(`Inserted ${Math.min(i + BATCH, rows.length)}/${rows.length}`)
  }

  const totalHours = rows.reduce((s, r) => s + r.hours, 0)
  console.log(`Done. Inserted ${rows.length} entries totaling ${totalHours} hours.`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
