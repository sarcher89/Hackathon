-- Add time-off balance columns to users (defaults match business rules)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS vacation_hours   numeric NOT NULL DEFAULT 80,
  ADD COLUMN IF NOT EXISTS sick_hours       numeric NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS bereavement_hours numeric NOT NULL DEFAULT 16;

-- Set balances for all existing employees
UPDATE users SET
  vacation_hours    = 80,
  sick_hours        = 40,
  bereavement_hours = 16
WHERE vacation_hours = 0 OR sick_hours = 0 OR bereavement_hours = 0;

-- Time off requests
CREATE TABLE IF NOT EXISTS time_off_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_date  date NOT NULL,
  hours         numeric NOT NULL CHECK (hours > 0),
  type          text NOT NULL CHECK (type IN ('vacation', 'sick', 'bereavement')),
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE time_off_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own requests"
  ON time_off_requests FOR INSERT
  WITH CHECK (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "Users can view own requests"
  ON time_off_requests FOR SELECT
  USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "Leaders and admins can view all requests"
  ON time_off_requests FOR SELECT
  USING ((SELECT role FROM users WHERE auth_id = auth.uid()) IN ('leader', 'admin'));

CREATE POLICY "Leaders and admins can update requests"
  ON time_off_requests FOR UPDATE
  USING ((SELECT role FROM users WHERE auth_id = auth.uid()) IN ('leader', 'admin'));

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  type         text NOT NULL,
  message      text NOT NULL,
  read         boolean NOT NULL DEFAULT false,
  data         jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "Authenticated users can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can mark own notifications read"
  ON notifications FOR UPDATE
  USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));
