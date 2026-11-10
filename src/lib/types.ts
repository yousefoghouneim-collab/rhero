export type Role = 'manager' | 'cleaner';
export type Lang = 'en' | 'lg' | 'sw' | 'ar' | 'hi' | 'ur' | 'bn' | 'ml' | 'tl';
export type I18n = Partial<Record<Lang, string>>;

export interface Org {
  id: string; name: string; short_name: string | null; is_demo: boolean; timezone: string;
  settings: { report_time?: string; work_days?: number[]; shift_start?: string; shift_end?: string; staff_arrival?: string; currency?: string };
  form_token: string; demo_seeded_on: string | null;
}
export interface Profile {
  id: string; org_id: string; full_name: string; role: Role; phone: string | null; email: string | null;
  language: Lang; color: string | null; active: boolean; last_seen_at: string | null; created_at: string;
}
export interface Area { id: string; org_id: string; name: string; name_i18n: I18n; icon: string; sort: number; active: boolean }
export type RoutineKind = 'cleaning' | 'toilets' | 'stock';
export interface Routine {
  id: string; org_id: string; name: string; name_i18n: I18n; description: string | null; kind: RoutineKind;
  start_time: string; end_time: string; days: number[]; color: string; icon: string; sort: number; active: boolean;
}
export interface Task {
  id: string; org_id: string; routine_id: string; area_id: string | null; title: string; title_i18n: I18n;
  days: number[] | null; assignee_id: string | null; sort: number; active: boolean;
}
export interface TaskDone { id: string; org_id: string; task_id: string; routine_id: string; day: string; done_by: string | null; done_at: string; note: string | null; photo_path: string | null }
export type Section = 'pantry' | 'stationery';
export interface Item {
  id: string; org_id: string; code: string | null; name: string; section: Section; category: string; unit: string;
  pack_info: string | null; track_opened: boolean; par_qty: number; warn_qty: number; min_qty: number;
  monthly_usage: number | null; supplier: string | null; supplier_url: string | null; unit_price: number | null;
  emoji: string | null; location: string | null; sort: number; active: boolean; qty_opened: number; qty_store: number;
  last_counted_at: string | null; last_counted_by: string | null; updated_at: string;
}
export interface StockCount {
  id: string; org_id: string; item_id: string; day: string; qty_opened: number; qty_store: number;
  prev_total: number | null; received_since: number; used: number | null; counted_by: string | null; counted_at: string; note: string | null;
}
export type OrderStatus = 'draft' | 'ordered' | 'partial' | 'received' | 'cancelled';
export interface OrderLine { id: string; order_id: string; item_id: string | null; name: string; unit: string | null; qty: number; unit_price: number | null; received_qty: number }
export interface Order {
  id: string; org_id: string; ref: string; supplier: string | null; status: OrderStatus; notes: string | null;
  created_by: string | null; created_at: string; ordered_at: string | null; expected_on: string | null; received_at: string | null;
  lines?: OrderLine[];
}
export type RequestStatus = 'new' | 'approved' | 'ordered' | 'delivered' | 'rejected' | 'on_hold';
export interface PurchaseRequest {
  id: string; org_id: string; ref: string; title: string; category: string; qty: number; specs: string | null; reason: string | null;
  link: string | null; needed_by: string | null; priority: 'low' | 'normal' | 'high' | 'urgent'; requester_name: string | null;
  requester_email: string | null; requester_phone: string | null; department: string | null; est_unit_cost: number | null;
  supplier: string | null; po_number: string | null; status: RequestStatus; notes: string | null; source: 'manager' | 'form';
  created_at: string; updated_at: string;
}
export type PassStatus = 'pending' | 'approved' | 'issued' | 'rejected' | 'completed';
export interface VisitorPass {
  id: string; org_id: string; ref: string; visitor_name: string; id_type: 'emirates_id' | 'passport' | 'other'; id_number: string;
  nationality: string | null; email: string | null; phone: string | null; company: string | null; occupation: string | null;
  visit_reason: string; visit_date: string; arrival_time: string | null; departure_time: string | null; host_name: string;
  host_team: string | null; host_email: string | null; host_phone: string | null; vehicle_plate: string | null; equipment: string | null;
  extra_visitors: { name: string; id_number?: string }[]; notes: string | null; status: PassStatus; source: 'manager' | 'form'; created_at: string;
}
export type IssueKind = 'supply' | 'broken' | 'spill' | 'pest' | 'other';
export interface Issue {
  id: string; org_id: string; area_id: string | null; item_id: string | null; kind: IssueKind; note: string | null; photo_path: string | null;
  status: 'open' | 'resolved'; reported_by: string | null; created_at: string; resolved_at: string | null; resolved_by: string | null;
}
export interface Notification { id: string; kind: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string }

export interface ReportRoutine { id: string; name: string; kind: RoutineKind; icon: string; start: string; end: string; total: number; done: number; late: number; first_done: string | null; last_done: string | null; missed: { title: string; area: string | null }[] }
export interface ReportItem { id: string; name: string; emoji: string | null; unit: string; section: Section; store: number; opened: number; min: number; par: number; need: number }
export interface ReportData {
  day: string; generated_at: string;
  cleaning: { total: number; done: number; late: number; routines: ReportRoutine[]; cleaners: { id: string; name: string; done: number }[] };
  stock: { scheduled: boolean; total: number; counted: number; counted_at: string | null; counted_by: string | null; red: ReportItem[]; orange: ReportItem[]; used: { name: string; emoji: string | null; unit: string; used: number }[] };
  issues: { new: { kind: IssueKind; note: string | null; area: string | null; status: string; at: string; by: string | null }[]; open: number };
  requests: { new_today: number; pending: number };
  passes: { today: number; pending: number };
}
export interface DailyReport { id: string; org_id: string; day: string; data: ReportData; created_at: string }
