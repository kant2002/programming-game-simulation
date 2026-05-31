import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceDay,
  canCollectPayment,
  collectPayment,
  createGame,
  DEFAULT_COMPANY_SETTINGS,
  formatGameDay,
  generateProject,
  getCustomerRelationshipLabel,
  parseGameDay,
  presentToCustomer
} from "../src/index.js";

test("generateProject creates features with complexity and customer value", () => {
  const project = generateProject({
    seed: "ignored",
    random: () => 0.4,
    featureCount: 20
  });

  assert.equal(project.features.length, 20);
  assert.equal(project.status, "active");
  assert.ok(project.customer.companyName.length > 0);
  assert.ok(project.basePrice > 0);
  assert.ok(project.potentialValue >= project.basePrice);

  for (const feature of project.features) {
    assert.ok(feature.complexity >= 3);
    assert.ok(feature.complexity <= 10);
    assert.ok(feature.customerValue > 0);
    assert.equal(feature.reportedDone, false);
    assert.equal(feature.actuallyWorks, false);
  }
});

test("generateProject creates a random customer company name", () => {
  const project = generateProject({
    random: () => 0,
    featureCount: 1
  });

  assert.equal(project.customer.companyName, "Northern Logistics LLC");
  assert.equal(project.customer.relationship, 100);
});

test("advanceDay adds progress and marks completed features as reported done", () => {
  const game = createGame({
    seed: "progress",
    project: {
      featureCount: 1
    },
    developers: [
      {
        id: "fast-dev",
        name: "Fast Dev",
        speed: 20,
        reliability: 1,
        regressionChance: 0
      }
    ]
  });

  const feature = game.project.features[0];

  advanceDay(game);

  assert.equal(feature.progress, feature.complexity);
  assert.equal(feature.reportedDone, true);
  assert.equal(feature.actuallyWorks, true);
});

test("advanceDay can silently break an older working feature", () => {
  const randomValues = [0, 0, 0, 0];
  const game = {
    day: 1,
    developers: [
      {
        id: "risky-dev",
        name: "Risky Dev",
        speed: 2,
        reliability: 1,
        regressionChance: 1
      }
    ],
    project: {
      status: "active",
      customer: {
        companyName: "Test Corp",
        relationship: 20
      },
      features: [
        {
          id: "feature-1",
          name: "Existing Login",
          complexity: 1,
          customerValue: 100,
          progress: 1,
          reportedDone: true,
          actuallyWorks: true
        },
        {
          id: "feature-2",
          name: "New Dashboard",
          complexity: 1,
          customerValue: 200,
          progress: 0,
          reportedDone: false,
          actuallyWorks: false
        }
      ]
    },
    eventLog: [],
    _random: () => randomValues.shift() ?? 0
  };

  const { events } = advanceDay(game);

  assert.equal(game.project.features[0].reportedDone, true);
  assert.equal(game.project.features[0].actuallyWorks, false);
  assert.ok(events.some((event) => event.type === "possible-regression"));
});

test("presentToCustomer checks reported features without collecting payment", () => {
  const game = {
    day: 3,
    cash: 0,
    developers: [],
    project: {
      status: "active",
      potentialValue: 1500,
      features: [
        {
          id: "feature-1",
          name: "Working Feature",
          complexity: 1,
          customerValue: 300,
          progress: 1,
          reportedDone: true,
          actuallyWorks: true
        },
        {
          id: "feature-2",
          name: "Broken Feature",
          complexity: 1,
          customerValue: 500,
          progress: 1,
          reportedDone: true,
          actuallyWorks: false
        },
        {
          id: "feature-3",
          name: "Unfinished Feature",
          complexity: 1,
          customerValue: 700,
          progress: 0,
          reportedDone: false,
          actuallyWorks: false
        }
      ],
      presentation: null
    },
    eventLog: [],
    _random: () => 0
  };

  const { result } = presentToCustomer(game, { checkCount: 2 });

  assert.equal(result.checkedCount, 2);
  assert.equal(result.passedCount, 1);
  assert.equal(result.failedCount, 1);
  assert.equal(game.cash, 0);
  assert.equal(game.project.status, "active");
  assert.equal(game.project.features[0].reportedDone, true);
  assert.equal(game.project.features[1].reportedDone, false);
});

test("collectPayment is available only when all features are ready", () => {
  const game = {
    day: 5,
    cash: 100,
    developers: [],
    project: {
      status: "active",
      potentialValue: 800,
      features: [
        {
          id: "feature-1",
          name: "Ready Feature",
          complexity: 1,
          customerValue: 300,
          progress: 1,
          reportedDone: true,
          actuallyWorks: true
        },
        {
          id: "feature-2",
          name: "Not Ready Feature",
          complexity: 1,
          customerValue: 500,
          progress: 1,
          reportedDone: false,
          actuallyWorks: true
        }
      ],
      presentation: null,
      payment: null
    },
    eventLog: []
  };

  assert.equal(canCollectPayment(game), false);
  assert.throws(() => collectPayment(game), /all features are ready/);

  game.project.features[1].reportedDone = true;
  const { payment } = collectPayment(game);

  assert.equal(payment.amount, 800);
  assert.equal(game.cash, 900);
  assert.equal(game.project.status, "completed");
  assert.equal(canCollectPayment(game), false);
});

test("createGame stores company settings and preserves them across new projects", () => {
  const game = createGame({
    companySettings: {
      makeInternalSpecification: false
    }
  });

  assert.deepEqual(game.companySettings, {
    makeInternalSpecification: false
  });

  const nextGame = createGame({
    day: game.day,
    cash: game.cash,
    companySettings: game.companySettings
  });

  assert.deepEqual(nextGame.companySettings, {
    makeInternalSpecification: false
  });
  assert.deepEqual(DEFAULT_COMPANY_SETTINGS, {
    makeInternalSpecification: false
  });
});

test("parseGameDay converts absolute days into year, month, and day", () => {
  assert.deepEqual(parseGameDay(1), { year: 1, month: 1, day: 1 });
  assert.deepEqual(parseGameDay(30), { year: 1, month: 1, day: 30 });
  assert.deepEqual(parseGameDay(31), { year: 1, month: 2, day: 1 });
  assert.deepEqual(parseGameDay(360), { year: 1, month: 12, day: 30 });
  assert.deepEqual(parseGameDay(361), { year: 2, month: 1, day: 1 });
});

test("formatGameDay omits year and month labels for early game dates", () => {
  assert.equal(formatGameDay(1), "День 1");
  assert.equal(formatGameDay(15), "День 15");
  assert.equal(formatGameDay(31), "Месяц 2, День 1");
  assert.equal(formatGameDay(360), "Месяц 12, День 30");
  assert.equal(formatGameDay(361), "Год 2, Месяц 1, День 1");
});

test("advanceDay records company budget in success log every 360 days", () => {
  const game = createGame({
    seed: "budget-snapshot",
    cash: 15000,
    day: 359,
    project: {
      featureCount: 1
    },
    developers: [
      {
        id: "dev-1",
        name: "Dev",
        speed: 0,
        reliability: 1,
        regressionChance: 0,
        salary: 0
      }
    ]
  });

  assert.deepEqual(game.successLog, []);

  advanceDay(game);

  assert.equal(game.day, 360);
  assert.deepEqual(game.successLog, [{ day: 360, cash: 15000 }]);

  advanceDay(game);

  assert.equal(game.day, 361);
  assert.deepEqual(game.successLog, [{ day: 360, cash: 15000 }]);
});

test("advanceDay advances time and pays salaries without an active project", () => {
  const game = createGame({
    cash: 10000,
    day: 29,
    project: {
      featureCount: 1
    },
    developers: [
      {
        id: "dev-1",
        name: "Dev",
        speed: 0,
        reliability: 1,
        regressionChance: 0,
        salary: 1500
      }
    ]
  });

  game.project.status = "completed";
  game.project.customer.relationship = 50;

  const { events } = advanceDay(game);

  assert.equal(game.day, 30);
  assert.equal(game.cash, 8500);
  assert.equal(game.project.status, "completed");
  assert.equal(game.project.customer.relationship, 50);
  assert.ok(events.some((event) => event.type === "salary-paid"));
  assert.equal(events.some((event) => event.type === "feature-progress"), false);
});

test("advanceDay deducts developer salaries every 30 days", () => {
  const game = createGame({
    seed: "payroll",
    cash: 10000,
    day: 29,
    project: {
      featureCount: 1
    },
    developers: [
      {
        id: "dev-1",
        name: "Аня",
        speed: 1,
        reliability: 1,
        regressionChance: 0,
        salary: 1500
      },
      {
        id: "dev-2",
        name: "Борис",
        speed: 1,
        reliability: 1,
        regressionChance: 0,
        salary: 1200
      }
    ]
  });

  const { events } = advanceDay(game);

  assert.equal(game.day, 30);
  assert.equal(game.cash, 7300);
  assert.ok(events.some((event) => event.type === "salary-paid" && event.total === 2700));

  advanceDay(game);
  assert.equal(game.day, 31);
  assert.equal(game.cash, 7300);
});

test("advanceDay ends project when customer relationship drops below zero", () => {
  const game = createGame({
    project: {
      featureCount: 1,
      customer: {
        companyName: "Test Corp",
        relationship: 1
      }
    },
    developers: [
      {
        id: "dev-1",
        name: "Dev",
        speed: 0,
        reliability: 1,
        regressionChance: 0,
        salary: 0
      }
    ]
  });

  advanceDay(game);

  assert.equal(game.project.customer.relationship, 0);
  assert.equal(game.project.status, "active");

  const { events } = advanceDay(game);

  assert.equal(game.project.customer.relationship, -1);
  assert.equal(game.project.status, "failed");
  assert.equal(game.project.payment, null);
  assert.equal(canCollectPayment(game), false);
  assert.ok(events.some((event) => event.type === "project-failed"));
});

test("getCustomerRelationshipLabel maps relationship levels to text", () => {
  assert.equal(getCustomerRelationshipLabel(20), "ужасное");
  assert.equal(getCustomerRelationshipLabel(0), "ужасное");
  assert.equal(getCustomerRelationshipLabel(-1), "ужасное");
  assert.equal(getCustomerRelationshipLabel(21), "раздраженное");
  assert.equal(getCustomerRelationshipLabel(60), "раздраженное");
  assert.equal(getCustomerRelationshipLabel(61), "нейтральное");
  assert.equal(getCustomerRelationshipLabel(100), "нейтральное");
  assert.equal(getCustomerRelationshipLabel(101), "довольное");
  assert.equal(getCustomerRelationshipLabel(120), "довольное");
});
