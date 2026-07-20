-- Allow employees to attach a note to an individual clock session
ALTER TABLE clock_sessions
  ADD COLUMN IF NOT EXISTS notes text;
