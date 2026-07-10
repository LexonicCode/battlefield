import { SUPPLIER_COLORS } from '../config.js';

const HEADER_ALIASES = {
  owner: ['Account Owner', 'Owner'],
  accountName: ['Account Name'],
  companyActivity: ['Company Activity', 'Sector', 'Activity'],
  classification: ['Classification', 'Class'],
  supplierRaw: ['Current Main Supplier (Idox or Competitor Name)', 'Supplier', 'Supplier '],
  competitorValue: ['Estimated Competitor Value (per annum)', 'Potential ACV', 'Potential Value'],
  upsellValue: ['Estimated Upsell Value/Opps in SF (per annum)', 'Upsell Value', 'Upsell'],
  totalSpend: ['Total Spend This Year', 'Current ACV', 'Total Spend'],
};

function pickValue(row, aliases) {
  for (const alias of aliases) {
    if (Object.hasOwn(row, alias) && String(row[alias]).trim() !== '') {
      return String(row[alias]).trim();
    }
  }
  return '';
}

export function parseCurrency(value) {
  if (value == null) {
    return 0;
  }

  const raw = String(value).replace(/\u00A0/g, ' ').trim();
  if (!raw || raw === '-' || raw === '£-') {
    return 0;
  }

  const negativeWrapped = /^\((.*)\)$/.test(raw);
  const cleaned = raw
    .replace(/[£$,]/g, '')
    .replace(/\s+/g, '')
    .replace(/[–—]/g, '-')
    .trim();

  if (!cleaned || cleaned === '-' || cleaned.toLowerCase() === 'n/a') {
    return 0;
  }

  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return negativeWrapped ? -Math.abs(parsed) : parsed;
}

export function getSupplierColorKey(supplierRaw) {
  const value = (supplierRaw || '').toLowerCase();

  if (value.includes('idox')) {
    return 'idox';
  }

  if (value.includes('esri')) {
    return 'esri';
  }

  if (value.includes('landmark')) {
    return 'landmark';
  }

  if (value === 'os' || value.includes('ordnance survey')) {
    return 'os';
  }

  return 'other';
}

export function zoneKeyFromActivity(activity) {
  const base = (activity || 'Unspecified').trim();
  return base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unspecified';
}

function scaleHeight(total, maxTotal, minHeight, maxHeight) {
  if (maxTotal <= 0) {
    return minHeight;
  }

  const ratio = Math.sqrt(Math.max(total, 0)) / Math.sqrt(maxTotal);
  return minHeight + ratio * (maxHeight - minHeight);
}

export function normalizeRows(rows, { minHeight, maxHeight }) {
  const baseRecords = rows
    .map((row) => {
      const owner = pickValue(row, HEADER_ALIASES.owner);
      const accountName = pickValue(row, HEADER_ALIASES.accountName);
      const companyActivity = pickValue(row, HEADER_ALIASES.companyActivity) || 'Unspecified';
      const classification = pickValue(row, HEADER_ALIASES.classification);
      const supplierRaw = pickValue(row, HEADER_ALIASES.supplierRaw);
      const competitorValue = parseCurrency(pickValue(row, HEADER_ALIASES.competitorValue));
      const upsellValue = parseCurrency(pickValue(row, HEADER_ALIASES.upsellValue));
      const totalSpend = parseCurrency(pickValue(row, HEADER_ALIASES.totalSpend));
      const computedTotalValue = competitorValue + upsellValue + totalSpend;
      const zoneKey = zoneKeyFromActivity(companyActivity);
      const colorKey = getSupplierColorKey(supplierRaw);

      return {
        owner,
        accountName,
        companyActivity,
        classification,
        supplierRaw,
        competitorValue,
        upsellValue,
        totalSpend,
        computedTotalValue,
        zoneKey,
        colorKey,
        colorHex: SUPPLIER_COLORS[colorKey],
      };
    })
    .filter((record) => record.accountName);

  const maxTotal = baseRecords.reduce((max, record) => Math.max(max, record.computedTotalValue), 0);

  return baseRecords
    .map((record) => ({
      ...record,
      scaledHeight: scaleHeight(record.computedTotalValue, maxTotal, minHeight, maxHeight),
    }))
    .sort(
      (a, b) =>
        a.companyActivity.localeCompare(b.companyActivity, undefined, { sensitivity: 'base' }) ||
        a.accountName.localeCompare(b.accountName, undefined, { sensitivity: 'base' }),
    );
}
