// ── Music Directors Data ─────────────────────────────────────────────────────
// Used for onboarding preference selection and home page recommendations

const MUSIC_DIRECTORS = [
  // ── Tamil Cinema ─────────────────────────────────────────────────────────
  {
    id: 'anirudh',
    name: 'Anirudh Ravichander',
    category: 'Tamil Cinema',
    knownFor: 'Vikram, Leo, Jawan',
    gradient: 'linear-gradient(135deg, #ec4899, #be185d)',
    emoji: '🎸',
    searchQuery: 'Anirudh Ravichander songs'
  },
  {
    id: 'ar_rahman',
    name: 'A.R. Rahman',
    category: 'Tamil Cinema',
    knownFor: 'Roja, Bombay, Dil Se',
    gradient: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
    emoji: '🎼',
    searchQuery: 'AR Rahman Tamil hit songs'
  },
  {
    id: 'harris_jayaraj',
    name: 'Harris Jayaraj',
    category: 'Tamil Cinema',
    knownFor: 'Ghajini, Anniyan, Vettaiyaadu',
    gradient: 'linear-gradient(135deg, #06b6d4, #0284c7)',
    emoji: '🎹',
    searchQuery: 'Harris Jayaraj hit songs'
  },
  {
    id: 'yuvan',
    name: 'Yuvan Shankar Raja',
    category: 'Tamil Cinema',
    knownFor: 'Vinnaithaandi Varuvaayaa, 96',
    gradient: 'linear-gradient(135deg, #f59e0b, #b45309)',
    emoji: '🎵',
    searchQuery: 'Yuvan Shankar Raja songs'
  },
  {
    id: 'imman',
    name: 'D. Imman',
    category: 'Tamil Cinema',
    knownFor: 'Theri, Viswasam, Naayakan',
    gradient: 'linear-gradient(135deg, #10b981, #047857)',
    emoji: '🎻',
    searchQuery: 'D Imman superhit Tamil songs'
  },
  {
    id: 'ilaiyaraaja',
    name: 'Ilaiyaraaja',
    category: 'Tamil Cinema',
    knownFor: 'Moondram Pirai, Nayagan',
    gradient: 'linear-gradient(135deg, #ef4444, #b91c1c)',
    emoji: '👑',
    searchQuery: 'Ilaiyaraaja classic songs'
  },
  {
    id: 'gvp',
    name: 'G.V. Prakash Kumar',
    category: 'Tamil Cinema',
    knownFor: 'Aadukalam, Soodhu Kavvum',
    gradient: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
    emoji: '🎺',
    searchQuery: 'GV Prakash Kumar hit songs'
  },
  {
    id: 'santhosh_narayanan',
    name: 'Santhosh Narayanan',
    category: 'Tamil Cinema',
    knownFor: 'Kabali, Pa Ranjith films',
    gradient: 'linear-gradient(135deg, #a855f7, #7c3aed)',
    emoji: '🎧',
    searchQuery: 'Santhosh Narayanan songs'
  },
  {
    id: 'vijay_antony',
    name: 'Vijay Antony',
    category: 'Tamil Cinema',
    knownFor: 'Naan, Salim',
    gradient: 'linear-gradient(135deg, #f97316, #c2410c)',
    emoji: '🎤',
    searchQuery: 'Vijay Antony songs'
  },

  // ── Hindi Cinema ────────────────────────────────────────────────────────
  {
    id: 'pritam',
    name: 'Pritam',
    category: 'Hindi Cinema',
    knownFor: 'Ae Dil Hai Mushkil, ZNMD',
    gradient: 'linear-gradient(135deg, #f97316, #ea580c)',
    emoji: '🎼',
    searchQuery: 'Pritam Bollywood hit songs'
  },
  {
    id: 'vishal_shekhar',
    name: 'Vishal-Shekhar',
    category: 'Hindi Cinema',
    knownFor: 'Om Shanti Om, Student of the Year',
    gradient: 'linear-gradient(135deg, #ec4899, #db2777)',
    emoji: '🎹',
    searchQuery: 'Vishal Shekhar best songs'
  },
  {
    id: 'sel',
    name: 'Shankar Ehsaan Loy',
    category: 'Hindi Cinema',
    knownFor: 'Dil Chahta Hai, Kal Ho Na Ho',
    gradient: 'linear-gradient(135deg, #06b6d4, #0369a1)',
    emoji: '🎸',
    searchQuery: 'Shankar Ehsaan Loy songs'
  },
  {
    id: 'amit_trivedi',
    name: 'Amit Trivedi',
    category: 'Hindi Cinema',
    knownFor: 'Dev D, Udaan, Queen',
    gradient: 'linear-gradient(135deg, #10b981, #059669)',
    emoji: '🎵',
    searchQuery: 'Amit Trivedi hit songs'
  },
  {
    id: 'sachin_jigar',
    name: 'Sachin-Jigar',
    category: 'Hindi Cinema',
    knownFor: 'Fukrey, Shuddh Desi Romance',
    gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
    emoji: '🎺',
    searchQuery: 'Sachin Jigar songs'
  },
  {
    id: 'ar_rahman_hindi',
    name: 'A.R. Rahman (Hindi)',
    category: 'Hindi Cinema',
    knownFor: 'Lagaan, Rang De Basanti',
    gradient: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
    emoji: '🎼',
    searchQuery: 'AR Rahman Hindi songs'
  },

  // ── International ────────────────────────────────────────────────────────
  {
    id: 'hans_zimmer',
    name: 'Hans Zimmer',
    category: 'International',
    knownFor: 'Inception, Interstellar, The Dark Knight',
    gradient: 'linear-gradient(135deg, #6366f1, #4338ca)',
    emoji: '🎻',
    searchQuery: 'Hans Zimmer best music'
  },
  {
    id: 'john_williams',
    name: 'John Williams',
    category: 'International',
    knownFor: 'Star Wars, Jurassic Park, Schindler\'s List',
    gradient: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
    emoji: '🎼',
    searchQuery: 'John Williams iconic themes'
  },
  {
    id: 'max_martin',
    name: 'Max Martin',
    category: 'International',
    knownFor: 'Taylor Swift, The Weeknd, Katy Perry',
    gradient: 'linear-gradient(135deg, #ec4899, #be185d)',
    emoji: '🎸',
    searchQuery: 'Max Martin produced songs'
  },
  {
    id: 'pharrell',
    name: 'Pharrell Williams',
    category: 'International',
    knownFor: 'Happy, Get Lucky, Blurred Lines',
    gradient: 'linear-gradient(135deg, #f59e0b, #b45309)',
    emoji: '🎵',
    searchQuery: 'Pharrell Williams songs'
  },
  {
    id: 'quincy_jones',
    name: 'Quincy Jones',
    category: 'International',
    knownFor: 'Michael Jackson - Thriller, Off the Wall',
    gradient: 'linear-gradient(135deg, #6b7280, #374151)',
    emoji: '👑',
    searchQuery: 'Quincy Jones classic music'
  }
];
