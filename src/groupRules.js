export const GROUP_LIMITS = Object.freeze({
  owned: 3,
  members: 12,
  inviteDays: 7,
});

export function normalizeGroupInput(value = {}) {
  const name = String(value.name || "").trim().replace(/\s+/g, " ").slice(0, 60);
  const description = String(value.description || "").trim().replace(/\s+/g, " ").slice(0, 180);
  if (name.length < 2) return null;
  return { name, description };
}

export function normalizeInviteToken(value = "") {
  const token = String(value || "").trim();
  return /^[A-Za-z0-9_-]{24,128}$/.test(token) ? token : "";
}

export function normalizeGroupId(value = "") {
  const id = String(value || "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) ? id : "";
}

