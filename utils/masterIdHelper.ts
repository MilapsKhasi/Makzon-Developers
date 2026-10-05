import { supabase } from '../lib/supabase';

/**
 * MASTER ID ARCHITECTURE (ZenterPrime)
 * 
 * Format: [SEQUENCE]-[RANDOM]-[DATE]
 * Example: ARDT-2385-262705
 * 
 * 1. SEQUENCE:
 *    - Alphabetic sequential series: AAA → AAB → AAC ... → ZZZ (26^3 = 17,576 combinations)
 *    - After ZZZ: AAAA → AAAB ... → ZZZZ (26^4 = 456,976 combinations)
 *    - After ZZZZ: AAAAA ...
 *    - Deleted IDs remain retired; never reuse or renumber an existing ID.
 *    - Duplicates/new items receive a strictly new sequence.
 * 
 * 2. RANDOM:
 *    - 4-character alphanumeric uniqueness token.
 * 
 * 3. DATE:
 *    - YYFY + MM format (e.g. 262705 = FY 2026-27, May).
 *    - On edit, updates the month portion while preserving sequence and random tokens.
 * 
 * CRITICAL RULE:
 * This human-readable Master ID does NOT replace the permanent Supabase UUID (`id`).
 * Supabase UUID remains the immutable primary key and database identity.
 */

/**
 * Converts a non-negative integer to an alphabetic sequence (AAA, AAB ... ZZZ, AAAA ...).
 */
export const numberToSequence = (n: number): string => {
  let len = 3;
  let currentCap = Math.pow(26, len);
  let rem = Math.max(0, Math.floor(n));

  while (rem >= currentCap) {
    rem -= currentCap;
    len++;
    currentCap = Math.pow(26, len);
  }

  const chars: string[] = [];
  for (let i = len - 1; i >= 0; i--) {
    const power = Math.pow(26, i);
    const digit = Math.floor(rem / power) % 26;
    chars.push(String.fromCharCode(65 + digit));
    rem = rem % power;
  }
  return chars.join('');
};

/**
 * Converts an alphabetic sequence back to its numerical index.
 */
export const sequenceToNumber = (seq: string): number => {
  if (!seq) return -1;
  const clean = seq.toUpperCase().replace(/[^A-Z]/g, '');
  if (clean.length < 3) return -1;

  let total = 0;
  for (let l = 3; l < clean.length; l++) {
    total += Math.pow(26, l);
  }

  let val = 0;
  for (let i = 0; i < clean.length; i++) {
    const digit = clean.charCodeAt(i) - 65;
    val = val * 26 + digit;
  }

  return total + val;
};

/**
 * Generates a 4-character alphanumeric random token.
 */
export const generateRandomToken = (length = 4): string => {
  const chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let res = '';
  for (let i = 0; i < length; i++) {
    res += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return res;
};

/**
 * Calculates Indian Financial Year date code: YYFY + MM
 * Example: May 2026 (FY 2026-27, Month 05) => 262705
 */
export const getFinancialYearDateCode = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1 - 12

  let fyStart: number;
  let fyEnd: number;

  if (month >= 4) {
    fyStart = year;
    fyEnd = year + 1;
  } else {
    fyStart = year - 1;
    fyEnd = year;
  }

  const startYY = String(fyStart).slice(-2);
  const endYY = String(fyEnd).slice(-2);
  const mm = String(month).padStart(2, '0');

  return `${startYY}${endYY}${mm}`;
};

/**
 * Generates a full structured ZenterPrime Master ID.
 * Format: [SEQUENCE]-[RANDOM]-[DATE] (e.g. ARDT-2385-262705)
 */
export const generateMasterId = (sequenceIndex: number, date: Date = new Date(), customRandom?: string): string => {
  const seq = numberToSequence(sequenceIndex);
  const rnd = customRandom || generateRandomToken(4);
  const dt = getFinancialYearDateCode(date);
  return `${seq}-${rnd}-${dt}`;
};

/**
 * Parses an existing Master ID into its constituent components.
 */
export const parseMasterId = (masterId: string) => {
  if (!masterId || typeof masterId !== 'string') return null;
  const parts = masterId.trim().toUpperCase().split('-');
  if (parts.length !== 3) return null;

  const [sequence, random, dateCode] = parts;
  const sequenceIndex = sequenceToNumber(sequence);
  if (sequenceIndex < 0) return null;

  return {
    sequence,
    sequenceIndex,
    random,
    dateCode,
    yearPrefix: dateCode.slice(0, 4),
    month: dateCode.slice(4, 6)
  };
};

/**
 * On edit, updates the date portion of the Master ID while strictly keeping
 * the Sequence and Random tokens intact.
 */
export const updateMasterIdOnEdit = (existingMasterId: string | undefined | null, newDate: Date = new Date()): string => {
  if (!existingMasterId) return generateMasterId(0, newDate);
  const parsed = parseMasterId(existingMasterId);
  if (!parsed) {
    return existingMasterId;
  }
  const newDateCode = getFinancialYearDateCode(newDate);
  return `${parsed.sequence}-${parsed.random}-${newDateCode}`;
};

/**
 * Queries the database table to determine the next strictly unused sequence index.
 * Considers both active and deleted records to ensure retired IDs are never reused.
 */
export const getNextMasterSequenceIndex = async (
  companyId: string,
  table: 'vendors' | 'stock_items' | 'additional_charges' | string
): Promise<number> => {
  if (!companyId) return 0;

  try {
    const { data, error } = await supabase
      .from(table)
      .select('master_id')
      .eq('company_id', companyId);

    if (error || !data || data.length === 0) {
      return 0;
    }

    let maxIndex = -1;
    for (const row of data) {
      if (row && row.master_id) {
        const parsed = parseMasterId(row.master_id);
        if (parsed && parsed.sequenceIndex > maxIndex) {
          maxIndex = parsed.sequenceIndex;
        }
      }
    }

    return maxIndex + 1;
  } catch (err) {
    console.error(`Error calculating next master sequence for ${table}:`, err);
    return 0;
  }
};

/**
 * Helper to generate the next Master ID for a new entity.
 */
export const createNewMasterId = async (
  companyId: string,
  table: 'vendors' | 'stock_items' | 'additional_charges' | string,
  date: Date = new Date()
): Promise<string> => {
  const nextIdx = await getNextMasterSequenceIndex(companyId, table);
  return generateMasterId(nextIdx, date);
};
