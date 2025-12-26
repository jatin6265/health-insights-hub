// Role-based authentication types
export type AppRole = 'admin' | 'trainer' | 'trainee';
export type UserStatus = 'pending' | 'active' | 'inactive' | 'rejected';
export type AttendanceStatus = 'present' | 'late' | 'partial' | 'absent';
export type SessionStatus = 'scheduled' | 'active' | 'completed' | 'cancelled';

export interface UserProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  status: UserStatus;
  phone: string | null;
  department: string | null;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface Training {
  id: string;
  title: string;
  description: string | null;
  created_by: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: string;
  training_id: string;
  title: string;
  description: string | null;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  location: string | null;
  trainer_id: string | null;
  status: SessionStatus;
  qr_token: string | null;
  qr_expires_at: string | null;
  actual_start_time: string | null;
  actual_end_time: string | null;
  late_threshold_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface SessionParticipant {
  id: string;
  session_id: string;
  user_id: string;
  assigned_at: string;
  assigned_by: string | null;
}

export interface Attendance {
  id: string;
  session_id: string;
  user_id: string;
  join_time: string | null;
  leave_time: string | null;
  duration_minutes: number | null;
  status: AttendanceStatus;
  qr_token_used: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  link: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// Extended types with relations
export interface UserWithRole extends UserProfile {
  role?: AppRole;
}
