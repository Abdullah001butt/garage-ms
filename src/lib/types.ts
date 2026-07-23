export type Customer = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
};

export type Vehicle = {
  id: string;
  customer_id: string;
  plate_number: string;
  make: string | null;
  model: string | null;
  year: number | null;
  color: string | null;
  vin: string | null;
  notes: string | null;
  created_at: string;
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

export type InvoiceStatus = "unpaid" | "paid";
export type DocumentType = "estimate" | "invoice";

export type Invoice = {
  id: string;
  job_card_id: string | null;
  customer_id: string;
  status: InvoiceStatus;
  document_type: DocumentType;
  vat_rate: number;
  converted_from_estimate_id: string | null;
  created_at: string;
  paid_at: string | null;
};

export type InvoiceItemType = "part" | "labor";

export type InvoiceItem = {
  id: string;
  invoice_id: string;
  part_id: string | null;
  description: string;
  item_type: InvoiceItemType;
  quantity: number;
  unit_price: number;
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
  created_at: string;
};

export type Expense = {
  id: string;
  category: string;
  description: string | null;
  amount: number;
  expense_date: string;
  created_at: string;
};

export type Role = "owner" | "receptionist" | "mechanic";

export type Profile = {
  id: string;
  full_name: string;
  role: Role;
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
  created_at: string;
};
