import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createHexColumn } from './hexTile.js';

const currencyFormatter = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });
const percentageFormatter = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 });

export async function createBattlefieldScene({
  container,
  detailPanel,
  sectorFilter,
  supplierFilter,
  accountSearch,
  recordCount,
}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0f172a');

  const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
  camera.position.set(0, 40, 60);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI / 2.1;

  scene.add(new THREE.AmbientLight('#ffffff', 0.45));
  const directional = new THREE.DirectionalLight('#ffffff', 1.1);
  directional.position.set(20, 50, 20);
  scene.add(directional);

  const grid = new THREE.GridHelper(120, 40, '#334155', '#1e293b');
  scene.add(grid);

  const payload = await fetch('/data/customers.battlefield.json').then((r) => r.json());
  const records = payload.records;
  const totalValue = records.reduce((sum, record) => sum + Number(record.normalized_value || 0), 0);
  const nonZeroRecords = records.filter((record) => Number(record.normalized_value) > 0).length;

  const sectors = [...new Set(records.map((record) => record.sector))].sort();
  const suppliers = [...new Set(records.map((record) => record.supplier))].sort();
  sectorFilter.innerHTML = '<option value="all">All sectors</option>' + sectors.map((s) => `<option value="${s}">${s}</option>`).join('');
  supplierFilter.innerHTML = '<option value="all">All suppliers</option>' + suppliers.map((s) => `<option value="${s}">${s}</option>`).join('');

  const meshes = [];
  for (const record of records) {
    const mesh = createHexColumn({ height: record.height_units, color: record.color });
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
      hoveredMesh.material.emissiveIntensity = 1;
      hoveredMesh = null;
    }

    if (intersects.length) {
      hoveredMesh = intersects[0].object;
      hoveredMesh.material.emissive.setHex(0x1d4ed8);
      hoveredMesh.material.emissiveIntensity = 0.5;
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
      <p><strong>Height Units:</strong> ${data.height_units}</p>
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
