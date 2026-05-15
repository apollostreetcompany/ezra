import { formatReference, parseReference, type PassageReference } from "../references/parser.js";

export type LocalTranslationId = "web" | "kjv";

export interface LocalVerse {
  bookId: string;
  chapter: number;
  verse: number;
  text: string;
}

export interface LocalPassage {
  reference: string;
  translation: LocalTranslationId;
  verses: LocalVerse[];
  attribution: string;
}

export interface LocalBible {
  id: LocalTranslationId;
  abbreviation: string;
  name: string;
  attribution: string;
  verses: LocalVerse[];
}

export const localBibles: Record<LocalTranslationId, LocalBible> = {
  web: {
    id: "web",
    abbreviation: "WEB",
    name: "World English Bible",
    attribution: "World English Bible, public domain. Source edition to be finalized from eBible assets.",
    verses: [
      { bookId: "john", chapter: 3, verse: 16, text: "For God so loved the world, that he gave his one and only Son, that whoever believes in him should not perish, but have eternal life." },
      { bookId: "romans", chapter: 8, verse: 28, text: "We know that all things work together for good for those who love God, to those who are called according to his purpose." },
      { bookId: "psalms", chapter: 23, verse: 1, text: "Yahweh is my shepherd: I shall lack nothing." }
    ]
  },
  kjv: {
    id: "kjv",
    abbreviation: "KJV",
    name: "King James Version",
    attribution: "King James Version. Jurisdiction and source edition note required before full asset import.",
    verses: [
      { bookId: "john", chapter: 3, verse: 16, text: "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life." },
      { bookId: "romans", chapter: 8, verse: 28, text: "And we know that all things work together for good to them that love God, to them who are the called according to his purpose." },
      { bookId: "psalms", chapter: 23, verse: 1, text: "The LORD is my shepherd; I shall not want." }
    ]
  }
};

export function getLocalPassage(referenceInput: string, translation: LocalTranslationId = "web"): LocalPassage {
  const reference = parseReference(referenceInput);
  const bible = localBibles[translation];
  const verses = bible.verses.filter((verse) => verse.bookId === reference.book.id && isVerseInReference(verse, reference));
  if (verses.length === 0) {
    throw new Error(`Local ${bible.abbreviation} text not loaded for ${formatReference(reference)}.`);
  }
  return { reference: formatReference(reference), translation, verses, attribution: bible.attribution };
}

function isVerseInReference(verse: LocalVerse, reference: PassageReference): boolean {
  if (verse.chapter < reference.startChapter || verse.chapter > reference.endChapter) {
    return false;
  }
  if (verse.chapter === reference.startChapter && reference.startVerse !== undefined && verse.verse < reference.startVerse) {
    return false;
  }
  if (verse.chapter === reference.endChapter && reference.endVerse !== undefined && verse.verse > reference.endVerse) {
    return false;
  }
  return true;
}
