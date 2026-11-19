// Edit these demo rows to change the sample catalog; none of their details imply store inventory.
window.inderCategories = [
  { id: "biscuits-cookies", name: "Biscuits & Cookies", imageUrl: "assets/categories/biscuits-cookies.jpg" },
  { id: "chips-namkeen", name: "Chips & Namkeen", imageUrl: "assets/categories/chips-namkeen.jpg" },
  { id: "chocolates-candies", name: "Chocolates & Candies", imageUrl: "assets/categories/chocolates-candies.jpg" },
  { id: "milk-dairy", name: "Milk & Dairy Products", imageUrl: "assets/categories/milk-dairy.jpg" },
  { id: "cold-drinks-beverages", name: "Cold Drinks & Beverages", imageUrl: "assets/categories/cold-drinks-beverages.jpg" },
  { id: "tea-coffee", name: "Tea & Coffee", imageUrl: "assets/categories/tea-coffee.jpg" },
  { id: "atta-rice-dal", name: "Atta, Rice & Dal", imageUrl: "assets/categories/atta-rice-dal.jpg" },
  { id: "oil-masala", name: "Oil & Masala", imageUrl: "assets/categories/oil-masala.jpg" },
  { id: "instant-food", name: "Instant Food", imageUrl: "assets/categories/instant-food.jpg" },
  { id: "bakery-bread", name: "Bakery & Bread", imageUrl: "assets/categories/bakery-bread.jpg" },
  { id: "personal-care", name: "Personal Care", imageUrl: "assets/categories/personal-care.jpg" },
  { id: "household-cleaning", name: "Household & Cleaning", imageUrl: "assets/categories/household-cleaning.jpg" },
  { id: "pooja-items", name: "Pooja Items", imageUrl: "assets/categories/pooja-items.jpg" },
  { id: "other-daily-essentials", name: "Other Daily Essentials", imageUrl: "assets/categories/other-daily-essentials.jpg" },
  { id: "fruits", name: "Fruits", imageUrl: "assets/categories/fruits.jpg" },
  { id: "vegetables", name: "Vegetables", imageUrl: "assets/categories/vegetables.jpg" },
  { id: "frozen-foods", name: "Frozen Foods", imageUrl: "assets/categories/frozen-foods.jpg" },
  { id: "ice-cream", name: "Ice Cream", imageUrl: "assets/categories/ice-cream.jpg" },
  { id: "baby-care", name: "Baby Care", imageUrl: "assets/categories/baby-care.jpg" },
  { id: "dry-fruits-nuts", name: "Dry Fruits & Nuts", imageUrl: "assets/categories/dry-fruits-nuts.jpg" },
  { id: "kitchen-essentials", name: "Kitchen Essentials", imageUrl: "assets/categories/kitchen-essentials.jpg" },
  { id: "stationery", name: "Stationery", imageUrl: "assets/categories/stationery.jpg" },
  { id: "pet-care", name: "Pet Care", imageUrl: "assets/categories/pet-care.jpg" },
  { id: "health-hygiene", name: "Health & Hygiene", imageUrl: "assets/categories/health-hygiene.jpg" }
];

const demoProductsByCategory = [
  ["biscuits-cookies", [
    ["parle-g-glucose", "Parle-G Glucose Biscuits", "Parle", "100g", 10],
    ["britannia-good-day-cashew", "Good Day Cashew Cookies", "Britannia", "72g", 20],
    ["sunfeast-dark-fantasy", "Dark Fantasy Choco Fills", "Sunfeast", "75g", 40],
    ["oreo-original", "Oreo Original", "Oreo", "120g", 30],
    ["sunfeast-hide-seek", "Hide & Seek Chocolate Chips", "Sunfeast", "100g", 35],
    ["britannia-marie-gold", "Marie Gold", "Britannia", "120g", 20],
    ["mcvities-digestive", "Digestive Biscuits", "McVitie's", "100g", 35],
    ["anmol-dream-lite", "Dream Lite Biscuits", "Anmol", "150g", 20]
  ]],
  ["chips-namkeen", [
    ["lays-classic-salted", "Classic Salted Potato Chips", "Lay's", "52g", 20],
    ["kurkure-masala-munch", "Masala Munch", "Kurkure", "75g", 20],
    ["bingo-mad-angles", "Mad Angles Achaari Masti", "Bingo!", "72g", 20],
    ["haldiram-aloo-bhujia", "Aloo Bhujia", "Haldiram's", "200g", 55],
    ["bikaji-bhujia", "Bikaneri Bhujia", "Bikaji", "200g", 50],
    ["uncle-chips-spicy", "Spicy Treat Potato Chips", "Uncle Chipps", "48g", 20],
    ["too-yumm-multigrain", "Multigrain Chips", "Too Yumm!", "60g", 20],
    ["balaji-wafers", "Masala Masti Wafers", "Balaji", "135g", 30],
    ["haldiram-moong-dal", "Moong Dal", "Haldiram's", "200g", 55],
    ["pringles-original", "Original Potato Crisps", "Pringles", "107g", 99]
  ]],
  ["chocolates-candies", [
    ["cadbury-dairy-milk", "Dairy Milk Chocolate", "Cadbury", "40g", 40],
    ["kitkat-4-finger", "KitKat 4 Finger", "KitKat", "37.3g", 30],
    ["nestle-munch", "Munch Chocolate Wafer", "Nestle", "25g", 10],
    ["alpenliebe-candy", "Alpenliebe Creamfill Candy", "Alpenliebe", "100g", 50]
  ]],
  ["milk-dairy", [
    ["amul-taaza-milk", "Taaza Toned Milk", "Amul", "500ml", 30],
    ["amul-gold-milk", "Gold Full Cream Milk", "Amul", "500ml", 35],
    ["mother-dairy-toned-milk", "Toned Milk", "Mother Dairy", "500ml", 30],
    ["amul-butter", "Pasteurised Butter", "Amul", "100g", 60],
    ["amul-paneer", "Fresh Paneer", "Amul", "200g", 95],
    ["amul-masti-dahi", "Masti Dahi", "Amul", "400g", 40],
    ["amul-cheese-slices", "Cheese Slices", "Amul", "200g", 145]
  ]],
  ["cold-drinks-beverages", [
    ["coca-cola", "Coca-Cola Soft Drink", "Coca-Cola", "750ml", 40],
    ["pepsi", "Pepsi Soft Drink", "Pepsi", "750ml", 40],
    ["thums-up", "Thums Up Soft Drink", "Thums Up", "750ml", 40],
    ["sprite", "Sprite Lemon-Lime Drink", "Sprite", "750ml", 40],
    ["frooti-mango", "Mango Drink", "Frooti", "600ml", 30],
    ["real-mango-juice", "Mango Fruit Juice", "Real", "1L", 110],
    ["tropicana-orange-juice", "Orange Fruit Juice", "Tropicana", "1L", 110],
    ["bisleri-water", "Packaged Drinking Water", "Bisleri", "1L", 20],
    ["sting-energy", "Berry Blast Energy Drink", "Sting", "250ml", 20],
    ["red-bull-energy", "Energy Drink", "Red Bull", "250ml", 125]
  ]],
  ["tea-coffee", []],
  ["atta-rice-dal", [
    ["aashirvaad-atta", "Shudh Chakki Atta", "Aashirvaad", "1kg", 65],
    ["fortune-atta", "Chakki Fresh Atta", "Fortune", "1kg", 60],
    ["india-gate-basmati", "Classic Basmati Rice", "India Gate", "1kg", 150],
    ["daawat-rozana-rice", "Rozana Super Basmati Rice", "Daawat", "1kg", 100],
    ["tata-toor-dal", "Toor Dal", "Tata Sampann", "500g", 90],
    ["tata-moong-dal", "Moong Dal", "Tata Sampann", "500g", 85],
    ["fortune-chana-dal", "Chana Dal", "Fortune", "500g", 55],
    ["tata-masoor-dal", "Masoor Dal", "Tata Sampann", "500g", 70],
    ["tata-rajma", "Red Rajma", "Tata Sampann", "500g", 90],
    ["tata-kabuli-chana", "Kabuli Chana", "Tata Sampann", "500g", 70],
    ["fortune-sonamasoori", "Sona Masoori Rice", "Fortune", "1kg", 80]
  ]],
  ["oil-masala", [
    ["fortune-sunflower-oil", "Sunflower Refined Oil", "Fortune", "1L", 150],
    ["dhara-mustard-oil", "Kachi Ghani Mustard Oil", "Dhara", "1L", 170],
    ["saffola-gold-oil", "Gold Pro Healthy Lifestyle Oil", "Saffola", "1L", 190],
    ["tata-salt", "Iodized Salt", "Tata Salt", "1kg", 28],
    ["mdh-garam-masala", "Garam Masala", "MDH", "100g", 95],
    ["everest-turmeric", "Turmeric Powder", "Everest", "100g", 45],
    ["catch-coriander", "Coriander Powder", "Catch", "100g", 50],
    ["everest-chilli", "Kashmirilal Chilli Powder", "Everest", "100g", 65],
    ["catch-cumin", "Cumin Seeds", "Catch", "100g", 75],
    ["tata-hing", "Compounded Asafoetida", "Tata Sampann", "10g", 50]
  ]],
  ["instant-food", [
    ["maggi-masala-noodles", "2-Minute Masala Noodles", "Maggi", "70g", 14],
    ["yippee-magic-masala", "Magic Masala Noodles", "Sunfeast YiPPee!", "70g", 14],
    ["knorr-tomato-soup", "Classic Thick Tomato Soup", "Knorr", "53g", 55]
  ]],
  ["bakery-bread", [
    ["modern-white-bread", "White Sandwich Bread", "Modern", "400g", 45]
  ]],
  ["personal-care", [
    ["dove-cream-beauty-soap", "Cream Beauty Bathing Bar", "Dove", "100g", 65],
    ["lux-soft-glow-soap", "Soft Glow Soap", "Lux", "100g", 35],
    ["colgate-dental-cream", "Strong Teeth Toothpaste", "Colgate", "100g", 65],
    ["clinic-plus-shampoo", "Strong & Long Shampoo", "Clinic Plus", "175ml", 120],
    ["dettol-handwash", "Original Handwash", "Dettol", "200ml", 110],
    ["nivea-body-lotion", "Body Milk Nourishing Lotion", "Nivea", "200ml", 210]
  ]],
  ["household-cleaning", [
    ["vim-dishwash-bar", "Lemon Dishwash Bar", "Vim", "200g", 30],
    ["surf-excel-detergent", "Easy Wash Detergent Powder", "Surf Excel", "1kg", 150]
  ]],
  ["pooja-items", [
    ["mangaldeep-agarbatti", "Rose Incense Sticks", "Mangaldeep", "100g", 40],
    ["cycle-pure-agarbatti", "Three-in-One Incense Sticks", "Cycle Pure", "100g", 50],
    ["camphor-tablets", "Camphor Tablets", "Pooja Essentials", "50g", 45],
    ["cotton-wicks", "Cotton Pooja Wicks", "Pooja Essentials", "100 count", 30],
    ["diya-oil", "Pooja Diya Oil", "Pooja Essentials", "500ml", 90],
    ["roli-kumkum-kit", "Roli Kumkum Pooja Kit", "Pooja Essentials", "1 pack", 35]
  ]],
  ["other-daily-essentials", [
    ["safety-matches", "Safety Matches", "Homelites", "10 boxes", 20]
  ]],
  ["fruits", []],
  ["vegetables", []],
  ["frozen-foods", []],
  ["ice-cream", []],
  ["baby-care", []],
  ["dry-fruits-nuts", []],
  ["kitchen-essentials", []],
  ["stationery", []],
  ["pet-care", []],
  ["health-hygiene", []]
];

window.inderProducts = demoProductsByCategory.flatMap(([category, items]) =>
  items.map(([id, name, brand, weight, price]) => {
    const categoryDetails = window.inderCategories.find((item) => item.id === category);
    return {
      id,
      name,
      category,
      categoryLabel: categoryDetails.name,
      brand,
      weight,
      price,
      image: categoryDetails.imageUrl,
      rating: null,
      originalPrice: null,
      discount: null,
      popularity: null,
      newest: null,
      priceType: "DEMO"
    };
  })
);
