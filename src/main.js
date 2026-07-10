import './styles.css';
import { createBattlefieldScene } from './app/render/scene.js';
import { GRID_CONFIG } from './app/config.js';

const app = document.querySelector('#app');

app.innerHTML = `
  <header>
    <h1>Utility Account Battlefield</h1>
    <p class="subtitle">Clean 3D account landscape with dynamic clustering and filters</p>
  </header>
  <section class="layout">
    <div id="scene"></div>
    <aside class="panel">
      <h2>View controls</h2>
      <div class="controls">
        <label>
          Cluster by
          <select id="clusterBy"></select>
        </label>
        <label>
          Filter value
          <select id="filterValue"></select>
        </label>
      </div>
      <h2>Legend</h2>
      <div id="legend"></div>
      <h2>Dataset</h2>
      <p id="stats"></p>
      <p><strong>Grid:</strong> target ${GRID_CONFIG.targetCellsPerAxis} × ${GRID_CONFIG.targetCellsPerAxis}, cellSize ${GRID_CONFIG.cellSize}, gap ${GRID_CONFIG.cellGap}, columnWidth ${GRID_CONFIG.columnWidth}</p>
      <p>Hover a column for details. Click to pin tooltip. Press Esc to clear.</p>
      <p><a href="/api/logout">Logout</a></p>
    </aside>
  </section>
  <div id="tooltip" role="status" aria-live="polite"></div>
`;

createBattlefieldScene({
  container: document.querySelector('#scene'),
  legend: document.querySelector('#legend'),
  tooltip: document.querySelector('#tooltip'),
  stats: document.querySelector('#stats'),
  clusterBy: document.querySelector('#clusterBy'),
  filterValue: document.querySelector('#filterValue'),
});
