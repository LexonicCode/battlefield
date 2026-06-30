import './styles.css';
import { createBattlefieldScene } from './battlefield/scene.js';

const app = document.querySelector('#app');

app.innerHTML = `
  <header>
    <h1>Customer Battlefield Planner</h1>
  </header>
  <section class="layout">
    <div id="scene"></div>
    <aside id="details">
      <h2>Account details</h2>
      <p>Click a hex column to inspect customer details.</p>
    </aside>
  </section>
`;

createBattlefieldScene({
  container: document.querySelector('#scene'),
  detailPanel: document.querySelector('#details'),
});
