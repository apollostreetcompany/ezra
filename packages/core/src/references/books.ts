export interface BibleBook {
  id: string;
  osisId: string;
  name: string;
  testament: "old" | "new";
  chapters: number;
  aliases: string[];
}

export const bibleBooks: BibleBook[] = [
  { id: "genesis", osisId: "Gen", name: "Genesis", testament: "old", chapters: 50, aliases: ["gen", "ge", "gn"] },
  { id: "exodus", osisId: "Exod", name: "Exodus", testament: "old", chapters: 40, aliases: ["exod", "ex", "exo"] },
  { id: "leviticus", osisId: "Lev", name: "Leviticus", testament: "old", chapters: 27, aliases: ["lev", "le", "lv"] },
  { id: "numbers", osisId: "Num", name: "Numbers", testament: "old", chapters: 36, aliases: ["num", "nu", "nm", "nb"] },
  { id: "deuteronomy", osisId: "Deut", name: "Deuteronomy", testament: "old", chapters: 34, aliases: ["deut", "dt"] },
  { id: "joshua", osisId: "Josh", name: "Joshua", testament: "old", chapters: 24, aliases: ["josh", "jos"] },
  { id: "judges", osisId: "Judg", name: "Judges", testament: "old", chapters: 21, aliases: ["judg", "jdg", "jg"] },
  { id: "ruth", osisId: "Ruth", name: "Ruth", testament: "old", chapters: 4, aliases: ["ru"] },
  { id: "1-samuel", osisId: "1Sam", name: "1 Samuel", testament: "old", chapters: 31, aliases: ["1 sam", "1sam", "i samuel", "first samuel"] },
  { id: "2-samuel", osisId: "2Sam", name: "2 Samuel", testament: "old", chapters: 24, aliases: ["2 sam", "2sam", "ii samuel", "second samuel"] },
  { id: "1-kings", osisId: "1Kgs", name: "1 Kings", testament: "old", chapters: 22, aliases: ["1 kgs", "1ki", "i kings", "first kings"] },
  { id: "2-kings", osisId: "2Kgs", name: "2 Kings", testament: "old", chapters: 25, aliases: ["2 kgs", "2ki", "ii kings", "second kings"] },
  { id: "1-chronicles", osisId: "1Chr", name: "1 Chronicles", testament: "old", chapters: 29, aliases: ["1 chr", "1chron", "first chronicles"] },
  { id: "2-chronicles", osisId: "2Chr", name: "2 Chronicles", testament: "old", chapters: 36, aliases: ["2 chr", "2chron", "second chronicles"] },
  { id: "ezra", osisId: "Ezra", name: "Ezra", testament: "old", chapters: 10, aliases: ["ezr"] },
  { id: "nehemiah", osisId: "Neh", name: "Nehemiah", testament: "old", chapters: 13, aliases: ["neh"] },
  { id: "esther", osisId: "Esth", name: "Esther", testament: "old", chapters: 10, aliases: ["esth", "est"] },
  { id: "job", osisId: "Job", name: "Job", testament: "old", chapters: 42, aliases: [] },
  { id: "psalms", osisId: "Ps", name: "Psalms", testament: "old", chapters: 150, aliases: ["psalm", "ps", "psa", "pss"] },
  { id: "proverbs", osisId: "Prov", name: "Proverbs", testament: "old", chapters: 31, aliases: ["prov", "pr"] },
  { id: "ecclesiastes", osisId: "Eccl", name: "Ecclesiastes", testament: "old", chapters: 12, aliases: ["eccl", "ecc", "qoheleth"] },
  { id: "song-of-solomon", osisId: "Song", name: "Song of Solomon", testament: "old", chapters: 8, aliases: ["song", "song of songs", "sos", "canticles"] },
  { id: "isaiah", osisId: "Isa", name: "Isaiah", testament: "old", chapters: 66, aliases: ["isa"] },
  { id: "jeremiah", osisId: "Jer", name: "Jeremiah", testament: "old", chapters: 52, aliases: ["jer"] },
  { id: "lamentations", osisId: "Lam", name: "Lamentations", testament: "old", chapters: 5, aliases: ["lam"] },
  { id: "ezekiel", osisId: "Ezek", name: "Ezekiel", testament: "old", chapters: 48, aliases: ["ezek", "eze"] },
  { id: "daniel", osisId: "Dan", name: "Daniel", testament: "old", chapters: 12, aliases: ["dan", "dn"] },
  { id: "hosea", osisId: "Hos", name: "Hosea", testament: "old", chapters: 14, aliases: ["hos"] },
  { id: "joel", osisId: "Joel", name: "Joel", testament: "old", chapters: 3, aliases: ["jl"] },
  { id: "amos", osisId: "Amos", name: "Amos", testament: "old", chapters: 9, aliases: ["am"] },
  { id: "obadiah", osisId: "Obad", name: "Obadiah", testament: "old", chapters: 1, aliases: ["obad", "ob"] },
  { id: "jonah", osisId: "Jonah", name: "Jonah", testament: "old", chapters: 4, aliases: ["jon"] },
  { id: "micah", osisId: "Mic", name: "Micah", testament: "old", chapters: 7, aliases: ["mic"] },
  { id: "nahum", osisId: "Nah", name: "Nahum", testament: "old", chapters: 3, aliases: ["nah"] },
  { id: "habakkuk", osisId: "Hab", name: "Habakkuk", testament: "old", chapters: 3, aliases: ["hab"] },
  { id: "zephaniah", osisId: "Zeph", name: "Zephaniah", testament: "old", chapters: 3, aliases: ["zeph", "zep"] },
  { id: "haggai", osisId: "Hag", name: "Haggai", testament: "old", chapters: 2, aliases: ["hag"] },
  { id: "zechariah", osisId: "Zech", name: "Zechariah", testament: "old", chapters: 14, aliases: ["zech", "zec"] },
  { id: "malachi", osisId: "Mal", name: "Malachi", testament: "old", chapters: 4, aliases: ["mal"] },
  { id: "matthew", osisId: "Matt", name: "Matthew", testament: "new", chapters: 28, aliases: ["matt", "mt"] },
  { id: "mark", osisId: "Mark", name: "Mark", testament: "new", chapters: 16, aliases: ["mk", "mrk"] },
  { id: "luke", osisId: "Luke", name: "Luke", testament: "new", chapters: 24, aliases: ["lk"] },
  { id: "john", osisId: "John", name: "John", testament: "new", chapters: 21, aliases: ["jn", "jhn"] },
  { id: "acts", osisId: "Acts", name: "Acts", testament: "new", chapters: 28, aliases: ["ac"] },
  { id: "romans", osisId: "Rom", name: "Romans", testament: "new", chapters: 16, aliases: ["rom", "ro"] },
  { id: "1-corinthians", osisId: "1Cor", name: "1 Corinthians", testament: "new", chapters: 16, aliases: ["1 cor", "1cor", "first corinthians"] },
  { id: "2-corinthians", osisId: "2Cor", name: "2 Corinthians", testament: "new", chapters: 13, aliases: ["2 cor", "2cor", "second corinthians"] },
  { id: "galatians", osisId: "Gal", name: "Galatians", testament: "new", chapters: 6, aliases: ["gal"] },
  { id: "ephesians", osisId: "Eph", name: "Ephesians", testament: "new", chapters: 6, aliases: ["eph"] },
  { id: "philippians", osisId: "Phil", name: "Philippians", testament: "new", chapters: 4, aliases: ["phil", "php"] },
  { id: "colossians", osisId: "Col", name: "Colossians", testament: "new", chapters: 4, aliases: ["col"] },
  { id: "1-thessalonians", osisId: "1Thess", name: "1 Thessalonians", testament: "new", chapters: 5, aliases: ["1 thess", "1thess", "first thessalonians"] },
  { id: "2-thessalonians", osisId: "2Thess", name: "2 Thessalonians", testament: "new", chapters: 3, aliases: ["2 thess", "2thess", "second thessalonians"] },
  { id: "1-timothy", osisId: "1Tim", name: "1 Timothy", testament: "new", chapters: 6, aliases: ["1 tim", "1tim", "first timothy"] },
  { id: "2-timothy", osisId: "2Tim", name: "2 Timothy", testament: "new", chapters: 4, aliases: ["2 tim", "2tim", "second timothy"] },
  { id: "titus", osisId: "Titus", name: "Titus", testament: "new", chapters: 3, aliases: ["tit"] },
  { id: "philemon", osisId: "Phlm", name: "Philemon", testament: "new", chapters: 1, aliases: ["phlm", "phm"] },
  { id: "hebrews", osisId: "Heb", name: "Hebrews", testament: "new", chapters: 13, aliases: ["heb"] },
  { id: "james", osisId: "Jas", name: "James", testament: "new", chapters: 5, aliases: ["jas", "jm"] },
  { id: "1-peter", osisId: "1Pet", name: "1 Peter", testament: "new", chapters: 5, aliases: ["1 pet", "1pet", "first peter"] },
  { id: "2-peter", osisId: "2Pet", name: "2 Peter", testament: "new", chapters: 3, aliases: ["2 pet", "2pet", "second peter"] },
  { id: "1-john", osisId: "1John", name: "1 John", testament: "new", chapters: 5, aliases: ["1 jn", "1john", "first john"] },
  { id: "2-john", osisId: "2John", name: "2 John", testament: "new", chapters: 1, aliases: ["2 jn", "2john", "second john"] },
  { id: "3-john", osisId: "3John", name: "3 John", testament: "new", chapters: 1, aliases: ["3 jn", "3john", "third john"] },
  { id: "jude", osisId: "Jude", name: "Jude", testament: "new", chapters: 1, aliases: ["jud"] },
  { id: "revelation", osisId: "Rev", name: "Revelation", testament: "new", chapters: 22, aliases: ["rev", "revelations", "apocalypse"] }
];

const aliasEntries = bibleBooks.flatMap((book) => [book.name, book.id, book.osisId, ...book.aliases].map((alias) => [normalizeBookAlias(alias), book] as const));

export const bookAliasMap = new Map(aliasEntries);

export function normalizeBookAlias(value: string): string {
  return value.toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();
}

export function findBibleBook(value: string): BibleBook | undefined {
  return bookAliasMap.get(normalizeBookAlias(value));
}
