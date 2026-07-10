function toGroupKey(value) {
  const text = String(value ?? '').trim();
  return text || 'Unspecified';
}

export function layoutGrid(records, config, groupBy = (record) => record.companyActivity) {
  const {
    targetCellsPerAxis,
    zoneGapCells,
    cellSize,
    cellGap,
  } = config;

  const byZone = new Map();
  for (const record of records) {
    const groupValue = toGroupKey(groupBy(record));
    if (!byZone.has(groupValue)) {
      byZone.set(groupValue, []);
    }
    byZone.get(groupValue).push(record);
  }

  const zoneEntries = [...byZone.entries()]
    .map(([groupValue, items]) => ({
      groupValue,
      companyActivity: groupValue,
      records: [...items].sort((a, b) => a.accountName.localeCompare(b.accountName, undefined, { sensitivity: 'base' })),
    }))
    .sort((a, b) => a.companyActivity.localeCompare(b.companyActivity, undefined, { sensitivity: 'base' }));

  const laidOut = [];
  let cursorX = 0;
  let cursorZ = 0;
  let rowDepth = 0;

  for (const zone of zoneEntries) {
    const zoneCount = zone.records.length;
    const zoneCols = Math.ceil(Math.sqrt(zoneCount));
    const zoneRows = Math.ceil(zoneCount / zoneCols);

    if (cursorX > 0 && cursorX + zoneCols > targetCellsPerAxis) {
      cursorX = 0;
      cursorZ += rowDepth + zoneGapCells;
      rowDepth = 0;
    }

    zone.records.forEach((record, index) => {
      const localX = index % zoneCols;
      const localZ = Math.floor(index / zoneCols);
      laidOut.push({
        ...record,
        gridX: cursorX + localX,
        gridZ: cursorZ + localZ,
      });
    });

    cursorX += zoneCols + zoneGapCells;
    rowDepth = Math.max(rowDepth, zoneRows);
  }

  if (!laidOut.length) {
    return laidOut;
  }

  const minX = Math.min(...laidOut.map((record) => record.gridX));
  const maxX = Math.max(...laidOut.map((record) => record.gridX));
  const minZ = Math.min(...laidOut.map((record) => record.gridZ));
  const maxZ = Math.max(...laidOut.map((record) => record.gridZ));
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const stride = cellSize + cellGap;

  return laidOut.map((record) => ({
    ...record,
    x: (record.gridX - centerX) * stride,
    z: (record.gridZ - centerZ) * stride,
  }));
}

export function layoutGridByZone(records, config) {
  return layoutGrid(records, config, (record) => record.companyActivity);
}
