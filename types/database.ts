export type UserRole = 'ic' | 'leader' | 'admin'
export type ClientSystem = 'denticon' | 'cloud9' | 'other'
export type TaskSystem = 'denticon' | 'cloud9' | 'both'

export interface User {
  id: string
  auth_id: string
  full_name: string
  email: string
  role: UserRole
  hourly_wage: number
  department?: string
  vacation_hours: number
  sick_hours: number
  bereavement_hours: number
  created_at: string
}

export type TimeOffType = 'vacation' | 'sick' | 'bereavement'
export type TimeOffStatus = 'pending' | 'approved' | 'denied'

export interface TimeOffRequest {
  id: string
  user_id: string
  request_date: string
  hours: number
  type: TimeOffType
  status: TimeOffStatus
  notes: string | null
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  from_user_id: string
  type: string
  message: string
  read: boolean
  data: Record<string, unknown> | null
  created_at: string
}

export interface Client {
  id: string
  name: string
  system: ClientSystem
  active: boolean
  created_at: string
}

export interface Project {
  id: string
  client_id: string
  name: string
  active: boolean
  created_at: string
}

export interface Task {
  id: string
  name: string
  category: string
  system: TaskSystem
  sort_order: number
}

export interface TimeEntry {
  id: string
  user_id: string
  client_id: string
  project_id: string | null
  task_id: string
  entry_date: string
  hours: number
  notes: string | null
  exported: boolean
  created_at: string
}

// Joined/enriched types used in UI
export interface TimeEntryWithRelations extends TimeEntry {
  client: Client
  task: Task
  project: Project | null
  user: User
}
