import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createHexColumn } from './hexTile.js';

const currencyFormatter = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });
const percentageFormatter = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 });
const COLUMN_HEIGHT_SCALE = 0.42;
const COLUMN_RADIUS = 1.32;
const BOARD_SIZE = 25;
const HEX_SPACING = 1.15;

const THEME_TOKENS = {
  dark: {
    sceneBackground: '#0f172a',
    boardTop: '#1f2937',
    boardEdge: '#334155',
    territoryOpacity: 0.28,
    hoverEmissive: 0x1d4ed8,
    ambientIntensity: 0.45,
    directionalIntensity: 1.1,
  },
  light: {
    sceneBackground: '#e2e8f0',
    boardTop: '#f8fafc',
    boardEdge: '#cbd5e1',
    territoryOpacity: 0.2,
    hoverEmissive: 0x1e40af,
    ambientIntensity: 0.6,
    directionalIntensity: 1.0,
  },
};

const TERRITORY_COLORS = {
  water: '#0ea5e9',
  energy: '#f59e0b',
  fibre: '#22c55e',
  gas: '#ef4444',
  infrastructure: '#a855f7',
  renewables: '#14b8a6',
  other: '#64748b',
};

function axialToWorld(q, r, spacing = HEX_SPACING) {
  return {
    x: spacing * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r),
    z: spacing * ((3 / 2) * r),
  };
}

function createHexBoard(scene) {
  const boardMeshes = [];
  const tileHeight = 0.14;
  const tileRadius = HEX_SPACING * 0.96;

  for (let q = -Math.floor(BOARD_SIZE / 2); q <= Math.floor(BOARD_SIZE / 2); q += 1) {
    for (let r = -Math.floor(BOARD_SIZE / 2); r <= Math.floor(BOARD_SIZE / 2); r += 1) {
      const geometry = new THREE.CylinderGeometry(tileRadius, tileRadius, tileHeight, 6);
      const material = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0.02 });
      const mesh = new THREE.Mesh(geometry, material);
      const world = axialToWorld(q, r);
      mesh.position.set(world.x, tileHeight / 2, world.z);
      scene.add(mesh);
      boardMeshes.push(mesh);
    }
  }

  return boardMeshes;
}

function createTerritoryPads(scene, records) {
  const bySector = new Map();
  for (const record of records) {
    if (!bySector.has(record.sector)) {
      bySector.set(record.sector, []);
    }
    bySector.get(record.sector).push(record);
  }

  const territoryMeshes = [];
  for (const [sector, sectorRows] of bySector.entries()) {
    const centerX = sectorRows.reduce((sum, item) => sum + Number(item.x), 0) / sectorRows.length;
    const centerZ = sectorRows.reduce((sum, item) => sum + Number(item.z), 0) / sectorRows.length;
    const maxDistance = sectorRows.reduce((largest, item) => {
      const dx = Number(item.x) - centerX;
      const dz = Number(item.z) - centerZ;
      return Math.max(largest, Math.sqrt(dx ** 2 + dz ** 2));
    }, 3);

    const radius = Math.max(5, maxDistance + 3.2);
    const geometry = new THREE.CylinderGeometry(radius, radius, 0.08, 48);
    const material = new THREE.MeshStandardMaterial({
      color: TERRITORY_COLORS[sector] || TERRITORY_COLORS.other,
      transparent: true,
      roughness: 0.9,
      metalness: 0.0,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(centerX, 0.04, centerZ);
    scene.add(mesh);
    territoryMeshes.push(mesh);
  }

  return territoryMeshes;
}

export async function createBattlefieldScene({
  container,
  detailPanel,
  sectorFilter,
  supplierFilter,
  accountSearch,
  recordCount,
}) {
  let currentTheme = document.documentElement.dataset.theme || 'dark';
  if (!THEME_TOKENS[currentTheme]) {
    currentTheme = 'dark';
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(THEME_TOKENS[currentTheme].sceneBackground);

  const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
  camera.position.set(0, 40, 60);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI / 2.1;

  const ambient = new THREE.AmbientLight('#ffffff', THEME_TOKENS[currentTheme].ambientIntensity);
  scene.add(ambient);
  const directional = new THREE.DirectionalLight('#ffffff', 1.1);
  directional.position.set(20, 50, 20);
  scene.add(directional);
  directional.intensity = THEME_TOKENS[currentTheme].directionalIntensity;

  const payload = await fetch('/data/customers.battlefield.json').then((r) => r.json());
  const records = payload.records;
  const totalValue = records.reduce((sum, record) => sum + Number(record.normalized_value || 0), 0);
  const nonZeroRecords = records.filter((record) => Number(record.normalized_value) > 0).length;

  const sectors = [...new Set(records.map((record) => record.sector))].sort();
  const suppliers = [...new Set(records.map((record) => record.supplier))].sort();
  sectorFilter.innerHTML = '<option value="all">All sectors</option>' + sectors.map((s) => `<option value="${s}">${s}</option>`).join('');
  supplierFilter.innerHTML = '<option value="all">All suppliers</option>' + suppliers.map((s) => `<option value="${s}">${s}</option>`).join('');

  const boardMeshes = createHexBoard(scene);
  const territoryMeshes = createTerritoryPads(scene, records);
  const meshes = [];
  for (const record of records) {
    const mesh = createHexColumn({ height: Number(record.height_units) * COLUMN_HEIGHT_SCALE, radius: COLUMN_RADIUS, color: record.color });
    mesh.position.x = record.x;
    mesh.position.z = record.z;
    mesh.userData = record;
    scene.add(mesh);
    meshes.push(mesh);
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hoveredMesh = null;

  function applyFilters() {
    const selectedSector = sectorFilter.value;
    const selectedSupplier = supplierFilter.value;
    const searchText = accountSearch.value.trim().toLowerCase();
    let visibleCount = 0;

    for (const mesh of meshes) {
      const { sector, supplier, account_name: accountName } = mesh.userData;
      const sectorMatch = selectedSector === 'all' || sector === selectedSector;
      const supplierMatch = selectedSupplier === 'all' || supplier === selectedSupplier;
      const accountMatch = !searchText || accountName.toLowerCase().includes(searchText);
      mesh.visible = sectorMatch && supplierMatch && accountMatch;
      if (mesh.visible) {
        visibleCount += 1;
      }
    }

    if (hoveredMesh && !hoveredMesh.visible) {
      hoveredMesh.material.emissive.setHex(0x000000);
      hoveredMesh.material.emissiveIntensity = 0;
      hoveredMesh = null;
    }

    if (recordCount) {
      recordCount.textContent = `${visibleCount} / ${records.length} visible`;
    }
  }

  sectorFilter.addEventListener('change', applyFilters);
  supplierFilter.addEventListener('change', applyFilters);
  accountSearch.addEventListener('input', applyFilters);

  renderer.domElement.addEventListener('pointermove', (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(meshes.filter((mesh) => mesh.visible));

    if (hoveredMesh && (!intersects.length || intersects[0].object !== hoveredMesh)) {
      hoveredMesh.material.emissive.setHex(0x000000);
      hoveredMesh.material.emissiveIntensity = 0;
      hoveredMesh = null;
    }

    if (intersects.length) {
      hoveredMesh = intersects[0].object;
      hoveredMesh.material.emissive.setHex(THEME_TOKENS[currentTheme].hoverEmissive);
      hoveredMesh.material.emissiveIntensity = 0.45;
    }

    renderer.domElement.style.cursor = intersects.length > 0 ? 'pointer' : 'default';
  });

  renderer.domElement.addEventListener('click', (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(meshes.filter((mesh) => mesh.visible));
    if (!intersects.length) {
      return;
    }

    const data = intersects[0].object.userData;
    detailPanel.innerHTML = `
      <h3>${data.account_name}</h3>
      <p><strong>Sector:</strong> ${data.sector}</p>
      <p><strong>Supplier:</strong> ${data.supplier}</p>
      <p><strong>Normalized Value:</strong> ${currencyFormatter.format(Number(data.normalized_value || 0))}</p>
      <p><strong>Column Height:</strong> ${(Number(data.height_units) * COLUMN_HEIGHT_SCALE).toFixed(2)}</p>
      <p><strong>Value Source:</strong> ${data.value_source}</p>
      <p><strong>Idox Penetration:</strong> ${percentageFormatter.format(Number(data.idox_penetration || 0))}%</p>
    `;
  });

  detailPanel.innerHTML = `
    <h2>Account details</h2>
    <p class="hint">Click a hex column to inspect customer details.</p>
    <div class="summary-grid">
      <div><span>Total records</span><strong>${records.length}</strong></div>
      <div><span>Non-zero value</span><strong>${nonZeroRecords}</strong></div>
      <div><span>Total value</span><strong>${currencyFormatter.format(totalValue)}</strong></div>
      <div><span>Sectors</span><strong>${sectors.length}</strong></div>
    </div>
  `;
  applyFilters();

  function setTheme(theme) {
    const palette = THEME_TOKENS[theme] || THEME_TOKENS.dark;
    currentTheme = THEME_TOKENS[theme] ? theme : 'dark';
    scene.background.set(palette.sceneBackground);
    ambient.intensity = palette.ambientIntensity;
    directional.intensity = palette.directionalIntensity;

    for (const mesh of boardMeshes) {
      mesh.material.color.set(palette.boardTop);
      mesh.material.emissive.set(palette.boardEdge);
      mesh.material.emissiveIntensity = 0.16;
    }

    for (const mesh of territoryMeshes) {
      mesh.material.opacity = palette.territoryOpacity;
    }

    if (hoveredMesh) {
      hoveredMesh.material.emissive.setHex(palette.hoverEmissive);
      hoveredMesh.material.emissiveIntensity = 0.45;
    }
  }

  setTheme(currentTheme);

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
  return { setTheme };
}
