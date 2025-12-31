/**
 * Timezone-safe date formatting utilities
 * Parses "YYYY-MM-DD" strings directly without Date object conversion
 * to avoid timezone shift issues
 */

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/**
 * Format date string in a timezone-safe way
 * @param dateStr - Date string in "YYYY-MM-DD" format
 * @param options - Formatting options
 * @returns Formatted date string (e.g., "Jan 15, 2024" or "January 15, 2024")
 */
export const formatDateSafe = (
  dateStr: string,
  options?: { short?: boolean; includeYear?: boolean }
): string => {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  if (!year || !month || !day) return dateStr;

  const months = options?.short !== false ? MONTHS_SHORT : MONTHS_FULL;
  const includeYear = options?.includeYear !== false; // Default to true

  if (includeYear) {
    return `${months[parseInt(month) - 1]} ${parseInt(day)}, ${year}`;
  }
  return `${months[parseInt(month) - 1]} ${parseInt(day)}`;
};

/**
 * Short date format with year (e.g., "Jan 15, 2024")
 */
export const formatDate = (dateStr: string): string => {
  return formatDateSafe(dateStr, { short: true, includeYear: true });
};

/**
 * Full date format with year (e.g., "January 15, 2024")
 */
export const formatDateFull = (dateStr: string): string => {
  return formatDateSafe(dateStr, { short: false, includeYear: true });
};
