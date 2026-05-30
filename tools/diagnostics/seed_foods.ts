import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const envFile = await Deno.readTextFile(".env.local");
let SUPABASE_URL = "";
let SUPABASE_SERVICE_KEY = "";

const urlMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
if (urlMatch) SUPABASE_URL = urlMatch[1].trim();

const serviceMatch = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);
if (serviceMatch) SUPABASE_SERVICE_KEY = serviceMatch[1].trim();

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing Supabase credentials in .env.local");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const foodsData = [
  // Proteins (High Protein density)
  {
    name: "Chicken Breast",
    category_decay_rate: 0.1,
    nutritional_info: {
      calories: 165,
      protein: 31,
      carbs: 0,
      fats: 3.6,
      sodium: 74,
      sugar: 0,
      magnesium: 29,
      iron: 1.0,
      vitamin_d: 0
    }
  },
  {
    name: "Salmon Fillet",
    category_decay_rate: 0.1,
    nutritional_info: {
      calories: 208,
      protein: 22,
      carbs: 0,
      fats: 13,
      sodium: 59,
      sugar: 0,
      magnesium: 27,
      iron: 0.3,
      vitamin_d: 526
    }
  },
  {
    name: "Grass-Fed Lean Beef",
    category_decay_rate: 0.1,
    nutritional_info: {
      calories: 190,
      protein: 26,
      carbs: 0,
      fats: 9.3,
      sodium: 68,
      sugar: 0,
      magnesium: 21,
      iron: 2.7,
      vitamin_d: 4
    }
  },
  {
    name: "Tuna (Canned in Water)",
    category_decay_rate: 0.05,
    nutritional_info: {
      calories: 116,
      protein: 26,
      carbs: 0,
      fats: 1.0,
      sodium: 330,
      sugar: 0,
      magnesium: 33,
      iron: 1.5,
      vitamin_d: 68
    }
  },
  {
    name: "Turkey Breast Slice",
    category_decay_rate: 0.1,
    nutritional_info: {
      calories: 104,
      protein: 17,
      carbs: 2.0,
      fats: 2.0,
      sodium: 780,
      sugar: 1.0,
      magnesium: 18,
      iron: 0.9,
      vitamin_d: 0
    }
  },
  {
    name: "Extra Firm Tofu",
    category_decay_rate: 0.08,
    nutritional_info: {
      calories: 83,
      protein: 10,
      carbs: 1.2,
      fats: 5.3,
      sodium: 7,
      sugar: 0,
      magnesium: 37,
      iron: 1.6,
      vitamin_d: 0
    }
  },
  // Dairy & Alternatives
  {
    name: "Whole Eggs",
    category_decay_rate: 0.08,
    nutritional_info: {
      calories: 143,
      protein: 12.6,
      carbs: 0.7,
      fats: 9.5,
      sodium: 124,
      sugar: 0.4,
      magnesium: 12,
      iron: 1.8,
      vitamin_d: 87
    }
  },
  {
    name: "Greek Yogurt (Non-Fat, Plain)",
    category_decay_rate: 0.1,
    nutritional_info: {
      calories: 59,
      protein: 10,
      carbs: 3.6,
      fats: 0.4,
      sodium: 36,
      sugar: 3.2,
      magnesium: 11,
      iron: 0.1,
      vitamin_d: 0
    }
  },
  {
    name: "Cottage Cheese (Low Fat)",
    category_decay_rate: 0.1,
    nutritional_info: {
      calories: 84,
      protein: 11,
      carbs: 3.4,
      fats: 2.3,
      sodium: 364,
      sugar: 2.7,
      magnesium: 9,
      iron: 0.1,
      vitamin_d: 0
    }
  },
  // Carbs & Grains
  {
    name: "Quinoa (Cooked)",
    category_decay_rate: 0.04,
    nutritional_info: {
      calories: 120,
      protein: 4.4,
      carbs: 21.3,
      fats: 1.9,
      sodium: 7,
      sugar: 0.9,
      magnesium: 64,
      iron: 1.5,
      vitamin_d: 0
    }
  },
  {
    name: "Brown Rice (Cooked)",
    category_decay_rate: 0.04,
    nutritional_info: {
      calories: 111,
      protein: 2.6,
      carbs: 23,
      fats: 0.9,
      sodium: 5,
      sugar: 0.4,
      magnesium: 43,
      iron: 0.4,
      vitamin_d: 0
    }
  },
  {
    name: "Sweet Potato (Baked)",
    category_decay_rate: 0.05,
    nutritional_info: {
      calories: 90,
      protein: 2.0,
      carbs: 20.7,
      fats: 0.1,
      sodium: 36,
      sugar: 6.5,
      magnesium: 27,
      iron: 0.7,
      vitamin_d: 0
    }
  },
  {
    name: "Rolled Oats (Dry)",
    category_decay_rate: 0.02,
    nutritional_info: {
      calories: 389,
      protein: 16.9,
      carbs: 66.3,
      fats: 6.9,
      sodium: 2,
      sugar: 0,
      magnesium: 177,
      iron: 4.7,
      vitamin_d: 0
    }
  },
  {
    name: "Black Beans (Canned)",
    category_decay_rate: 0.03,
    nutritional_info: {
      calories: 91,
      protein: 6.0,
      carbs: 16.6,
      fats: 0.3,
      sodium: 236,
      sugar: 0.3,
      magnesium: 49,
      iron: 1.8,
      vitamin_d: 0
    }
  },
  {
    name: "Lentils (Cooked)",
    category_decay_rate: 0.04,
    nutritional_info: {
      calories: 116,
      protein: 9.0,
      carbs: 20.1,
      fats: 0.4,
      sodium: 2,
      sugar: 1.8,
      magnesium: 36,
      iron: 3.3,
      vitamin_d: 0
    }
  },
  // Fats
  {
    name: "Avocado",
    category_decay_rate: 0.12,
    nutritional_info: {
      calories: 160,
      protein: 2.0,
      carbs: 8.5,
      fats: 14.7,
      sodium: 7,
      sugar: 0.7,
      magnesium: 29,
      iron: 0.6,
      vitamin_d: 0
    }
  },
  {
    name: "Extra Virgin Olive Oil",
    category_decay_rate: 0.01,
    nutritional_info: {
      calories: 884,
      protein: 0,
      carbs: 0,
      fats: 100,
      sodium: 2,
      sugar: 0,
      magnesium: 0,
      iron: 0.6,
      vitamin_d: 0
    }
  },
  {
    name: "Almonds",
    category_decay_rate: 0.02,
    nutritional_info: {
      calories: 579,
      protein: 21,
      carbs: 22,
      fats: 49,
      sodium: 1,
      sugar: 4.3,
      magnesium: 270,
      iron: 3.7,
      vitamin_d: 0
    }
  },
  {
    name: "Walnuts",
    category_decay_rate: 0.03,
    nutritional_info: {
      calories: 654,
      protein: 15.2,
      carbs: 13.7,
      fats: 65.2,
      sodium: 2,
      sugar: 2.6,
      magnesium: 158,
      iron: 2.9,
      vitamin_d: 0
    }
  },
  {
    name: "Chia Seeds",
    category_decay_rate: 0.02,
    nutritional_info: {
      calories: 486,
      protein: 16.5,
      carbs: 42.1,
      fats: 30.7,
      sodium: 16,
      sugar: 0,
      magnesium: 335,
      iron: 7.7,
      vitamin_d: 0
    }
  },
  {
    name: "Natural Peanut Butter",
    category_decay_rate: 0.03,
    nutritional_info: {
      calories: 588,
      protein: 25,
      carbs: 20,
      fats: 50,
      sodium: 17,
      sugar: 3.0,
      magnesium: 154,
      iron: 1.9,
      vitamin_d: 0
    }
  },
  // Veggies & Greens
  {
    name: "Baby Spinach",
    category_decay_rate: 0.15,
    nutritional_info: {
      calories: 23,
      protein: 2.9,
      carbs: 3.6,
      fats: 0.4,
      sodium: 79,
      sugar: 0.4,
      magnesium: 79,
      iron: 2.7,
      vitamin_d: 0
    }
  },
  {
    name: "Broccoli Florets",
    category_decay_rate: 0.1,
    nutritional_info: {
      calories: 34,
      protein: 2.8,
      carbs: 7.0,
      fats: 0.4,
      sodium: 33,
      sugar: 1.7,
      magnesium: 21,
      iron: 0.7,
      vitamin_d: 0
    }
  },
  {
    name: "Asparagus Spears",
    category_decay_rate: 0.12,
    nutritional_info: {
      calories: 20,
      protein: 2.2,
      carbs: 3.9,
      fats: 0.1,
      sodium: 2,
      sugar: 1.9,
      magnesium: 14,
      iron: 2.1,
      vitamin_d: 0
    }
  },
  {
    name: "Curly Kale",
    category_decay_rate: 0.12,
    nutritional_info: {
      calories: 49,
      protein: 4.3,
      carbs: 8.8,
      fats: 0.9,
      sodium: 38,
      sugar: 2.3,
      magnesium: 47,
      iron: 1.5,
      vitamin_d: 0
    }
  },
  {
    name: "Bell Peppers (Mixed)",
    category_decay_rate: 0.08,
    nutritional_info: {
      calories: 26,
      protein: 1.0,
      carbs: 6.0,
      fats: 0.3,
      sodium: 4,
      sugar: 4.2,
      magnesium: 12,
      iron: 0.4,
      vitamin_d: 0
    }
  },
  // Fruits
  {
    name: "Fresh Blueberries",
    category_decay_rate: 0.1,
    nutritional_info: {
      calories: 57,
      protein: 0.7,
      carbs: 14.5,
      fats: 0.3,
      sodium: 1,
      sugar: 10,
      magnesium: 6,
      iron: 0.3,
      vitamin_d: 0
    }
  },
  {
    name: "Fresh Raspberries",
    category_decay_rate: 0.12,
    nutritional_info: {
      calories: 52,
      protein: 1.2,
      carbs: 11.9,
      fats: 0.7,
      sodium: 1,
      sugar: 4.4,
      magnesium: 22,
      iron: 0.7,
      vitamin_d: 0
    }
  },
  {
    name: "Gala Apple",
    category_decay_rate: 0.05,
    nutritional_info: {
      calories: 52,
      protein: 0.3,
      carbs: 13.8,
      fats: 0.2,
      sodium: 1,
      sugar: 10.4,
      magnesium: 5,
      iron: 0.1,
      vitamin_d: 0
    }
  },
  {
    name: "Banana",
    category_decay_rate: 0.1,
    nutritional_info: {
      calories: 89,
      protein: 1.1,
      carbs: 22.8,
      fats: 0.3,
      sodium: 1,
      sugar: 12.2,
      magnesium: 27,
      iron: 0.3,
      vitamin_d: 0
    }
  }
];

async function seed() {
  console.log(`Clearing existing records (if any) and inserting ${foodsData.length} metabolic staples...`);
  
  // Clear any existing foods to prevent duplicate keys
  const { error: deleteErr } = await supabase
    .from("foods")
    .delete()
    .neq("id", 0); // Bypasses safe delete restrictions by specifying a condition that matches all rows
    
  if (deleteErr) {
    console.warn("Delete warning (might be clean already):", deleteErr);
  }

  const { data, error } = await supabase
    .from("foods")
    .insert(foodsData)
    .select();

  if (error) {
    console.error("Seeding failed:", error);
    Deno.exit(1);
  }

  console.log(`Successfully seeded ${data?.length} premium foods into the database!`);
}

await seed();
