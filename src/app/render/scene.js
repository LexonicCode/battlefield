import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GRID_CONFIG, SUPPLIER_COLORS } from '../config.js';
import { loadAccounts } from '../data/loadAccounts.js';
import { layoutGrid } from '../layout/gridLayout.js';
import { createColumnMesh } from './columnMesh.js';

const ALL_FILTER_VALUE = '__all__';

const CLUSTER_OPTIONS = [
  { key: 'companyActivity', label: 'Company Activity' },
  { key: 'supplier', label: 'Supplier' },
  { key: 'classification', label: 'Classification' },
  { key: 'owner', label: 'Account Owner' },
];

function currency(value) {
  return `£${Math.round(value).toLocaleString()}`;
}

function formatSupplierLabel(value) {
  if (value === 'idox') return 'Idox';
  if (value === 'esri') return 'ESRI';
  if (value === 'landmark') return 'Landmark';
  if (value === 'os') return 'Ordnance Survey / OS';
  return 'Other / Unknown';
}

function getAttributeValue(record, attribute) {
  if (attribute === 'supplier') {
    return record.colorKey || 'other';
  }

  const raw = record[attribute];
  return String(raw ?? '').trim() || 'Unspecified';
}

function getAttributeLabel(attribute, value) {
  if (attribute === 'supplier') {
    return formatSupplierLabel(value);
  }
  return value;
}

function applyLegend(container) {
  container.innerHTML = `
    <div><span class="legend-swatch" style="background:${SUPPLIER_COLORS.idox}"></span>Idox</div>
    <div><span class="legend-swatch" style="background:${SUPPLIER_COLORS.esri}"></span>ESRI</div>
    <div><span class="legend-swatch" style="background:${SUPPLIER_COLORS.landmark}"></span>Landmark</div>
    <div><span class="legend-swatch" style="background:${SUPPLIER_COLORS.os}"></span>Ordnance Survey / OS</div>
    <div><span class="legend-swatch" style="background:${SUPPLIER_COLORS.other}"></span>Other / Unknown</div>
  `;
}

function createZoneLabel(activity) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    return new THREE.Object3D();
  }
  canvas.width = 420;
  canvas.height = 94;
  context.fillStyle = '#111827';
  context.font = '600 34px Inter, Arial, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.shadowColor = 'rgba(255,255,255,0.75)';
  context.shadowBlur = 8;
  context.shadowOffsetX = 0;
  context.shadowOffsetY = 0;
  context.fillText(activity, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const label = new THREE.Mesh(new THREE.PlaneGeometry(8.8, 1.9), material);
  label.rotation.x = -Math.PI / 2;
  label.renderOrder = 10;
  return label;
}

function setTooltip(tooltip, data, x, y) {
  tooltip.style.display = 'block';
  tooltip.style.left = `${x + 12}px`;
  tooltip.style.top = `${y + 12}px`;
  tooltip.innerHTML = `
    <strong>${data.accountName}</strong><br/>
    Activity: ${data.companyActivity}<br/>
    Supplier: ${data.supplierRaw || 'Unknown'}<br/>
    Class: ${data.classification || 'Unspecified'}<br/>
    Owner: ${data.owner || 'Unspecified'}<br/>
    Competitor: ${currency(data.competitorValue)}<br/>
    Upsell: ${currency(data.upsellValue)}<br/>
    Spend: ${currency(data.totalSpend)}<br/>
    <strong>Total: ${currency(data.computedTotalValue)}</strong>
  `;
}

function accountId(record) {
  return `${record.accountName}::${record.owner}::${record.companyActivity}`;
}

function clearGroup(group) {
  while (group.children.length) {
    const child = group.children.pop();
    if (child?.geometry) {
      child.geometry.dispose();
    }
    const materials = Array.isArray(child?.material) ? child.material : [child?.material];
    for (const material of materials) {
      if (!material) {
        continue;
      }
      if (material.map) {
        material.map.dispose();
      }
      material.dispose();
    }
    group.remove(child);
  }
}

function computeGridAxisOffset(sampleCoordinate, stride, divisions) {
  const normalized = sampleCoordinate / stride + divisions / 2;
  const shiftCells = normalized - 0.5 - Math.floor(normalized - 0.5);
  return shiftCells * stride;
}

function buildAlignedGrid(positioned) {
  if (!positioned.length) {
    return null;
  }

  const minX = Math.min(...positioned.map((record) => record.gridX));
  const maxX = Math.max(...positioned.map((record) => record.gridX));
  const minZ = Math.min(...positioned.map((record) => record.gridZ));
  const maxZ = Math.max(...positioned.map((record) => record.gridZ));
  const cellsWide = Math.max(maxX - minX + 1 + GRID_CONFIG.zoneGapCells * 2, 24);
  const cellsDeep = Math.max(maxZ - minZ + 1 + GRID_CONFIG.zoneGapCells * 2, 24);
  const divisions = Math.max(cellsWide, cellsDeep);
  const stride = GRID_CONFIG.cellSize + GRID_CONFIG.cellGap;
  const size = divisions * stride;

  const grid = new THREE.GridHelper(size, divisions, '#c6d3e5', '#dbe4f0');
  const sample = positioned[0];
  grid.position.set(
    computeGridAxisOffset(sample.x, stride, divisions),
    0.01,
    computeGridAxisOffset(sample.z, stride, divisions),
  );
  return grid;
}

function populateClusterSelect(clusterBy) {
  clusterBy.innerHTML = '';
  for (const option of CLUSTER_OPTIONS) {
    const node = document.createElement('option');
    node.value = option.key;
    node.textContent = option.label;
    clusterBy.appendChild(node);
  }
}

function populateFilterSelect(filterValue, accounts, attribute) {
  filterValue.innerHTML = '';

  const allOption = document.createElement('option');
  allOption.value = ALL_FILTER_VALUE;
  allOption.textContent = `All ${CLUSTER_OPTIONS.find((option) => option.key === attribute)?.label ?? 'values'}`;
  filterValue.appendChild(allOption);

  const values = [...new Set(accounts.map((record) => getAttributeValue(record, attribute)))].sort((a, b) =>
    getAttributeLabel(attribute, a).localeCompare(getAttributeLabel(attribute, b), undefined, { sensitivity: 'base' }),
  );

  for (const value of values) {
    const node = document.createElement('option');
    node.value = value;
    node.textContent = getAttributeLabel(attribute, value);
    filterValue.appendChild(node);
  }
}

export async function createBattlefieldScene({ container, legend, tooltip, stats, clusterBy, filterValue }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#edf3fb');

  const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 3000);
  camera.position.set(0, 72, 88);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = true;
  controls.enableZoom = true;
  controls.maxPolarAngle = Math.PI / 2.05;
  controls.target.set(0, 0, 0);

  scene.add(new THREE.AmbientLight('#ffffff', 0.85));
  const directional = new THREE.DirectionalLight('#ffffff', 1.3);
  directional.position.set(40, 70, 30);
  scene.add(directional);

  const accent = new THREE.DirectionalLight('#dbeafe', 0.45);
  accent.position.set(-45, 45, -30);
  scene.add(accent);

  const accounts = await loadAccounts();
  const meshes = [];
  const meshById = new Map();

  for (const account of accounts) {
    const mesh = createColumnMesh({
      width: GRID_CONFIG.columnWidth,
      height: account.scaledHeight,
      color: account.colorHex,
    });
    mesh.position.set(0, account.scaledHeight / 2, 0);
    mesh.visible = false;
    mesh.userData = account;
    scene.add(mesh);
    meshes.push(mesh);
    meshById.set(accountId(account), mesh);
  }

  let grid = null;
  let didSetInitialView = false;
  const labelGroup = new THREE.Group();
  scene.add(labelGroup);

  populateClusterSelect(clusterBy);
  applyLegend(legend);

  function applyLayout() {
    const attribute = clusterBy.value || 'companyActivity';
    const selectedFilter = filterValue.value || ALL_FILTER_VALUE;

    const filteredAccounts = selectedFilter === ALL_FILTER_VALUE
      ? accounts
      : accounts.filter((record) => getAttributeValue(record, attribute) === selectedFilter);

    const positioned = layoutGrid(filteredAccounts, GRID_CONFIG, (record) => getAttributeValue(record, attribute));
    const visibleIds = new Set();

    for (const record of positioned) {
      const id = accountId(record);
      const mesh = meshById.get(id);
      if (!mesh) {
        continue;
      }
      mesh.position.x = record.x;
      mesh.position.z = record.z;
      mesh.position.y = record.scaledHeight / 2;
      mesh.visible = true;
      mesh.userData = record;
      visibleIds.add(id);
    }

    for (const [id, mesh] of meshById.entries()) {
      if (!visibleIds.has(id)) {
        mesh.visible = false;
      }
    }

    if (grid) {
      scene.remove(grid);
    }
    grid = buildAlignedGrid(positioned);
    if (grid) {
      scene.add(grid);
    }

    clearGroup(labelGroup);
    const groupedRecords = new Map();
    for (const record of positioned) {
      const value = getAttributeValue(record, attribute);
      if (!groupedRecords.has(value)) {
        groupedRecords.set(value, []);
      }
      groupedRecords.get(value).push(record);
    }

    for (const [value, records] of groupedRecords.entries()) {
      const minX = Math.min(...records.map((record) => record.x));
      const maxX = Math.max(...records.map((record) => record.x));
      const maxZ = Math.max(...records.map((record) => record.z));
      const stride = GRID_CONFIG.cellSize + GRID_CONFIG.cellGap;
      const label = createZoneLabel(getAttributeLabel(attribute, value));
      label.position.set((minX + maxX) / 2, 0.03, maxZ + stride * 0.75);
      labelGroup.add(label);
    }

    if (!didSetInitialView && positioned.length) {
      const stride = GRID_CONFIG.cellSize + GRID_CONFIG.cellGap;
      const minX = Math.min(...positioned.map((record) => record.x));
      const maxX = Math.max(...positioned.map((record) => record.x));
      const minZ = Math.min(...positioned.map((record) => record.z));
      const maxZ = Math.max(...positioned.map((record) => record.z));
      const maxHeight = Math.max(...positioned.map((record) => record.scaledHeight));
      const centerX = (minX + maxX) / 2;
      const centerZ = (minZ + maxZ) / 2 + stride * 0.4;
      const width = maxX - minX + GRID_CONFIG.columnWidth;
      const depth = maxZ - minZ + GRID_CONFIG.columnWidth + stride * 1.6;
      const span = Math.max(width, depth);
      controls.target.set(centerX, Math.max(2.5, maxHeight * 0.32), centerZ);
      camera.position.set(centerX, Math.max(28, maxHeight * 2.15 + 10), centerZ + span * 0.78 + 8);
      controls.update();
      didSetInitialView = true;
    }

    const clusterLabel = CLUSTER_OPTIONS.find((option) => option.key === attribute)?.label ?? 'Category';
    stats.textContent = `${positioned.length.toLocaleString()} shown of ${accounts.length.toLocaleString()} accounts — clustered by ${clusterLabel}`;
  }

  clusterBy.value = 'companyActivity';
  populateFilterSelect(filterValue, accounts, clusterBy.value);
  filterValue.value = ALL_FILTER_VALUE;
  applyLayout();

  clusterBy.addEventListener('change', () => {
    populateFilterSelect(filterValue, accounts, clusterBy.value);
    filterValue.value = ALL_FILTER_VALUE;
    applyLayout();
  });

  filterValue.addEventListener('change', () => {
    applyLayout();
  });

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let lockedId = null;

  function pick(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(meshes, false)[0];
    return hit?.object || null;
  }

  renderer.domElement.addEventListener('pointermove', (event) => {
    const hit = pick(event);
    renderer.domElement.style.cursor = hit ? 'pointer' : 'default';

    if (lockedId != null) {
      return;
    }

    if (!hit) {
      tooltip.style.display = 'none';
      return;
    }

    setTooltip(tooltip, hit.userData, event.clientX, event.clientY);
  });

  renderer.domElement.addEventListener('click', (event) => {
    const hit = pick(event);

    if (!hit) {
      lockedId = null;
      tooltip.style.display = 'none';
      return;
    }

    const data = hit.userData;
    lockedId = `${data.accountName}:${data.owner}`;
    setTooltip(tooltip, data, event.clientX, event.clientY);
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      lockedId = null;
      tooltip.style.display = 'none';
    }
  });

  function animate() {
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  window.addEventListener('resize', () => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  });

  animate();
}
