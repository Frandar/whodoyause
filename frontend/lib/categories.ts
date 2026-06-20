// App-side seed list (PRD §8) — mirrors backend/src/categories.py. Kept in sync
// by hand; both change only via deploy. Not a database table at MVP.
export const CATEGORIES = [
  'HVAC',
  'Electrician',
  'Plumber',
  'Lawn/Landscaping',
  'Dentist',
  'General Contractor',
  'Roofing',
  'Pest Control',
  'House Cleaning',
  'Auto Repair',
  'Painter',
  'Handyman',
] as const;
