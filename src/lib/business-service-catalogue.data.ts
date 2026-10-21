/** Reviewed Irish business starter recipes. Draft suggestions only; the owner must save.
 * Excluded professions remain readable in the historical classification catalogue.
 * Labels are scoped to activities, not availability, prices or professional authorisation.
 */
export type ServiceRecipe = {
 label: string; core: readonly string[]; extras: readonly string[];
 question?: string; options?: readonly {id:string;label:string;services:readonly string[]}[];
 manualReview?: boolean;
};
export const SERVICE_STARTER_VERSION = 1 as const;
export const SERVICE_RECIPES: Readonly<Record<string,ServiceRecipe>> = {
  "electrician": {
    "label": "Electrician",
    "core": [
      "Electrical fault finding",
      "Socket and switch repairs",
      "Lighting repairs and installation",
      "Wiring repairs"
    ],
    "extras": [
      "Rewiring",
      "Consumer unit replacement",
      "Electrical testing",
      "EV charger installation",
      "Solar PV",
      "Alarms"
    ]
  },
  "plumber": {
    "label": "Plumber",
    "core": [
      "Leak repairs",
      "Tap repairs and replacement",
      "Toilet repairs",
      "Pipework repairs",
      "Sink and basin plumbing"
    ],
    "extras": [
      "Bathroom installation",
      "Radiator installation",
      "Drain unblocking",
      "Water tanks",
      "Boiler work"
    ]
  },
  "heating_engineer": {
    "label": "Heating engineer",
    "core": [],
    "extras": [
      "Gas boiler servicing",
      "Oil boiler servicing",
      "Boiler replacement",
      "Heat pumps",
      "Underfloor heating"
    ],
    "question": "Heating systems",
    "options": [
      {
        "id": "gas",
        "label": "Gas",
        "services": [
          "Gas boiler servicing",
          "Gas boiler repairs"
        ]
      },
      {
        "id": "oil",
        "label": "Oil",
        "services": [
          "Oil boiler servicing",
          "Oil boiler repairs"
        ]
      },
      {
        "id": "heat_pumps",
        "label": "Heat pumps",
        "services": [
          "Heat pump servicing",
          "Heat pump fault diagnosis"
        ]
      },
      {
        "id": "solid_fuel",
        "label": "Solid fuel",
        "services": [
          "Solid-fuel heating servicing",
          "Solid-fuel heating repairs"
        ]
      }
    ]
  },
  "carpenter_joiner": {
    "label": "Carpenter / joiner",
    "core": [
      "Door fitting and repairs",
      "Skirting and architraves",
      "Shelving",
      "General joinery repairs"
    ],
    "extras": [
      "Fitted wardrobes",
      "Kitchens",
      "Staircases",
      "Roof carpentry",
      "Bespoke furniture"
    ]
  },
  "builder": {
    "label": "Builder",
    "core": [
      "Building repairs",
      "Renovations",
      "Alterations"
    ],
    "extras": [
      "Extensions",
      "New builds",
      "Loft conversions",
      "Commercial construction",
      "Project management"
    ]
  },
  "roofer": {
    "label": "Roofer",
    "core": [],
    "extras": [
      "Slate and tile replacement",
      "Flat roof repairs",
      "Chimney repairs",
      "Fascias and soffits",
      "Full roof replacement"
    ],
    "question": "Roofing work",
    "options": [
      {
        "id": "pitched_roofs",
        "label": "Pitched roofs",
        "services": [
          "Pitched roof repairs",
          "Pitched roof maintenance"
        ]
      },
      {
        "id": "flat_roofs",
        "label": "Flat roofs",
        "services": [
          "Flat roof repairs",
          "Flat roof maintenance"
        ]
      },
      {
        "id": "roofline",
        "label": "Roofline",
        "services": [
          "Gutter repairs",
          "Fascia and soffit repairs"
        ]
      }
    ]
  },
  "painter_decorator": {
    "label": "Painter / decorator",
    "core": [
      "Interior painting",
      "Walls and ceilings",
      "Woodwork painting",
      "Surface preparation"
    ],
    "extras": [
      "Exterior painting",
      "Wallpaper hanging",
      "Spray painting",
      "Commercial decorating"
    ]
  },
  "plasterer": {
    "label": "Plasterer",
    "core": [
      "Internal plastering",
      "Skimming",
      "Plaster repairs"
    ],
    "extras": [
      "External rendering",
      "Dry lining",
      "Coving",
      "Insulated plasterboard"
    ]
  },
  "tiler": {
    "label": "Tiler",
    "core": [
      "Wall tiling",
      "Floor tiling",
      "Tile repairs",
      "Grouting"
    ],
    "extras": [
      "Bathroom tiling",
      "Kitchen tiling",
      "Natural stone",
      "Outdoor tiling",
      "Wet rooms"
    ]
  },
  "flooring_installer": {
    "label": "Flooring installer",
    "core": [],
    "extras": [
      "Laminate floor fitting",
      "Carpet fitting",
      "Engineered wood floor fitting",
      "LVT floor fitting",
      "Vinyl floor fitting",
      "Solid wood floor fitting",
      "Floor sanding"
    ],
    "question": "Floor types",
    "options": [
      {
        "id": "carpet",
        "label": "Carpet",
        "services": [
          "Carpet fitting",
          "Floor preparation"
        ]
      },
      {
        "id": "laminate",
        "label": "Laminate",
        "services": [
          "Laminate floor fitting",
          "Floor preparation"
        ]
      },
      {
        "id": "engineered_wood",
        "label": "Engineered wood",
        "services": [
          "Engineered wood floor fitting",
          "Floor preparation"
        ]
      },
      {
        "id": "solid_wood",
        "label": "Solid wood",
        "services": [
          "Solid wood floor fitting",
          "Floor preparation"
        ]
      },
      {
        "id": "lvt",
        "label": "LVT",
        "services": [
          "LVT floor fitting",
          "Floor preparation"
        ]
      },
      {
        "id": "vinyl",
        "label": "Vinyl",
        "services": [
          "Vinyl floor fitting",
          "Floor preparation"
        ]
      }
    ]
  },
  "locksmith": {
    "label": "Locksmith",
    "core": [
      "Lock repairs",
      "Lock replacement",
      "Lock fitting"
    ],
    "extras": [
      "Lockouts",
      "Key cutting",
      "Vehicle locks",
      "Access control",
      "Master key systems"
    ]
  },
  "windows_glazing": {
    "label": "Windows & glazing",
    "core": [],
    "extras": [
      "Window fitting",
      "Door fitting",
      "Double-glazed unit replacement",
      "Window hardware repairs",
      "Conservatories"
    ],
    "question": "Glazing work",
    "options": [
      {
        "id": "replacement_glass",
        "label": "Replacement glass",
        "services": [
          "Replacement glass",
          "Glazing repairs"
        ]
      },
      {
        "id": "window_installation",
        "label": "Window installation",
        "services": [
          "Window fitting"
        ]
      },
      {
        "id": "door_installation",
        "label": "Door installation",
        "services": [
          "Door fitting"
        ]
      },
      {
        "id": "window_repairs",
        "label": "Window repairs",
        "services": [
          "Window hardware repairs"
        ]
      }
    ]
  },
  "groundwork": {
    "label": "Groundwork",
    "core": [
      "Site preparation",
      "Excavation",
      "Foundations",
      "Drainage groundwork"
    ],
    "extras": [
      "Driveways",
      "Paving",
      "Septic systems",
      "Demolition",
      "Plant hire"
    ]
  },
  "multi_trade": {
    "label": "Multi-trade",
    "core": [],
    "extras": [
      "General joinery repairs",
      "Painting",
      "Tiling",
      "General building repairs",
      "Plumbing repairs"
    ],
    "question": "Trades you cover",
    "options": [
      {
        "id": "joinery",
        "label": "Joinery",
        "services": [
          "Door fitting and repairs",
          "General joinery repairs"
        ]
      },
      {
        "id": "painting",
        "label": "Painting",
        "services": [
          "Interior painting",
          "Surface preparation"
        ]
      },
      {
        "id": "tiling",
        "label": "Tiling",
        "services": [
          "Wall tiling",
          "Floor tiling"
        ]
      },
      {
        "id": "general_repairs",
        "label": "General repairs",
        "services": [
          "Minor property repairs",
          "Routine property upkeep"
        ]
      },
      {
        "id": "plumbing",
        "label": "Plumbing",
        "services": [
          "Leak repairs",
          "Tap repairs and replacement",
          "Toilet repairs"
        ]
      }
    ]
  },
  "cleaning": {
    "label": "Cleaning",
    "core": [],
    "extras": [
      "Domestic cleaning",
      "Office cleaning",
      "End-of-tenancy cleaning",
      "Window cleaning",
      "Carpet cleaning",
      "Oven cleaning"
    ],
    "question": "Premises you clean",
    "options": [
      {
        "id": "homes",
        "label": "Homes",
        "services": [
          "Regular home cleaning",
          "Deep home cleaning"
        ]
      },
      {
        "id": "commercial_premises",
        "label": "Commercial premises",
        "services": [
          "Commercial cleaning"
        ]
      },
      {
        "id": "accommodation",
        "label": "Accommodation",
        "services": [
          "Changeover cleaning"
        ]
      }
    ]
  },
  "gardening_landscaping": {
    "label": "Gardening / landscaping",
    "core": [
      "Lawn mowing",
      "Hedge trimming",
      "Weeding",
      "Garden maintenance"
    ],
    "extras": [
      "Planting",
      "Turfing",
      "Garden design",
      "Patios",
      "Tree work"
    ]
  },
  "property_maintenance": {
    "label": "Property maintenance",
    "core": [
      "Minor property repairs",
      "Routine property upkeep"
    ],
    "extras": [
      "Painting",
      "Joinery repairs",
      "Plumbing repairs",
      "Grounds maintenance",
      "Landlord maintenance"
    ]
  },
  "pest_control": {
    "label": "Pest control",
    "core": [],
    "extras": [
      "Rodent control",
      "Crawling insect control",
      "Wasp treatment",
      "Bird control",
      "Commercial monitoring"
    ],
    "question": "Pests you treat",
    "options": [
      {
        "id": "rodents",
        "label": "Rodents",
        "services": [
          "Rodent inspections",
          "Rodent treatment"
        ]
      },
      {
        "id": "crawling_insects",
        "label": "Crawling insects",
        "services": [
          "Crawling insect inspections",
          "Crawling insect treatment"
        ]
      },
      {
        "id": "wasps",
        "label": "Wasps",
        "services": [
          "Wasp nest treatment"
        ]
      },
      {
        "id": "monitoring_only",
        "label": "Monitoring only",
        "services": [
          "Pest inspections",
          "Pest monitoring"
        ]
      }
    ]
  },
  "appliance_repair": {
    "label": "Appliance repair",
    "core": [],
    "extras": [
      "Washing machines",
      "Tumble dryers",
      "Dishwashers",
      "Electric ovens",
      "Fridges and freezers"
    ],
    "question": "Appliances you repair",
    "options": [
      {
        "id": "washing_machines",
        "label": "Washing machines",
        "services": [
          "Washing machine fault diagnosis",
          "Washing machine repairs"
        ]
      },
      {
        "id": "tumble_dryers",
        "label": "Tumble dryers",
        "services": [
          "Tumble dryer fault diagnosis",
          "Tumble dryer repairs"
        ]
      },
      {
        "id": "dishwashers",
        "label": "Dishwashers",
        "services": [
          "Dishwasher fault diagnosis",
          "Dishwasher repairs"
        ]
      },
      {
        "id": "electric_ovens",
        "label": "Electric ovens",
        "services": [
          "Electric oven fault diagnosis",
          "Electric oven repairs"
        ]
      },
      {
        "id": "fridges_and_freezers",
        "label": "Fridges and freezers",
        "services": [
          "Fridge and freezer fault diagnosis",
          "Fridge and freezer repairs"
        ]
      }
    ]
  },
  "removals_storage": {
    "label": "Removals / storage",
    "core": [],
    "extras": [
      "House removals",
      "Office removals",
      "Furniture transport",
      "Packing",
      "Self-storage",
      "Container storage"
    ],
    "question": "Business activities",
    "options": [
      {
        "id": "removals",
        "label": "Removals",
        "services": [
          "House removals",
          "Furniture transport"
        ]
      },
      {
        "id": "storage",
        "label": "Storage",
        "services": [
          "Storage space rental"
        ]
      }
    ]
  },
  "waste_removal": {
    "label": "Waste removal",
    "core": [],
    "extras": [
      "Household clearances",
      "Garden waste collection",
      "Bulky item collection",
      "Office clearances",
      "Construction waste collection"
    ],
    "question": "Waste you collect",
    "options": [
      {
        "id": "garden_waste",
        "label": "Garden waste",
        "services": [
          "Garden waste collection"
        ]
      },
      {
        "id": "bulky_household_items",
        "label": "Bulky household items",
        "services": [
          "Bulky household item collection"
        ]
      },
      {
        "id": "office_clearances",
        "label": "Office clearances",
        "services": [
          "Office clearances"
        ]
      },
      {
        "id": "construction_waste",
        "label": "Construction waste",
        "services": [
          "Construction waste collection"
        ]
      }
    ]
  },
  "hair_salon": {
    "label": "Hair salon",
    "core": [
      "Haircuts",
      "Blow-dries",
      "Root touch-ups",
      "All-over colour",
      "Highlights",
      "Balayage",
      "Toner",
      "Conditioning treatments"
    ],
    "extras": [
      "Hair extensions",
      "Colour correction",
      "Keratin smoothing",
      "Bridal hair",
      "Perms",
      "Specialist curly cuts"
    ]
  },
  "barber": {
    "label": "Barber",
    "core": [
      "Haircuts",
      "Clipper cuts",
      "Beard trims"
    ],
    "extras": [
      "Skin fades",
      "Hot towel shaves",
      "Hair colouring",
      "Children's cuts",
      "Hair systems"
    ]
  },
  "nail_salon": {
    "label": "Nail salon",
    "core": [],
    "extras": [
      "Gel polish application",
      "Gel removal",
      "Pedicures",
      "Acrylic extensions",
      "Builder gel overlays",
      "Nail art"
    ],
    "question": "Nail services",
    "options": [
      {
        "id": "natural_nails",
        "label": "Natural nails",
        "services": [
          "Manicures",
          "Nail polish application"
        ]
      },
      {
        "id": "gel_polish",
        "label": "Gel polish",
        "services": [
          "Gel polish application",
          "Gel polish removal"
        ]
      },
      {
        "id": "builder_gel",
        "label": "Builder gel",
        "services": [
          "Builder gel overlays",
          "Builder gel infills"
        ]
      },
      {
        "id": "gel_extensions",
        "label": "Gel extensions",
        "services": [
          "Gel nail extensions",
          "Gel nail infills"
        ]
      },
      {
        "id": "acrylic_extensions",
        "label": "Acrylic extensions",
        "services": [
          "Acrylic nail extensions",
          "Acrylic nail infills"
        ]
      },
      {
        "id": "pedicures",
        "label": "Pedicures",
        "services": [
          "Pedicures"
        ]
      }
    ]
  },
  "beauty_salon": {
    "label": "Beauty salon",
    "core": [],
    "extras": [
      "Cosmetic facials",
      "Waxing",
      "Brows",
      "Lashes",
      "Nails",
      "Makeup"
    ],
    "question": "Treatment families",
    "options": [
      {
        "id": "facials",
        "label": "Facials",
        "services": [
          "Cosmetic facials"
        ]
      },
      {
        "id": "waxing",
        "label": "Waxing",
        "services": [
          "Leg waxing",
          "Underarm waxing",
          "Facial waxing"
        ]
      },
      {
        "id": "brows",
        "label": "Brows",
        "services": [
          "Brow shaping"
        ]
      },
      {
        "id": "lashes",
        "label": "Lashes",
        "services": [
          "Lash lifts"
        ]
      },
      {
        "id": "nails",
        "label": "Nails",
        "services": [
          "Manicures",
          "Nail polish application"
        ]
      },
      {
        "id": "makeup",
        "label": "Makeup",
        "services": [
          "Occasion makeup"
        ]
      }
    ]
  },
  "lashes_brows": {
    "label": "Lashes / brows",
    "core": [],
    "extras": [
      "Brow shaping",
      "Brow tinting",
      "Brow lamination",
      "Lash tinting",
      "Lash lifts",
      "Lash extensions",
      "Lash infills"
    ],
    "question": "Lash and brow services",
    "options": [
      {
        "id": "brows",
        "label": "Brows",
        "services": [
          "Brow shaping"
        ]
      },
      {
        "id": "lash_lifts",
        "label": "Lash lifts",
        "services": [
          "Lash lifts"
        ]
      },
      {
        "id": "lash_extensions",
        "label": "Lash extensions",
        "services": [
          "Lash extension application",
          "Lash extension infills"
        ]
      }
    ]
  },
  "waxing": {
    "label": "Waxing",
    "core": [
      "Leg waxing",
      "Underarm waxing",
      "Facial waxing"
    ],
    "extras": [
      "Bikini waxing",
      "Intimate waxing",
      "Arm waxing",
      "Back waxing",
      "Chest waxing"
    ]
  },
  "makeup_artist": {
    "label": "Makeup artist",
    "core": [
      "Makeup application",
      "Occasion makeup"
    ],
    "extras": [
      "Bridal makeup",
      "Bridal trials",
      "Editorial makeup",
      "Lessons",
      "Special effects makeup"
    ]
  },
  "spa": {
    "label": "Spa",
    "core": [],
    "extras": [
      "Cosmetic facials",
      "Nonclinical cosmetic body treatments",
      "Manicures",
      "Pedicures",
      "Thermal suite access"
    ],
    "question": "Cosmetic services and facilities",
    "options": [
      {
        "id": "facials",
        "label": "Facials",
        "services": [
          "Cosmetic facials"
        ]
      },
      {
        "id": "body_treatments",
        "label": "Body treatments",
        "services": [
          "Nonclinical cosmetic body treatments"
        ]
      },
      {
        "id": "manicures",
        "label": "Manicures",
        "services": [
          "Manicures"
        ]
      },
      {
        "id": "pedicures",
        "label": "Pedicures",
        "services": [
          "Pedicures"
        ]
      },
      {
        "id": "thermal_facilities",
        "label": "Thermal facilities",
        "services": [
          "Thermal suite access"
        ]
      }
    ]
  },
  "gym": {
    "label": "Gym",
    "core": [
      "Gym access"
    ],
    "extras": [
      "Memberships",
      "Group fitness classes",
      "Personal training",
      "Fitness induction",
      "Swimming",
      "Sauna facilities"
    ]
  },
  "personal_trainer": {
    "label": "Personal trainer",
    "core": [
      "Personal training sessions",
      "Fitness assessments",
      "Exercise programmes"
    ],
    "extras": [
      "Small-group training",
      "Online coaching",
      "Sports conditioning",
      "Specialist population training"
    ]
  },
  "yoga": {
    "label": "Yoga",
    "core": [
      "Yoga classes"
    ],
    "extras": [
      "Private yoga sessions",
      "Beginner courses",
      "Pregnancy yoga",
      "Children's yoga",
      "Workshops"
    ]
  },
  "pilates": {
    "label": "Pilates",
    "core": [],
    "extras": [
      "Mat Pilates classes",
      "Reformer Pilates classes",
      "Private Pilates sessions",
      "Beginner courses"
    ],
    "question": "Pilates formats",
    "options": [
      {
        "id": "mat",
        "label": "Mat",
        "services": [
          "Mat Pilates classes"
        ]
      },
      {
        "id": "reformer",
        "label": "Reformer",
        "services": [
          "Reformer Pilates classes"
        ]
      },
      {
        "id": "private_sessions",
        "label": "Private sessions",
        "services": [
          "Private Pilates sessions"
        ]
      }
    ]
  },
  "sports_coaching": {
    "label": "Sports coaching",
    "core": [],
    "extras": [
      "Individual coaching",
      "Team coaching",
      "Training camps",
      "Junior coaching",
      "Competition preparation"
    ],
    "question": "Coaching formats",
    "options": [
      {
        "id": "individual",
        "label": "Individual",
        "services": [
          "Individual sports coaching"
        ]
      },
      {
        "id": "groups",
        "label": "Groups",
        "services": [
          "Group sports coaching"
        ]
      },
      {
        "id": "teams",
        "label": "Teams",
        "services": [
          "Team sports coaching"
        ]
      }
    ]
  },
  "restaurant": {
    "label": "Restaurant",
    "core": [
      "Restaurant dining"
    ],
    "extras": [
      "Lunch",
      "Dinner",
      "Breakfast",
      "Takeaway",
      "Private dining",
      "Group dining",
      "Outside catering"
    ]
  },
  "caf": {
    "label": "Café",
    "core": [
      "Coffee",
      "Tea",
      "Café drinks"
    ],
    "extras": [
      "Pastries",
      "Breakfast",
      "Lunch",
      "Sandwiches",
      "Takeaway drinks",
      "Catering"
    ]
  },
  "takeaway": {
    "label": "Takeaway",
    "core": [],
    "extras": [
      "Takeaway food collection",
      "Takeaway food delivery",
      "Online ordering",
      "Catering",
      "Dine-in"
    ],
    "question": "How you serve customers",
    "options": [
      {
        "id": "collection",
        "label": "Collection",
        "services": [
          "Takeaway food collection"
        ]
      },
      {
        "id": "own_delivery",
        "label": "Own delivery",
        "services": [
          "Takeaway food delivery"
        ]
      },
      {
        "id": "delivery_partner",
        "label": "Delivery partner",
        "services": [
          "Takeaway orders through a delivery partner"
        ]
      }
    ]
  },
  "pub_bar": {
    "label": "Pub / bar",
    "core": [
      "Bar drinks"
    ],
    "extras": [
      "Food service",
      "Private functions",
      "Live entertainment",
      "Room hire",
      "Accommodation"
    ]
  },
  "catering": {
    "label": "Catering",
    "core": [],
    "extras": [
      "Corporate catering",
      "Wedding catering",
      "Buffet catering",
      "Private dining",
      "Staffed service",
      "Equipment hire"
    ],
    "question": "Catering formats",
    "options": [
      {
        "id": "drop_off",
        "label": "Drop-off",
        "services": [
          "Drop-off event catering"
        ]
      },
      {
        "id": "staffed",
        "label": "Staffed",
        "services": [
          "Staffed event catering"
        ]
      },
      {
        "id": "corporate",
        "label": "Corporate",
        "services": [
          "Corporate catering"
        ]
      },
      {
        "id": "weddings",
        "label": "Weddings",
        "services": [
          "Wedding catering"
        ]
      },
      {
        "id": "private_events",
        "label": "Private events",
        "services": [
          "Private event catering"
        ]
      }
    ]
  },
  "hotel": {
    "label": "Hotel",
    "core": [
      "Room stays"
    ],
    "extras": [
      "Breakfast",
      "Restaurant dining",
      "Conference rooms",
      "Weddings",
      "Spa",
      "Parking",
      "Pet-friendly stays"
    ]
  },
  "guesthouse_b_b": {
    "label": "Guesthouse / B&B",
    "core": [],
    "extras": [
      "Breakfast",
      "Evening meals",
      "Group stays",
      "Parking",
      "Pet-friendly stays"
    ],
    "question": "Accommodation and meals",
    "options": [
      {
        "id": "accommodation",
        "label": "Accommodation",
        "services": [
          "Guest accommodation"
        ]
      },
      {
        "id": "breakfast",
        "label": "Breakfast",
        "services": [
          "Breakfast"
        ]
      }
    ]
  },
  "holiday_accommodation": {
    "label": "Holiday accommodation",
    "core": [
      "Holiday stays"
    ],
    "extras": [
      "Longer stays",
      "Group accommodation",
      "Pet-friendly stays",
      "Accessible accommodation",
      "Cleaning services"
    ]
  },
  "garage_mechanic": {
    "label": "Garage / mechanic",
    "core": [],
    "extras": [
      "Clutches",
      "Timing belts",
      "Exhausts",
      "Suspension",
      "Air conditioning",
      "NCT preparation",
      "Hybrid and EV work"
    ],
    "question": "Vehicles you work on",
    "options": [
      {
        "id": "cars_and_light_vans",
        "label": "Cars and light vans",
        "services": [
          "Vehicle servicing",
          "Oil and filter changes",
          "Brake repairs",
          "Mechanical fault diagnosis",
          "Battery replacement"
        ]
      },
      {
        "id": "motorcycles",
        "label": "Motorcycles",
        "services": [
          "Motorcycle servicing",
          "Motorcycle repairs",
          "Motorcycle fault diagnosis"
        ]
      },
      {
        "id": "hgvs",
        "label": "HGVs",
        "services": [
          "HGV servicing",
          "HGV repairs",
          "HGV fault diagnosis"
        ]
      },
      {
        "id": "electric_vehicles",
        "label": "Electric vehicles",
        "services": [
          "EV servicing",
          "EV fault diagnosis"
        ]
      }
    ]
  },
  "tyre_centre": {
    "label": "Tyre centre",
    "core": [
      "Tyre supply and fitting",
      "Puncture repairs",
      "Wheel balancing",
      "Tyre checks"
    ],
    "extras": [
      "Wheel alignment",
      "Mobile fitting",
      "Alloy wheel repair",
      "Commercial vehicle tyres",
      "Agricultural tyres",
      "Suspension repairs"
    ]
  },
  "body_repair": {
    "label": "Body repair",
    "core": [
      "Vehicle body repairs",
      "Dent repairs",
      "Paintwork repairs"
    ],
    "extras": [
      "Bumper repairs",
      "Scratch repairs",
      "Alloy refurbishment",
      "Insurance repair handling",
      "Chassis repairs",
      "Classic restoration"
    ]
  },
  "vehicle_dealership": {
    "label": "Vehicle dealership",
    "core": [],
    "extras": [
      "Trade-ins",
      "Test drives",
      "Vehicle sourcing",
      "Vehicle servicing",
      "Mechanical repairs",
      "Vehicle parts sales"
    ],
    "question": "Dealership activities",
    "options": [
      {
        "id": "sales",
        "label": "Sales",
        "services": [
          "Vehicle sales"
        ]
      },
      {
        "id": "workshop",
        "label": "Workshop",
        "services": [
          "Vehicle servicing",
          "Oil and filter changes",
          "Brake repairs",
          "Mechanical fault diagnosis",
          "Battery replacement"
        ]
      },
      {
        "id": "parts",
        "label": "Parts",
        "services": [
          "Vehicle parts sales"
        ]
      }
    ]
  },
  "vehicle_recovery": {
    "label": "Vehicle recovery",
    "core": [],
    "extras": [
      "Jump starts",
      "Spare wheel fitting",
      "Roadside repairs",
      "Accident recovery",
      "Heavy vehicle recovery",
      "Vehicle storage"
    ],
    "question": "Recovery services",
    "options": [
      {
        "id": "car_and_light_van_recovery",
        "label": "Car and light van recovery",
        "services": [
          "Car and light van recovery",
          "Car and light van towing"
        ]
      },
      {
        "id": "heavy_vehicle_recovery",
        "label": "Heavy vehicle recovery",
        "services": [
          "Heavy vehicle recovery",
          "Heavy vehicle towing"
        ]
      },
      {
        "id": "transport_only",
        "label": "Transport only",
        "services": [
          "Vehicle transport"
        ]
      },
      {
        "id": "roadside_assistance",
        "label": "Roadside assistance",
        "services": [
          "Jump starts",
          "Spare wheel fitting"
        ]
      }
    ]
  },
  "valeting_detailing": {
    "label": "Valeting / detailing",
    "core": [],
    "extras": [
      "Machine polishing",
      "Paint correction",
      "Ceramic coating",
      "Upholstery shampooing",
      "Odour treatment",
      "Mobile valeting"
    ],
    "question": "Vehicle care",
    "options": [
      {
        "id": "valeting",
        "label": "Valeting",
        "services": [
          "Exterior vehicle cleaning",
          "Interior vehicle cleaning",
          "Vehicle valeting"
        ]
      },
      {
        "id": "paint_correction",
        "label": "Paint correction",
        "services": [
          "Paint correction"
        ]
      },
      {
        "id": "machine_polishing",
        "label": "Machine polishing",
        "services": [
          "Machine polishing"
        ]
      },
      {
        "id": "ceramic_coatings",
        "label": "Ceramic coatings",
        "services": [
          "Ceramic coating"
        ]
      }
    ]
  },
  "vehicle_rental": {
    "label": "Vehicle rental",
    "core": [],
    "extras": [
      "Car hire",
      "Van hire",
      "Minibus hire",
      "Long-term hire",
      "Vehicle delivery"
    ],
    "question": "Vehicles for hire",
    "options": [
      {
        "id": "cars",
        "label": "Cars",
        "services": [
          "Car hire"
        ]
      },
      {
        "id": "vans",
        "label": "Vans",
        "services": [
          "Van hire"
        ]
      },
      {
        "id": "minibuses",
        "label": "Minibuses",
        "services": [
          "Minibus hire"
        ]
      },
      {
        "id": "motorcycles",
        "label": "Motorcycles",
        "services": [
          "Motorcycle hire"
        ]
      },
      {
        "id": "specialist_vehicles",
        "label": "Specialist vehicles",
        "services": [
          "Specialist vehicle hire"
        ]
      }
    ]
  },
  "consultant": {
    "label": "Consultant",
    "core": [],
    "extras": [
      "Business strategy reviews",
      "Operational reviews",
      "Process improvement",
      "HR consulting",
      "Marketing consulting",
      "Project support"
    ],
    "question": "Business consulting areas",
    "options": [
      {
        "id": "strategy",
        "label": "Strategy",
        "services": [
          "Business strategy reviews"
        ]
      },
      {
        "id": "operations",
        "label": "Operations",
        "services": [
          "Operational reviews",
          "Process improvement"
        ]
      },
      {
        "id": "hr_administration",
        "label": "HR administration",
        "services": [
          "HR process consulting"
        ]
      },
      {
        "id": "marketing",
        "label": "Marketing",
        "services": [
          "Marketing consulting"
        ]
      },
      {
        "id": "technology",
        "label": "Technology",
        "services": [
          "Business technology implementation consulting"
        ]
      }
    ]
  },
  "recruitment_agency": {
    "label": "Recruitment agency",
    "core": [],
    "extras": [
      "Permanent recruitment",
      "Temporary staffing",
      "Contract recruitment",
      "Executive search",
      "Payroll services"
    ],
    "question": "Recruitment models",
    "options": [
      {
        "id": "permanent",
        "label": "Permanent",
        "services": [
          "Permanent recruitment",
          "Candidate sourcing"
        ]
      },
      {
        "id": "temporary",
        "label": "Temporary",
        "services": [
          "Temporary staffing",
          "Candidate sourcing"
        ]
      },
      {
        "id": "contract",
        "label": "Contract",
        "services": [
          "Contract recruitment",
          "Candidate sourcing"
        ]
      },
      {
        "id": "executive_search",
        "label": "Executive search",
        "services": [
          "Executive search"
        ]
      }
    ]
  },
  "estate_agent": {
    "label": "Estate agent",
    "core": [
      "Property sales",
      "Property valuations",
      "Property viewings"
    ],
    "extras": [
      "Lettings",
      "Commercial sales",
      "Auctions",
      "Property management",
      "New developments"
    ]
  },
  "letting_agent": {
    "label": "Letting agent",
    "core": [
      "Rental property marketing",
      "Rental viewings",
      "Tenant sourcing"
    ],
    "extras": [
      "Lease administration",
      "Rent collection",
      "Inspections",
      "Property management",
      "Commercial lettings"
    ]
  },
  "property_management": {
    "label": "Property management",
    "core": [],
    "extras": [
      "Rent collection",
      "Tenant management",
      "Block management",
      "Service charge administration",
      "Commercial management"
    ],
    "question": "Properties you manage",
    "options": [
      {
        "id": "rental_properties",
        "label": "Rental properties",
        "services": [
          "Tenancy management",
          "Property maintenance coordination"
        ]
      },
      {
        "id": "blocks_and_omcs",
        "label": "Blocks and OMCs",
        "services": [
          "Block management",
          "Service charge administration"
        ]
      },
      {
        "id": "commercial",
        "label": "Commercial",
        "services": [
          "Commercial property management",
          "Property maintenance coordination"
        ]
      }
    ]
  },
  "accommodation_management": {
    "label": "Accommodation management",
    "core": [
      "Guest communication",
      "Accommodation listing management",
      "Changeover coordination"
    ],
    "extras": [
      "Cleaning",
      "Linen",
      "Check-in support",
      "Maintenance coordination",
      "Revenue management"
    ]
  },
  "tutor": {
    "label": "Tutor",
    "core": [],
    "extras": [
      "Junior Cycle preparation",
      "Leaving Certificate preparation",
      "Primary tuition",
      "Adult tuition",
      "Group lessons"
    ],
    "question": "Learner levels",
    "options": [
      {
        "id": "primary",
        "label": "Primary",
        "services": [
          "Primary school tuition"
        ]
      },
      {
        "id": "junior_cycle",
        "label": "Junior Cycle",
        "services": [
          "Junior Cycle tuition"
        ]
      },
      {
        "id": "leaving_certificate",
        "label": "Leaving Certificate",
        "services": [
          "Leaving Certificate tuition"
        ]
      },
      {
        "id": "third_level",
        "label": "Third level",
        "services": [
          "Third-level tuition"
        ]
      },
      {
        "id": "adults",
        "label": "Adults",
        "services": [
          "Adult tuition"
        ]
      }
    ]
  },
  "language_school": {
    "label": "Language school",
    "core": [],
    "extras": [
      "Language conversation classes",
      "Exam preparation",
      "Private lessons",
      "Children's courses",
      "Business language courses"
    ],
    "question": "Language teaching formats",
    "options": [
      {
        "id": "courses",
        "label": "Courses",
        "services": [
          "Language courses"
        ]
      },
      {
        "id": "private_lessons",
        "label": "Private lessons",
        "services": [
          "Private language lessons"
        ]
      },
      {
        "id": "conversation",
        "label": "Conversation",
        "services": [
          "Language conversation classes"
        ]
      },
      {
        "id": "business",
        "label": "Business",
        "services": [
          "Business language courses"
        ]
      }
    ]
  },
  "driving_instructor": {
    "label": "Driving instructor",
    "core": [],
    "extras": [
      "EDT lessons",
      "Automatic lessons",
      "Manual lessons",
      "Refresher lessons",
      "Motorbike training",
      "Trailer training"
    ],
    "question": "Driving lesson types",
    "options": [
      {
        "id": "manual_cars",
        "label": "Manual cars",
        "services": [
          "Manual car driving lessons",
          "Driving test preparation"
        ]
      },
      {
        "id": "automatic_cars",
        "label": "Automatic cars",
        "services": [
          "Automatic car driving lessons",
          "Driving test preparation"
        ]
      },
      {
        "id": "motorcycles",
        "label": "Motorcycles",
        "services": [
          "Motorcycle riding lessons",
          "Motorcycle test preparation"
        ]
      },
      {
        "id": "hgvs",
        "label": "HGVs",
        "services": [
          "HGV driving lessons",
          "HGV test preparation"
        ]
      },
      {
        "id": "buses",
        "label": "Buses",
        "services": [
          "Bus driving lessons",
          "Bus test preparation"
        ]
      },
      {
        "id": "trailers",
        "label": "Trailers",
        "services": [
          "Trailer driving lessons",
          "Trailer test preparation"
        ]
      }
    ]
  },
  "training_provider": {
    "label": "Training provider",
    "core": [],
    "extras": [
      "Workplace training",
      "Technical training",
      "Professional development courses",
      "Online courses",
      "Workshops"
    ],
    "question": "Training subjects",
    "options": [
      {
        "id": "professional_development",
        "label": "Professional development",
        "services": [
          "Professional development courses"
        ]
      },
      {
        "id": "software",
        "label": "Software",
        "services": [
          "Software training"
        ]
      },
      {
        "id": "technical_skills",
        "label": "Technical skills",
        "services": [
          "Technical skills training"
        ]
      },
      {
        "id": "customer_service",
        "label": "Customer service",
        "services": [
          "Customer service training"
        ]
      },
      {
        "id": "manual_handling",
        "label": "Manual handling",
        "services": [
          "Manual handling training"
        ]
      },
      {
        "id": "food_safety",
        "label": "Food safety",
        "services": [
          "Food safety training"
        ]
      }
    ]
  },
  "music_teacher": {
    "label": "Music teacher",
    "core": [],
    "extras": [
      "Music theory",
      "Exam preparation",
      "Group lessons",
      "Ensemble coaching",
      "Home visits"
    ],
    "question": "Music lessons",
    "options": [
      {
        "id": "piano",
        "label": "Piano",
        "services": [
          "Piano lessons"
        ]
      },
      {
        "id": "guitar",
        "label": "Guitar",
        "services": [
          "Guitar lessons"
        ]
      },
      {
        "id": "voice",
        "label": "Voice",
        "services": [
          "Singing lessons"
        ]
      },
      {
        "id": "violin",
        "label": "Violin",
        "services": [
          "Violin lessons"
        ]
      },
      {
        "id": "drums",
        "label": "Drums",
        "services": [
          "Drum lessons"
        ]
      },
      {
        "id": "other_instruments",
        "label": "Other instruments",
        "services": [
          "Music lessons"
        ]
      }
    ]
  },
  "dance_school": {
    "label": "Dance school",
    "core": [],
    "extras": [
      "Private lessons",
      "Children's classes",
      "Adult classes",
      "Wedding choreography",
      "Exam preparation"
    ],
    "question": "Dance styles",
    "options": [
      {
        "id": "ballet",
        "label": "Ballet",
        "services": [
          "Ballet classes"
        ]
      },
      {
        "id": "contemporary",
        "label": "Contemporary",
        "services": [
          "Contemporary dance classes"
        ]
      },
      {
        "id": "ballroom",
        "label": "Ballroom",
        "services": [
          "Ballroom dance classes"
        ]
      },
      {
        "id": "latin",
        "label": "Latin",
        "services": [
          "Latin dance classes"
        ]
      },
      {
        "id": "irish_dancing",
        "label": "Irish dancing",
        "services": [
          "Irish dancing classes"
        ]
      },
      {
        "id": "hip_hop",
        "label": "Hip hop",
        "services": [
          "Hip hop dance classes"
        ]
      },
      {
        "id": "other_styles",
        "label": "Other styles",
        "services": [
          "Dance classes"
        ]
      }
    ]
  },
  "pet_groomer": {
    "label": "Pet groomer",
    "core": [],
    "extras": [
      "Clipping and styling",
      "Nail trimming",
      "De-shedding",
      "Hand stripping",
      "Cat grooming"
    ],
    "question": "Animals you groom",
    "options": [
      {
        "id": "dogs",
        "label": "Dogs",
        "services": [
          "Dog grooming",
          "Dog bathing and drying",
          "Dog coat brushing"
        ]
      },
      {
        "id": "cats",
        "label": "Cats",
        "services": [
          "Cat grooming",
          "Cat coat brushing"
        ]
      },
      {
        "id": "other_animals",
        "label": "Other animals",
        "services": [
          "Pet grooming"
        ]
      }
    ]
  },
  "boarding_kennels_cattery": {
    "label": "Boarding kennels / cattery",
    "core": [],
    "extras": [
      "Dog boarding",
      "Cat boarding",
      "Daycare",
      "Pet collection",
      "Medication support"
    ],
    "question": "Animals you board",
    "options": [
      {
        "id": "dogs",
        "label": "Dogs",
        "services": [
          "Dog boarding"
        ]
      },
      {
        "id": "cats",
        "label": "Cats",
        "services": [
          "Cat boarding"
        ]
      }
    ]
  },
  "dog_walker": {
    "label": "Dog walker",
    "core": [
      "Dog walking"
    ],
    "extras": [
      "Solo walks",
      "Group walks",
      "Puppy visits",
      "Home visits",
      "Pet sitting",
      "Overnight care"
    ]
  },
  "animal_trainer": {
    "label": "Animal trainer",
    "core": [],
    "extras": [
      "Puppy training",
      "Dog obedience training",
      "Group classes",
      "Behaviour consultations",
      "Residential training"
    ],
    "question": "Training services",
    "options": [
      {
        "id": "puppy_training",
        "label": "Puppy training",
        "services": [
          "Puppy training"
        ]
      },
      {
        "id": "dog_obedience",
        "label": "Dog obedience",
        "services": [
          "Dog obedience training"
        ]
      },
      {
        "id": "group_classes",
        "label": "Group classes",
        "services": [
          "Animal training classes"
        ]
      },
      {
        "id": "other_species",
        "label": "Other species",
        "services": [
          "Animal training sessions"
        ]
      }
    ]
  },
  "equestrian_services": {
    "label": "Equestrian services",
    "core": [],
    "extras": [
      "Riding lessons",
      "Full livery",
      "DIY livery",
      "Horse schooling",
      "Competition coaching",
      "Horse transport"
    ],
    "question": "Equestrian activities",
    "options": [
      {
        "id": "riding_school",
        "label": "Riding school",
        "services": [
          "Riding lessons"
        ]
      },
      {
        "id": "full_livery",
        "label": "Full livery",
        "services": [
          "Full livery"
        ]
      },
      {
        "id": "diy_livery",
        "label": "DIY livery",
        "services": [
          "DIY livery"
        ]
      },
      {
        "id": "schooling",
        "label": "Schooling",
        "services": [
          "Horse schooling"
        ]
      },
      {
        "id": "trekking",
        "label": "Trekking",
        "services": [
          "Riding treks"
        ]
      }
    ]
  },
  "event_planner": {
    "label": "Event planner",
    "core": [],
    "extras": [
      "Wedding planning",
      "Corporate events",
      "Private parties",
      "On-the-day coordination",
      "Supplier sourcing"
    ],
    "question": "Events you plan",
    "options": [
      {
        "id": "weddings",
        "label": "Weddings",
        "services": [
          "Wedding planning",
          "Wedding coordination"
        ]
      },
      {
        "id": "corporate",
        "label": "Corporate",
        "services": [
          "Corporate event planning",
          "Corporate event coordination"
        ]
      },
      {
        "id": "private_parties",
        "label": "Private parties",
        "services": [
          "Private party planning",
          "Private party coordination"
        ]
      }
    ]
  },
  "event_venue": {
    "label": "Event venue",
    "core": [],
    "extras": [
      "Wedding venue hire",
      "Corporate events",
      "Private parties",
      "Catering",
      "Equipment hire",
      "Accommodation"
    ],
    "question": "Venue hire",
    "options": [
      {
        "id": "weddings",
        "label": "Weddings",
        "services": [
          "Wedding venue hire"
        ]
      },
      {
        "id": "corporate_events",
        "label": "Corporate events",
        "services": [
          "Corporate event venue hire"
        ]
      },
      {
        "id": "private_parties",
        "label": "Private parties",
        "services": [
          "Private party venue hire"
        ]
      },
      {
        "id": "meetings",
        "label": "Meetings",
        "services": [
          "Meeting room hire"
        ]
      },
      {
        "id": "rehearsals",
        "label": "Rehearsals",
        "services": [
          "Rehearsal room hire"
        ]
      }
    ]
  },
  "photographer": {
    "label": "Photographer",
    "core": [],
    "extras": [
      "Portraits",
      "Weddings",
      "Events",
      "Commercial photography",
      "Property photography",
      "Product photography"
    ],
    "question": "Photography work",
    "options": [
      {
        "id": "weddings",
        "label": "Weddings",
        "services": [
          "Wedding photography"
        ]
      },
      {
        "id": "portraits",
        "label": "Portraits",
        "services": [
          "Portrait photography"
        ]
      },
      {
        "id": "events",
        "label": "Events",
        "services": [
          "Event photography"
        ]
      },
      {
        "id": "products",
        "label": "Products",
        "services": [
          "Product photography"
        ]
      },
      {
        "id": "property",
        "label": "Property",
        "services": [
          "Property photography"
        ]
      },
      {
        "id": "commercial",
        "label": "Commercial",
        "services": [
          "Commercial photography"
        ]
      }
    ]
  },
  "videographer": {
    "label": "Videographer",
    "core": [],
    "extras": [
      "Wedding films",
      "Event filming",
      "Corporate videos",
      "Promotional videos",
      "Drone filming",
      "Live streaming"
    ],
    "question": "Video work",
    "options": [
      {
        "id": "weddings",
        "label": "Weddings",
        "services": [
          "Wedding filming"
        ]
      },
      {
        "id": "corporate",
        "label": "Corporate",
        "services": [
          "Corporate filming"
        ]
      },
      {
        "id": "events",
        "label": "Events",
        "services": [
          "Event filming"
        ]
      },
      {
        "id": "editing_only",
        "label": "Editing only",
        "services": [
          "Video editing"
        ]
      },
      {
        "id": "filming_only",
        "label": "Filming only",
        "services": [
          "Video filming"
        ]
      }
    ]
  },
  "entertainment": {
    "label": "Entertainment",
    "core": [],
    "extras": [
      "Live music performances",
      "DJ performances",
      "Children's entertainment",
      "Magic performances",
      "Event hosting"
    ],
    "question": "Entertainment types",
    "options": [
      {
        "id": "band",
        "label": "Band",
        "services": [
          "Live band performances"
        ]
      },
      {
        "id": "solo_musician",
        "label": "Solo musician",
        "services": [
          "Live music performances"
        ]
      },
      {
        "id": "dj",
        "label": "DJ",
        "services": [
          "DJ performances"
        ]
      },
      {
        "id": "magician",
        "label": "Magician",
        "services": [
          "Magic performances"
        ]
      },
      {
        "id": "host",
        "label": "Host",
        "services": [
          "Event hosting"
        ]
      },
      {
        "id": "children_s_act",
        "label": "Children's act",
        "services": [
          "Children's entertainment"
        ]
      }
    ]
  },
  "equipment_hire": {
    "label": "Equipment hire",
    "core": [],
    "extras": [
      "Sound equipment hire",
      "Lighting hire",
      "Event furniture hire",
      "Marquee hire",
      "Tool hire",
      "Plant hire"
    ],
    "question": "Equipment for hire",
    "options": [
      {
        "id": "sound",
        "label": "Sound",
        "services": [
          "Sound equipment hire"
        ]
      },
      {
        "id": "lighting",
        "label": "Lighting",
        "services": [
          "Lighting hire"
        ]
      },
      {
        "id": "furniture",
        "label": "Furniture",
        "services": [
          "Event furniture hire"
        ]
      },
      {
        "id": "marquees",
        "label": "Marquees",
        "services": [
          "Marquee hire"
        ]
      },
      {
        "id": "tools",
        "label": "Tools",
        "services": [
          "Tool hire"
        ]
      },
      {
        "id": "plant",
        "label": "Plant",
        "services": [
          "Plant hire"
        ]
      }
    ]
  },
  "designer": {
    "label": "Designer",
    "core": [],
    "extras": [
      "Brand identity design",
      "Logo design",
      "Print design",
      "Digital design",
      "Nonstructural interior design",
      "Product design"
    ],
    "question": "Design disciplines",
    "options": [
      {
        "id": "graphic_and_brand",
        "label": "Graphic and brand",
        "services": [
          "Logo design",
          "Brand identity design"
        ]
      },
      {
        "id": "digital_interfaces",
        "label": "Digital interfaces",
        "services": [
          "Interface design"
        ]
      },
      {
        "id": "interiors",
        "label": "Interiors",
        "services": [
          "Nonstructural interior design"
        ]
      },
      {
        "id": "products",
        "label": "Products",
        "services": [
          "Product design"
        ]
      },
      {
        "id": "print",
        "label": "Print",
        "services": [
          "Print design"
        ]
      }
    ]
  },
  "it_support": {
    "label": "IT support",
    "core": [],
    "extras": [
      "Network setup",
      "Managed IT services",
      "Cybersecurity",
      "Backup management",
      "Cloud migration",
      "On-site support"
    ],
    "question": "IT support model",
    "options": [
      {
        "id": "home_users",
        "label": "Home users",
        "services": [
          "Computer troubleshooting",
          "Software installation",
          "Email setup"
        ]
      },
      {
        "id": "business_helpdesk",
        "label": "Business helpdesk",
        "services": [
          "Business IT support",
          "User support"
        ]
      },
      {
        "id": "managed_it",
        "label": "Managed IT",
        "services": [
          "Managed IT services",
          "IT maintenance"
        ]
      },
      {
        "id": "co_managed_it",
        "label": "Co-managed IT",
        "services": [
          "Co-managed IT services",
          "IT maintenance"
        ]
      }
    ]
  },
  "computer_phone_repair": {
    "label": "Computer / phone repair",
    "core": [],
    "extras": [
      "Phone screen replacement",
      "Phone battery replacement",
      "Laptop repairs",
      "Desktop repairs",
      "Tablet repairs",
      "Data recovery"
    ],
    "question": "Devices you repair",
    "options": [
      {
        "id": "phones",
        "label": "Phones",
        "services": [
          "Phone fault diagnosis",
          "Phone repairs"
        ]
      },
      {
        "id": "tablets",
        "label": "Tablets",
        "services": [
          "Tablet fault diagnosis",
          "Tablet repairs"
        ]
      },
      {
        "id": "laptops",
        "label": "Laptops",
        "services": [
          "Laptop fault diagnosis",
          "Laptop repairs"
        ]
      },
      {
        "id": "desktops",
        "label": "Desktops",
        "services": [
          "Desktop fault diagnosis",
          "Desktop repairs"
        ]
      },
      {
        "id": "consoles",
        "label": "Consoles",
        "services": [
          "Console fault diagnosis",
          "Console repairs"
        ]
      }
    ]
  },
  "software_business": {
    "label": "Software business",
    "core": [],
    "extras": [
      "Software subscriptions",
      "Product onboarding",
      "Software product support",
      "Software development",
      "Integrations",
      "Software maintenance"
    ],
    "question": "Software business model",
    "options": [
      {
        "id": "own_product",
        "label": "Own product",
        "services": [
          "Software product access",
          "Software product support"
        ]
      },
      {
        "id": "development",
        "label": "Development",
        "services": [
          "Software development",
          "Software maintenance"
        ]
      },
      {
        "id": "integrations",
        "label": "Integrations",
        "services": [
          "Software integration development"
        ]
      },
      {
        "id": "reseller",
        "label": "Reseller",
        "services": [
          "Software licence sales"
        ]
      }
    ]
  },
  "web_agency": {
    "label": "Web agency",
    "core": [
      "Website design",
      "Website development",
      "Website maintenance"
    ],
    "extras": [
      "E-commerce websites",
      "Hosting",
      "SEO",
      "Copywriting",
      "Paid advertising",
      "App development"
    ]
  },
  "telecoms_provider": {
    "label": "Telecoms provider",
    "core": [],
    "extras": [
      "Broadband service",
      "Business phone systems",
      "VoIP service",
      "Mobile plans",
      "Leased lines",
      "Installation support"
    ],
    "question": "Telecoms products",
    "options": [
      {
        "id": "broadband",
        "label": "Broadband",
        "services": [
          "Broadband service"
        ]
      },
      {
        "id": "mobile",
        "label": "Mobile",
        "services": [
          "Mobile plans"
        ]
      },
      {
        "id": "business_phone_systems",
        "label": "Business phone systems",
        "services": [
          "Business phone systems"
        ]
      },
      {
        "id": "voip",
        "label": "VoIP",
        "services": [
          "VoIP service"
        ]
      },
      {
        "id": "cabling",
        "label": "Cabling",
        "services": [
          "Network cabling installation"
        ]
      }
    ]
  },
  "taxi_chauffeur": {
    "label": "Taxi / chauffeur",
    "core": [],
    "extras": [
      "Taxi journeys",
      "Airport transfers",
      "Chauffeur hire",
      "Corporate travel",
      "Wheelchair-accessible transport"
    ],
    "question": "Passenger services",
    "options": [
      {
        "id": "taxi",
        "label": "Taxi",
        "services": [
          "Taxi journeys"
        ]
      },
      {
        "id": "hackney",
        "label": "Hackney",
        "services": [
          "Pre-booked private hire"
        ]
      },
      {
        "id": "chauffeur",
        "label": "Chauffeur",
        "services": [
          "Chauffeur journeys"
        ]
      },
      {
        "id": "airport_transfers",
        "label": "Airport transfers",
        "services": [
          "Airport transfers"
        ]
      }
    ]
  },
  "courier": {
    "label": "Courier",
    "core": [],
    "extras": [
      "Same-day delivery",
      "Scheduled delivery",
      "Document delivery",
      "International delivery"
    ],
    "question": "Courier services",
    "options": [
      {
        "id": "parcels",
        "label": "Parcels",
        "services": [
          "Parcel collection",
          "Parcel delivery"
        ]
      },
      {
        "id": "documents",
        "label": "Documents",
        "services": [
          "Document delivery"
        ]
      },
      {
        "id": "scheduled",
        "label": "Scheduled",
        "services": [
          "Scheduled courier delivery"
        ]
      },
      {
        "id": "same_day",
        "label": "Same day",
        "services": [
          "Same-day courier delivery"
        ]
      },
      {
        "id": "international",
        "label": "International",
        "services": [
          "International parcel delivery"
        ]
      }
    ]
  },
  "haulage": {
    "label": "Haulage",
    "core": [],
    "extras": [
      "Pallet transport",
      "Full loads",
      "Part loads",
      "Refrigerated transport",
      "Container transport"
    ],
    "question": "Haulage work",
    "options": [
      {
        "id": "pallets",
        "label": "Pallets",
        "services": [
          "Pallet transport"
        ]
      },
      {
        "id": "full_loads",
        "label": "Full loads",
        "services": [
          "Full-load transport"
        ]
      },
      {
        "id": "part_loads",
        "label": "Part loads",
        "services": [
          "Part-load transport"
        ]
      },
      {
        "id": "bulk_and_tipper",
        "label": "Bulk and tipper",
        "services": [
          "Bulk goods transport"
        ]
      },
      {
        "id": "containers",
        "label": "Containers",
        "services": [
          "Container transport"
        ]
      },
      {
        "id": "refrigerated",
        "label": "Refrigerated",
        "services": [
          "Refrigerated goods transport"
        ]
      }
    ]
  },
  "passenger_transport": {
    "label": "Passenger transport",
    "core": [],
    "extras": [
      "Coach hire with driver",
      "Minibus hire with driver",
      "School transport",
      "Airport transfers",
      "Passenger tours",
      "Accessible transport"
    ],
    "question": "Passenger transport",
    "options": [
      {
        "id": "coaches",
        "label": "Coaches",
        "services": [
          "Coach hire with driver"
        ]
      },
      {
        "id": "minibuses",
        "label": "Minibuses",
        "services": [
          "Minibus hire with driver"
        ]
      },
      {
        "id": "tours",
        "label": "Tours",
        "services": [
          "Passenger tours"
        ]
      },
      {
        "id": "private_hire",
        "label": "Private hire",
        "services": [
          "Private passenger transport"
        ]
      },
      {
        "id": "scheduled_routes",
        "label": "Scheduled routes",
        "services": [
          "Scheduled passenger transport"
        ]
      }
    ]
  },
  "delivery_service": {
    "label": "Delivery service",
    "core": [],
    "extras": [
      "Local deliveries",
      "Scheduled deliveries",
      "Food delivery",
      "Retail deliveries",
      "Furniture delivery",
      "Business deliveries"
    ],
    "question": "Goods you deliver",
    "options": [
      {
        "id": "parcels",
        "label": "Parcels",
        "services": [
          "Parcel delivery"
        ]
      },
      {
        "id": "food",
        "label": "Food",
        "services": [
          "Food delivery"
        ]
      },
      {
        "id": "retail",
        "label": "Retail",
        "services": [
          "Retail deliveries"
        ]
      },
      {
        "id": "furniture",
        "label": "Furniture",
        "services": [
          "Furniture delivery"
        ]
      },
      {
        "id": "trade_supplies",
        "label": "Trade supplies",
        "services": [
          "Trade supply delivery"
        ]
      }
    ]
  },
  "farm_business": {
    "label": "Farm business",
    "core": [],
    "extras": [
      "Milk sales",
      "Livestock sales",
      "Crop sales",
      "Farm shop sales",
      "Farm produce delivery",
      "Farm visits"
    ],
    "question": "Business activities",
    "options": [
      {
        "id": "produce_sales",
        "label": "Produce sales",
        "services": [
          "Farm produce sales"
        ]
      },
      {
        "id": "livestock_sales",
        "label": "Livestock sales",
        "services": [
          "Livestock sales"
        ]
      },
      {
        "id": "farm_shop",
        "label": "Farm shop",
        "services": [
          "Farm shop sales"
        ]
      },
      {
        "id": "farm_visits",
        "label": "Farm visits",
        "services": [
          "Farm visits"
        ]
      },
      {
        "id": "production",
        "label": "Production",
        "services": [
          "Farm production"
        ]
      }
    ]
  },
  "agricultural_contractor": {
    "label": "Agricultural contractor",
    "core": [],
    "extras": [
      "Silage cutting",
      "Baling",
      "Slurry spreading",
      "Hedge cutting",
      "Ploughing",
      "Reseeding",
      "Crop harvesting"
    ],
    "question": "Contracting operations",
    "options": [
      {
        "id": "silage",
        "label": "Silage",
        "services": [
          "Silage cutting"
        ]
      },
      {
        "id": "baling",
        "label": "Baling",
        "services": [
          "Baling"
        ]
      },
      {
        "id": "slurry",
        "label": "Slurry",
        "services": [
          "Slurry spreading"
        ]
      },
      {
        "id": "tillage",
        "label": "Tillage",
        "services": [
          "Tillage services"
        ]
      },
      {
        "id": "reseeding",
        "label": "Reseeding",
        "services": [
          "Reseeding"
        ]
      },
      {
        "id": "harvesting",
        "label": "Harvesting",
        "services": [
          "Crop harvesting"
        ]
      },
      {
        "id": "hedge_cutting",
        "label": "Hedge cutting",
        "services": [
          "Hedge cutting"
        ]
      }
    ]
  },
  "agricultural_machinery_repair": {
    "label": "Agricultural machinery repair",
    "core": [],
    "extras": [
      "Tractor repairs",
      "Agricultural hydraulic repairs",
      "Baler repairs",
      "Harvester repairs",
      "Mobile repairs",
      "Welding"
    ],
    "question": "Machinery you repair",
    "options": [
      {
        "id": "tractors",
        "label": "Tractors",
        "services": [
          "Tractor fault diagnosis",
          "Tractor servicing",
          "Tractor repairs"
        ]
      },
      {
        "id": "implements",
        "label": "Implements",
        "services": [
          "Agricultural implement repairs"
        ]
      },
      {
        "id": "harvesting_machinery",
        "label": "Harvesting machinery",
        "services": [
          "Harvesting machinery servicing",
          "Harvesting machinery repairs"
        ]
      },
      {
        "id": "hydraulics",
        "label": "Hydraulics",
        "services": [
          "Agricultural hydraulic repairs"
        ]
      }
    ]
  },
  "forestry_services": {
    "label": "Forestry services",
    "core": [],
    "extras": [
      "Tree planting",
      "Forestry maintenance",
      "Forest thinning",
      "Timber harvesting",
      "Forest replanting",
      "Forestry planning"
    ],
    "question": "Forestry work",
    "options": [
      {
        "id": "planting",
        "label": "Planting",
        "services": [
          "Tree planting"
        ]
      },
      {
        "id": "maintenance",
        "label": "Maintenance",
        "services": [
          "Forestry maintenance"
        ]
      },
      {
        "id": "thinning",
        "label": "Thinning",
        "services": [
          "Forest thinning"
        ]
      },
      {
        "id": "harvesting",
        "label": "Harvesting",
        "services": [
          "Timber harvesting"
        ]
      },
      {
        "id": "replanting",
        "label": "Replanting",
        "services": [
          "Forest replanting"
        ]
      }
    ]
  },
  "charity": {
    "label": "Charity",
    "core": [],
    "extras": [
      "Advice sessions",
      "Support groups",
      "Outreach",
      "Community programmes",
      "Item donations",
      "Fundraising events"
    ],
    "question": "Actual activities",
    "options": [
      {
        "id": "fundraising",
        "label": "Fundraising",
        "services": [
          "Fundraising events"
        ]
      },
      {
        "id": "volunteering",
        "label": "Volunteering",
        "services": [
          "Volunteer programmes"
        ]
      },
      {
        "id": "grants",
        "label": "Grants",
        "services": [
          "Grant applications"
        ]
      },
      {
        "id": "community_events",
        "label": "Community events",
        "services": [
          "Community events"
        ]
      },
      {
        "id": "donations",
        "label": "Donations",
        "services": [
          "Donation enquiries"
        ]
      }
    ]
  },
  "community_organisation": {
    "label": "Community organisation",
    "core": [],
    "extras": [
      "Community activities",
      "Community classes",
      "Support groups",
      "Community venue hire",
      "Local events",
      "Volunteer programmes"
    ],
    "question": "Actual activities",
    "options": [
      {
        "id": "community_activities",
        "label": "Community activities",
        "services": [
          "Community activities"
        ]
      },
      {
        "id": "classes",
        "label": "Classes",
        "services": [
          "Community classes"
        ]
      },
      {
        "id": "venue_hire",
        "label": "Venue hire",
        "services": [
          "Community venue hire"
        ]
      },
      {
        "id": "events",
        "label": "Events",
        "services": [
          "Community events"
        ]
      },
      {
        "id": "volunteering",
        "label": "Volunteering",
        "services": [
          "Volunteer programmes"
        ]
      }
    ]
  },
  "sports_club": {
    "label": "Sports club",
    "core": [],
    "extras": [
      "Sports training sessions",
      "Sports coaching",
      "Sports competitions",
      "Junior activities",
      "Camps",
      "Sports facility hire"
    ],
    "question": "Club activities",
    "options": [
      {
        "id": "membership",
        "label": "Membership",
        "services": [
          "Club membership"
        ]
      },
      {
        "id": "training",
        "label": "Training",
        "services": [
          "Sports training sessions"
        ]
      },
      {
        "id": "coaching",
        "label": "Coaching",
        "services": [
          "Sports coaching"
        ]
      },
      {
        "id": "competitions",
        "label": "Competitions",
        "services": [
          "Sports competitions"
        ]
      },
      {
        "id": "facility_hire",
        "label": "Facility hire",
        "services": [
          "Sports facility hire"
        ]
      }
    ]
  },
  "membership_organisation": {
    "label": "Membership organisation",
    "core": [],
    "extras": [
      "Member events",
      "Member training",
      "Member networking",
      "Professional support",
      "Member publications",
      "Accreditation"
    ],
    "question": "Membership services",
    "options": [
      {
        "id": "membership",
        "label": "Membership",
        "services": [
          "Membership applications",
          "Membership renewals"
        ]
      },
      {
        "id": "events",
        "label": "Events",
        "services": [
          "Member events"
        ]
      },
      {
        "id": "networking",
        "label": "Networking",
        "services": [
          "Member networking"
        ]
      },
      {
        "id": "training",
        "label": "Training",
        "services": [
          "Member training"
        ]
      },
      {
        "id": "publications",
        "label": "Publications",
        "services": [
          "Member publications"
        ]
      }
    ]
  },
  "other_speciality": {
    "label": "Other speciality",
    "core": [],
    "extras": [],
    "manualReview": true
  }
};
export const EXCLUDED_SETUP_SPECIALITIES: Readonly<Record<string,string>> = {
  "tanning": "Tanning",
  "gp_medical_practice": "GP / medical practice",
  "dental_practice": "Dental practice",
  "physiotherapy": "Physiotherapy",
  "optician": "Optician",
  "pharmacy": "Pharmacy",
  "counselling_psychotherapy": "Counselling / psychotherapy",
  "podiatry": "Podiatry",
  "home_care": "Home care",
  "massage": "Massage",
  "accountant_bookkeeper": "Accountant / bookkeeper",
  "solicitor": "Solicitor",
  "architect": "Architect",
  "engineer": "Engineer",
  "surveyor": "Surveyor",
  "insurance_broker": "Insurance broker",
  "financial_adviser": "Financial adviser",
  "childcare": "Childcare",
  "veterinary_practice": "Veterinary practice"
};
export const SERVICE_CATALOGUE_LABELS = [...new Set(Object.values(SERVICE_RECIPES).flatMap(recipe=>[...recipe.core,...recipe.extras,...(recipe.options??[]).flatMap(option=>option.services)]))];
