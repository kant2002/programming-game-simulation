import {
  advanceDay,
  createGame,
  getProjectSummary,
  presentToCustomer
} from "@it-company-game/game-core";

import "./styles.css";

const app = document.querySelector("#app");
let game = createGame();
let autoTimerId = null;

render();

function isAutoRunning() {
  return autoTimerId !== null;
}

function startAutoTime() {
  if (isAutoRunning() || game.project.status !== "active") {
    return;
  }

  autoTimerId = window.setInterval(() => {
    if (game.project.status !== "active") {
      render();
      return;
    }

    advanceDay(game);
    render();
  }, 1000);
}

function stopAutoTime() {
  if (autoTimerId === null) {
    return;
  }

  window.clearInterval(autoTimerId);
  autoTimerId = null;
}

function render() {
  const project = game.project;
  const summary = getProjectSummary(project);
  const presentation = project.presentation;
  const autoRunning = isAutoRunning();

  app.innerHTML = `
    <section class="hero">
      <div>
        <p class="eyebrow">Симулятор IT-компании</p>
        <h1>${project.name}</h1>
        <p class="lead">
          Вам пришел проект с рынка. Команда делает фичи, но скрытые ошибки и регрессии
          проявятся только на демонстрации заказчику.
        </p>
      </div>
      <div class="cash-card">
        <span>День ${game.day}</span>
        <strong>${formatMoney(game.cash)}</strong>
        <small>деньги компании</small>
      </div>
    </section>

    <section class="toolbar">
      <button data-action="new-project">Сгенерировать проект</button>
      ${autoRunning ? "" : `<button data-action="next-day" ${project.status !== "active" ? "disabled" : ""}>Следующий день</button>`}
      <button data-action="present" ${project.status !== "active" || summary.reportedDone === 0 ? "disabled" : ""}>
        Показать заказчику
      </button>
      <label class="auto-control ${autoRunning ? "active" : ""}">
        <input
          type="checkbox"
          data-action="auto-time"
          ${autoRunning ? "checked" : ""}
          ${project.status !== "active" ? "disabled" : ""}
        />
        <span>Автотечение времени</span>
        <small>1 секунда = 1 день</small>
      </label>
    </section>

    <section class="grid">
      <article class="panel">
        <h2>Проект</h2>
        <dl class="stats">
          <div>
            <dt>Фич</dt>
            <dd>${summary.totalFeatures}</dd>
          </div>
          <div>
            <dt>Готово</dt>
            <dd>${summary.reportedDone}</dd>
          </div>
          <div>
            <dt>Потенциал</dt>
            <dd>${formatMoney(summary.potentialValue)}</dd>
          </div>
          <div>
            <dt>Прогресс</dt>
            <dd>${summary.progressPercent}%</dd>
          </div>
        </dl>
        <div class="progress">
          <span style="width: ${summary.progressPercent}%"></span>
        </div>
        ${presentation ? renderPresentation(presentation) : ""}
      </article>

      <article class="panel">
        <h2>Программисты</h2>
        <div class="developers">
          ${game.developers.map(renderDeveloper).join("")}
        </div>
      </article>
    </section>

    <section class="panel">
      <h2>Требования</h2>
      <div class="features">
        ${project.features.map(renderFeature).join("")}
      </div>
    </section>

    <section class="panel">
      <h2>Журнал</h2>
      <ol class="event-log">
        ${game.eventLog.slice(-12).reverse().map((event) => `<li>${event.message}</li>`).join("")}
      </ol>
    </section>
  `;

  app.querySelector('[data-action="new-project"]').addEventListener("click", () => {
    game = createGame({
      day: game.day,
      cash: game.cash
    });
    render();
  });

  const nextDayButton = app.querySelector('[data-action="next-day"]');
  if (nextDayButton) {
    nextDayButton.addEventListener("click", () => {
      advanceDay(game);
      render();
    });
  }

  app.querySelector('[data-action="present"]').addEventListener("click", () => {
    presentToCustomer(game);
    render();
  });

  app.querySelector('[data-action="auto-time"]').addEventListener("change", (event) => {
    if (event.target.checked) {
      startAutoTime();
    } else {
      stopAutoTime();
    }

    render();
  });
}

function renderDeveloper(developer) {
  return `
    <div class="developer">
      <strong>${developer.name}</strong>
      <span>скорость ${developer.speed}</span>
      <span>надежность ${Math.round(developer.reliability * 100)}%</span>
    </div>
  `;
}

function renderFeature(feature) {
  const progressPercent = Math.round((feature.progress / feature.complexity) * 100);
  const status = feature.reportedDone ? "Готово" : "В работе";

  return `
    <article class="feature ${feature.reportedDone ? "done" : ""}">
      <div class="feature-header">
        <h3>${feature.name}</h3>
        <span>${status}</span>
      </div>
      <p>Сложность: ${feature.complexity} · Ценность: ${formatMoney(feature.customerValue)}</p>
      <div class="progress small">
        <span style="width: ${progressPercent}%"></span>
      </div>
    </article>
  `;
}

function renderPresentation(presentation) {
  return `
    <div class="presentation">
      <h3>Результат презентации</h3>
      <p>
        Проверено: ${presentation.checkedCount}.
        Прошло: ${presentation.passedCount}.
        Провалилось: ${presentation.failedCount}.
      </p>
      <strong>Выплата: ${formatMoney(presentation.earned)}</strong>
    </div>
  `;
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}
