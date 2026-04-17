// ─── Bhagavad Gita ───
export const CHAPTER_NAMES = [
  'Arjuna Vishada Yoga',       'Sankhya Yoga',
  'Karma Yoga',                'Jnana Karma Sanyasa Yoga',
  'Karma Vairagya Yoga',       'Abhyasa Yoga',
  'Paramahamsa Vijnana Yoga',  'Aksara Parabrahma Yoga',
  'Raja Vidya Raja Guhya Yoga','Vibhuti Vistara Yoga',
  'Visvarupadarshana Yoga',    'Bhakti Yoga',
  'Kshetra Kshetragya Yoga',   'Gunatraya Vibhaga Yoga',
  'Purushottama Yoga',         'Daivasura Sampad Yoga',
  'Shraddhatraya Vibhaga Yoga','Moksha Sanyasa Yoga'
];

export const VERSE_COUNTS = [47,72,43,42,29,47,30,28,34,42,55,20,35,27,20,24,28,78];

export const QUICK_PROMPTS_GITA = [
  "I feel lost in life",
  "How do I deal with failure?",
  "I'm scared of the future",
  "What does Krishna say about anger?",
  "I feel unmotivated",
  "How to find my purpose?"
];

// ─── Bible ───
export const BIBLE_BOOKS = [
  // Old Testament
  { name: 'Genesis',          testament: 'Old' },
  { name: 'Exodus',           testament: 'Old' },
  { name: 'Psalms',           testament: 'Old' },
  { name: 'Proverbs',         testament: 'Old' },
  { name: 'Isaiah',           testament: 'Old' },
  { name: 'Jeremiah',         testament: 'Old' },
  { name: 'Ezekiel',          testament: 'Old' },
  { name: 'Daniel',           testament: 'Old' },
  { name: 'Job',              testament: 'Old' },
  { name: 'Ecclesiastes',     testament: 'Old' },
  { name: 'Song of Solomon',  testament: 'Old' },
  { name: 'Lamentations',     testament: 'Old' },
  { name: 'Hosea',            testament: 'Old' },
  { name: 'Amos',             testament: 'Old' },
  { name: 'Jonah',            testament: 'Old' },
  { name: 'Micah',            testament: 'Old' },
  { name: 'Malachi',          testament: 'Old' },
  // New Testament
  { name: 'Matthew',          testament: 'New' },
  { name: 'Mark',             testament: 'New' },
  { name: 'Luke',             testament: 'New' },
  { name: 'John',             testament: 'New' },
  { name: 'Acts',             testament: 'New' },
  { name: 'Romans',           testament: 'New' },
  { name: '1 Corinthians',    testament: 'New' },
  { name: '2 Corinthians',    testament: 'New' },
  { name: 'Galatians',        testament: 'New' },
  { name: 'Ephesians',        testament: 'New' },
  { name: 'Philippians',      testament: 'New' },
  { name: 'Colossians',       testament: 'New' },
  { name: 'Hebrews',          testament: 'New' },
  { name: 'James',            testament: 'New' },
  { name: '1 Peter',          testament: 'New' },
  { name: '1 John',           testament: 'New' },
  { name: 'Revelation',       testament: 'New' },
];

export const QUICK_PROMPTS_BIBLE = [
  "I feel lost and don't know God's plan",
  "How do I deal with failure?",
  "I'm scared of the future",
  "What does Jesus say about anger?",
  "I feel unmotivated",
  "How to find my purpose?"
];

// ─── Quran ───
export const QURAN_SURAH_COUNTS = [
  7,286,200,176,120,165,206,75,129,109,
  123,111,43,52,99,128,111,110,98,135,
  112,78,118,64,77,227,93,88,69,60,
  34,30,73,54,45,83,182,88,75,85,
  54,53,89,59,37,35,38,29,18,45,
  60,49,62,55,78,96,29,22,24,13,
  14,11,11,18,12,12,30,52,52,44,
  28,28,20,56,40,31,50,22,31,13,
  28,14,27,18,17,24,20,22,23,17,
  22,13,4,31,9,11,13,11,10,11,
  19,12,4,4,6,7,5,4,5,4,6,7,3,6,3,4,4,3,6,3
];

export const QUICK_PROMPTS_QURAN = [
  "I feel lost in life",
  "How do I deal with failure?",
  "I'm scared of the future",
  "What does Allah say about patience?",
  "I feel unmotivated",
  "How to find my purpose?"
];

// ─── Sikhism ───
export const QUICK_PROMPTS_SIKH = [
  "I feel lost in life",
  "How do I deal with failure?",
  "I'm scared of the future",
  "What does Gurbani say about fear?",
  "I feel unmotivated",
  "How to find my purpose?"
];

// ─── Buddhism ───
export const DHAMMAPADA_CHAPTERS = [
  'The Twin Verses',    'On Heedfulness',       'The Mind',
  'Flowers',            'The Fool',              'The Wise',
  'The Venerable',      'The Thousands',         'Evil',
  'Violence',           'Old Age',               'The Self',
  'The World',          'The Buddha',            'Happiness',
  'The Beloved',        'Anger',                 'Impurity',
  'The Just',           'The Path',              'Miscellaneous',
  'Hell',               'The Elephant',          'Craving',
  'The Monk',           'The Brahmin'
];

export const DHAMMAPADA_VERSE_COUNTS = [20,12,12,17,17,14,10,16,13,17,11,16,16,18,26,12,14,21,17,17,17,14,16,26,23,41];

export const QUICK_PROMPTS_BUDDHA = [
  "I feel lost in life",
  "How do I let go of suffering?",
  "I'm too attached to outcomes",
  "What did the Buddha say about anger?",
  "I feel unmotivated",
  "How to find inner peace?"
];

// ─── Taoism ───
export const TAO_CHAPTERS = Array.from({ length: 81 }, (_, i) => {
  const names = {
    1: 'The Tao That Can Be Named', 2: 'The Relativity of Opposites',
    4: 'The Inexhaustible Tao',     8: 'The Highest Good',
    11: 'The Uses of Emptiness',    16: 'Returning to the Root',
    22: 'Yielding and Overcoming',  33: 'Knowing Oneself',
    44: 'Fame and Self',            55: 'The Virtue of a Child',
    66: 'Leading by Following',     76: 'The Living and the Dead',
    81: 'The Way of the Sage'
  };
  return names[i + 1] || `Chapter ${i + 1}`;
});

export const QUICK_PROMPTS_TAO = [
  "I'm struggling to let go",
  "How do I stop forcing things?",
  "I feel resistance inside me",
  "What does Laozi say about the ego?",
  "I feel lost in life",
  "How to find my purpose?"
];

// ─── Judaism / Torah ───
export const TORAH_BOOKS = [
  { name: 'Genesis',      desc: 'Creation & Covenant' },
  { name: 'Exodus',       desc: 'Liberation & the Law' },
  { name: 'Leviticus',    desc: 'Holiness & Sacrifice' },
  { name: 'Numbers',      desc: 'Wilderness & Faith' },
  { name: 'Deuteronomy',  desc: 'Covenant Renewed' },
  { name: 'Joshua',       desc: 'Entering the Promise' },
  { name: 'Psalms',       desc: 'Prayer & Praise' },
  { name: 'Proverbs',     desc: 'Wisdom & Virtue' },
  { name: 'Isaiah',       desc: 'Prophecy & Hope' },
  { name: 'Job',          desc: 'Suffering & Faith' },
  { name: 'Ecclesiastes', desc: 'Meaning & Impermanence' },
  { name: 'Song of Songs',desc: 'Love & Devotion' },
];

export const QUICK_PROMPTS_TORAH = [
  "I feel lost in life",
  "How do I deal with hardship?",
  "I'm scared of the future",
  "What does the Torah say about anger?",
  "I feel unmotivated",
  "How to find my purpose?"
];

// ─── Jainism ───
export const JAIN_TEXTS = [
  { name: 'Acaranga Sutra',         desc: 'Lord Mahavira\'s conduct & non-violence' },
  { name: 'Sutrakritanga',          desc: 'Refuting wrong paths, embracing truth' },
  { name: 'Uttaradhyayana Sutra',   desc: 'Mahavira\'s final discourses' },
  { name: 'Dasavaikalika Sutra',    desc: 'Conduct of ascetics' },
  { name: 'Tattvartha Sutra',       desc: 'Systematic philosophy of liberation' },
  { name: 'Kalpa Sutra',            desc: 'Lives of the Tirthankaras' },
  { name: 'Samayasara',             desc: 'The Essence of the Self' },
  { name: 'Niyamasara',             desc: 'The Essence of Discipline' },
];

export const QUICK_PROMPTS_JAIN = [
  "I feel lost in life",
  "How do I let go of attachment?",
  "I'm struggling with anger",
  "What did Mahavira say about the soul?",
  "I feel unmotivated",
  "How to find inner peace?"
];

// ─── Confucianism ───
export const ANALECTS_BOOKS = [
  'Xue Er — Learning',                'Wei Zheng — Governance',
  'Ba Yi — Ritual',                   'Li Ren — Goodness',
  'Gong Ye Chang — Judging People',   'Yong Ye — Virtue in Action',
  'Shu Er — The Master\'s Way',       'Tai Bo — Selfless Rule',
  'Zi Han — Rarity of Virtue',        'Xiang Dang — Ritual Conduct',
  'Xian Jin — Disciples',             'Yan Yuan — On Humanity',
  'Zi Lu — On Strength',              'Xian Wen — On Shame',
  'Wei Ling Gong — On Consistency',   'Ji Shi — On Leadership',
  'Yang Huo — Human Nature',          'Wei Zi — Noble Hermits',
  'Zi Zhang — On Learning',           'Yao Yue — The Sage Kings'
];

export const QUICK_PROMPTS_CONFUCIUS = [
  "I feel lost in life",
  "How do I become a better person?",
  "I'm struggling with my relationships",
  "What did Confucius say about virtue?",
  "I feel unmotivated",
  "How to find my purpose?"
];

// ─── Bahá'í ───
export const BAHAI_TEXTS = [
  { name: 'Kitáb-i-Aqdas',              desc: 'The Most Holy Book — Laws & Principles' },
  { name: 'Kitáb-i-Íqán',               desc: 'The Book of Certitude — Faith & Knowledge' },
  { name: 'Hidden Words',               desc: 'Gems of divine wisdom in brief form' },
  { name: 'Seven Valleys',              desc: 'The mystical journey of the soul' },
  { name: 'Gleanings',                  desc: 'Selections from the writings of Bahá\'u\'lláh' },
  { name: 'Prayers and Meditations',    desc: 'Sacred prayers for every occasion' },
  { name: 'Gems of Divine Mysteries',   desc: 'On the station of the Manifestation' },
  { name: 'Tablet of Ahmad',            desc: 'A prayer of steadfastness and faith' },
];

export const QUICK_PROMPTS_BAHAI = [
  "I feel lost in life",
  "How do I deal with hardship?",
  "I'm scared of the future",
  "What does Bahá'u'lláh say about unity?",
  "I feel unmotivated",
  "How to find my purpose?"
];
