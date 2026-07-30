export type HelpContent = {
  title: string;
  steps: string[];
};

export const HELP_CONTENT: Record<string, HelpContent> = {
  "/today": {
    title: "Today",
    steps: [
      "This page shows everything that needs your attention right now.",
      "Tap any car or customer name to open its details.",
      "Use the buttons at the top to quickly start a new job, estimate, or appointment.",
    ],
  },
  "/dashboard": {
    title: "Dashboard",
    steps: [
      "This page shows how the business is doing — money in, money out, and top customers.",
      "Tap \"Generate This Week's Insights\" for a simple written summary of the week.",
      "The numbers update automatically as you add jobs, invoices, and expenses.",
    ],
  },
  "/customers": {
    title: "Customers",
    steps: [
      "This is your list of all customers and their cars.",
      "Tap \"+ Add Customer\" to add a new customer and their car.",
      "Tap any customer's name to see their cars, balance, and history.",
      "Use the search box to quickly find a customer by name or phone number.",
    ],
  },
  "/jobs": {
    title: "Job Cards",
    steps: [
      "This is where you track every car currently being worked on.",
      "Tap \"+ New Job Card\" when a car comes in for repair.",
      "Tap a job card to update its status or add what was done.",
      "Use \"Board\" view to see jobs by stage (Pending, In Progress, Completed), or \"List\" for a simple list.",
    ],
  },
  "/jobs/new": {
    title: "New Job Card",
    steps: [
      "Choose the car from the list (search by plate number).",
      "Type what work needs to be done, or tap a quick template button to fill it in automatically.",
      "Tap \"Create Job Card\" to save.",
    ],
  },
  "/appointments": {
    title: "Appointments",
    steps: [
      "This page shows upcoming bookings from customers.",
      "Tap \"Book Appointment\" at the bottom to add a new one yourself.",
      "Tap \"Remind\" to send the customer a WhatsApp reminder.",
      "Tap \"Complete\" or \"Cancel\" once the appointment has happened.",
    ],
  },
  "/service-reminders": {
    title: "Service Reminders",
    steps: [
      "This page shows cars that are due or overdue for their next service.",
      "Tap \"Remind\" to send that customer a WhatsApp message about it.",
    ],
  },
  "/job-templates": {
    title: "Job Templates",
    steps: [
      "These are quick shortcuts for jobs you do often (like Oil Change or Brake Pads).",
      "Tap \"Create Template\" to make a new one with a name, description, and usual price.",
      "When making a New Job Card, tap a template button to fill everything in automatically.",
    ],
  },
  "/estimates": {
    title: "Estimates",
    steps: [
      "This is where you prepare a price quote before doing the work.",
      "Tap \"+ New Estimate\" to start one for a customer.",
      "Once the customer agrees, tap \"Convert to Invoice\" inside the estimate.",
    ],
  },
  "/invoices": {
    title: "Invoices",
    steps: [
      "This is your list of all bills given to customers.",
      "Tap any invoice to see details, add items, or record a payment.",
      "Use \"Send PDF via WhatsApp\" inside an invoice to send the customer a real copy.",
      "Use the search box or status filter to find a specific invoice.",
    ],
  },
  "/reports/outstanding-dues": {
    title: "Outstanding Dues",
    steps: [
      "This page shows every customer who still owes money.",
      "Older debts are shown first, with how many days they've been unpaid.",
      "Tap \"Remind\" to send that customer a WhatsApp payment reminder.",
    ],
  },
  "/expenses": {
    title: "Expenses",
    steps: [
      "This is where you record shop costs like rent, tools, or supplies.",
      "Fill the form at the bottom and tap \"Save Expense.\"",
      "Tap \"Edit\" next to any expense to fix a mistake.",
    ],
  },
  "/reports/vat": {
    title: "VAT Report",
    steps: [
      "This page automatically calculates the VAT (tax) collected for a chosen month.",
      "Pick a month at the top, then tap \"Export Excel\" if you need a copy for the accountant.",
    ],
  },
  "/reports/daily-cashflow": {
    title: "Daily Cash Flow",
    steps: [
      "This page shows money that came in and went out on a specific day.",
      "Pick a date at the top to check a different day.",
      "At the end of the day, count the cash in the drawer and enter it under \"Cash Drawer Reconciliation\" to check it matches.",
    ],
  },
  "/reports/profit-loss": {
    title: "Profit & Loss",
    steps: [
      "This page shows the real profit for a month — money earned minus everything spent.",
      "Pick a month at the top to see a different month's numbers.",
      "Tap \"Export Excel\" to save a copy.",
    ],
  },
  "/partners": {
    title: "Partners",
    steps: [
      "This is where you manage business partners and their share of the profit.",
      "Enter each partner's share percentage — they should add up to 100%.",
      "Check \"View Profit Split Report\" to see how much each partner is owed.",
    ],
  },
  "/inventory": {
    title: "Parts Stock",
    steps: [
      "This page shows how many of each part you have left.",
      "Parts shown in red are running low — order more soon.",
      "Tap \"Scan to Find\" to use your phone's camera to search for a part by its barcode.",
      "Fill the form at the bottom to add a brand new part.",
    ],
  },
  "/purchase-orders": {
    title: "Purchase Orders",
    steps: [
      "This page tracks parts you've ordered from suppliers.",
      "Create these from the Parts Stock page when something is low.",
      "Update the status to \"Ordered\" then \"Received\" as the order progresses.",
    ],
  },
  "/settings": {
    title: "Shop Settings",
    steps: [
      "This is where your shop's name, address, and invoice details are set up.",
      "You usually only need to change this once — it's used on every invoice.",
      "Scroll down to manage company vehicles and holidays too.",
    ],
  },
  "/staff": {
    title: "Staff",
    steps: [
      "This page lists everyone with an account in the system.",
      "Set each person's role and monthly salary here.",
      "Tap \"Attendance & Salary\" to record daily attendance and calculate pay.",
    ],
  },
  "/audit-log": {
    title: "Audit Log",
    steps: [
      "This page shows a history of everything changed in the system, and who did it.",
      "Use the filters at the top to find a specific change by staff member, action, or date.",
    ],
  },
};

export function findHelpForPath(pathname: string): HelpContent | null {
  if (HELP_CONTENT[pathname]) return HELP_CONTENT[pathname];

  const matches = Object.keys(HELP_CONTENT)
    .filter((key) => pathname.startsWith(key))
    .sort((a, b) => b.length - a.length);

  return matches.length > 0 ? HELP_CONTENT[matches[0]] : null;
}
