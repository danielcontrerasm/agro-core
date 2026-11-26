export const farmBusinessTimeZone = 'America/Bogota';

const inputFormat = new Intl.DateTimeFormat('sv-SE', {
  timeZone: farmBusinessTimeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export function farmDateTimeInput(instant = new Date()) {
  return inputFormat.format(instant).replace(' ', 'T');
}

export function farmInputInstant(dateTime: string) {
  // The Colombian civil time used by these forms is UTC−05:00.
  return new Date(`${dateTime}-05:00`).toISOString();
}
