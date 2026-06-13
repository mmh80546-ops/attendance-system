// Hand-maintained subset of the database schema used by the typed data layer.
// Regenerate with `supabase gen types typescript` once the CLI is wired up.

export type AppRole =
  | 'admin'
  | 'hr_manager'
  | 'operations_manager'
  | 'project_manager'
  | 'site_engineer'
  | 'supervisor'
  | 'employee';

export type SyncStatus = 'local' | 'synced' | 'pending';
export type Department =
  | 'projects' | 'maintenance' | 'procurement' | 'accounting' | 'hr' | 'management';
export type EmploymentStatus = 'active' | 'on_leave' | 'suspended' | 'terminated';
export type AttendanceStatus = 'present' | 'late' | 'absent' | 'incomplete';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type HrReviewStatus = 'pending' | 'reviewed' | 'flagged';
export type LeaveType = 'annual' | 'sick' | 'emergency' | 'unpaid' | 'other';

export interface Profile {
  id: string;
  role: AppRole;
  employee_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Employee {
  id: string;
  employee_code: string;
  full_name_ar: string;
  full_name_en: string | null;
  job_title: string | null;
  department: Department | null;
  nationality: string | null;
  mobile: string | null;
  joining_date: string | null;
  employment_status: EmploymentStatus;
  assigned_project_id: string | null;
  assigned_team_id: string | null;
  annual_leave_balance_days: number;
  external_ref: string | null;
  sync_status: SyncStatus;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  client: string | null;
  location_text: string | null;
  latitude: number | null;
  longitude: number | null;
  geofence_radius_m: number;
  project_manager_id: string | null;
  status: 'active' | 'inactive';
  external_ref: string | null;
  sync_status: SyncStatus;
  created_at: string;
  updated_at: string;
}

export interface Site {
  id: string;
  project_id: string | null;
  name: string;
  latitude: number | null;
  longitude: number | null;
  geofence_radius_m: number;
  is_active: boolean;
  external_ref: string | null;
  sync_status: SyncStatus;
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: string;
  name: string;
  project_id: string | null;
  supervisor_id: string | null;
  site_engineer_id: string | null;
  external_ref: string | null;
  sync_status: SyncStatus;
  created_at: string;
  updated_at: string;
}

export interface Attendance {
  id: string;
  employee_id: string;
  site_id: string | null;
  work_date: string;
  check_in_at: string | null;
  check_in_lat: number | null;
  check_in_lng: number | null;
  check_in_photo_url: string | null;
  check_in_distance_m: number | null;
  check_in_geofence_pass: boolean | null;
  check_out_at: string | null;
  check_out_lat: number | null;
  check_out_lng: number | null;
  check_out_photo_url: string | null;
  status: AttendanceStatus;
  tamper_flags: Record<string, boolean>;
  supervisor_approval: ApprovalStatus;
  supervisor_approved_by: string | null;
  supervisor_approved_at: string | null;
  hr_review: HrReviewStatus;
  hr_reviewed_by: string | null;
  hr_reviewed_at: string | null;
  notes: string | null;
  external_ref: string | null;
  sync_status: SyncStatus;
  created_at: string;
  updated_at: string;
}

export interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  num_days: number;
  reason: string | null;
  supervisor_approval: ApprovalStatus;
  supervisor_approved_by: string | null;
  supervisor_approved_at: string | null;
  supervisor_reject_reason: string | null;
  hr_approval: ApprovalStatus;
  hr_approved_by: string | null;
  hr_approved_at: string | null;
  hr_reject_reason: string | null;
  balance_deducted: boolean;
  external_ref: string | null;
  sync_status: SyncStatus;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  before: unknown;
  after: unknown;
  created_at: string;
}

export interface SystemSettings {
  id: boolean;
  workday_start: string;
  late_threshold_minutes: number;
  standard_hours: number;
  weekend_days: number[];
  default_geofence_radius_m: number;
  updated_at: string;
}

type Table<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: Table<Profile>;
      employees: Table<Employee>;
      projects: Table<Project>;
      sites: Table<Site>;
      teams: Table<Team>;
      attendance: Table<Attendance>;
      leave_requests: Table<LeaveRequest>;
      audit_log: Table<AuditLog>;
      system_settings: Table<SystemSettings>;
    };
    Views: {
      employees_safe: { Row: Employee; Relationships: [] };
    };
    Functions: {
      attendance_check_in: {
        Args: {
          p_site_id: string;
          p_lat: number | null;
          p_lng: number | null;
          p_photo_url: string;
          p_accuracy?: number | null;
          p_mock_location?: boolean;
        };
        Returns: Attendance;
      };
      attendance_check_out: {
        Args: { p_lat: number | null; p_lng: number | null; p_photo_url: string | null };
        Returns: Attendance;
      };
      decide_attendance: {
        Args: { p_id: string; p_decision: ApprovalStatus; p_reason?: string | null };
        Returns: Attendance;
      };
      hr_review_attendance: {
        Args: { p_id: string; p_status: HrReviewStatus };
        Returns: Attendance;
      };
      submit_leave: {
        Args: {
          p_leave_type: LeaveType;
          p_start: string;
          p_end: string;
          p_reason: string | null;
        };
        Returns: LeaveRequest;
      };
      supervisor_decide_leave: {
        Args: { p_id: string; p_decision: ApprovalStatus; p_reason?: string | null };
        Returns: LeaveRequest;
      };
      hr_decide_leave: {
        Args: { p_id: string; p_decision: ApprovalStatus; p_reason?: string | null };
        Returns: LeaveRequest;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
