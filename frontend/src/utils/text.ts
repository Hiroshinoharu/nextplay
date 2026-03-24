const isWhitespace = (value: string) => {
  if (value.length !== 1) return false;
  const code = value.charCodeAt(0);
  return (
    code === 9 ||
    code === 10 ||
    code === 11 ||
    code === 12 ||
    code === 13 ||
    code === 32
  );
};

const isAlphaNumeric = (value: string) => {
  if (value.length !== 1) return false;
  const code = value.charCodeAt(0);
  return (
    (code >= 48 && code <= 57) ||
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122)
  );
};

const isUppercase = (value: string) => {
  if (value.length !== 1) return false;
  const code = value.charCodeAt(0);
  return code >= 65 && code <= 90;
};

const isLowercase = (value: string) => {
  if (value.length !== 1) return false;
  const code = value.charCodeAt(0);
  return code >= 97 && code <= 122;
};

/**
 * Trim trailing slashes from a string.
 *
 * @param {string} value - The string to trim
 * @returns {string} - The trimmed string
 */
export const trimTrailingSlashes = (value: string) => {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === 47) {
    end -= 1;
  }
  return end === value.length ? value : value.slice(0, end);
};

/**
 * Collapse whitespace in a string, so that only single spaces are used to separate words.
 *
 * If the input string is empty, an empty string is returned.
 *
 * @param {string} [value] - The string to collapse whitespace in
 * @returns {string} - The string with collapsed whitespace
 */
export const collapseWhitespace = (value?: string) => {
  if (!value) return "";

  let result = "";
  let pendingSpace = false;
  for (const char of value) {
    if (isWhitespace(char)) {
      pendingSpace = result.length > 0;
      continue;
    }
    if (pendingSpace) {
      result += " ";
      pendingSpace = false;
    }
    result += char;
  }
  return result;
};

type NormalizeAlphaNumericTextOptions = {
  allowPlus?: boolean;
};

/**
 * Normalize a string to only contain alphanumeric characters and, optionally, a single plus sign.
 *
 * The function will collapse whitespace in the input string, so that only single spaces are used to separate words.
 * If the input string is empty, an empty string is returned.
 *
 * @param {string} [value] - The string to normalize
 * @param {NormalizeAlphaNumericTextOptions} [options] - Options for normalizing the string
 * @returns {string} - The normalized string
 */
export const normalizeAlphaNumericText = (
  value?: string,
  options: NormalizeAlphaNumericTextOptions = {},
) => {
  if (!value) return "";

  const { allowPlus = false } = options;
  let result = "";
  let pendingSpace = false;
  for (const rawChar of value) {
    const char = isUppercase(rawChar) ? rawChar.toLowerCase() : rawChar;
    const keep =
      isAlphaNumeric(char) || (allowPlus && char === "+");
    if (keep) {
      if (pendingSpace && result.length > 0) {
        result += " ";
      }
      result += char;
      pendingSpace = false;
      continue;
    }
    pendingSpace = result.length > 0;
  }
  return result;
};

/**
 * Splits a string into an array of substrings, using any of the given delimiters.
 *
 * If the input string is empty, an empty array is returned.
 *
 * The function will not split on whitespace characters, only on the specified delimiters.
 *
 * @param {string} value - The string to split
 * @param {readonly string[]} delimiters - The delimiters to split on
 * @returns {string[]} - The array of substrings
 */
export const splitOnAnyDelimiter = (value: string, delimiters: readonly string[]) => {
  if (!value) return [] as string[];

  const delimiterSet = new Set(delimiters);
  const parts: string[] = [];
  let current = "";

  for (const char of value) {
    if (delimiterSet.has(char)) {
      parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  parts.push(current);
  return parts;
};

/**
 * Converts a slug string to sentence case.
 *
 * The function will replace underscores, dashes, and whitespace characters with spaces,
 * and then capitalize the first letter of the resulting string.
 *
 * If the input string is empty, an empty string is returned.
 *
 * @param {string} value - The slug string to convert
 * @returns {string} - The sentence-cased string
 */
export const toSentenceCaseFromSlug = (value: string) => {
  let normalized = "";
  let pendingSpace = false;

  for (const char of value) {
    const shouldReplace = char === "_" || char === "-" || isWhitespace(char);
    if (shouldReplace) {
      pendingSpace = normalized.length > 0;
      continue;
    }
    if (pendingSpace) {
      normalized += " ";
      pendingSpace = false;
    }
    normalized += char;
  }

  if (!normalized) return "";

  const first = normalized[0];
  if (isLowercase(first)) {
    return first.toUpperCase() + normalized.slice(1);
  }
  return normalized;
};

/**
 * Replace all occurrences of a character in a string with another character.
 *
 * @param {string} value - The string to search and replace in
 * @param {string} search - The character to search for
 * @param {string} replacement - The character to replace with
 * @returns {string} - The string with all occurrences of search replaced with replacement
 */
export const replaceAllCharacters = (
  value: string,
  search: string,
  replacement: string,
) => {
  if (!value || search === replacement) return value;

  let result = "";
  for (const char of value) {
    result += char === search ? replacement : char;
  }
  return result;
};

export const takeUntilAnyDelimiter = (
  value: string,
  delimiters: readonly string[],
) => {
  const delimiterSet = new Set(delimiters);
  let result = "";
  for (const char of value) {
    if (delimiterSet.has(char)) break;
    result += char;
  }
  return result;
};

export const replaceIgdbImageSizeSegment = (url: string, size: string) => {
  const markerIndex = url.indexOf("/t_");
  if (markerIndex < 0) return url;

  const segmentEnd = url.indexOf("/", markerIndex + 3);
  if (segmentEnd < 0) return url;

  return `${url.slice(0, markerIndex)}/${size}/${url.slice(segmentEnd + 1)}`;
};

export const isAsciiYouTubeVideoId = (value: string) => {
  if (value.length !== 11) return false;
  for (const char of value) {
    if (isAlphaNumeric(char) || char === "_" || char === "-") {
      continue;
    }
    return false;
  }
  return true;
};

