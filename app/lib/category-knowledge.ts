// ============================================================
// app/lib/category-knowledge.ts
//
// KNOWLEDGE LIBRARY — Amazon Product Domain Knowledge
//
// HOW IT WORKS:
// 1. Product title and category are scanned for keywords
// 2. The most specific matching knowledge block is returned
// 3. This context is injected into the LLM prompt
//
// Each block covers:
// - Common buyer complaints in this category
// - Fake review signals specific to this category
// - Top listing gaps Amazon sellers miss
// - Amazon-specific fix language (bullet points, A+ content, backend keywords)
//
// FUNCTION SIGNATURE:
//   getCategoryKnowledge(productTitle: string, category: string): string
// Returns a string of expert context under 500 tokens.
// ============================================================

// ── Category detection keywords ───────────────────────────────

const CATEGORY_KEYWORDS: Array<{ key: string; keywords: string[] }> = [
  {
    key: 'electronics',
    keywords: [
      'bluetooth', 'wireless', 'charger', 'cable', 'usb', 'hdmi', 'adapter',
      'speaker', 'headphone', 'earphone', 'earbud', 'monitor', 'keyboard',
      'mouse', 'laptop', 'tablet', 'phone', 'camera', 'battery', 'power bank',
      'smart', 'wifi', 'router', 'hub', 'dock', 'led', 'light strip',
    ],
  },
  {
    key: 'kitchen',
    keywords: [
      'pan', 'pot', 'skillet', 'knife', 'cutting board', 'blender', 'air fryer',
      'instant pot', 'coffee maker', 'kettle', 'toaster', 'microwave', 'baking',
      'mixing bowl', 'strainer', 'colander', 'spatula', 'utensil', 'cookbook',
      'food storage', 'container', 'lunch box', 'kitchen', 'cooking', 'cookware',
    ],
  },
  {
    key: 'health',
    keywords: [
      'vitamin', 'supplement', 'protein', 'probiotic', 'collagen', 'omega',
      'melatonin', 'zinc', 'magnesium', 'turmeric', 'mask', 'glove', 'brace',
      'support', 'pillow', 'mattress', 'heating pad', 'thermometer', 'blood pressure',
      'scale', 'posture', 'compression', 'bandage', 'first aid',
    ],
  },
  {
    key: 'sports',
    keywords: [
      'resistance band', 'dumbbell', 'barbell', 'yoga mat', 'foam roller',
      'jump rope', 'gym', 'workout', 'fitness', 'running', 'cycling', 'hiking',
      'camping', 'tent', 'backpack', 'water bottle', 'hydration', 'sports bag',
      'jersey', 'shorts', 'leggings', 'activewear', 'sneaker', 'shoe',
    ],
  },
  {
    key: 'toys',
    keywords: [
      'toy', 'lego', 'puzzle', 'game', 'doll', 'action figure', 'remote control',
      'rc car', 'board game', 'card game', 'building block', 'playset', 'stuffed',
      'plush', 'educational', 'kids', 'children', 'baby', 'toddler',
    ],
  },
  {
    key: 'pet',
    keywords: [
      'dog', 'cat', 'pet', 'collar', 'leash', 'harness', 'crate', 'kennel',
      'litter', 'food bowl', 'water fountain', 'pet bed', 'scratching post',
      'fish tank', 'aquarium', 'bird cage', 'chew toy', 'treat', 'grooming',
    ],
  },
  {
    key: 'beauty',
    keywords: [
      'foundation', 'concealer', 'mascara', 'lipstick', 'eyeshadow', 'blush',
      'highlighter', 'serum', 'moisturizer', 'sunscreen', 'toner', 'cleanser',
      'shampoo', 'conditioner', 'hair mask', 'hair oil', 'nail polish', 'perfume',
      'skincare', 'makeup', 'beauty', 'lotion', 'cream',
    ],
  },
  {
    key: 'tools',
    keywords: [
      'drill', 'saw', 'screwdriver', 'wrench', 'hammer', 'level', 'tape measure',
      'tool set', 'socket', 'pliers', 'extension cord', 'power tool', 'hand tool',
      'ladder', 'workbench', 'storage cabinet', 'shelf bracket', 'anchor', 'screw',
      'paint brush', 'roller', 'caulk', 'putty', 'sealant',
    ],
  },
]

// ── Knowledge blocks per category ────────────────────────────

const CATEGORY_KNOWLEDGE: Record<string, string> = {

  electronics: `
AMAZON ELECTRONICS BUYER PATTERNS:
COMMON COMPLAINTS:
- Compatibility: "doesn't work with my [device/OS version]" — top complaint across all electronics
- Connectivity failures: drops signal, won't pair, intermittent connection after first week
- Charging problems: slow charge, doesn't charge at all, gets hot while charging
- Setup friction: "impossible to set up", vague manual, no app support for older phones
- Firmware/update issues: product degrades after update, won't connect post-update
- Counterfeit signals: missing safety certifications (CE, FCC, UL), smell of cheap plastic, short cord

FAKE REVIEW SIGNALS:
- Surge of 5★ reviews with no text or only "great product"
- Identical phrasing across multiple reviews posted same day
- Reviewers with no other purchase history (new accounts, Vine heavy on low-quality items)
- Reviews praising "fast shipping" with no mention of the product itself

TOP LISTING GAPS:
- No compatibility table (device models, OS versions supported)
- Specs buried — buyers want voltage, wattage, connector type in bullet points
- No mention of certifications (FCC, CE, RoHS, UL listed)
- Missing "what's in the box" list causes return spike

AMAZON-SPECIFIC FIXES:
- Lead bullet point with compatibility: "Compatible with [top 5 device models]"
- Add backend keywords: connector type, wattage, certification numbers
- A+ content: compatibility chart, comparison table vs competitor
- Backend: include model numbers of compatible devices — massive long-tail traffic`,

  kitchen: `
AMAZON KITCHEN & HOME BUYER PATTERNS:
COMMON COMPLAINTS:
- Material safety: "is this BPA-free?", "is it food-grade?", "safe for dishwasher?"
- Assembly complaints: missing screws, instructions unclear, parts don't align
- Durability under heat: warps in dishwasher, coating peels after 3-4 months
- Sizing inaccuracy: "holds half what description says", "smaller than photo"
- Smell issues: chemical smell when first used, plastic smell when heated

FAKE REVIEW SIGNALS:
- Multiple reviews claiming "lasts forever" on a product that's been listed 3 months
- Reviews referencing features not in the listing or that don't exist
- Heavy clustering of 5★ reviews immediately after launch with no negative reviews

TOP LISTING GAPS:
- No material certification (BPA-free, food-grade silicone, PFOA-free)
- Dimensions given as external only — buyers need internal capacity
- No dishwasher/microwave/oven safety statement in bullets
- No "first use" instructions — causes smell/coating complaints

AMAZON-SPECIFIC FIXES:
- Bullet 1: material safety certifications prominently (BPA-free, FDA-approved, PFOA-free)
- Bullet 2: exact internal dimensions AND capacity in both metric and imperial
- A+ content: care instructions module, material comparison chart
- Backend keywords: oven-safe temperature rating, dishwasher-safe, material type`,

  health: `
AMAZON HEALTH & PERSONAL CARE BUYER PATTERNS:
COMMON COMPLAINTS:
- Ingredient sensitivities: "caused a rash", "allergic reaction", undisclosed allergens
- Size/fit accuracy: braces, supports, compression items — buyers order wrong size
- Effectiveness vs claims: "didn't work as described", "no difference after 30 days"
- Packaging leaks: liquid supplements, oils, creams arrive leaking or with broken seal
- Expiry signals: product already expired or close to expiry on arrival

FAKE REVIEW SIGNALS:
- Claims of miraculous results in 1-3 days for supplements (biologically implausible)
- Reviews praising taste/smell for unflavored products
- Identical before-after stories across multiple ASINs by same brand

TOP LISTING GAPS:
- No full ingredient list in listing (buyers can't check allergens without buying)
- Size charts use vague S/M/L without measurements — causes returns
- Claims not supported by citations — triggers buyer skepticism
- No manufacturing date or expiry date policy in listing

AMAZON-SPECIFIC FIXES:
- Full ingredient list in listing description (not just "natural ingredients")
- Size chart bullet with actual measurements (inches/cm) for every size
- A+ content: ingredient breakdown, how-to-use module, FAQ on sensitivities
- Backend: ingredient names as keywords — buyers search for specific ingredients`,

  sports: `
AMAZON SPORTS & OUTDOORS BUYER PATTERNS:
COMMON COMPLAINTS:
- Size chart accuracy: apparel and gear runs small/large vs the chart
- Material durability: tears under stress, seams fail after first session, stitching unravels
- Weather resistance: "not as waterproof as claimed", leaks in heavy rain
- Assembly: parts missing, instructions incomplete for multi-piece gear
- Missing parts: accessories shown in photos not included in box

FAKE REVIEW SIGNALS:
- Reviews praising durability on day 1 ("very durable quality") — can't know yet
- No mention of specific use case — "great product" without context
- Profile of reviewer has no other sporting goods purchases

TOP LISTING GAPS:
- Size chart not specific enough — needs actual measurements, not just S/M/L
- No waterproof rating (IPX rating, mm water column) for outdoor gear
- Material weight not listed (gsm for fabrics) — proxy for quality
- No mention of what scenario it handles well vs where it has limits

AMAZON-SPECIFIC FIXES:
- Size chart image in gallery showing actual chest/waist/hip measurements
- Bullet with specific waterproof/weatherproof rating (IPX4, 10,000mm)
- A+ content: use-case comparison table, size guide with measurement instructions
- Backend: activity-specific keywords, size variants, weather ratings`,

  toys: `
AMAZON TOYS & GAMES BUYER PATTERNS:
COMMON COMPLAINTS:
- Age appropriateness: "too hard for the age listed", "too easy", age range misleading
- Safety signals: small parts, sharp edges, paint smell, lead/BPA in materials
- Battery type/life: unusual battery size (N, C, 9V), drains fast, no batteries included
- Assembly complexity: takes 2 hours when listing says "easy setup"
- Durability: breaks on first day of play, cheap plastic, thin joints

FAKE REVIEW SIGNALS:
- All 5★ reviews from accounts with no other toy purchases
- Reviews claiming "my child absolutely loves it" with no specific detail
- Photos in reviews that look like product shots, not real play

TOP LISTING GAPS:
- Battery type not specified in bullets — causes immediate return
- No ASTM F963 / CPSC compliance statement for children's products
- Age range listed without explanation of why (physical ability? attention span?)
- Missing "what's in the box" item count — causes returns for "missing pieces"

AMAZON-SPECIFIC FIXES:
- Bullet: exact battery type, quantity, whether included or not
- Bullet: ASTM F963 compliant, tested for children ages X+
- A+ content: assembly diagram, age-appropriate use guide
- Backend: battery type, age range, educational category, skill level`,

  pet: `
AMAZON PET SUPPLIES BUYER PATTERNS:
COMMON COMPLAINTS:
- Safety (non-toxic): "my dog chewed it and I'm worried it's toxic"
- Sizing for breeds: collar/harness fits chart inaccurate for breed body shape
- Durability vs chewing: destroyed in under an hour by aggressive chewers
- Food-grade materials: bowls, feeders, treats — buyers check for BPA/food-safe claims
- Smell: product has chemical smell, pet won't use it

FAKE REVIEW SIGNALS:
- Claims product "stopped shedding completely" or "cured" a condition
- Photos that look staged with a perfect-looking pet
- Reviews with no mention of specific breed or pet size

TOP LISTING GAPS:
- No material safety statement (non-toxic, BPA-free, food-grade)
- Sizing chart doesn't reference breed weight/neck/girth measurements
- No chew-strength rating or intended use case (light chewer vs power chewer)
- Missing assembly or setup instructions for feeders, crates, gates

AMAZON-SPECIFIC FIXES:
- Bullet 1: safety certifications (non-toxic, food-grade, BPA-free)
- Bullet 2: sizing chart with breed weight AND body measurement ranges
- A+ content: breed suitability guide, durability comparison by chew level
- Backend: breed names, size descriptors (small/medium/large dog), material type`,

  beauty: `
AMAZON BEAUTY BUYER PATTERNS:
COMMON COMPLAINTS:
- Shade accuracy vs photos: foundation/concealer color different from listing image
- Skin sensitivity: causes breakouts, redness, irritation — ingredient not disclosed
- Scent complaints: "smells like chemicals", scent fades within an hour
- Packaging quality: pump broken on arrival, leaks during shipping, difficult to open
- Longevity: "lasts 2 hours not all day", coverage not as full as shown

FAKE REVIEW SIGNALS:
- Before/after photos with dramatic results posted on day 1 of product launch
- Reviews claiming "cured" a skin condition — illegal claim, signals manipulation
- Multiple reviews referencing the same unusual benefit not in the listing

TOP LISTING GAPS:
- No full ingredient list (INCI names) — buyers with sensitivities need this
- Shade names don't match standardized naming used by other brands
- No skin type guidance (oily/dry/combination/sensitive) in listing
- Finish and coverage level not described specifically

AMAZON-SPECIFIC FIXES:
- Bullet: skin type suitability, finish (matte/dewy/satin), coverage level
- Bullet: key ingredients highlighted with benefits, allergens disclosed
- A+ content: shade comparison chart, skin type guide, ingredient spotlight
- Backend: skin type, finish type, key ingredients, color family`,

  tools: `
AMAZON TOOLS & HOME IMPROVEMENT BUYER PATTERNS:
COMMON COMPLAINTS:
- Fit/compatibility: "doesn't fit my [specific model/brand]"
- Power adequacy: "not strong enough for [specific material/task]"
- Safety certifications: no UL listing, no CSA approval — buyers reject for professional use
- Assembly instructions: missing steps, diagrams don't match parts in box
- Missing hardware: screws, anchors, mounting hardware not included

FAKE REVIEW SIGNALS:
- Professional claims ("used this on a job site for years") from newly created account
- Reviews praising power output with no mention of what task was performed
- No mention of compared tools or trade-offs

TOP LISTING GAPS:
- No compatibility statement (screw size, pilot hole diameter, material type)
- Power specs hidden — buyers need amps, volts, RPM, torque rating in bullets
- No UL/ETL/CSA certification listed — blocks professional and commercial use
- No maximum load/weight rating for mounting hardware and brackets

AMAZON-SPECIFIC FIXES:
- Bullet 1: compatible screw/bolt sizes, pilot hole specs, compatible materials
- Bullet 2: power rating (amps, volts, watts), max RPM or torque
- Bullet 3: safety certifications (UL listed, ETL certified, CSA approved)
- A+ content: compatibility table, installation diagram, load rating chart
- Backend: screw size, material compatibility, certification numbers`,
}

// ── Generic fallback ─────────────────────────────────────────

const GENERIC_FALLBACK = `
AMAZON GENERAL BUYER PATTERNS:
COMMON COMPLAINTS:
- Item not as described — photos show different size, color, or quality
- Missing parts — components shown in photos not included in box
- Durability — fails or breaks earlier than expected from listing claims
- Difficult setup — instructions missing or unclear for multi-part products

FAKE REVIEW SIGNALS:
- Surge of identical-phrasing 5★ reviews with no product detail
- Reviews from accounts with no verified purchase history
- Claims of benefits that contradict what the product physically does

TOP LISTING GAPS:
- Dimensions and capacity in both metric and imperial
- What's in the box — full item count to prevent "missing pieces" returns
- Material type and any relevant safety certifications
- Compatibility or fit information if product must match another item

AMAZON-SPECIFIC FIXES:
- Lead bullet with the most-searched compatibility or use case
- A+ content to address the top FAQ buyers ask before buying
- Backend keywords: material, size, compatible device or product names
- Add a "what's in the box" bullet to reduce return rate`

// ── Detection function ────────────────────────────────────────

function detectCategory(productTitle: string, category: string): string {
  const combined = (productTitle + ' ' + category).toLowerCase()

  for (const { key, keywords } of CATEGORY_KEYWORDS) {
    for (const kw of keywords) {
      if (combined.includes(kw)) return key
    }
  }

  // Check category string against category keys directly
  const catLower = category.toLowerCase()
  if (catLower.includes('electronic') || catLower.includes('computer')) return 'electronics'
  if (catLower.includes('kitchen') || catLower.includes('home') || catLower.includes('garden')) return 'kitchen'
  if (catLower.includes('health') || catLower.includes('personal care') || catLower.includes('grocery')) return 'health'
  if (catLower.includes('sport') || catLower.includes('outdoor') || catLower.includes('fitness')) return 'sports'
  if (catLower.includes('toy') || catLower.includes('game') || catLower.includes('baby')) return 'toys'
  if (catLower.includes('pet')) return 'pet'
  if (catLower.includes('beauty') || catLower.includes('cosmetic')) return 'beauty'
  if (catLower.includes('tool') || catLower.includes('hardware') || catLower.includes('improvement')) return 'tools'

  return 'other'
}

// ── Main export ───────────────────────────────────────────────

export function getCategoryKnowledge(productTitle: string, category: string): string {
  const detected = detectCategory(productTitle, category)
  const knowledge = CATEGORY_KNOWLEDGE[detected] || GENERIC_FALLBACK
  return knowledge.trim()
}
