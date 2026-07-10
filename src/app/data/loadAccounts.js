import { CSV_SOURCE, HEIGHT_CONFIG } from '../config.js';
import { parseCsv } from './csv.js';
import { normalizeRows } from './model.js';

async function fetchCsv(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to load required CSV source: ${url}`);
  }
  return response.text();
}

export async function loadAccounts() {
  const csvText = await fetchCsv(CSV_SOURCE);
  const rows = parseCsv(csvText);

  return normalizeRows(rows, {
    minHeight: HEIGHT_CONFIG.minHeight,
    maxHeight: HEIGHT_CONFIG.maxHeight,
  });
}
