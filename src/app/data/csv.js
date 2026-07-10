function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(current);
      current = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && text[i + 1] === '\n') {
        i += 1;
      }
      row.push(current);
      const isNonEmpty = row.some((value) => value.trim().length > 0);
      if (isNonEmpty) {
        rows.push(row.map((value) => value.trim()));
      }
      row = [];
      current = '';
      continue;
    }

    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    const isNonEmpty = row.some((value) => value.trim().length > 0);
    if (isNonEmpty) {
      rows.push(row.map((value) => value.trim()));
    }
  }

  return rows;
}

function buildHeaders(headerValues) {
  const seen = new Set();
  return headerValues.map((header, index) => {
    const base = header.trim() || `__col_${index}`;
    if (!seen.has(base)) {
      seen.add(base);
      return base;
    }
    let suffix = 2;
    let candidate = `${base}__${suffix}`;
    while (seen.has(candidate)) {
      suffix += 1;
      candidate = `${base}__${suffix}`;
    }
    seen.add(candidate);
    return candidate;
  });
}

export function parseCsv(text) {
  const normalized = text.replace(/^\uFEFF/, '');
  const rows = parseCsvRows(normalized);

  if (!rows.length) {
    return [];
  }

  const headers = buildHeaders(rows[0]);

  return rows.slice(1).map((values) => {
    const row = {};

    headers.forEach((header, index) => {
      row[header] = (values[index] ?? '').trim();
    });

    return row;
  });
}
