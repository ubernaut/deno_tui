/** Weighted text field used by fuzzy command-style search helpers. */
export interface WeightedSearchField {
  value: string;
  normalized: string;
  weight: number;
}

/** Normalizes human-readable command/search text for stable matching. */
export function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase().replace(/[_.:/]+/g, " ").replace(/\s+/g, " ");
}

/** Splits a query into normalized non-empty terms. */
export function searchTerms(query: string): string[] {
  const normalized = normalizeSearchText(query);
  return normalized.length === 0 ? [] : normalized.split(" ");
}

/** Builds weighted search fields with precomputed normalized text. */
export function weightedSearchFields(fields: readonly { value: string; weight: number }[]): WeightedSearchField[] {
  const weighted = new Array<WeightedSearchField>(fields.length);
  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index]!;
    weighted[index] = {
      value: field.value,
      weight: field.weight,
      normalized: normalizeSearchText(field.value),
    };
  }
  return weighted;
}

/** Scores an item with weighted fields against all query terms. */
export function scoreWeightedSearchFields(
  fields: readonly WeightedSearchField[],
  terms: readonly string[],
  disabled = false,
): { score: number; matched: string[] } | undefined {
  if (terms.length === 0) {
    return { score: disabled ? -1 : 0, matched: [] };
  }

  let score = disabled ? -10 : 0;
  const matched: string[] = [];
  for (const term of terms) {
    let best = 0;
    let bestValue: string | undefined;
    for (const field of fields) {
      const fieldScore = scoreSearchField(field.normalized, term, field.weight);
      if (fieldScore > best) {
        best = fieldScore;
        bestValue = field.value;
      }
    }
    if (best <= 0) return undefined;
    score += best;
    if (bestValue) matched.push(bestValue);
  }

  return { score, matched: uniqueStrings(matched) };
}

/** Scores one normalized field against one normalized term. */
export function scoreSearchField(field: string, term: string, weight: number): number {
  if (field === term) return weight + 40;
  if (field.startsWith(term)) return weight + 25;
  if (hasWordStartingWith(field, term)) return weight + 15;
  if (field.includes(term)) return weight + 5;
  return acronymStartsWith(field, term) ? weight : 0;
}

/** Inserts a ranked candidate into a sorted top-N buffer. */
export function insertBoundedRanked<T>(
  ranked: T[],
  candidate: T,
  limit: number,
  compare: (left: T, right: T) => number,
): void {
  let low = 0;
  let high = ranked.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (compare(candidate, ranked[middle]!) < 0) high = middle;
    else low = middle + 1;
  }
  if (low >= limit) return;
  ranked.splice(low, 0, candidate);
  if (ranked.length > limit) ranked.pop();
}

function hasWordStartingWith(field: string, term: string): boolean {
  let wordStart = 0;
  for (let index = 0; index <= field.length; index += 1) {
    if (index < field.length && field[index] !== " ") {
      continue;
    }
    if (index > wordStart && field.startsWith(term, wordStart)) {
      return true;
    }
    wordStart = index + 1;
  }
  return false;
}

function acronymStartsWith(field: string, term: string): boolean {
  let termIndex = 0;
  let atWordStart = true;
  for (let index = 0; index < field.length; index += 1) {
    const char = field[index];
    if (char === " ") {
      atWordStart = true;
      continue;
    }
    if (!atWordStart) {
      continue;
    }
    if (termIndex >= term.length) {
      return true;
    }
    if (char !== term[termIndex]) {
      return false;
    }
    termIndex += 1;
    atWordStart = false;
  }
  return termIndex >= term.length;
}

function uniqueStrings(values: readonly string[]): string[] {
  if (values.length === 0) return [];
  const unique: string[] = [];
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]!;
    let seen = false;
    for (let uniqueIndex = 0; uniqueIndex < unique.length; uniqueIndex += 1) {
      if (unique[uniqueIndex] === value) {
        seen = true;
        break;
      }
    }
    if (seen) continue;
    unique.push(value);
  }
  return unique;
}
