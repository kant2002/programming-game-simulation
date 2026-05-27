import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceDay,
  canCollectPayment,
  collectPayment,
  createGame,
  generateProject,
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
