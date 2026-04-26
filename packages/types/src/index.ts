export type UserRole = "ADMIN" | "MANAGER" | "MEMBER";

export type CostModel = "AVERAGE_HOURLY" | "SALARY_BANDS" | "CSV_UPLOAD";

export type CalendarProvider = "GOOGLE" | "MICROSOFT";

export type TrendPoint = {
  label: string;
  total_cost: number;
  total_hours: number;
  meeting_count: number;
};

export type BreakdownPoint = {
  label: string;
  total_cost: number;
  total_hours: number;
  meeting_count: number;
};

export type DashboardResponse = {
  total_cost: number;
  total_hours: number;
  avg_cost_per_meeting: number;
  flagged_cost: number;
  trends: TrendPoint[];
  breakdowns: {
    by_organizer: BreakdownPoint[];
    by_flags: BreakdownPoint[];
  };
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  org_id: string;
  org_name: string;
};

export type AuthResponse = {
  token: string;
  user: AuthUser;
};

export type MeetingListItem = {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  attendee_count: number;
  total_cost: number;
  cost_per_minute: number;
  is_large: boolean;
  is_long: boolean;
  is_recurring: boolean;
};

export type MeetingDetail = MeetingListItem & {
  organizer: {
    id: string;
    name: string;
    email: string;
  } | null;
  attendees: Array<{
    id: string;
    name: string | null;
    email: string;
    is_external: boolean;
    is_required: boolean;
  }>;
  ratings: Array<{
    id: string;
    rating: number;
    comment: string | null;
    created_at: string;
    user: {
      name: string;
    };
  }>;
  summary: {
    body: string;
    created_at: string;
  } | null;
};

export type EmployeePublic = {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role_title: string | null;
  department: string | null;
  has_salary: boolean;
  has_hourly_rate: boolean;
  rate_source: "employee" | "role" | "organization" | "fallback";
};

export type RoleBand = {
  id: string;
  title: string;
  min_salary: number | null;
  max_salary: number | null;
  hourly_rate: number | null;
};

export type SummaryInput = {
  key_points: string[];
  decisions: string[];
  action_items: Array<{
    task: string;
    owner?: string;
    due_date?: string;
  }>;
};
