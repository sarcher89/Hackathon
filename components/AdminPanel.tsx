'use client'

import { useState } from 'react'
import { User, Client, Project, Task, UserRole, ClientSystem, TaskSystem } from '@/types/database'
import { setUserWage, updateUserProfile } from '@/app/actions/payroll'
import { createEmployee, createClient, createProject } from '@/app/actions/admin'
import { createTask } from '@/app/actions/tasks'

const DEPARTMENTS = ['Legwork Web Team', 'Legwork Marketing']
const ROLES: UserRole[] = ['ic', 'leader', 'admin']
const CLIENT_SYSTEMS: ClientSystem[] = ['denticon', 'cloud9', 'other']
const TASK_SYSTEMS: TaskSystem[] = ['denticon', 'cloud9', 'both']

interface Props {
  users: User[]
  clients: Client[]
  projectsByClient: Record<string, Project[]>
  tasks: Task[]
}

interface EditState {
  full_name: string
  department: string
  hourly_wage: string
}

function SectionCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">{title}</h3>
      {children}
    </div>
  )
}

function CollapsibleList({
  title,
  count,
  children,
}: {
  title: string
  count: number
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-4">
      <button
        onClick={() => setOpen(prev => !prev)}
        className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-800"
      >
        <svg
          className={`w-3 h-3 shrink-0 text-slate-400 transition-transform ${open ? '' : '-rotate-90'}`}
          viewBox="0 0 16 16" fill="none"
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {title} <span className="text-slate-400 font-normal">({count})</span>
      </button>
      {open && <div className="mt-2 max-h-72 overflow-y-auto rounded border border-slate-200">{children}</div>}
    </div>
  )
}

export default function AdminPanel({ users: initialUsers, clients: initialClients, projectsByClient, tasks: initialTasks }: Props) {
  const [users, setUsers] = useState(initialUsers)
  const [clients, setClients] = useState(initialClients)
  const [projects, setProjects] = useState(Object.values(projectsByClient).flat())
  const [tasks, setTasks] = useState(initialTasks)

  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<EditState>({ full_name: '', department: '', hourly_wage: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Add Employee
  const [newEmployee, setNewEmployee] = useState({ email: '', fullName: '', department: '', role: 'ic' as UserRole })
  const [addingEmployee, setAddingEmployee] = useState(false)
  const [employeeError, setEmployeeError] = useState<string | null>(null)
  const [newEmployeePassword, setNewEmployeePassword] = useState<{ email: string; password: string } | null>(null)

  // Add Client
  const [newClientName, setNewClientName] = useState('')
  const [newClientSystem, setNewClientSystem] = useState<ClientSystem>('denticon')
  const [addingClient, setAddingClient] = useState(false)
  const [clientError, setClientError] = useState<string | null>(null)

  // Add Project
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectClientId, setNewProjectClientId] = useState('')
  const [addingProject, setAddingProject] = useState(false)
  const [projectError, setProjectError] = useState<string | null>(null)

  // Add Task
  const [newTaskName, setNewTaskName] = useState('')
  const [newTaskCategory, setNewTaskCategory] = useState('')
  const [newTaskSystem, setNewTaskSystem] = useState<TaskSystem>('both')
  const [addingTask, setAddingTask] = useState(false)
  const [taskError, setTaskError] = useState<string | null>(null)

  function startEdit(u: User) {
    setEditing(u.id)
    setDraft({
      full_name: u.full_name || '',
      department: u.department || '',
      hourly_wage: String(u.hourly_wage || ''),
    })
    setError(null)
  }

  function cancel() {
    setEditing(null)
    setError(null)
  }

  async function handleSave(userId: string) {
    setSaving(true)
    setError(null)

    const wage = parseFloat(draft.hourly_wage)
    const profileResult = await updateUserProfile(userId, {
      full_name: draft.full_name.trim(),
      department: draft.department,
    })

    if (!profileResult.success) {
      setError(profileResult.error ?? 'Save failed')
      setSaving(false)
      return
    }

    if (!isNaN(wage) && wage >= 0) {
      const wageResult = await setUserWage(userId, wage)
      if (!wageResult.success) {
        setError(wageResult.error ?? 'Wage save failed')
        setSaving(false)
        return
      }
    }

    setUsers(prev =>
      prev.map(u =>
        u.id === userId
          ? {
              ...u,
              full_name: draft.full_name.trim(),
              department: draft.department,
              hourly_wage: !isNaN(wage) ? wage : u.hourly_wage,
            }
          : u
      )
    )
    setEditing(null)
    setSaving(false)
  }

  async function handleAddEmployee() {
    setAddingEmployee(true)
    setEmployeeError(null)
    setNewEmployeePassword(null)

    const result = await createEmployee(newEmployee)
    setAddingEmployee(false)

    if (!result.success) {
      setEmployeeError(result.error)
      return
    }

    setUsers(prev => [...prev, result.user])
    setNewEmployeePassword({ email: result.user.email, password: result.tempPassword })
    setNewEmployee({ email: '', fullName: '', department: '', role: 'ic' })
  }

  async function handleAddClient() {
    setAddingClient(true)
    setClientError(null)

    const result = await createClient(newClientName, newClientSystem)
    setAddingClient(false)

    if (!result.success) {
      setClientError(result.error)
      return
    }

    setClients(prev => [...prev, result.client])
    setNewClientName('')
  }

  async function handleAddProject() {
    setAddingProject(true)
    setProjectError(null)

    const result = await createProject(newProjectName, newProjectClientId)
    setAddingProject(false)

    if (!result.success) {
      setProjectError(result.error)
      return
    }

    setProjects(prev => [...prev, result.project])
    setNewProjectName('')
  }

  async function handleAddTask() {
    setAddingTask(true)
    setTaskError(null)

    const result = await createTask(newTaskName, { category: newTaskCategory, system: newTaskSystem })
    setAddingTask(false)

    if (!result.success) {
      setTaskError(result.error)
      return
    }

    setTasks(prev => [...prev, result.task])
    setNewTaskName('')
    setNewTaskCategory('')
  }

  return (
    <div className="space-y-6">
      {/* Employees */}
      <SectionCard title="Add Employee">
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Email</label>
            <input
              type="email"
              value={newEmployee.email}
              onChange={e => setNewEmployee(s => ({ ...s, email: e.target.value }))}
              className="w-52 rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Full Name</label>
            <input
              type="text"
              value={newEmployee.fullName}
              onChange={e => setNewEmployee(s => ({ ...s, fullName: e.target.value }))}
              className="w-44 rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Department</label>
            <select
              value={newEmployee.department}
              onChange={e => setNewEmployee(s => ({ ...s, department: e.target.value }))}
              className="rounded border border-slate-300 px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="">— Select —</option>
              {DEPARTMENTS.map(dep => (
                <option key={dep} value={dep}>{dep}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Role</label>
            <select
              value={newEmployee.role}
              onChange={e => setNewEmployee(s => ({ ...s, role: e.target.value as UserRole }))}
              className="rounded border border-slate-300 px-2 py-1.5 text-sm capitalize bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              {ROLES.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleAddEmployee}
            disabled={addingEmployee || !newEmployee.email.trim()}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {addingEmployee ? 'Adding…' : 'Add Employee'}
          </button>
        </div>
        {employeeError && <p className="mt-2 text-xs text-red-600">{employeeError}</p>}
        {newEmployeePassword && (
          <p className="mt-2 rounded bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-800">
            Created <strong>{newEmployeePassword.email}</strong> with temporary password{' '}
            <code className="rounded bg-white px-1.5 py-0.5 font-mono">{newEmployeePassword.password}</code> — share this with them so they can log in.
          </p>
        )}
      </SectionCard>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Department</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Role</th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Hourly Wage</th>
              <th className="w-32" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map(u => {
              const isEditing = editing === u.id
              return (
                <tr key={u.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        type="text"
                        value={draft.full_name}
                        onChange={e => setDraft(d => ({ ...d, full_name: e.target.value }))}
                        className="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    ) : (
                      <>
                        <div className="text-sm font-medium text-slate-800">{u.full_name || '—'}</div>
                        <div className="text-xs text-slate-400">{u.email}</div>
                      </>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    {isEditing ? (
                      <select
                        value={draft.department}
                        onChange={e => setDraft(d => ({ ...d, department: e.target.value }))}
                        className="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                      >
                        <option value="">— Select —</option>
                        {DEPARTMENTS.map(dep => (
                          <option key={dep} value={dep}>{dep}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-sm text-slate-600">{u.department || <span className="text-slate-300">—</span>}</span>
                    )}
                  </td>

                  <td className="px-4 py-3 text-sm text-slate-600 capitalize">{u.role}</td>

                  <td className="px-4 py-3 text-right">
                    {isEditing ? (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={draft.hourly_wage}
                        onChange={e => setDraft(d => ({ ...d, hourly_wage: e.target.value }))}
                        className="w-24 rounded border border-slate-300 px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    ) : (
                      <span className="text-sm font-medium text-slate-700">
                        {u.hourly_wage > 0 ? `$${u.hourly_wage.toFixed(2)}/hr` : '—'}
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3 text-right">
                    {isEditing ? (
                      <div className="flex flex-col gap-1 items-end">
                        {error && <p className="text-xs text-red-500 mb-1">{error}</p>}
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSave(u.id)}
                            disabled={saving}
                            className="rounded bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancel}
                            className="rounded border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(u)}
                        className="rounded border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Clients */}
      <SectionCard title="Add Client">
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Name</label>
            <input
              type="text"
              value={newClientName}
              onChange={e => setNewClientName(e.target.value)}
              className="w-56 rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">System</label>
            <select
              value={newClientSystem}
              onChange={e => setNewClientSystem(e.target.value as ClientSystem)}
              className="rounded border border-slate-300 px-2 py-1.5 text-sm capitalize bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              {CLIENT_SYSTEMS.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleAddClient}
            disabled={addingClient || !newClientName.trim()}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {addingClient ? 'Adding…' : 'Add Client'}
          </button>
        </div>
        {clientError && <p className="mt-2 text-xs text-red-600">{clientError}</p>}

        <CollapsibleList title="View all clients" count={clients.length}>
          <table className="min-w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {clients.map(c => (
                <tr key={c.id}>
                  <td className="px-3 py-2 text-slate-700">{c.name}</td>
                  <td className="px-3 py-2 text-right text-xs text-slate-400 capitalize">{c.system}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CollapsibleList>
      </SectionCard>

      {/* Projects */}
      <SectionCard title="Add Project">
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Name</label>
            <input
              type="text"
              value={newProjectName}
              onChange={e => setNewProjectName(e.target.value)}
              className="w-56 rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Client</label>
            <select
              value={newProjectClientId}
              onChange={e => setNewProjectClientId(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="">— Select —</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleAddProject}
            disabled={addingProject || !newProjectName.trim() || !newProjectClientId}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {addingProject ? 'Adding…' : 'Add Project'}
          </button>
        </div>
        {projectError && <p className="mt-2 text-xs text-red-600">{projectError}</p>}

        <CollapsibleList title="View all projects" count={projects.length}>
          <table className="min-w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {projects.map(p => (
                <tr key={p.id}>
                  <td className="px-3 py-2 text-slate-700">{p.name}</td>
                  <td className="px-3 py-2 text-right text-xs text-slate-400">
                    {clients.find(c => c.id === p.client_id)?.name ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CollapsibleList>
      </SectionCard>

      {/* Tasks */}
      <SectionCard title="Add Task">
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Name</label>
            <input
              type="text"
              value={newTaskName}
              onChange={e => setNewTaskName(e.target.value)}
              className="w-56 rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Category</label>
            <input
              type="text"
              value={newTaskCategory}
              onChange={e => setNewTaskCategory(e.target.value)}
              placeholder="Custom"
              className="w-40 rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">System</label>
            <select
              value={newTaskSystem}
              onChange={e => setNewTaskSystem(e.target.value as TaskSystem)}
              className="rounded border border-slate-300 px-2 py-1.5 text-sm capitalize bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              {TASK_SYSTEMS.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleAddTask}
            disabled={addingTask || !newTaskName.trim()}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {addingTask ? 'Adding…' : 'Add Task'}
          </button>
        </div>
        {taskError && <p className="mt-2 text-xs text-red-600">{taskError}</p>}

        <CollapsibleList title="View all tasks" count={tasks.length}>
          <table className="min-w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {tasks.map(t => (
                <tr key={t.id}>
                  <td className="px-3 py-2 text-slate-700">{t.name}</td>
                  <td className="px-3 py-2 text-xs text-slate-400">{t.category}</td>
                  <td className="px-3 py-2 text-right text-xs text-slate-400 capitalize">{t.system}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CollapsibleList>
      </SectionCard>
    </div>
  )
}
