export function formatSerial(year, num) {
  if (num < 1 || num > 9999) throw new Error('serial number out of range (1..9999)');
  return `${year}-${String(num).padStart(4, '0')}`;
}

export function parseSerial(serial) {
  const m = /^(\d{4})-(\d{4})$/.exec(serial);
  if (!m) throw new Error('bad serial format');
  const num = Number(m[2]);
  if (num < 1 || num > 9999) throw new Error('serial number out of range (1..9999)');
  return { year: Number(m[1]), num };
}
