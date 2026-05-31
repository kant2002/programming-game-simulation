import {
  advanceDay,
  canCollectPayment,
  collectPayment,
  createGame,
  formatGameDay,
  getProjectSummary,
  presentToCustomer
} from "@it-company-game/game-core";

import "./styles.css";

const app = document.querySelector("#app");
let game = createGame();
let autoTimerId = null;

startAutoTime();
render();

function isAutoRunning() {
  return autoTimerId !== null;
}

function startAutoTime() {
  if (isAutoRunning()) {
    return;
  }

  autoTimerId = window.setInterval(() => {
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
  const payment = project.payment;
  const autoRunning = isAutoRunning();
  const paymentAvailable = canCollectPayment(game);

  app.innerHTML = `
    <section class="hero">
      <div>
        <p class="eyebrow">Симулятор IT-компании</p>
        <h1>${project.name}</h1>
        <p class="lead">
          Вам пришел проект с рынка. Заказчик: <strong>${project.customer.companyName}</strong>. Команда делает фичи, но скрытые ошибки и регрессии
          проявятся только на демонстрации заказчику.
        </p>
      </div>
      <div class="cash-card">
        <span>${formatGameDay(game.day)}</span>
        <strong>${formatMoney(game.cash)}</strong>
        <small>деньги компании</small>
      </div>
    </section>

    <section class="toolbar">
      <button data-action="new-project">Найти новый проект</button>
      ${autoRunning ? "" : `<button data-action="next-day">Следующий день</button>`}
      <button data-action="present" ${project.status !== "active" || summary.reportedDone === 0 ? "disabled" : ""}>
        Показать заказчику
      </button>
      <button data-action="collect-payment" ${paymentAvailable ? "" : "disabled"}>
        Получить оплату
      </button>
      <label class="auto-control ${autoRunning ? "active" : ""}">
        <input
          type="checkbox"
          data-action="auto-time"
          ${autoRunning ? "checked" : ""}
        />
        <span>Автотечение времени</span>
        <small>1 секунда = 1 день</small>
      </label>
    </section>

    <section class="grid">
      <article class="panel">
        <h2>${project.name} / ${project.customer.companyName}</h2>
        <dl class="stats">
          <div>
            <dt title="Отношение к вашей компании: ${summary.customerRelationshipValue}">Отношение</dt>
            <dd title="Отношение к вашей компании: \nужасное - клиент готов разорвать контракт\nраздраженное - клиент раздражен вашей компанией\nнейтральное - клиент нейтрален к вашей компании\nдовольное - клиент доволен работой с вами">${summary.customerRelationship}</dd>
          </div>
          <div>
            <dt>Фич / Готово</dt>
            <dd>${summary.totalFeatures} / ${summary.reportedDone}</dd>
          </div>
          <div>
            <dt>Контракт</dt>
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
        ${project.status === "failed" ? renderProjectFailed() : ""}
        ${payment ? renderPayment(payment) : ""}
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

    ${game.successLog?.length ? renderSuccessLog(game.successLog) : ""}
  `;

  app.querySelector('[data-action="new-project"]').addEventListener("click", () => {
    game = createGame({
      day: game.day,
      cash: game.cash,
      successLog: game.successLog
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

  app.querySelector('[data-action="collect-payment"]').addEventListener("click", () => {
    collectPayment(game);
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
    <div class="developer flex">
      <strong class="flex-grow-2">${developer.name}</strong>
      <span class="flex-grow" title="Скорость разработки">С: ${developer.speed}</span>
      <span class="flex-grow" title="Надежность разработки">Н: ${Math.round(developer.reliability * 100)}%</span>
      <span class="flex-grow-2" title="Зарплата разработчика">ЗП: ${formatMoney(developer.salary ?? 0)}/мес</span>
    </div>
  `;
}

function renderFeature(feature) {
  const progressPercent = Math.round((feature.progress / feature.complexity) * 100);
  const needsFix = !feature.reportedDone && feature.progress >= feature.complexity;
  const status = feature.reportedDone ? "Готово" : needsFix ? "Нужны исправления" : "В работе";

  return `
    <article class="feature ${feature.reportedDone ? "done" : ""} ${needsFix ? "needs-fix" : ""}">
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

function renderProjectFailed() {
  return `
    <div class="presentation">
      <h3>Контракт расторгнут</h3>
      <p>Заказчик потерял терпение. Оплата не будет выплачена.</p>
    </div>
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
      <p>Ошибочные фичи возвращены в работу. Оплата доступна только когда все фичи готовы.</p>
    </div>
  `;
}

function renderSuccessLog(successLog) {
  return `
    <section class="panel">
      <h2>Лог успехов</h2>
      <ol class="success-log">
        ${successLog
          .slice()
          .reverse()
          .map((entry) => `<li>${formatGameDay(entry.day)}: ${formatMoney(entry.cash)}</li>`)
          .join("")}
      </ol>
    </section>
  `;
}

function renderPayment(payment) {
  return `
    <div class="payment">
      <h3>Оплата получена</h3>
      <p>${formatGameDay(payment.day)}</p>
      <strong>${formatMoney(payment.amount)}</strong>
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
