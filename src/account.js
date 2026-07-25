const EMPTY_ACCOUNT = {
  authenticated: false,
  authConfigured: false,
  databaseConfigured: false,
  scoreSyncAvailable: false,
  groupsAvailable: false,
  user: null,
};

async function readJson(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `SurStudio account request failed (${response.status}).`);
  return body;
}

export async function loadAccount() {
  try {
    return { ...EMPTY_ACCOUNT, ...await readJson(await fetch("/api/account", { credentials: "same-origin" })) };
  } catch {
    return EMPTY_ACCOUNT;
  }
}

export async function loadRemoteScores() {
  const body = await readJson(await fetch("/api/scores", { credentials: "same-origin" }));
  return Array.isArray(body.scores) ? body.scores : [];
}

export async function saveRemoteScore(take) {
  const body = await readJson(await fetch("/api/scores", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(take),
  }));
  return body.score;
}

export function mergeScores(localScores = [], remoteScores = [], limit = 100) {
  const byId = new Map();
  for (const score of localScores) {
    if (score?.id) byId.set(score.id, score);
  }
  for (const score of remoteScores) {
    if (score?.id) byId.set(score.id, { ...byId.get(score.id), ...score, synced: true });
  }
  return [...byId.values()]
    .sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0))
    .slice(0, limit);
}

async function submitAuthAction(action, provider = "") {
  const csrf = await readJson(await fetch("/api/auth/csrf", { credentials: "same-origin" }));
  const form = document.createElement("form");
  form.method = "POST";
  form.action = `/api/auth/${action}${provider ? `/${provider}` : ""}`;

  const fields = {
    csrfToken: csrf.csrfToken,
    callbackUrl: window.location.href,
  };
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}

export function beginGoogleSignIn() {
  return submitAuthAction("signin", "google");
}

export function beginSignOut() {
  return submitAuthAction("signout");
}
