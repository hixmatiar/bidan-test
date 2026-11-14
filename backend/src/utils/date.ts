const JAKARTA_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta',
});

const JAKARTA_PARTS = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export function todayJakarta(now: Date = new Date()): string {
  return JAKARTA_DATE.format(now);
}

function jakartaParts(now: Date): Record<string, string> {
  const parts: Record<string, string> = {};
  for (const part of JAKARTA_PARTS.formatToParts(now)) {
    if (part.type !== 'literal') parts[part.type] = part.value;
  }
  return parts;
}

/** `YYYY-MM-DD HH:mm` in Asia/Jakarta. */
export function dateTimeJakarta(now: Date = new Date()): string {
  const parts = jakartaParts(now);
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

/** `YYYY-MM-DD HH:mm WIB` in Asia/Jakarta. */
export function dateTimeWib(now: Date = new Date()): string {
  return `${dateTimeJakarta(now)} WIB`;
}
