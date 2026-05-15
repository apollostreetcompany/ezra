import { bibleBooks, findBibleBook, type BibleBook } from "./books.js";

export interface PassageReference {
  input: string;
  book: BibleBook;
  startChapter: number;
  startVerse?: number;
  endChapter: number;
  endVerse?: number;
}

export function parseReference(input: string): PassageReference {
  const normalized = input.trim().replace(/\s+/g, " ");
  if (!normalized) {
    throw new Error("Reference is required.");
  }

  const match = findLongestBookPrefix(normalized);
  if (!match) {
    throw new Error(`Unknown Bible book in reference: ${input}`);
  }

  const rest = normalized.slice(match.alias.length).trim();
  if (!rest) {
    throw new Error(`Missing chapter in reference: ${input}`);
  }

  const rangeMatch = /^(\d+)(?::(\d+))?(?:\s*-\s*(?:(\d+):)?(\d+))?$/.exec(rest);
  if (!rangeMatch) {
    throw new Error(`Invalid Bible reference format: ${input}`);
  }

  const startChapter = readPositiveInteger(rangeMatch[1], "start chapter");
  const startVerse = rangeMatch[2] ? readPositiveInteger(rangeMatch[2], "start verse") : undefined;
  const explicitEndChapter = rangeMatch[3] ? readPositiveInteger(rangeMatch[3], "end chapter") : undefined;
  const endToken = rangeMatch[4] ? readPositiveInteger(rangeMatch[4], "end verse/chapter") : undefined;
  const { endChapter, endVerse } = resolveRangeEnd(startChapter, startVerse, explicitEndChapter, endToken);

  if (startChapter > match.book.chapters || endChapter > match.book.chapters) {
    throw new Error(`${match.book.name} has ${match.book.chapters} chapters.`);
  }

  if (endChapter < startChapter) {
    throw new Error("End chapter must not be before start chapter.");
  }

  if (endChapter === startChapter && startVerse !== undefined && endVerse !== undefined && endVerse < startVerse) {
    throw new Error("End verse must not be before start verse.");
  }

  const reference: PassageReference = { input, book: match.book, startChapter, endChapter };
  if (startVerse !== undefined) {
    reference.startVerse = startVerse;
  }
  if (endVerse !== undefined) {
    reference.endVerse = endVerse;
  }
  return reference;
}

export function formatReference(reference: PassageReference): string {
  const start = reference.startVerse === undefined ? `${reference.startChapter}` : `${reference.startChapter}:${reference.startVerse}`;
  const samePoint = reference.startChapter === reference.endChapter && reference.startVerse === reference.endVerse;
  const wholeChapter = reference.startVerse === undefined && reference.endVerse === undefined && reference.startChapter === reference.endChapter;
  if (samePoint || wholeChapter) {
    return `${reference.book.name} ${start}`;
  }
  const end = reference.endVerse === undefined ? `${reference.endChapter}` : `${reference.endChapter}:${reference.endVerse}`;
  return `${reference.book.name} ${start}-${end}`;
}

export function referenceId(reference: PassageReference): string {
  const startVerse = reference.startVerse ?? 0;
  const endVerse = reference.endVerse ?? 0;
  return `${reference.book.id}.${reference.startChapter}.${startVerse}-${reference.endChapter}.${endVerse}`;
}

function findLongestBookPrefix(input: string): { book: BibleBook; alias: string } | undefined {
  const lower = input.toLowerCase();
  const candidates = bibleBooks.flatMap((book) => [book.name, book.id, book.osisId, ...book.aliases].map((alias) => ({ book, alias })));
  return candidates
    .filter(({ alias }) => lower === alias.toLowerCase() || lower.startsWith(`${alias.toLowerCase()} `))
    .sort((a, b) => b.alias.length - a.alias.length)[0];
}

function readPositiveInteger(value: string | undefined, label: string): number {
  if (!value) {
    throw new Error(`Missing ${label}.`);
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return parsed;
}

function resolveRangeEnd(
  startChapter: number,
  startVerse: number | undefined,
  explicitEndChapter: number | undefined,
  endToken: number | undefined,
): { endChapter: number; endVerse: number | undefined } {
  if (endToken === undefined) {
    return { endChapter: startChapter, endVerse: startVerse };
  }

  if (explicitEndChapter !== undefined) {
    return { endChapter: explicitEndChapter, endVerse: endToken };
  }

  if (startVerse === undefined) {
    return { endChapter: endToken, endVerse: undefined };
  }

  return { endChapter: startChapter, endVerse: endToken };
}
