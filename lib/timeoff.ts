import { TimeOffType } from '@/types/database'

export const TIME_OFF_CLIENT_NAME = 'Time Off'
export const TIME_OFF_TASK_CATEGORY = 'Time Off'

export const TIME_OFF_TYPE_LABEL: Record<TimeOffType, string> = {
  vacation: 'Vacation',
  sick: 'Sick',
  bereavement: 'Bereavement',
}
