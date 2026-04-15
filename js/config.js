// ─── Chapter metadata ───
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

// ─── Topic → verse mapping for RAG ───
export const TOPIC_MAP = {
  stress:      [{ch:2,v:14},{ch:2,v:47},{ch:6,v:35}],
  anxiety:     [{ch:2,v:14},{ch:2,v:20},{ch:4,v:36}],
  fear:        [{ch:2,v:14},{ch:2,v:40},{ch:11,v:33}],
  duty:        [{ch:2,v:47},{ch:3,v:8}, {ch:18,v:41}],
  grief:       [{ch:2,v:11},{ch:2,v:19},{ch:2,v:20}],
  anger:       [{ch:2,v:63},{ch:3,v:37},{ch:16,v:21}],
  purpose:     [{ch:3,v:35},{ch:18,v:45},{ch:4,v:18}],
  death:       [{ch:2,v:20},{ch:2,v:22},{ch:8,v:5}],
  success:     [{ch:2,v:47},{ch:3,v:19},{ch:18,v:46}],
  love:        [{ch:9,v:26},{ch:12,v:13},{ch:12,v:14}],
  motivation:  [{ch:3,v:8},{ch:6,v:5},{ch:18,v:48}],
  confusion:   [{ch:2,v:7},{ch:3,v:35},{ch:18,v:66}],
  lost:        [{ch:2,v:7},{ch:18,v:66},{ch:9,v:22}],
  failure:     [{ch:2,v:47},{ch:2,v:38},{ch:4,v:22}],
  default:     [{ch:2,v:47},{ch:6,v:5},{ch:18,v:66}]
};

// ─── Quick prompts ───
export const QUICK_PROMPTS = [
  "I feel lost in life",
  "How do I deal with failure?",
  "I'm scared of the future",
  "What does Krishna say about anger?",
  "I feel unmotivated",
  "How to find my purpose?"
];
