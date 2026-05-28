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

export function buildReceiptModel(fields, issued) {
  const amountNum = Number(String(fields.amount).replace(/[$,]/g, ''));
  if (!Number.isFinite(amountNum) || amountNum <= 0) throw new Error('invalid amount');
  return {
    serial: req(issued.serial, 'serial'),
    dateIssued: issued.dateIssued,
    dateReceived: req(fields.dateReceived, 'dateReceived'),
    donorName: req(fields.donorName, 'donorName'),
    donorAddress: req(fields.donorAddress, 'donorAddress'),
    cityProvince: req(fields.cityProvince, 'cityProvince'),
    postalCode: req(fields.postalCode, 'postalCode'),
    amount: amountNum.toFixed(2),
    charity: CHARITY,
  };
}
