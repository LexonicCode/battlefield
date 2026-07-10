import { CSV_SOURCES, HEIGHT_CONFIG } from '../config.js';
import { parseCsv } from './csv.js';
import { normalizeRows } from './model.js';

async function fetchFirstAvailable(urls) {
  for (const url of urls) {
    const response = await fetch(url);
    if (response.ok) {
      return response.text();
    }
  }

  throw new Error(`Unable to load CSV data from any source: ${urls.join(', ')}`);
}

export async function loadAccounts() {
  const csvText = await fetchFirstAvailable(CSV_SOURCES);
  const rows = parseCsv(csvText);

  return normalizeRows(rows, {
    minHeight: HEIGHT_CONFIG.minHeight,
    maxHeight: HEIGHT_CONFIG.maxHeight,
  });
}
