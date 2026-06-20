# App-side seed list (PRD §8) — NOT a database table. Adding/renaming a category
# is a code deploy at MVP. The frontend keeps its own copy for the dropdown.
CATEGORIES = [
    "HVAC",
    "Electrician",
    "Plumber",
    "Lawn/Landscaping",
    "Dentist",
    "General Contractor",
    "Roofing",
    "Pest Control",
    "House Cleaning",
    "Auto Repair",
    "Painter",
    "Handyman",
]

CATEGORY_SET = frozenset(CATEGORIES)
