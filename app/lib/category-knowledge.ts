// ============================================================
// app/lib/category-knowledge.ts
//
// KNOWLEDGE LIBRARY — Etsy Product Domain Knowledge
//
// HOW IT WORKS:
// 1. Seller selects a category from the dropdown
// 2. Product name is scanned for keywords to detect specific product type
// 3. The most specific matching knowledge block is injected into the prompt
// 4. If no specific match found, category-level knowledge is used as fallback
//
// WHY THIS EXISTS:
// Without domain knowledge, the model gives generic fixes.
// With domain knowledge, the model gives expert-level fixes:
//   Generic: "use better thread"
//   Expert:  "switch to 0.8mm waxed linen thread, saddle stitch pattern"
//
// HOW TO ADD NEW PRODUCTS:
// 1. Add keywords to PRODUCT_KEYWORDS map
// 2. Add knowledge block to PRODUCT_KNOWLEDGE map with same key
// 3. Keep each block under 500 tokens
// ============================================================

// ── Product type detection ────────────────────────────────────
// Maps product type keys to keywords that identify them from product name.
// Checked in order — first match wins.

const PRODUCT_KEYWORDS: Record<string, string[]> = {

  // ── Home & Living ──────────────────────────────────────────
  'candle':        ['candle', 'candles', 'soy candle', 'beeswax', 'wax melt', 'wax melts', 'taper'],
  'macrame':       ['macrame', 'macramé', 'wall hanging', 'woven wall', 'fiber art', 'boho wall', 'tapestry', 'textile wall'],
  'ceramic':       ['ceramic', 'pottery', 'mug', 'bowl', 'vase', 'planter', 'stoneware', 'earthenware', 'clay', 'wheel thrown', 'handthrown'],
  'cutting_board': ['cutting board', 'charcuterie', 'cheese board', 'serving board', 'wooden board'],
  'print':         ['print', 'poster', 'art print', 'wall art', 'illustration', 'digital print', 'giclée'],
  'canvaspainting':['canvas', 'painting', 'acrylic painting', 'oil painting', 'watercolor', 'original art'],
  'wreath':        ['wreath', 'door wreath', 'floral wreath', 'dried wreath', 'eucalyptus wreath'],
  'pillow':        ['pillow', 'cushion', 'throw pillow', 'pillow cover', 'pillowcase'],
  'blanket':       ['blanket', 'throw blanket', 'knit blanket', 'crochet blanket', 'woven blanket'],
  'soap':          ['soap', 'bar soap', 'liquid soap', 'bath bomb', 'shower gel', 'body wash', 'lotion', 'body butter'],

  // ── Jewelry & Accessories ──────────────────────────────────
  'ring':          ['ring', 'rings', 'band', 'signet ring', 'stacking ring', 'wedding band'],
  'necklace':      ['necklace', 'pendant', 'chain necklace', 'choker', 'locket'],
  'earrings':      ['earring', 'earrings', 'studs', 'hoops', 'dangles', 'ear wire'],
  'bracelet':      ['bracelet', 'bangle', 'cuff', 'charm bracelet', 'beaded bracelet'],
  'leather_wallet':['wallet', 'card holder', 'card wallet', 'bifold', 'money clip', 'leather wallet'],
  'leather_bag':   ['leather bag', 'leather purse', 'leather tote', 'leather backpack', 'leather clutch', 'leather handbag'],
  'fabric_bag':    ['tote bag', 'canvas bag', 'cotton bag', 'fabric purse', 'crossbody bag', 'shoulder bag', 'handbag', 'purse', 'clutch'],
  'hat':           ['hat', 'beanie', 'cap', 'bucket hat', 'sun hat', 'knit hat'],
  'scarf':         ['scarf', 'scarves', 'wrap', 'shawl', 'cowl'],

  // ── Clothing & Apparel ─────────────────────────────────────
  'tshirt':        ['t-shirt', 'tshirt', 'tee', 'shirt', 'top', 'blouse'],
  'dress':         ['dress', 'skirt', 'maxi dress', 'midi dress', 'wrap dress'],
  'sweater':       ['sweater', 'jumper', 'cardigan', 'knitwear', 'pullover', 'hoodie', 'sweatshirt'],
  'leggings':      ['leggings', 'yoga pants', 'activewear', 'joggers', 'sweatpants'],

  // ── Craft Supplies ─────────────────────────────────────────
  'yarn':          ['yarn', 'wool', 'fiber', 'roving', 'spinning fiber', 'knitting yarn', 'crochet yarn'],
  'fabric':        ['fabric', 'cloth', 'material', 'cotton fabric', 'linen fabric', 'quilting fabric'],
  'stamp':         ['stamp', 'rubber stamp', 'clear stamp', 'stamping'],
  'sticker':       ['sticker', 'stickers', 'decal', 'vinyl sticker', 'planner sticker'],

  // ── Paper & Party ──────────────────────────────────────────
  'invitation':    ['invitation', 'invitations', 'wedding invitation', 'birthday invitation', 'invite'],
  'card':          ['greeting card', 'note card', 'postcard', 'thank you card', 'birthday card'],
  'planner':       ['planner', 'journal', 'notebook', 'bullet journal', 'diary'],

  // ── Pet Supplies ───────────────────────────────────────────
  'pet_collar':    ['dog collar', 'cat collar', 'pet collar', 'collar', 'leash', 'harness'],
  'pet_toy':       ['dog toy', 'cat toy', 'pet toy', 'chew toy', 'catnip'],
  'pet_bed':       ['dog bed', 'cat bed', 'pet bed', 'pet mat', 'pet cushion'],

  // ── Food & Drink ───────────────────────────────────────────
  'jam':           ['jam', 'jelly', 'preserve', 'marmalade', 'spread', 'honey'],
  'spice':         ['spice', 'spices', 'seasoning', 'rub', 'blend', 'herb mix'],
  'chocolate':     ['chocolate', 'truffle', 'fudge', 'candy', 'sweet', 'confection'],
  'tea':           ['tea', 'herbal tea', 'loose leaf', 'tea blend', 'chai'],

  // ── Toys & Games ───────────────────────────────────────────
  'wood_toy':      ['wooden toy', 'wood toy', 'puzzle', 'wooden puzzle', 'toy car', 'toy train', 'play set'],
  'stuffed_toy':   ['stuffed animal', 'plushie', 'plush toy', 'soft toy', 'amigurumi', 'doll', 'stuffed'],
  'game':          ['game', 'board game', 'card game', 'dice', 'chess', 'checkers'],

  // ── Weddings ───────────────────────────────────────────────
  'wedding_sign':  ['wedding sign', 'welcome sign', 'seating chart', 'table sign', 'place card'],
  'wedding_favor': ['wedding favor', 'favor', 'wedding gift', 'guest gift', 'party favor'],
  'wedding_decor': ['wedding decor', 'centerpiece', 'table decor', 'wedding decoration', 'ceremony decor'],
}

// ── Knowledge blocks per product type ────────────────────────

const PRODUCT_KNOWLEDGE: Record<string, string> = {

  'candle': `
CANDLE EXPERT KNOWLEDGE:
TUNNELING (wax only melts around wick, thick walls remain):
- Root cause: wick diameter too small for jar diameter — never a burn time issue
- Fix by jar size: 2" jar = CD-10 or ECO-6 | 2.5" jar = CD-12 or ECO-8 | 3" jar = CD-18 or ECO-10 | 3.5" jar = CD-22 or ECO-14
- Rule: first burn must achieve full melt pool edge to edge — if it cannot, wick is wrong size
- Supplier: Candle Science, Lone Star Candle Supply, CandleWic for wick samples

WEAK SCENT THROW:
- Root cause: fragrance load too low, wrong flashpoint, or added at wrong temperature
- Fix: increase fragrance oil to 10% of wax weight (max 12% for soy wax)
- Add fragrance at 185°F — above 200°F burns off top notes, below 170°F causes separation
- Use fragrance oils with flashpoint above 170°F for soy — check supplier spec sheet
- Cold throw vs hot throw: if scent strong cold but weak burning → wick too small (not enough heat)

CRACKED JAR: always shipping damage, never production issue
- Fix: 2-inch pre-cut foam inserts all 6 sides (Foam Factory candle inserts), double-wall 32 ECT box
- Suppliers: Uline (S-4104), Foam Factory (search "candle jar foam insert")

SOOT / BLACK SMOKE:
- Root cause: wick not trimmed or wick too large for jar
- Fix: include a wick trimmer in every order + printed card "trim wick to 1/4 inch before each burn"
- Add to listing: "trim wick before each burn for clean smoke-free experience"

NO WICK INSTRUCTIONS:
- Fix: printed card inside box — "First burn: let wax melt fully to edges (2-3 hrs). Trim wick to 1/4" before each burn. Never burn more than 4 hours."`,

  'macrame': `
MACRAME EXPERT KNOWLEDGE:
FRINGE UNRAVELING:
- Root cause: rope ends not finished — need whipping, overhand knot, or fabric glue
- Fix 1 (simplest): apply a small drop of Beacon Fabric Glue or Aleene's Fabric Fusion to each rope end — let dry 24 hours before shipping
- Fix 2 (professional): whip each end with matching thread — wrap 6-8 times around the last 1cm, thread through loop, pull tight
- Fix 3 (decorative): tie an overhand knot at each end — makes fringe look intentionally finished
- NEVER use heat gun or lighter on natural cotton — burns and discolors
- Thread weight for macrame: 3mm single strand for main body, 2mm for fringe sections

COLOR DIFFERENT FROM PHOTOS:
- Root cause: tungsten/warm studio lighting makes natural cotton look whiter than it is
- Natural cotton rope is ALWAYS warm-toned (cream/ivory) — never cool white
- Fix: reshoot in north-facing natural daylight (10am-2pm), ISO 200, f/8
- Add to listing description: "Natural cotton rope has warm ivory tones — not bright white. Photos taken in natural daylight for accurate color."
- Offer a physical swatch ($2-3 shipped) for buyers who need exact color matching

SIZE LOOKS DIFFERENT IN PHOTOS:
- Root cause: wide-angle or close-up photography makes piece look larger
- Fix: add a photo showing piece next to a standard item (hand, chair, doorframe)
- Add dimensions as FIRST line of listing description in both inches and cm
- Add a size comparison photo — this alone reduces size complaints by 60%

WARPED WOODEN DOWEL:
- Root cause: kiln-dried birch or pine warps with humidity changes during storage/shipping
- Fix: source dowels from craft suppliers who specify "kiln-dried" (Woodpeckers, Craft Dowels)
- Store dowels horizontally in climate-controlled space — never standing upright
- Wrap dowels in kraft paper for shipping — not plastic (plastic traps moisture)
- Test: roll each dowel on flat surface before use — reject any that wobble

UNEVEN FRINGE LENGTH:
- Root cause: cutting rope freehand without guide
- Fix: use a cardboard template cut to exact fringe length — cut all strands against template
- Use sharp fabric scissors not craft scissors — dull blades cause uneven cuts`,

  'ceramic': `
CERAMIC EXPERT KNOWLEDGE:
HANDLE BREAKS:
- Root cause: earthenware fired below 1200°C OR handle not scored before joining
- Fix: switch to stoneware clay body (cone 6, 1240°C minimum) — Laguna B-Mix 5 or Standard 182 Speckled Buff
- Score handle join with serrated rib tool, both pieces at leather-hard stage (not bone dry)
- Apply slip generously, press firmly, smooth join — stoneware handles survive 400+ dishwasher cycles

COLOR DIFFERENT FROM PHOTOS:
- Root cause: 3200K tungsten studio lights shift glaze color warm by 2-3 stops
- Fix: reshoot under north-facing natural light, overcast day, 10am-2pm, ISO 200 f/8 1/125s
- Add to listing: "All photos in natural daylight. Glaze may appear 10-15% richer on warm monitors."

GLAZE CRAZING (cracks in glaze surface):
- Root cause: thermal expansion mismatch between clay body and glaze
- Fix: use commercial glaze rated for same cone as clay body — do not mix cone 6 glaze with cone 10 clay
- Fire to temperature listed on glaze bottle exactly — under-firing causes crazing

CHIPPING:
- Root cause: shipping without adequate cushioning
- Fix: double-wall box, 2 inches bubble wrap all sides, mark FRAGILE
- Each piece in its own box — never pack multiple ceramics together`,

  'cutting_board': `
CUTTING BOARD EXPERT KNOWLEDGE:
WARPING:
- Root cause: end grain boards warp when one side gets wet — must be sealed both sides
- Fix: apply food-grade mineral oil to ALL surfaces including bottom before first use
- Season with Howard Butcher Block Conditioner (beeswax + mineral oil) monthly
- Add to listing: "Season with mineral oil before first use — apply to all surfaces including bottom"

CRACKING:
- Root cause: dishwasher use or soaking in water — wood expands/contracts and cracks
- Fix: add "hand wash only" care card inside each order — laser engrave or stamp this on board itself
- Use edge-grain or end-grain construction — face-grain boards crack more easily

FOOD SAFETY:
- Use only food-safe finishes: mineral oil, beeswax, or FDA-approved wood finish
- Never use linseed oil (not food safe), olive oil (goes rancid), or vegetable oil
- Add finish type to listing: "Finished with food-grade mineral oil — safe for all food contact"

SCRATCHES ON ARRIVAL:
- Root cause: boards rubbing together in box
- Fix: wrap each board individually in kraft paper or bubble wrap — never ship unwrapped`,

  'leather_wallet': `
LEATHER WALLET EXPERT KNOWLEDGE:
STITCHING FAILS:
- Root cause: wrong thread type or lock stitch instead of saddle stitch
- Fix: 0.8mm waxed linen thread, saddle stitch pattern (two needles, one thread, locked every hole)
- Suppliers: Tandy Leather, Rocky Mountain Leather Supply, Springfield Leather
- Single-ply thread fails at stress points — use 2-ply or heavier for card slots and edges

CARD SLOTS TOO TIGHT:
- Fix: widen slot by 2mm using leather skiver — target 88mm internal width
- Standard credit card is 85.6mm wide — need 2.4mm minimum clearance each side
- Break in slots with cards during QC before shipping — eliminates stiffness complaints

SCRATCHED ON ARRIVAL:
- Root cause: transit damage — not production defect
- Fix: wrap each wallet in microfoam sheet (1/16 inch), place in rigid kraft box not poly mailer
- Add tissue paper layer inside box around the microfoam wrap

COLOR TRANSFER:
- Root cause: excess dye not sealed
- Fix: apply 2 coats Fiebing's Leather Sheen after dyeing, buff between coats`,

  'leather_bag': `
LEATHER BAG EXPERT KNOWLEDGE:
STRAP BREAKS AT HARDWARE:
- Root cause: D-ring or swivel snap too small for strap load
- Fix: solid brass D-rings minimum 1-inch for bags under 5lbs, 1.5-inch for heavier
- Rivets must be double-cap copper rivets — not Chicago screws for load-bearing points
- Test every strap with 3x intended load before shipping

ZIPPER FAILS:
- Root cause: cheap zipper substitute — YKK failure rate 0.1% vs 8-12% generic
- Fix: specify YKK #5 coil zipper for main compartment — costs $0.40 more, eliminates complaints
- Specify in Etsy listing: "YKK zippers throughout"

LINING PEELS:
- Root cause: iron-on interfacing not bonded correctly
- Fix: Pellon 809 Décor-Bond interfacing, press at 300°F for 15 seconds with steam

SCRATCHED ON ARRIVAL:
- Root cause: poly mailers crush and scratch leather in transit
- Fix: stuff bag with acid-free tissue, wrap in microfoam, rigid box only — never poly mailer`,

  'fabric_bag': `
FABRIC BAG EXPERT KNOWLEDGE:
HANDLES TEAR:
- Root cause: handles sewn with single seam or wrong thread
- Fix: double-stitch all handle attachment points with 2.5mm stitch length
- Bartack at top and bottom of each handle attachment — this alone eliminates 90% of handle failures
- Use Gutermann thread minimum — generic thread breaks at handle stress points

FABRIC PILLING:
- Root cause: low-grade cotton or loose weave
- Fix: switch to 12oz canvas minimum for tote bags — 8oz canvas pills within months
- Pre-wash fabric before cutting — preshrinks and tightens weave

COLOR FADING:
- Root cause: reactive dye not fixed or wrong wash instructions
- Fix: include printed care card "machine wash cold, inside out, tumble dry low"
- Wash finished bags once before shipping — removes excess dye that causes fading

SEAMS UNRAVEL:
- Root cause: serger not used or wrong stitch type
- Fix: serge all interior seams, French seam for lightweight fabrics`,

  'ring': `
RING EXPERT KNOWLEDGE:
TARNISHING:
- Root cause: base metal not sealed or plating too thin
- Fix: 18k gold vermeil minimum 2.5 micron gold over sterling silver — not gold-filled or plated brass
- Add anti-tarnish strip to each package — available from Rio Grande or Stuller
- Include care card: "Store in provided pouch away from water, perfume, and lotions"

SIZING WRONG:
- Fix: add ring sizer to listing as a free add-on ($0.15 each from Esslinger)
- Add sizing guide photo showing how to measure finger at end of day (fingers swell)
- Offer free resize within 30 days — eliminates sizing anxiety and increases conversion

STONE FALLS OUT:
- Root cause: prong not burnished fully or bezel too shallow
- Fix: bezel depth minimum 1/3 of stone height — use bezel rocker tool to roll edge over stone
- Check every stone setting under 10x loupe before shipping

ALLERGIC REACTION:
- Root cause: nickel in base metal
- Fix: specify "nickel-free, lead-free" in listing and to supplier in writing
- Switch to sterling silver, 14k gold, or titanium for sensitive customers`,

  'earrings': `
EARRING EXPERT KNOWLEDGE:
EAR WIRE BREAKS:
- Root cause: thin gauge wire or wrong alloy
- Fix: use 20-gauge sterling silver or 14k gold-filled ear wire minimum
- Suppliers: Rio Grande, Fire Mountain Gems — specify "nickel-free" always
- Test by opening and closing hook 20 times — if it fatigues, wire gauge is too thin

STONE OR CHARM FALLS OFF:
- Root cause: head pin loop not closed fully or jump ring not soldered
- Fix: close all loops with round-nose pliers until no gap — test with fingernail
- Solder jump rings for heavy pendants over 3 grams

POST BACKS FALL OFF:
- Root cause: friction back too loose or wrong size post
- Fix: use clutch backs (La Rose or Earnuts) for posts — they grip better than friction backs
- Match post diameter to back: 0.76mm post with standard back

ALLERGIC REACTION:
- Fix: switch to surgical steel, sterling silver, 14k gold, or niobium posts
- State metals used prominently in listing — "sterling silver posts, nickel-free"`,

  'necklace': `
NECKLACE EXPERT KNOWLEDGE:
CHAIN BREAKS AT CLASP:
- Root cause: lobster clasp gauge too thin for chain weight
- Fix: 5mm lobster clasp minimum for chains under 2mm — 7mm clasp for heavier chains
- Suppliers: Beadaholique, Fire Mountain Gems — specify "sturdy lobster clasp" weight rating

CLASP WON'T STAY CLOSED:
- Root cause: spring in clasp fatigued or wrong clasp style
- Fix: spring ring clasps fatigue quickly — switch to lobster claw or toggle clasp
- Test every clasp by opening/closing 50 times before use

PENDANT SLIDES ON CHAIN:
- Root cause: bail opening too large for chain link
- Fix: bail opening should be 0.5mm larger than chain width maximum
- Use a split ring instead of jump ring for heavy pendants — split rings don't open under load

TARNISHING:
- Root cause: sterling silver oxidizes normally — set expectations in listing
- Fix: include anti-tarnish strip in packaging, add care card "polish with silver cloth, store in provided pouch"
- Offer rhodium plating option for sterling — adds $3-4 cost, eliminates tarnish complaints`,

  'soap': `
SOAP EXPERT KNOWLEDGE:
SWEATING / GLYCERIN DEW:
- Root cause: glycerin in soap attracts moisture from air — normal for cold process soap
- Fix: wrap each bar in shrink wrap or wax paper before shipping — eliminates sweating
- Add to listing: "Natural glycerin in handmade soap may attract moisture — store in cool dry place"

SOFT OR MUSHY:
- Root cause: not cured long enough — cold process soap needs 4-6 weeks minimum
- Fix: cure on wire rack minimum 4 weeks before shipping — test with fingernail hardness
- Increase lye concentration by 2-3% (superfat 5% instead of 8%) for harder bar

CRACKING ON TOP:
- Root cause: sodium lactate added while oils too hot, or too much water
- Fix: let oils cool to 90°F before combining with lye — use 33% lye concentration (3:1 water to lye)

COLOR FADING:
- Root cause: colorant not skin-safe-stable or UV exposure
- Fix: use cosmetic-grade micas from TKB Trading or Mad Micas — they hold color in soap
- Keep soap out of direct sunlight in listing photos and storage

SCENT FADES QUICKLY:
- Root cause: fragrance oil not skin-safe or not anchored with fixative
- Fix: use fragrance oils at 3% of total oil weight with a fixative (sodium lactate or kaolin clay)
- Fragrance oils from Brambleberry or Natures Garden are formulated for soap`,

  'print': `
PRINT EXPERT KNOWLEDGE:
COLORS DIFFERENT FROM SCREEN:
- Root cause: RGB digital file vs CMYK print — monitors show RGB, printers use CMYK
- Fix: convert all files to CMYK before sending to printer — use Adobe Acrobat or Photoshop
- Add to listing: "Colors may vary slightly from screen — we print in CMYK for truest color accuracy"
- Offer color proof at checkout for an additional fee

ARRIVED BENT OR CREASED:
- Root cause: shipped in regular envelope or soft mailer
- Fix: rigid flat mailer (Uline S-13750 stays-flat mailer) for prints under 11x14
- For larger prints: cardboard sandwich inside rigid mailer, or mailing tube
- Mark "DO NOT BEND" on outside — required for carrier damage claims

PIXELATED OR BLURRY:
- Root cause: file resolution too low for print size
- Fix: minimum 300 DPI at print size — a 4x6 print needs at least 1200x1800 pixels
- Use vector files (SVG, PDF) for text-heavy designs — never pixel fonts

PRINT LOOKS WASHED OUT:
- Root cause: file exported at low quality or wrong color profile
- Fix: export as PDF/X-1a at 300 DPI with embedded fonts`,

  'pillow': `
PILLOW EXPERT KNOWLEDGE:
ZIPPER BREAKS OR SNAGS:
- Root cause: cheap nylon zipper or wrong gauge
- Fix: YKK invisible zipper #3 for pillow covers — costs $0.30 more, eliminates complaints
- Sew zipper with zipper foot — zipper sewn with regular foot catches and breaks

FABRIC PILLING:
- Root cause: low thread count or synthetic blend
- Fix: minimum 200 thread count cotton for pillow covers — linen is pill-resistant
- Pre-wash all fabric before cutting — tightens weave and removes pills before sale

SEAMS UNRAVEL:
- Root cause: serger not used or insufficient seam allowance
- Fix: 1/2 inch seam allowance minimum, serge all raw edges, backstitch at start and end

INSERT LUMPY OR FLAT:
- Root cause: low fill power insert or wrong size
- Fix: insert should be 2 inches larger than cover on each side — 20x20 cover needs 22x22 insert
- Use down-alternative inserts with minimum 350g fill weight for 18x18 covers`,

  'blanket': `
BLANKET EXPERT KNOWLEDGE:
PILLING:
- Root cause: low twist yarn or acrylic blend
- Fix: switch to combed cotton or merino wool minimum 2-ply — avoid single-ply jersey
- Add washing instructions: "wash inside out cold, air dry flat — tumble dry causes pilling"

UNEVEN EDGES:
- Root cause: tension inconsistency in knit or crochet
- Fix: use stitch markers every 10 stitches to catch tension changes early
- Block finished blanket by soaking in lukewarm water, pin to dimensions, air dry flat

WRONG SIZE:
- Root cause: yarn shrinks after washing or gauge not checked
- Fix: always wash gauge swatch before measuring — natural fibers shrink 10-15%
- List dimensions as "after washing" in listing description

SHEDDING:
- Root cause: excess fiber not washed out before shipping
- Fix: wash and dry each blanket once before shipping — removes loose fibers`,

  'yarn': `
YARN EXPERT KNOWLEDGE:
TANGLING IN SKEIN:
- Root cause: skein not secured before shipping
- Fix: add a belly band label that wraps around skein — holds shape during shipping
- Twist skein figure-8 style before banding — prevents tangling

COLOR BLEEDING:
- Root cause: dye not set properly
- Fix: add Retayne to dye bath for cotton, use citric acid for protein fibers (wool, silk)
- Test colorfastness: wet yarn, press between white cloth, iron — no color transfer = colorfast
- Add care card: "first wash — cold water, gentle, separate"

WEIGHT DIFFERENT FROM LABEL:
- Fix: weigh each skein on postal scale before labeling — label must match within 5%
- List yardage AND weight in grams — both are needed for pattern substitution`,

  'fabric_bag_general': `
GENERAL BAG KNOWLEDGE:
STRAP ISSUES: bartack reinforcement at attachment points eliminates 90% of strap failures
ZIPPER ISSUES: YKK zippers only — generic zipper failure rate 8-12% vs YKK 0.1%
SCRATCHED ON ARRIVAL: rigid box only, never poly mailer for structured bags`,

  'stuffed_toy': `
STUFFED TOY EXPERT KNOWLEDGE:
STUFFING COMES OUT:
- Root cause: seam allowance too small or wrong stitch
- Fix: 1/2 inch seam allowance minimum, double-stitch all seams, ladder stitch openings closed by hand
- Use Gutermann thread not generic — pet and child toys need to survive pulling

EYES FALL OUT:
- Root cause: safety eyes not installed correctly or wrong backing
- Fix: push safety eye stem through fabric, place washer on inside and press until locked — test with 5lb pull force
- For children under 3: embroider eyes — no safety eyes regardless of how secure

PAINT CHIPS:
- Root cause: acrylic without topcoat
- Fix: prime with Zinsser, non-toxic acrylic, seal with Mod Podge Hard Coat — 3 coats minimum

WRONG SIZE:
- Fix: photo with ruler or common object for scale, dimensions as first line of description`,

  'invitation': `
INVITATION EXPERT KNOWLEDGE:
COLORS WRONG ON PRINT:
- Root cause: RGB file sent to printer — always use CMYK
- Fix: export as CMYK PDF at 300 DPI with 0.125 inch bleed on all sides
- Add color note to listing: "Colors calibrated for professional CMYK printing — may vary on home printers"

ARRIVED BENT:
- Root cause: soft mailer — always use rigid flat mailer
- Fix: Uline stays-flat mailer, "DO NOT BEND" stamp — required for carrier damage claims

TYPO IN PERSONALIZATION:
- Root cause: no proofing step before printing
- Fix: send digital proof within 24 hours, require written approval before printing
- Add to listing: "Proof sent within 24 hours — production begins after your approval"

ENVELOPE ISSUES:
- Fix: include 10% extra envelopes — addressing mistakes happen
- Use A7 envelopes for 5x7 invitations — they fit with room for liner`,

  'pet_collar': `
PET COLLAR EXPERT KNOWLEDGE:
BUCKLE BREAKS:
- Root cause: plastic buckle not rated for dog weight
- Fix: ITW Nexus side-release buckles rated for 2x target dog weight minimum
- For dogs over 50lbs: metal buckle only — plastic fails under load
- State buckle material and weight rating in listing

DYE BLEEDS ONTO FUR:
- Root cause: reactive dye not fixed
- Fix: OEKO-TEX certified fabric only, wash finished collars 3 times before shipping
- Add "wash before first use" on hangtag

WRONG SIZE:
- Fix: measuring guide photo showing tape measure around pet neck
- List in inches AND cm, include sizing chart with neck measurement ranges`,

  'wood_toy': `
WOOD TOY EXPERT KNOWLEDGE:
SPLINTERS:
- Root cause: insufficient sanding or wrong grit sequence
- Fix: sand to 220 grit, final pass 400 grit, seal with beeswax or food-grade mineral oil
- Run hand over every surface before painting — catch rough spots

PAINT CHIPS:
- Root cause: wrong primer or insufficient topcoat
- Fix: Zinsser Bulls Eye 1-2-3 primer, non-toxic acrylic, Mod Podge Hard Coat 3 coats minimum
- Test by pressing fingernail into finished surface — no indent = cured properly

SMALL PARTS SAFETY:
- Any part under 1.75 inches = choking hazard — add warning to listing and product
- "Not suitable for children under 3 years" must be visible in listing

PAINT SMELL:
- Root cause: VOC off-gassing — let cure 72 hours minimum before shipping
- Use zero-VOC paints: Safecoat, EcoPaints, or Rust-Oleum Chalked Paint (low VOC)`,
}

// ── Category-level fallback knowledge ─────────────────────────
// Used when no specific product type is detected

const CATEGORY_FALLBACK: Record<string, string> = {

  'Home & Living': `
HOME & LIVING GENERAL KNOWLEDGE:
- "Arrived damaged/cracked/broken" → always a shipping problem → fix is packaging (foam inserts, double-wall box, bubble wrap)
- "Color different from photos" → reshoot under 5500K natural daylight, north-facing window
- "Smaller than expected" → add size comparison photo, dimensions as first line of description
- Never apply an inspection fix to a shipping problem — they are different root causes`,

  'Jewelry & Accessories': `
JEWELRY GENERAL KNOWLEDGE:
- Tarnishing: 18k vermeil minimum 2.5 micron plating, anti-tarnish strip in packaging
- Breaks at clasp: lobster claw clasp minimum 5mm, check gauge rating
- Allergic reaction: specify nickel-free, lead-free to supplier in writing
- Wrong size: include sizing guide photo and offer resize within 30 days`,

  'Clothing & Apparel': `
CLOTHING GENERAL KNOWLEDGE:
- Sizing: add detailed size chart with actual measurements (chest, waist, hip, length in inches AND cm)
- Shrinkage: pre-wash and dry fabric before cutting — eliminates shrinkage completely
- Fading: cold wash inside out, Retayne color fixative on cotton
- Pilling: combed cotton or merino wool minimum 2-ply — avoid single-ply jersey under 180gsm`,

  'Art & Collectibles': `
ART GENERAL KNOWLEDGE:
- Print colors wrong: convert to CMYK PDF 300 DPI before sending to printer
- Arrived bent: rigid flat mailer (stays-flat), "DO NOT BEND" on exterior
- Canvas warps: wrap in plastic before boxing, include silica gel packet`,

  'Craft Supplies & Tools': `
CRAFT SUPPLIES GENERAL KNOWLEDGE:
- Tools arrive damaged: rigid box 200lb test corrugated, VCI bags for metal tools
- Wrong color: photograph on white background under 5500K daylight with color name labels
- Quantity wrong: weigh each package on postal scale before sealing`,

  'Bags & Purses': `
BAGS GENERAL KNOWLEDGE:
- Strap breaks: bartack reinforcement at attachment points, ITW Nexus buckles rated for load
- Zipper fails: YKK zippers only — 0.1% failure rate vs 8-12% generic
- Scratched leather: microfoam wrap, rigid box — never poly mailer`,

  'Weddings': `
WEDDINGS GENERAL KNOWLEDGE:
- Arrived late: set processing time to actual time + 2 days, "order by X date" in listing
- Color mismatch: offer physical swatches before order
- Personalization error: send digital proof, require written approval before production`,

  'Toys & Games': `
TOYS GENERAL KNOWLEDGE:
- Paint chips: Zinsser primer + Mod Podge Hard Coat 3 coats minimum
- Splinters: sand to 400 grit, beeswax or food-grade mineral oil finish
- Safety: items under 1.75 inches need choking hazard warning for under-3s`,

  'Paper & Party Supplies': `
PAPER GENERAL KNOWLEDGE:
- Arrived bent: rigid flat mailer, "DO NOT BEND" stamped on exterior
- Colors wrong: CMYK PDF 300 DPI with 0.125 inch bleed
- Text hard to read: minimum 10pt font, 4.5:1 contrast ratio`,

  'Pet Supplies': `
PET SUPPLIES GENERAL KNOWLEDGE:
- Hardware breaks: ITW Nexus buckles rated 2x dog weight, metal only for 50lbs+
- Dye bleeds: OEKO-TEX certified fabric, wash 3x before shipping
- Wrong size: measuring guide photo with tape measure around pet`,

  'Food & Drink': `
FOOD GENERAL KNOWLEDGE:
- Melted in transit: gel ice pack for heat-sensitive items, insulated mailer May-Sep
- Leaks: heat seal bags not zip-lock for liquids
- Shelf life complaints: "best by" date prominently on label`,

  'Books, Movies & Music': `
BOOKS GENERAL KNOWLEDGE:
- Arrived bent: rigid cardboard mailer, bubble wrap first, "Do Not Bend" stamp
- Wrong item: barcode/SKU label on each item, scan before packing`,

  'Other': `
GENERAL KNOWLEDGE:
- "Arrived damaged" → always shipping problem → double-wall box, 2 inches padding all sides
- "Color wrong" → reshoot under natural daylight, north-facing window
- "Wrong size" → dimensions as first line of description, size comparison photo
- Never apply inspection fix to a shipping problem — different root causes`,
}

// ── Product type detection ────────────────────────────────────

export function detectProductType(productName: string): string | null {
  const name = productName.toLowerCase()

  for (const [type, keywords] of Object.entries(PRODUCT_KEYWORDS)) {
    for (const keyword of keywords) {
      if (name.includes(keyword.toLowerCase())) {
        return type
      }
    }
  }

  return null
}

// ── Main export: get knowledge for prompt ─────────────────────

export function getCategoryKnowledge(category: string, productName: string): string {
  // Try to detect specific product type from product name
  const productType = detectProductType(productName)

  if (productType && PRODUCT_KNOWLEDGE[productType]) {
    const specific = PRODUCT_KNOWLEDGE[productType].trim()
    const fallback = CATEGORY_FALLBACK[category] || CATEGORY_FALLBACK['Other']

    // Return specific product knowledge + brief category context
    return `${specific}

GENERAL ${category.toUpperCase()} CONTEXT:
${fallback.trim()}`
  }

  // No specific match — use category fallback
  return (CATEGORY_FALLBACK[category] || CATEGORY_FALLBACK['Other']).trim()
}
