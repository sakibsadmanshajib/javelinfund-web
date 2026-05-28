export const CHARITY = {
  name: 'The Javelin Education & Medical Fund',
  address: '1074 Lilydale Avenue, Belle River, ON, Canada, N8L 0Z2',
  regNumber: '75572 2097 RR0001',
  signatory: 'Glen Jackson, President',
  statement: 'This is your official receipt for income tax purposes.',
  craLine: 'Canada Revenue Agency: canada.ca/charities-giving',
};

function req(v, label) {
  if (typeof v !== 'string' || v.trim() === '') throw new Error(`missing field: ${label}`);
  return v.trim();
}

function validDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  if (isNaN(d.getTime())) return false;
  if (d.toISOString().slice(0, 10) !== s) return false; // rejects 2026-13-99 etc.
  const tomorrow = new Date(Date.now() + 86400000);
  return d.getTime() <= tomorrow.getTime();
}

export function buildReceiptModel(fields, issued) {
  const amountRaw = String(fields.amount == null ? '' : fields.amount).replace(/[$,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(amountRaw)) throw new Error('invalid amount');
  const amountNum = Number(amountRaw);
  if (!(amountNum > 0)) throw new Error('invalid amount');
  const dateReceived = req(fields.dateReceived, 'dateReceived');
  if (!validDate(dateReceived)) throw new Error('invalid dateReceived');
  return {
    serial: req(issued.serial, 'serial'),
    dateIssued: issued.dateIssued,
    dateReceived,
    donorName: req(fields.donorName, 'donorName'),
    donorAddress: req(fields.donorAddress, 'donorAddress'),
    cityProvince: req(fields.cityProvince, 'cityProvince'),
    postalCode: req(fields.postalCode, 'postalCode'),
    amount: amountNum.toFixed(2),
    charity: CHARITY,
  };
}
