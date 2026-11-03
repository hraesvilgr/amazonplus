// AmazonPlus — starter brand lists.
// These seed the scorer. The extension also learns brands as you browse, and your own
// Trust/Block choices (from the badge on each card) override everything here.
//
// Matching is case-insensitive against the brand line, or the start of the title.
// Single common words and platform names ("Apple", "Ring", "Xbox", "Kindle", "Lifetime") are left
// out on purpose: knock-off listings often start with them ("Xbox Controller Charger…").

var DSA_BRANDS = {
  known: [
    // Bakeware & cookware
    "Chicago Metallic", "USA Pan", "CHEFMADE", "Nordic Ware", "Nordicware", "Wilton",
    "Fat Daddio's", "Lodge", "Calphalon", "Simply Calphalon", "Cuisinart", "KitchenAid",
    "Le Creuset", "Staub", "All-Clad", "Emile Henry", "Rachael Ray", "Farberware", "Anolon",
    "Circulon", "GoodCook", "Pyrex", "Anchor Hocking", "CorningWare", "Corelle", "OXO",
    "OXO Good Grips", "Mauviel", "de Buyer", "Matfer", "Matfer Bourgeat", "Made In Cookware",
    "Hestan", "Scanpan", "T-fal", "Tefal", "Zwilling", "Henckels", "Wusthof", "Wüsthof",
    "Victorinox", "Mercer Culinary", "Winco", "Vollrath", "Libbey", "Lenox", "Ball Mason",
    "Bakers Mark", "Mrs. Anderson's", "Harold Import", "HIC Harold Import", "Norpro",
    "Fox Run", "Bellemain", "Silpat", "Ateco", "Paderno", "Cuisipro", "Microplane",
    "Joseph Joseph", "Great Jones", "Caraway", "GreenPan", "Our Place", "Misen", "Zyliss",
    "Brod & Taylor", "King Arthur", "Sassafras", "Ooni", "Baking Steel", "Doughmakers",
    "Kaiser Bakeware", "Birkmann", "Reynolds", "Reynolds Wrap", "Hefty", "Saran", "Kirkland Signature", "Hormel",
    "Vitafusion", "Olly", "SmartyPants", "Florsheim", "Allen Edmonds", "Woodlore", "Rockport", "Levi's", "Dockers", "Städter", "Stadter", "RBV Birkmann", "Zenker", "Dr. Oetker", "Lékué", "Lekue", "Rösle", "Rosle", "Tramontina",
    "Cuisinox", "Demeyere", "Viking Culinary", "Cook N Home", "Prepworks", "Chef'n", "Ninja", "Instant Pot", "Instant Brands", "Crock-Pot", "Hamilton Beach",
    "Proctor Silex", "Breville", "De'Longhi", "DeLonghi", "Nespresso", "Keurig", "Mr. Coffee",
    "Bodum", "Hario", "Chemex", "Baratza", "Bonavita", "Zojirushi", "Vitamix", "Blendtec", "NutriBullet", "Magic Bullet", "Oster", "Sunbeam", "Black+Decker",
    "Black & Decker", "Chefman", "COSORI", "Philips", "Smeg", "Rubbermaid",
    "Tupperware", "Weck", "Ziploc", "Stasher", "Weber", "Traeger",
    "Char-Broil", "Solo Stove", "Blackstone", "ThermoWorks", "Thermapen", "Taylor Precision",
    "Escali", "Etekcity", "Ozeri", "Polder",

    // Drinkware & food storage
    "Stanley", "Thermos", "Yeti", "Hydro Flask", "Owala", "Contigo", "CamelBak", "Nalgene",
    "Klean Kanteen", "S'well", "Simple Modern", "Brita", "PUR", "ZeroWater",

    // Home & cleaning
    "Amazon Basics", "AmazonBasics", "Amazon Commercial", "Amazon Brand", "Bissell", "Dyson",
    "Hoover", "Eureka", "iRobot", "Roomba", "Shark Ninja", "SharkNinja", "Miele", "Kärcher",
    "Karcher", "O-Cedar", "Libman", "Swiffer", "Clorox", "Lysol", "Mrs. Meyer's",
    "Seventh Generation", "Scotch-Brite", "3M", "Post-it", "Sterilite", "IRIS USA", "mDesign", "SimpleHuman", "Umbra", "Honeywell",
    "Levoit", "Coway", "Winix", "Blueair", "Vornado", "Lasko", "Dreo", "Frigidaire", "GE", "Whirlpool", "LG", "Samsung", "Panasonic", "Toshiba", "Brother", "Singer", "Janome", "Fiskars", "Westcott", "Duck Brand", "Gorilla Glue", "Loctite", "Elmer's", "WD-40", "Rust-Oleum", "Krylon", "Minwax",
    "Purdy", "Wooster", "Hampton Bay", "Moen", "Delta Faucet", "Kohler", "American Standard",
    "Waterpik", "Brondell", "Philips Hue", "Lutron", "Leviton", "Kasa", "TP-Link", "Wyze",
    "Eufy", "Arlo", "Blink", "Govee", "Feit Electric", "Cree", "Sylvania", "GE Lighting",
    "Energizer", "Duracell", "Rayovac", "Panasonic Eneloop", "EBL",

    // Bedding, bath, furniture
    "Mellanni", "Bedsure", "California Design Den", "Cozy Earth", "Boll & Branch", "Coyuchi",
    "Riley Home", "Snowe", "Quince", "Magic Linen", "Sleep Number", "Tempur", "Nectar", "Saatva",
    "Pottery Barn Kids", "Threshold", "Hearth & Hand", "Room Essentials", "Brielle Home",
    "Brooklinen", "Parachute", "Pottery Barn", "West Elm", "Casper", "Tempur-Pedic",
    "Zinus", "Linenspa", "Sealy", "Serta", "Beautyrest", "Utopia Bedding",
    "Utopia Towels", "Pinzon", "Martex", "Mainstays", "Better Homes & Gardens", "Sauder",
    "South Shore", "Ashley", "Signature Design by Ashley", "Stone & Beam",
    "Flash Furniture", "HON", "Herman Miller", "Steelcase", "FlexiSpot", "VIVO", "Ergotron", "Bush Furniture", "Nathan James",

    // Electronics & computing
    "Sony", "Bose", "Sennheiser", "Audio-Technica", "Shure", "JBL", "Harman Kardon",
    "Ultimate Ears", "Skullcandy", "Jabra", "Plantronics", "Poly", "Anker",
    "Soundcore", "Belkin", "Mophie", "Zagg", "OtterBox", "Spigen", "Incipio",
    "Case-Mate", "Logitech", "Razer", "Corsair", "SteelSeries", "HyperX", "Turtle Beach",
    "ASUS", "Acer", "Dell", "HP", "Lenovo", "Microsoft", "MSI", "Gigabyte", "Intel", "AMD",
    "NVIDIA", "EVGA", "Crucial", "Kingston", "SanDisk", "Western Digital", "Seagate",
    "Lexar", "PNY", "Netgear", "Linksys", "Ubiquiti", "Eero", "Synology",
    "QNAP", "APC", "CyberPower", "Tripp Lite", "Monoprice", "Cable Matters", "UGREEN",
    "Baseus", "Satechi", "Twelve South", "Native Union", "Peak Design",
    "Elgato", "Blue Yeti", "Rode", "RØDE", "Canon", "Nikon", "Fujifilm", "Olympus",
    "OM System", "Panasonic Lumix", "GoPro", "DJI", "Insta360", "Garmin", "Fitbit",
    "Suunto", "Amazfit", "Withings", "Google Nest", "Apple AirPods", "Apple iPad", "Apple iPhone", "Apple MacBook",
    "Apple Watch Series", "Apple Watch SE", "Apple Watch Ultra", "Apple AirTag",
    "Apple Magic", "Apple Pencil", "Apple TV", "Vizio", "TCL", "Hisense", "LG Electronics",
    "Epson", "Xerox", "Kodak", "Polaroid", "Fujifilm Instax", "Texas Instruments",
    "Casio", "8BitDo", "PowerA", "Hori",
    "Raspberry Pi", "Arduino", "Adafruit", "SparkFun", "Elegoo", "Creality", "Prusa",
    "Bambu Lab", "Chipolo", "Ring Video", "Ring Doorbell", "Ring Spotlight",
    "Nest Thermostat", "Nest Cam", "ecobee", "Philips Sonicare", "Oral-B", "Braun",
    "Remington", "Wahl", "Conair", "BaBylissPRO", "Revlon", "Dyson Supersonic",
    "Panasonic Arc", "Norelco", "Gillette",

    // Tools, hardware, auto
    "DeWalt", "Milwaukee", "Makita", "Bosch", "Ryobi", "Ridgid", "Craftsman",
    "Stanley Tools", "Kobalt", "Metabo", "Metabo HPT", "Hitachi", "Festool",
    "Klein Tools", "Knipex", "Wera", "Wiha", "Channellock", "Irwin", "Vise-Grip",
    "Gearwrench", "Tekton", "Crescent", "Estwing", "Leatherman", "Gerber",
    "Benchmade", "Kershaw", "Spyderco", "Buck Knives", "Fluke", "Dremel",
    "Porter-Cable", "Skil", "WORX", "Greenworks", "EGO", "Husqvarna",
    "Stihl", "Toro", "Sun Joe", "Scotts", "Miracle-Gro", "Ortho", "Rain Bird",
    "Gilmour", "Flexzilla", "Melnor", "Suncast", "Keter", "Chamberlain", "LiftMaster", "Master Lock", "Kwikset", "Schlage", "Yale", "August",
    "Armor All", "Meguiar's", "Chemical Guys", "Turtle Wax", "Rain-X",
    "Mobil 1", "Castrol", "Valvoline", "Pennzoil", "Bosch Automotive", "NOCO",
    "Schumacher", "Michelin", "Thule", "Yakima", "WeatherTech", "Husky Liners",
    "Lasfit", "Sylvania Automotive", "Philips Automotive", "Fram", "K&N", "Motorcraft",
    "ACDelco", "Gates", "Dorman", "Moog", "Monroe", "Bilstein", "Uniden",
    "Midland", "Garmin DriveSmart",

    // Outdoor, sports, travel
    "Coleman", "REI Co-op", "Patagonia", "The North Face", "Columbia", "Marmot",
    "Arc'teryx", "Osprey", "Deuter", "Gregory", "Kelty", "Big Agnes", "MSR", "Jetboil",
    "Black Diamond", "Petzl", "Nite Ize", "Fenix", "Streamlight", "Olight", "Maglite",
    "Goal Zero", "Jackery", "EcoFlow", "Bluetti", "Anker SOLIX", "Sawyer", "LifeStraw",
    "Katadyn", "Therm-a-Rest", "Sea to Summit", "Nemo", "Igloo",
    "RTIC", "Pelican", "Oakley", "Ray-Ban", "Maui Jim", "Garmin Forerunner",
    "Bowflex", "NordicTrack", "Peloton", "Schwinn", "Sunny Health & Fitness", "CAP Barbell",
    "Rogue", "Titan Fitness", "Gaiam", "Manduka", "Lululemon", "Hyperice", "Theragun",
    "TriggerPoint", "Wilson", "Spalding", "Rawlings", "Easton", "Franklin Sports",
    "Callaway", "TaylorMade", "Titleist", "Bushnell", "Vortex", "Leupold",
    "Samsonite", "Travelpro", "Briggs & Riley", "Tumi", "Delsey", "American Tourister",
    "Eagle Creek", "Herschel", "JanSport", "Eastpak", "Matein", "Swiss Gear", "SwissGear",

    // Clothing & shoes
    "Nike", "Adidas", "Under Armour", "Puma", "Reebok", "New Balance", "ASICS",
    "Brooks", "Hoka", "Saucony", "On Running", "Merrell", "Salomon", "Keen",
    "Teva", "Chaco", "Birkenstock", "Crocs", "Vans", "Skechers", "Clarks",
    "Dr. Martens", "Timberland", "Wolverine", "Red Wing", "Carhartt", "Dickies", "Levi's",
    "Wrangler", "Hanes", "Fruit of the Loom", "Gildan", "Jockey", "Calvin Klein",
    "Tommy Hilfiger", "Ralph Lauren", "Polo Ralph Lauren", "Lacoste", "Columbia Sportswear",
    "L.L.Bean", "Eddie Bauer", "Smartwool", "Darn Tough", "Bombas", "Injinji", "Amazon Essentials",
    "Goodthreads", "Daily Ritual", "Champion Athletic", "Russell Athletic", "Jerzees",
    "Wigwam", "Thorlo", "Uniqlo",

    // Health, beauty, personal care
    "Neutrogena", "CeraVe", "Cetaphil", "La Roche-Posay", "Aveeno", "Olay", "Eucerin",
    "Vanicream", "The Ordinary", "Paula's Choice", "Burt's Bees", "Aquaphor", "Vaseline",
    "Nivea", "Pantene", "Head & Shoulders", "Garnier", "L'Oréal", "L'Oreal",
    "Maybelline", "e.l.f.", "NYX", "Colgate", "Crest", "Sensodyne", "Listerine",
    "Philips Norelco", "Schick", "Bic", "Tylenol", "Advil", "Motrin",
    "Aleve", "Bayer", "Benadryl", "Zyrtec", "Claritin", "Allegra", "Flonase", "Mucinex",
    "Vicks", "Nature Made", "Nature's Bounty", "Centrum", "One A Day", "Garden of Life", "Pure Encapsulations", "Thorne", "Solgar", "Life Extension", "Doctor's Best",
    "Jarrow Formulas", "Nordic Naturals", "Kirkland Signature", "Nutricost", "NatureWise", "Natrol",
    "Rainbow Light", "MegaFood", "New Chapter", "Swanson", "Bluebonnet", "Country Life", "Klaire Labs",
    "NOW Foods", "NOW Supplements", "Optimum Nutrition", "Vital Proteins", "Orgain",
    "Omron", "Braun ThermoScan", "iHealth", "Band-Aid", "Nexcare", "Curad",
    "Johnson & Johnson", "Kleenex", "Charmin", "Cottonelle", "Huggies", "Pampers",

    // Pets
    "Purina", "Purina Pro Plan", "Blue Buffalo", "Hill's Science Diet", "Royal Canin",
    "Merrick", "Taste of the Wild", "Greenies", "Nylabone", "KONG", "Chuckit!", "Outward Hound", "Frisco", "PetSafe", "Petmate", "Kurgo", "Ruffwear",
    "Furminator", "Tidy Cats", "Fresh Step", "Arm & Hammer", "Dr. Elsey's",
    "Seresto", "Frontline", "Nature's Miracle", "Tetra", "Fluval", "Zilla",
    "Zoo Med", "Kaytee", "Oxbow", "Vitakraft",

    // Shop vacs & cleaning equipment
    "Shop-Vac", "Shop Vac Corporation", "Vacmaster", "Koblenz", "Dustless Technologies", "Prolux",
    "WORKSHOP Wet/Dry", "Fein", "Nilfisk", "Hoover Commercial",
    "Sanitaire", "ProTeam", "Oreck", "Rug Doctor", "Bissell Commercial", "Tineco", "Roborock", "Ecovacs",
    "Dreame", "Vax", "Kenmore", "Electrolux", "Dirt Devil",

    // Musical instruments & audio gear
    "Hohner", "Fender", "Seydel", "Lee Oskar", "Suzuki Music", "Suzuki", "Special 20",
    "Yamaha", "Gibson", "Epiphone", "Ibanez", "Squier", "Gretsch", "PRS", "Taylor Guitars",
    "Martin", "C.F. Martin", "Cordoba", "Kala", "Lanikai", "D'Addario", "Ernie Ball", "Elixir",
    "Dunlop", "Jim Dunlop", "Boss", "Roland", "Korg", "Behringer", "Marshall", "Vox", "Orange Amps",
    "Peavey", "Pearl", "Ludwig", "Zildjian", "Sabian", "Meinl", "Paiste", "Vic Firth", "Promark",
    "Remo", "Evans", "Hal Leonard", "Snark", "Planet Waves", "Levy's", "Gator", "Hercules",
    "K&M", "On-Stage", "Alesis", "M-Audio", "Akai", "Novation", "Arturia", "Native Instruments",
    "Focusrite", "PreSonus", "Universal Audio", "Steinberg", "Kawai", "Nord", "Electro-Harmonix",
    "MXR", "TC Electronic", "Line 6", "Positive Grid", "Fishman", "LR Baggs", "Seymour Duncan",
    "Gemeinhardt", "Selmer", "Bach", "Jupiter", "Buffet Crampon", "Vandoren", "Rico", "Hohner Kids",
    // Fans, heaters, air conditioning
    "Bionaire", "Holmes", "Comfort Zone", "Air King", "Pelonis", "Midea", "Haier", "Whynter",
    "Hurricane", "Rowenta", "Dyson Pure", "Boneco", "Stadler Form", "Hunter Fan", "Hunter",
    "Westinghouse", "Minka-Aire", "Emerson", "Friedrich", "Keystone", "Danby", "TOSOT", "Mr. Heater",
    "Dr. Infrared Heater", "Duraflame", "Broan", "Broan-NuTone", "Panasonic WhisperCeiling",
    "iLIVING", "Air King America",
    // Strollers, car seats, nursery
    "Chicco", "Graco", "Britax", "Joie", "Bugaboo", "BOB Gear", "BOB", "Baby Jogger", "Veer",
    "Cosco", "Cosco Kids", "Safety 1st", "Maxi-Cosi", "Nuna", "Cybex", "Doona", "UPPAbaby",
    "Evenflo", "Summer Infant", "Baby Trend", "hauck", "Zoe", "Delta Children", "Dream On Me",
    "Kolcraft", "Joovy", "Diono", "Clek", "Mockingbird", "Silver Cross", "Stokke",
    "Babyzen", "Ergobaby", "BabyBjörn", "BabyBjorn", "Fisher-Price", "Skip Hop", "Munchkin",
    "Boppy", "4moms", "Nanit", "Owlet", "Hatch Baby", "Frida", "FridaBaby", "NoseFrida",

    // Toys, kids, baby
    "LEGO", "Mattel", "Hasbro", "Melissa & Doug", "Hot Wheels", "Barbie",
    "Nerf", "Play-Doh", "Crayola", "Ravensburger", "Magna-Tiles", "Learning Resources",
    "VTech", "LeapFrog", "Philips Avent", "Dr. Brown's", "Tommee Tippee", "Infant Optics", "Little Tikes", "Step2",
    "Radio Flyer", "Schleich", "Playmobil", "Funko", "Bandai", "Spin Master",

    // Office & school
    "Sharpie", "Uni-ball", "Pentel", "Paper Mate", "BIC Cristal", "Staedtler", "Faber-Castell", "Prismacolor", "Moleskine", "Leuchtturm1917", "Rhodia",
    "Five Star", "Mead", "Avery", "Swingline", "Bostitch", "Fellowes", "Smead", "Pendaflex",
    "Rocketbook", "Quartet", "Scotch Brand", "Elmer's Glue", "Texas Instruments TI"
  ],

  // Real brands whose names are ordinary words or other companies' platforms. They count as
  // established only when the page isn't using the word as ordinary vocabulary, and never on
  // accessory titles ("Kindle Case Compatible with Kindle…").
  ambiguous: [
    "Shark", "Apple", "Ring", "Nest", "Kindle", "Echo", "Roku", "Google", "Purple", "Tiger",
    "Lifetime", "Method", "Command", "Halo", "Hatch", "Fellow", "Dash", "Away", "Branch", "Tile",
    "Polar", "Lucid", "Pilot", "Zebra", "Expo", "Orbit", "Cobra", "Smith", "Costa", "Ping",
    "Nomad", "Rivet", "Uplift", "Beats", "Lee", "Hart", "Sharp", "Klein", "Gorilla", "Scotch",
    "Mothers", "Optima", "Champion", "Converse", "Coach", "Glad", "Dove", "Bounty", "Tide",
    "Dawn", "Cascade", "Scott", "Dixie", "Solo", "Kiwi"
  ],

  // Throwaway / nonsense names confirmed by hand.
  blocked: [
    "Pavsrmy", "Gicyiit", "HOOMIL", "Tiawudi", "Coukre", "Yupjlia"
  ]
};

if (typeof module !== "undefined") module.exports = DSA_BRANDS;
