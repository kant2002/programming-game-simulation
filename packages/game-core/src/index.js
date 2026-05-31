const FEATURE_NOUNS = [
  "Login",
  "Dashboard",
  "Notifications",
  "Billing",
  "Reports",
  "Search",
  "API",
  "Import",
  "Export",
  "Permissions",
  "Chat",
  "Analytics",
  "Mobile View",
  "Audit Log",
  "Settings",
  "Onboarding",
  "Calendar",
  "Kanban Board",
  "File Storage",
  "Integrations"
];

const FEATURE_SUFFIXES = [
  "MVP",
  "V2",
  "Admin Flow",
  "Client Flow",
  "Automation",
  "Validation",
  "Prototype",
  "Integration"
];

const CUSTOMER_PREFIXES = [
  "Northern",
  "Bright",
  "Global",
  "Prime",
  "Silver",
  "Vertex",
  "Atlas",
  "Summit",
  "Horizon",
  "Metro",
  "Apex",
  "Civic"
];

const CUSTOMER_STEMS = [
  "Logistics",
  "Retail",
  "Systems",
  "Digital",
  "Partners",
  "Solutions",
  "Industries",
  "Commerce",
  "Capital",
  "Health",
  "Energy",
  "Media"
];

const CUSTOMER_SUFFIXES = ["LLC", "Group", "Inc", "Holdings", "Corp"];

export const SALARY_PAYDAY_INTERVAL = 30;
export const BUDGET_SNAPSHOT_INTERVAL = 360;
export const DAYS_PER_MONTH = 30;
export const DAYS_PER_YEAR = 360;
export const DEFAULT_CUSTOMER_RELATIONSHIP = 100;

export const DEFAULT_COMPANY_SETTINGS = {
  makeInternalSpecification: false
};

export function parseGameDay(day) {
  const dayIndex = day - 1;
  const dayInYear = dayIndex % DAYS_PER_YEAR;
  const year = Math.floor(dayIndex / DAYS_PER_YEAR) + 1;
  const month = Math.floor(dayInYear / DAYS_PER_MONTH) + 1;
  const dayOfMonth = (dayInYear % DAYS_PER_MONTH) + 1;

  return {
    year,
    month,
    day: dayOfMonth
  };
}

export function formatGameDay(day) {
  const { year, month, day: dayOfMonth } = parseGameDay(day);

  if (year !== 1) {
    return `Год ${year}, Месяц ${month}, День ${dayOfMonth}`;
  }

  if (month !== 1) {
    return `Месяц ${month}, День ${dayOfMonth}`;
  }

  return `День ${dayOfMonth}`;
}

export const DEFAULT_DEVELOPERS = [
  {
    id: "dev-1",
    name: "Аня",
    speed: 2.2,
    reliability: 0.86,
    regressionChance: 0.07,
    salary: 1500
  },
  {
    id: "dev-2",
    name: "Борис",
    speed: 1.7,
    reliability: 0.78,
    regressionChance: 0.11,
    salary: 1200
  }
];

export function createSeededRandom(seed = Date.now()) {
  let value = hashSeed(seed);

  return () => {
    value |= 0;
    value = (value + 0x6d2b79f5) | 0;
    let result = Math.imul(value ^ (value >>> 15), 1 | value);
    result = (result + Math.imul(result ^ (result >>> 7), 61 | result)) ^ result;
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

export function createGame(options = {}) {
  const random = getRandom(options);
  const project = generateProject({
    random,
    ...options.project
  });

  return {
    day: options.day ?? 1,
    cash: options.cash ?? 20_000,
    developers: cloneDevelopers(options.developers ?? DEFAULT_DEVELOPERS),
    project,
    eventLog: [
      {
        type: "project-created",
        message: `Получен проект "${project.name}" от ${project.customer.companyName} на ${project.features.length} фич.`
      }
    ],
    successLog: options.successLog ? [...options.successLog] : [],
    companySettings: normalizeCompanySettings(options.companySettings),
    _random: random
  };
}

export function generateProject(options = {}) {
  const random = options.random ?? Math.random;
  const minFeatures = options.minFeatures ?? 12;
  const maxFeatures = options.maxFeatures ?? 20;
  const featureCount = options.featureCount ?? randomInt(random, minFeatures, maxFeatures);
  const features = Array.from({ length: featureCount }, (_, index) =>
    createFeature(index + 1, random)
  );
  const totalCustomerValue = sum(features.map((feature) => feature.customerValue));

  return {
    id: options.id ?? `project-${randomInt(random, 1000, 9999)}`,
    name: options.name ?? createProjectName(random),
    customer: {
      companyName: options.customer?.companyName ?? createCustomerCompanyName(random),
      relationship: options.customer?.relationship ?? DEFAULT_CUSTOMER_RELATIONSHIP
    },
    status: "active",
    basePrice: Math.round(totalCustomerValue * 0.65),
    potentialValue: totalCustomerValue,
    features,
    presentation: null,
    payment: null
  };
}

export function advanceDay(game, options = {}) {
  const random = getGameRandom(game, options);
  const events = [];
  const hasActiveProject = isActiveProject(game);

  if (hasActiveProject) {
    for (const developer of game.developers) {
      const feature = chooseFeatureForWork(game.project, options.featureId);

      if (!feature) {
        events.push({
          type: "idle",
          message: `${developer.name} не нашел доступных задач.`
        });
        continue;
      }

      const previousProgress = feature.progress;
      const effort = roundToOne(developer.speed * randomFloat(random, 0.75, 1.25));
      feature.progress = roundToOne(Math.min(feature.complexity, feature.progress + effort));

      events.push({
        type: "feature-progress",
        developerId: developer.id,
        featureId: feature.id,
        progressAdded: roundToOne(feature.progress - previousProgress),
        message: `${developer.name} работал над "${feature.name}".`
      });

      if (feature.progress >= feature.complexity && !feature.reportedDone) {
        finishFeature(feature, developer, random);
        events.push({
          type: "feature-reported-done",
          developerId: developer.id,
          featureId: feature.id,
          message: `${developer.name} отметил "${feature.name}" как готовую.`
        });
      }

      const regression = maybeBreakExistingFeature(game.project, feature, developer, random);
      if (regression) {
        events.push({
          type: "possible-regression",
          developerId: developer.id,
          featureId: regression.id,
          message: `После изменений в проекте могла пострадать связанная функциональность. Команда этого не заметила.`
        });
      }
    }
  }

  game.day += 1;

  if (game.day % SALARY_PAYDAY_INTERVAL === 0) {
    const payrollEvent = paySalaries(game);
    events.push(payrollEvent);
  }

  if (game.day % BUDGET_SNAPSHOT_INTERVAL === 0) {
    recordBudgetSnapshot(game);
  }

  if (hasActiveProject) {
    decreaseCustomerRelationship(game);

    if (game.project.customer.relationship < 0) {
      events.push(failProjectDueToRelationship(game));
    }
  }

  game.eventLog.push(...events);
  return {
    game,
    events
  };
}

export function presentToCustomer(game, options = {}) {
  assertActiveProject(game);

  const random = getGameRandom(game, options);
  const readyFeatures = game.project.features.filter((feature) => feature.reportedDone);
  const checkCount = Math.min(options.checkCount ?? 5, readyFeatures.length);
  const checkedFeatures = shuffle([...readyFeatures], random).slice(0, checkCount);
  const checks = checkedFeatures.map((feature) => ({
    featureId: feature.id,
    featureName: feature.name,
    passed: feature.actuallyWorks,
    customerValue: feature.customerValue
  }));
  const failed = checks.filter((check) => !check.passed).length;

  for (const check of checks) {
    if (!check.passed) {
      const feature = game.project.features.find((item) => item.id === check.featureId);
      feature.reportedDone = false;
    }
  }

  game.project.presentation = {
    checkedCount: checks.length,
    passedCount: checks.length - failed,
    failedCount: failed,
    checks
  };

  const customerName = game.project.customer?.companyName ?? "Заказчик";
  const event = {
    type: "presentation",
    message: `${customerName} проверил ${checks.length} фич: прошло ${checks.length - failed}, провалилось ${failed}. Ошибочные фичи возвращены в работу.`
  };
  game.eventLog.push(event);

  return {
    game,
    result: game.project.presentation,
    events: [event]
  };
}

export function canCollectPayment(game) {
  return Boolean(
    game?.project &&
      game.project.status === "active" &&
      game.project.features.length > 0 &&
      game.project.features.every((feature) => feature.reportedDone)
  );
}

export function collectPayment(game) {
  if (!canCollectPayment(game)) {
    throw new Error("Payment can be collected only when all features are ready.");
  }

  const amount = game.project.potentialValue;
  game.cash += amount;
  game.project.status = "completed";
  game.project.payment = {
    amount,
    day: game.day
  };

  const event = {
    type: "payment-collected",
    amount,
    message: `Проект принят полностью. Получена оплата: ${amount}.`
  };
  game.eventLog.push(event);

  return {
    game,
    payment: game.project.payment,
    events: [event]
  };
}

export function getCustomerRelationshipLabel(relationship) {
  if (relationship <= 20) {
    return "ужасное";
  }

  if (relationship <= 60) {
    return "раздраженное";
  }

  if (relationship <= 100) {
    return "нейтральное";
  }

  return "довольное";
}

export function getProjectSummary(project) {
  const reportedDone = project.features.filter((feature) => feature.reportedDone).length;
  const visibleProgress = sum(project.features.map((feature) => feature.progress));
  const totalComplexity = sum(project.features.map((feature) => feature.complexity));

  return {
    totalFeatures: project.features.length,
    reportedDone,
    visibleProgress,
    totalComplexity,
    progressPercent: totalComplexity === 0 ? 0 : Math.round((visibleProgress / totalComplexity) * 100),
    allFeaturesReady: project.features.length > 0 && reportedDone === project.features.length,
    potentialValue: project.potentialValue,
    customerRelationship: getCustomerRelationshipLabel(project.customer.relationship),
    customerRelationshipValue: project.customer.relationship
  };
}

function createFeature(index, random) {
  const complexity = randomInt(random, 3, 10);
  const valueMultiplier = randomInt(random, 120, 240);

  return {
    id: `feature-${index}`,
    name: `${pick(FEATURE_NOUNS, random)} ${pick(FEATURE_SUFFIXES, random)}`,
    complexity,
    customerValue: complexity * valueMultiplier,
    progress: 0,
    reportedDone: false,
    actuallyWorks: false
  };
}

function finishFeature(feature, developer, random) {
  const complexityPenalty = Math.max(0, (feature.complexity - 5) * 0.015);
  const successChance = clamp(developer.reliability - complexityPenalty, 0.1, 0.98);

  feature.reportedDone = true;
  feature.actuallyWorks = random() <= successChance;
}

function maybeBreakExistingFeature(project, currentFeature, developer, random) {
  const candidates = project.features.filter(
    (feature) => feature.id !== currentFeature.id && feature.reportedDone && feature.actuallyWorks
  );

  if (candidates.length === 0) {
    return null;
  }

  const chance = clamp(developer.regressionChance + (1 - developer.reliability) * 0.04, 0, 0.6);
  if (random() > chance) {
    return null;
  }

  const brokenFeature = pick(candidates, random);
  brokenFeature.actuallyWorks = false;
  return brokenFeature;
}

function chooseFeatureForWork(project, forcedFeatureId) {
  if (forcedFeatureId) {
    const forced = project.features.find((feature) => feature.id === forcedFeatureId);
    if (forced && !forced.reportedDone) {
      return forced;
    }
  }

  return project.features
    .filter((feature) => !feature.reportedDone)
    .sort((left, right) => {
      if (left.progress !== right.progress) {
        return right.progress - left.progress;
      }

      return left.complexity - right.complexity;
    })[0];
}

function createProjectName(random) {
  const clients = ["Retail", "Logistics", "Fintech", "Medtech", "Edtech", "Factory"];
  const products = ["Portal", "Platform", "CRM", "Backoffice", "Marketplace", "Control Center"];
  return `${pick(clients, random)} ${pick(products, random)}`;
}

function createCustomerCompanyName(random) {
  return `${pick(CUSTOMER_PREFIXES, random)} ${pick(CUSTOMER_STEMS, random)} ${pick(CUSTOMER_SUFFIXES, random)}`;
}

function getRandom(options) {
  if (options.random) {
    return options.random;
  }

  if (options.seed !== undefined) {
    return createSeededRandom(options.seed);
  }

  return Math.random;
}

function getGameRandom(game, options) {
  if (options.random) {
    return options.random;
  }

  if (game._random) {
    return game._random;
  }

  return Math.random;
}

function isActiveProject(game) {
  return Boolean(game?.project && game.project.status === "active");
}

function assertActiveProject(game) {
  if (!game?.project || game.project.status !== "active") {
    throw new Error("Project is not active.");
  }
}

function normalizeCompanySettings(settings) {
  return {
    makeInternalSpecification:
      settings?.makeInternalSpecification ?? DEFAULT_COMPANY_SETTINGS.makeInternalSpecification
  };
}

function cloneDevelopers(developers) {
  return developers.map((developer) => ({ ...developer }));
}

function recordBudgetSnapshot(game) {
  if (!game.successLog) {
    game.successLog = [];
  }

  game.successLog.push({
    day: game.day,
    cash: game.cash
  });
}

function paySalaries(game) {
  const payments = game.developers.map((developer) => ({
    developerId: developer.id,
    developerName: developer.name,
    amount: developer.salary ?? 0
  }));
  const total = sum(payments.map((payment) => payment.amount));

  game.cash -= total;

  return {
    type: "salary-paid",
    day: game.day,
    total,
    payments,
    message: `Выплачена зарплата команде: ${total}.`
  };
}

function decreaseCustomerRelationship(game) {
  game.project.customer.relationship -= 1;
}

function failProjectDueToRelationship(game) {
  const customerName = game.project.customer.companyName;

  game.project.status = "failed";
  game.project.payment = null;

  return {
    type: "project-failed",
    message: `${customerName} разорвал контракт. Отношение упало ниже нуля — оплата не выплачивается.`
  };
}

function hashSeed(seed) {
  const text = String(seed);
  let hash = 1779033703 ^ text.length;

  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }

  return hash >>> 0;
}

function pick(items, random) {
  return items[Math.floor(random() * items.length)];
}

function randomInt(random, min, max) {
  return Math.floor(random() * (max - min + 1)) + min;
}

function randomFloat(random, min, max) {
  return random() * (max - min) + min;
}

function roundToOne(value) {
  return Math.round(value * 10) / 10;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function shuffle(items, random) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }

  return items;
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}
