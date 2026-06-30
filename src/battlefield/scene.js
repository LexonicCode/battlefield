import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createHexColumn } from './hexTile.js';

const ZONE_BASE_COLORS = {
  water: '#133a5e',
  energy: '#4a2f1c',
  fibre: '#2d2048',
  gas: '#3d3324',
  transport: '#1f3b2c',
};

function prettySupplierName(supplier) {
  if (supplier === 'ordnance_survey') return 'Ordnance Survey';
  if (supplier === 'esri') return 'ESRI';
  return supplier.charAt(0).toUpperCase() + supplier.slice(1);
}

export async function createBattlefieldScene({ container, detailPanel }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#151515');

  const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
  camera.position.set(0, 58, 74);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.set(0, 6, 0);
  controls.maxPolarAngle = Math.PI / 2.15;
  controls.minDistance = 35;
  controls.maxDistance = 130;

  scene.add(new THREE.AmbientLight('#ffffff', 0.5));
  const directional = new THREE.DirectionalLight('#fff7e6', 1.1);
  directional.position.set(-45, 80, 35);
  directional.castShadow = true;
  directional.shadow.mapSize.width = 2048;
  directional.shadow.mapSize.height = 2048;
  scene.add(directional);

  const table = new THREE.Mesh(
    new THREE.CylinderGeometry(95, 95, 3.2, 48),
    new THREE.MeshStandardMaterial({ color: '#3c2a1d', roughness: 0.95, metalness: 0.03 })
  );
  table.position.y = -1.75;
  table.receiveShadow = true;
  scene.add(table);

  const payload = await fetch('/data/customers.battlefield.json').then((r) => r.json());
  const records = payload.records;
  const layoutCells = payload.metadata?.grid?.cells ?? [];

  for (const cell of layoutCells) {
    const zoneColor = ZONE_BASE_COLORS[cell.zone] || '#334155';
    const tile = createHexColumn({
      radius: 0.98,
      height: 0.15,
      color: zoneColor,
      opacity: 0.95,
      roughness: 0.92,
      metalness: 0.02,
    });
    tile.position.x = cell.x;
    tile.position.z = cell.z;
    scene.add(tile);
  }

  const meshes = [];
  for (const record of records) {
    const mesh = createHexColumn({ radius: 0.9, height: record.height_units, color: record.color });
    mesh.position.x = record.x;
    mesh.position.z = record.z;
    mesh.userData = record;
    scene.add(mesh);
    meshes.push(mesh);
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  renderer.domElement.addEventListener('pointermove', (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(meshes);
    renderer.domElement.style.cursor = intersects.length > 0 ? 'pointer' : 'default';
  });

  renderer.domElement.addEventListener('click', (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(meshes);
    if (!intersects.length) {
      return;
    }

    const data = intersects[0].object.userData;
    detailPanel.innerHTML = `
      <h3>${data.account_name}</h3>
      <p><strong>Zone:</strong> ${data.sector_label}</p>
      <p><strong>Supplier:</strong> ${prettySupplierName(data.supplier)}</p>
      <p><strong>Current Annual Contract Value (ACV):</strong> £${Number(data.acv).toLocaleString()}</p>
      <p><strong>Height Units:</strong> ${data.height_units}</p>
      <p><strong>Value Source:</strong> ${data.value_source}</p>
      <p><strong>Idox Penetration:</strong> ${data.idox_penetration}</p>
    `;
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
