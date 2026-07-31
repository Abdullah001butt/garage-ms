export type CustomerType = "individual" | "company";

export type Customer = {
  id: string;
  name: string;
  customer_type: CustomerType;
  phone: string;
  email: string | null;
  address: string | null;
  city: string | null;
  landline: string | null;
  trn_number: string | null;
  representative: string | null;
  reference_name: string | null;
  notes: string | null;
  created_at: string;
};

export type CustomerBalanceAdjustment = {
  id: string;
  customer_id: string;
  amount: number;
  note: string;
  created_at: string;
};

export type JobSublet = {
  id: string;
  job_card_id: string;
  vendor_name: string;
  description: string;
  cost: number;
  created_at: string;
};

export type Emirate =
  | "Abu Dhabi"
  | "Dubai"
  | "Sharjah"
  | "Ajman"
  | "Umm Al Quwain"
  | "Ras Al Khaimah"
  | "Fujairah";

export type Vehicle = {
  id: string;
  customer_id: string;
  plate_number: string;
  emirate: Emirate;
  registration_expiry_date: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  origin_trim: string | null;
  vin: string | null;
  body_type: string | null;
  color: string | null;
  cylinders: number | null;
  current_mileage: number | null;
  odometer_reading: number | null;
  notes: string | null;
  service_interval_days: number | null;
  created_at: string;
};

export type DailyCashReconciliation = {
  id: string;
  reconciliation_date: string;
  counted_cash: number;
  notes: string | null;
  created_at: string;
};

export type CompanyVehicle = {
  id: string;
  name: string;
  plate_number: string | null;
  notes: string | null;
  created_at: string;
};

export type ShopHoliday = {
  id: string;
  holiday_date: string;
  label: string;
  created_at: string;
};

export type VehicleIncident = {
  id: string;
  vehicle_id: string;
  incident_date: string;
  description: string;
  created_at: string;
};

export type VehicleDocument = {
  id: string;
  vehicle_id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  uploaded_at: string;
};

export type JobStatus = "pending" | "in_progress" | "completed";

export type JobCard = {
  id: string;
  vehicle_id: string;
  customer_id: string;
  description: string;
  mechanic_name: string | null;
  odometer: number | null;
  status: JobStatus;
  created_at: string;
  completed_at: string | null;
};

export type InvoiceStatus = "unpaid" | "partial" | "paid";
export type DocumentType = "estimate" | "invoice";

export type Invoice = {
  id: string;
  job_card_id: string | null;
  customer_id: string;
  status: InvoiceStatus;
  document_type: DocumentType;
  vat_rate: number;
  discount: number;
  converted_from_estimate_id: string | null;
  created_at: string;
  paid_at: string | null;
};

export type InvoiceItemType = "part" | "labor" | "service";

export type InvoiceItem = {
  id: string;
  invoice_id: string;
  part_id: string | null;
  description: string;
  item_type: InvoiceItemType;
  quantity: number;
  unit_price: number;
  warranty_days: number | null;
  created_at: string;
};

export type Part = {
  id: string;
  name: string;
  sku: string | null;
  stock_qty: number;
  unit_cost: number | null;
  unit_price: number | null;
  reorder_threshold: number;
  supplier_name: string | null;
  supplier_phone: string | null;
  created_at: string;
};

export type ShopSettings = {
  id: string;
  shop_name: string;
  trn: string | null;
  address: string | null;
  phone: string | null;
  vat_rate: number;
  portal_url: string | null;
  email: string | null;
  website: string | null;
  facsimile: string | null;
  payment_method_note: string | null;
  payment_instructions: string | null;
  invoice_disclaimer: string | null;
  default_service_interval_days: number;
  google_review_link: string | null;
  created_at: string;
};

export type Expense = {
  id: string;
  category: string;
  description: string | null;
  amount: number;
  expense_date: string;
  company_vehicle_id: string | null;
  created_at: string;
};

export type JobTemplate = {
  id: string;
  name: string;
  description: string;
  created_at: string;
};

export type JobTemplateItem = {
  id: string;
  template_id: string;
  description: string;
  item_type: InvoiceItemType;
  quantity: number;
  unit_price: number;
  sort_order: number;
};

export type Role = "owner" | "receptionist" | "mechanic";

export type Profile = {
  id: string;
  full_name: string;
  role: Role;
  monthly_salary: number | null;
  created_at: string;
};

export type PaymentMethod = "cash" | "card" | "bank_transfer" | "ziina" | "other";

export type Payment = {
  id: string;
  invoice_id: string;
  amount: number;
  method: PaymentMethod;
  paid_at: string;
  notes: string | null;
  created_at: string;
};

export type Partner = {
  id: string;
  full_name: string;
  share_percentage: number;
  created_at: string;
};

export type AttendanceStatus = "present" | "absent" | "paid_leave" | "holiday";

export type AuditLog = {
  id: string;
  actor_id: string | null;
  actor_name: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

export type Attendance = {
  id: string;
  profile_id: string;
  attendance_date: string;
  status: AttendanceStatus;
  created_at: string;
};

export type ExpenseTemplate = {
  id: string;
  category: string;
  description: string | null;
  amount: number;
  day_of_month: number;
  active: boolean;
  created_at: string;
};

export type PurchaseOrderStatus = "pending" | "ordered" | "received" | "cancelled";

export type PurchaseOrder = {
  id: string;
  part_id: string;
  quantity: number;
  status: PurchaseOrderStatus;
  created_at: string;
  received_at: string | null;
};

export type AppointmentStatus = "scheduled" | "completed" | "cancelled";

export type Appointment = {
  id: string;
  customer_id: string;
  vehicle_id: string | null;
  scheduled_at: string;
  notes: string | null;
  status: AppointmentStatus;
  booked_online: boolean;
  created_at: string;
};
