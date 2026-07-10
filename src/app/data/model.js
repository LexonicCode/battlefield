import { SUPPLIER_COLORS } from '../config.js';

const HEADER_ALIASES = {
  owner: ['Account Owner', 'Owner'],
  accountName: ['Account Name'],
  companyActivity: ['Company Activity', 'Sector', 'Activity', '__col_2'],
  classification: ['Classification', 'Class', 'Customer Value Classification High (5) to Low (1)'],
  supplierRaw: ['Current Main Supplier (Idox or Competitor Name)', 'Supplier', 'Supplier '],
  competitorValue: ['Estimated Competitor Value', 'Estimated Competitor Value (per annum)', 'Potential ACV', 'Potential Value'],
  upsellValue: ['Estimated Upsell Value', 'Estimated Upsell Value/Opps in SF (per annum)', 'Upsell Value', 'Upsell'],
  totalSpend: ['Total Spend this year', 'Total Spend This Year', 'Current ACV', 'Total Spend'],
};

const REQUIRED_ACTIVITY_COUNTS = {
  'Water/Waste': 16,
  Telco: 33,
  Renewables: 12,
  Energy: 34,
  Infrastructure: 7,
};

function normalizeHeaderKey(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function buildHeaderLookup(row) {
  const lookup = new Map();
  for (const [header, value] of Object.entries(row)) {
    lookup.set(normalizeHeaderKey(header), String(value ?? '').trim());
  }
  return lookup;
}

function pickValue(row, headerLookup, aliases) {
  for (const alias of aliases) {
    if (Object.hasOwn(row, alias) && String(row[alias]).trim() !== '') {
      return String(row[alias]).trim();
    }

    const normalizedAlias = normalizeHeaderKey(alias);
    const normalizedValue = headerLookup.get(normalizedAlias);
    if (normalizedValue) {
      return normalizedValue;
    }
  }
  return '';
}

function normalizeCompanyActivity(rawActivity) {
  const activity = (rawActivity || '').trim();
  if (!activity) {
    return '';
  }

  const normalized = activity.toLowerCase();
  if (normalized.includes('water') && normalized.includes('waste')) {
    return 'Water/Waste';
  }
  if (normalized.includes('telco') || normalized.includes('telecom')) {
    return 'Telco';
  }
  if (normalized.includes('renewable')) {
    return 'Renewables';
  }
  if (normalized.includes('infrastructure')) {
    return 'Infrastructure';
  }
  if (normalized.includes('energy')) {
    return 'Energy';
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
      const headerLookup = buildHeaderLookup(row);
      const owner = pickValue(row, headerLookup, HEADER_ALIASES.owner);
      const accountName = pickValue(row, headerLookup, HEADER_ALIASES.accountName);
      const companyActivity = normalizeCompanyActivity(pickValue(row, headerLookup, HEADER_ALIASES.companyActivity));
      const classification = pickValue(row, headerLookup, HEADER_ALIASES.classification);
      const supplierRaw = pickValue(row, headerLookup, HEADER_ALIASES.supplierRaw);
      const competitorValue = parseCurrency(pickValue(row, headerLookup, HEADER_ALIASES.competitorValue));
      const upsellValue = parseCurrency(pickValue(row, headerLookup, HEADER_ALIASES.upsellValue));
      const totalSpend = parseCurrency(pickValue(row, headerLookup, HEADER_ALIASES.totalSpend));
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
    .filter((record) => record.accountName && record.companyActivity);

  const selectedRecords = Object.entries(REQUIRED_ACTIVITY_COUNTS).flatMap(([activity, expectedCount]) => {
    const records = baseRecords
      .filter((record) => record.companyActivity === activity)
      .sort(
        (a, b) =>
          a.accountName.localeCompare(b.accountName, undefined, { sensitivity: 'base' }) ||
          a.owner.localeCompare(b.owner, undefined, { sensitivity: 'base' }),
      );

    if (records.length < expectedCount) {
      throw new Error(`Expected ${expectedCount} ${activity} companies in UtilityTop100.csv but found ${records.length}.`);
    }

    return records.slice(0, expectedCount);
  });

  const expectedTotal = Object.values(REQUIRED_ACTIVITY_COUNTS).reduce((sum, count) => sum + count, 0);
  if (selectedRecords.length !== expectedTotal) {
    throw new Error(`Expected ${expectedTotal} companies from UtilityTop100.csv but selected ${selectedRecords.length}.`);
  }

  const maxTotal = selectedRecords.reduce((max, record) => Math.max(max, record.computedTotalValue), 0);

  return selectedRecords
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
