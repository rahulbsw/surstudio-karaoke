async function readJson(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || `SurStudio group request failed (${response.status}).`);
    error.code = body.code || "";
    error.status = response.status;
    throw error;
  }
  return body;
}

async function request(path, options = {}) {
  return readJson(await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: options.body ? { "Content-Type": "application/json", ...options.headers } : options.headers,
  }));
}

export function loadGroups() {
  return request("/api/groups");
}

export function loadGroup(groupId) {
  return request(`/api/groups/${encodeURIComponent(groupId)}`);
}

export function createGroup(input) {
  return request("/api/groups", { method: "POST", body: JSON.stringify(input) });
}

export function archiveGroup(groupId) {
  return request(`/api/groups/${encodeURIComponent(groupId)}`, { method: "DELETE" });
}

export function createGroupInvite(groupId) {
  return request(`/api/groups/${encodeURIComponent(groupId)}/invites`, { method: "POST" });
}

export function revokeGroupInvite(groupId, inviteId) {
  return request(`/api/groups/${encodeURIComponent(groupId)}/invites/${encodeURIComponent(inviteId)}`, { method: "DELETE" });
}

export function loadInvitePreview(token) {
  return request(`/api/group-invites/${encodeURIComponent(token)}`);
}

export function joinGroupInvite(token) {
  return request(`/api/group-invites/${encodeURIComponent(token)}/join`, { method: "POST" });
}

export function removeGroupMember(groupId, memberId) {
  return request(`/api/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(memberId)}`, { method: "DELETE" });
}

export function leaveGroup(groupId) {
  return request(`/api/groups/${encodeURIComponent(groupId)}/leave`, { method: "POST" });
}

export function makeInviteUrl(token, origin = typeof window !== "undefined" ? window.location.origin : "https://surstudio.datasierra.com") {
  const url = new URL("/", origin);
  url.searchParams.set("invite", token);
  return url.toString();
}

