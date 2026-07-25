import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArrowRight,
  CalendarDays,
  Check,
  Copy,
  Crown,
  Link2,
  LoaderCircle,
  LockKeyhole,
  LogIn,
  LogOut,
  Mic2,
  Plus,
  RefreshCw,
  Share2,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { beginGoogleSignIn } from "./account.js";
import { GROUP_LIMITS } from "./groupRules.js";
import {
  archiveGroup,
  createGroup,
  createGroupInvite,
  joinGroupInvite,
  leaveGroup,
  loadGroup,
  loadGroups,
  loadInvitePreview,
  makeInviteUrl,
  removeGroupMember,
  revokeGroupInvite,
} from "./groups.js";

const PREVIEW_GROUP_ID = "550e8400-e29b-41d4-a716-446655440000";
const PREVIEW_MEMBERS = [
  { id: "preview-rahul", name: "Rahul", role: "owner", joinedAt: "2026-07-01T00:00:00.000Z", isCurrentUser: true },
  { id: "preview-priya", name: "Priya", role: "member", joinedAt: "2026-07-03T00:00:00.000Z" },
  { id: "preview-arjun", name: "Arjun", role: "member", joinedAt: "2026-07-05T00:00:00.000Z" },
  { id: "preview-meera", name: "Meera", role: "member", joinedAt: "2026-07-06T00:00:00.000Z" },
  { id: "preview-kabir", name: "Kabir", role: "member", joinedAt: "2026-07-08T00:00:00.000Z" },
];
const PREVIEW_GROUP = {
  id: PREVIEW_GROUP_ID,
  name: "Friday Family Mehfil",
  description: "One favourite song and one cheerful take every week.",
  role: "owner",
  owner: { id: "preview-rahul", name: "Rahul" },
  memberCount: PREVIEW_MEMBERS.length,
  weeklyTopScore: 9.1,
  createdAt: "2026-07-01T00:00:00.000Z",
};
const PREVIEW_COLLECTION = {
  groups: [
    PREVIEW_GROUP,
    { ...PREVIEW_GROUP, id: "550e8400-e29b-41d4-a716-446655440001", name: "Retro Night Crew", description: "Golden-era Bollywood, every Sunday.", role: "member", owner: { id: "preview-priya", name: "Priya" }, memberCount: 8, weeklyTopScore: 8.8 },
  ],
  ownedActiveCount: 1,
  limits: GROUP_LIMITS,
};
const PREVIEW_DETAIL = {
  group: PREVIEW_GROUP,
  members: PREVIEW_MEMBERS,
  leaderboard: [
    { ...PREVIEW_MEMBERS[1], userId: "preview-priya", score: 9.1, rank: 1, title: "Lag Jaa Gale", artist: "Lata Mangeshkar", tier: "Legendary", recordedAt: "2026-07-24T00:00:00.000Z" },
    { ...PREVIEW_MEMBERS[0], userId: "preview-rahul", score: 8.7, rank: 2, title: "Pehla Nasha", artist: "Udit Narayan", tier: "Spotlight", recordedAt: "2026-07-23T00:00:00.000Z" },
    { ...PREVIEW_MEMBERS[2], userId: "preview-arjun", score: 8.2, rank: 3, title: "Kesariya", artist: "Arijit Singh", tier: "In tune", recordedAt: "2026-07-22T00:00:00.000Z" },
    { ...PREVIEW_MEMBERS[3], userId: "preview-meera", score: 7.9, rank: 4, title: "Saibo", artist: "Shreya Ghoshal", tier: "In tune", recordedAt: "2026-07-21T00:00:00.000Z" },
    { ...PREVIEW_MEMBERS[4], userId: "preview-kabir", score: null, rank: null, title: "", artist: "", tier: "", recordedAt: null },
  ],
  activeInvite: { id: "550e8400-e29b-41d4-a716-446655440099", expiresAt: "2026-07-30T00:00:00.000Z", remainingUses: 7 },
  weekStartsAt: "2026-07-20T00:00:00.000Z",
  limits: GROUP_LIMITS,
};

function SingerAvatar({ singer, size = "normal" }) {
  const initial = (singer?.name || "S").slice(0, 1).toUpperCase();
  return (
    <span className={`group-avatar ${size}`}>
      {singer?.image ? <img src={singer.image} alt="" referrerPolicy="no-referrer" /> : initial}
    </span>
  );
}

function InlineNotice({ tone = "info", children }) {
  return <div className={`groups-notice ${tone}`} role={tone === "error" ? "alert" : "status"}>{children}</div>;
}

function InviteWelcome({ invite, account, joining, onJoin }) {
  const unavailableCopy = {
    expired: "This invitation has expired. Ask the group owner for a fresh link.",
    revoked: "This invitation was revoked by the group owner.",
    archived: "This group is no longer active.",
    full: "This group has reached its 12-singer limit.",
    used: "This invitation has reached its join limit.",
  }[invite.reason] || "This invitation is no longer available.";
  return (
    <section className="invite-welcome" aria-labelledby="invite-welcome-title">
      <div className="invite-welcome-mark"><UserPlus /></div>
      <div>
        <div className="eyebrow eyebrow-muted"><Sparkles /> You’re invited</div>
        <h2 id="invite-welcome-title">{invite.name}</h2>
        <p>{invite.description || `${invite.ownerName} invited you to sing, practice, and climb the weekly scoreboard together.`}</p>
        <span><Users /> {invite.memberCount}/{invite.limits?.members || GROUP_LIMITS.members} singers · hosted by {invite.ownerName}</span>
      </div>
      <div className="invite-welcome-action">
        {invite.available ? account.authenticated ? (
          <button className="button button-primary" type="button" disabled={joining} onClick={onJoin}>
            {joining ? <LoaderCircle className="spinning" /> : <UserPlus />} Join this Mehfil
          </button>
        ) : (
          <button className="button button-primary" type="button" onClick={beginGoogleSignIn}><LogIn /> Sign in to join</button>
        ) : <InlineNotice tone="error">{unavailableCopy}</InlineNotice>}
        <small>Only score metadata appears in the group. Your recordings remain private.</small>
      </div>
    </section>
  );
}

function SignInGate({ authConfigured }) {
  return (
    <section className="groups-signin-gate">
      <span><Users /></span>
      <div className="eyebrow eyebrow-muted"><LockKeyhole /> Private by invitation</div>
      <h2>Sing better together.</h2>
      <p>Create a family Mehfil, invite the people you choose, and compare each singer’s best score of the week. Recordings never enter the group.</p>
      {authConfigured ? <button className="button button-primary" type="button" onClick={beginGoogleSignIn}><LogIn /> Continue with Google</button> : <InlineNotice tone="error">Google sign-in is not configured for this environment.</InlineNotice>}
      <div><span><ShieldCheck /> Invite-only</span><span><Trophy /> Fair weekly ranking</span><span><Mic2 /> Private recordings</span></div>
    </section>
  );
}

function GroupCreator({ ownedCount, limit, onCreated }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const atLimit = ownedCount >= limit;

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const detail = await createGroup({ name, description });
      setName("");
      setDescription("");
      setOpen(false);
      onCreated(detail.group.id);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button className="button button-primary groups-create-button" type="button" disabled={atLimit} onClick={() => setOpen(true)}>
        <Plus /> {atLimit ? `${limit} group limit reached` : "Create a Mehfil"}
      </button>
    );
  }

  return (
    <form className="group-create-panel" onSubmit={submit}>
      <div className="group-create-heading"><div><div className="eyebrow eyebrow-muted"><Users /> New group</div><h2>Start your Mehfil</h2><p>Keep it small, familiar, and fun. You can invite up to 11 more singers.</p></div><button type="button" aria-label="Close group creator" onClick={() => setOpen(false)}><X /></button></div>
      <div className="group-create-fields">
        <label><span>Group name</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength="60" required autoFocus placeholder="Friday Family Mehfil" /></label>
        <label><span>Short description</span><input value={description} onChange={(event) => setDescription(event.target.value)} maxLength="180" placeholder="One song and one cheerful take every week" /></label>
      </div>
      {error && <InlineNotice tone="error">{error}</InlineNotice>}
      <div className="group-create-actions"><small>{ownedCount}/{limit} active groups created</small><button className="button button-primary" type="submit" disabled={saving || name.trim().length < 2}>{saving ? <LoaderCircle className="spinning" /> : <Plus />} Create group</button></div>
    </form>
  );
}

function GroupList({ groups, selectedId, onSelect }) {
  if (!groups.length) {
    return (
      <div className="groups-empty">
        <span><Users /></span>
        <h3>Your first Mehfil starts here.</h3>
        <p>Create a private group, then share one invitation link with friends or family.</p>
      </div>
    );
  }
  return (
    <div className="group-card-grid" aria-label="Your groups">
      {groups.map((group) => (
        <button key={group.id} className={selectedId === group.id ? "group-card active" : "group-card"} type="button" onClick={() => onSelect(group.id)}>
          <span className="group-card-mark"><Users /></span>
          <span className="group-card-copy"><small>{group.role === "owner" ? "Your Mehfil" : `Hosted by ${group.owner.name}`}</small><strong>{group.name}</strong><em>{group.description || "A private SurStudio singing group"}</em></span>
          <span className="group-card-stats"><i><Users /> {group.memberCount}/{GROUP_LIMITS.members}</i><i><Trophy /> {group.weeklyTopScore == null ? "No score yet" : `${group.weeklyTopScore}/10`}</i></span>
          <ArrowRight />
        </button>
      ))}
    </div>
  );
}

function WeeklyLeaderboard({ detail }) {
  const scoredCount = detail.leaderboard.filter((entry) => entry.score != null).length;
  const weekLabel = new Date(detail.weekStartsAt).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
  return (
    <section className="leaderboard-card">
      <div className="group-section-heading"><div><div className="eyebrow eyebrow-muted"><Trophy /> Weekly scoreboard</div><h2>Best take wins the week.</h2><p>One best score per singer since {weekLabel}. Extra attempts never inflate the ranking.</p></div><span><CalendarDays /> {scoredCount}/{detail.members.length} ranked</span></div>
      <div className="leaderboard-list">
        {detail.leaderboard.map((entry, index) => (
          <article key={entry.userId} className={`${entry.isCurrentUser ? "current" : ""} ${entry.score == null ? "waiting" : ""}`}>
            <span className={`leaderboard-rank rank-${entry.rank || 0}`}>{entry.rank === 1 ? <Crown /> : entry.rank || "—"}</span>
            <SingerAvatar singer={entry} />
            <div><strong>{entry.name}{entry.isCurrentUser ? " · You" : ""}</strong><small>{entry.score == null ? "No scored take this week" : `${entry.title}${entry.artist ? ` · ${entry.artist}` : ""}`}</small></div>
            <span className="leaderboard-score">{entry.score == null ? <i>Waiting</i> : <><strong>{entry.score}</strong><small>/10</small></>}</span>
            {index === 0 && entry.score != null && <span className="leaderboard-glow" />}
          </article>
        ))}
      </div>
      {!scoredCount && <div className="leaderboard-empty"><Mic2 /><span><strong>The stage is open.</strong><small>The first synced score this week takes the lead.</small></span></div>}
    </section>
  );
}

function GroupInviteManager({ detail, onRefresh }) {
  const [generatedUrl, setGeneratedUrl] = useState("");
  const [status, setStatus] = useState("");
  const [working, setWorking] = useState(false);

  const generate = async () => {
    setWorking(true);
    setStatus("");
    try {
      const result = await createGroupInvite(detail.group.id);
      setGeneratedUrl(makeInviteUrl(result.token));
      setStatus("Fresh link ready");
      await onRefresh();
    } catch (error) {
      setStatus(error.message);
    } finally {
      setWorking(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(generatedUrl);
      setStatus("Invite copied");
    } catch {
      setStatus("Select and copy the link below");
    }
  };

  const share = async () => {
    if (!navigator.share) return copy();
    try {
      await navigator.share({ title: `Join ${detail.group.name} on SurStudio`, text: `You’re invited to our SurStudio Mehfil: ${detail.group.name}`, url: generatedUrl });
      setStatus("Invite shared");
    } catch (error) {
      if (error?.name !== "AbortError") setStatus("Could not share the invite");
    }
  };

  const revoke = async () => {
    if (!detail.activeInvite) return;
    setWorking(true);
    setStatus("");
    try {
      await revokeGroupInvite(detail.group.id, detail.activeInvite.id);
      setGeneratedUrl("");
      setStatus("Invitation revoked");
      await onRefresh();
    } catch (error) {
      setStatus(error.message);
    } finally {
      setWorking(false);
    }
  };

  const expiry = detail.activeInvite ? new Date(detail.activeInvite.expiresAt).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" }) : "";
  return (
    <section className="invite-manager">
      <div className="group-section-heading compact"><div><div className="eyebrow eyebrow-muted"><Link2 /> Invitation</div><h3>Bring in your people.</h3></div></div>
      <p>Links expire after {GROUP_LIMITS.inviteDays} days and are replaced whenever you create a fresh one. SurStudio never stores who you message.</p>
      {generatedUrl && <div className="generated-invite"><input value={generatedUrl} readOnly aria-label="Generated group invitation link" /><button type="button" onClick={copy}><Copy /> Copy</button><button type="button" onClick={share}><Share2 /> Share</button></div>}
      {detail.activeInvite && <span className="active-invite-note"><Check /> Active until {expiry} · {detail.activeInvite.remainingUses} joins remaining</span>}
      <div className="invite-manager-actions">
        <button className="button button-secondary" type="button" disabled={working || detail.members.length >= GROUP_LIMITS.members} onClick={generate}>{working ? <LoaderCircle className="spinning" /> : <RefreshCw />} {detail.activeInvite ? "Create fresh link" : "Create invite link"}</button>
        {detail.activeInvite && <button className="text-button danger" type="button" disabled={working} onClick={revoke}>Revoke link</button>}
      </div>
      {status && <small className="group-action-status">{status}</small>}
    </section>
  );
}

function MemberRoster({ detail, onRefresh }) {
  const [confirmMember, setConfirmMember] = useState("");
  const [status, setStatus] = useState("");
  const [working, setWorking] = useState(false);

  const remove = async (memberId) => {
    setWorking(true);
    setStatus("");
    try {
      await removeGroupMember(detail.group.id, memberId);
      setConfirmMember("");
      await onRefresh();
    } catch (error) {
      setStatus(error.message);
    } finally {
      setWorking(false);
    }
  };

  return (
    <section className="member-roster">
      <div className="group-section-heading compact"><div><div className="eyebrow eyebrow-muted"><Users /> Singers</div><h3>{detail.members.length}/{detail.limits.members} in this Mehfil</h3></div></div>
      <div className="member-list">
        {detail.members.map((member) => (
          <article key={member.id}>
            <SingerAvatar singer={member} />
            <div><strong>{member.name}{member.isCurrentUser ? " · You" : ""}</strong><small>{member.role === "owner" ? "Group owner" : `Joined ${new Date(member.joinedAt).toLocaleDateString(undefined, { timeZone: "UTC" })}`}</small></div>
            {detail.group.role === "owner" && member.role !== "owner" && (confirmMember === member.id ? <span className="member-confirm"><button type="button" disabled={working} onClick={() => remove(member.id)}>Remove</button><button type="button" onClick={() => setConfirmMember("")}>Cancel</button></span> : <button className="member-remove" type="button" aria-label={`Remove ${member.name}`} onClick={() => setConfirmMember(member.id)}><UserMinus /></button>)}
          </article>
        ))}
      </div>
      {status && <InlineNotice tone="error">{status}</InlineNotice>}
    </section>
  );
}

function GroupDetail({ detail, onRefresh, onCollectionRefresh, onSelectNone }) {
  const [confirmExit, setConfirmExit] = useState(false);
  const [status, setStatus] = useState("");
  const [working, setWorking] = useState(false);
  const owner = detail.group.role === "owner";

  const exit = async () => {
    setWorking(true);
    setStatus("");
    try {
      if (owner) await archiveGroup(detail.group.id);
      else await leaveGroup(detail.group.id);
      onSelectNone();
      await onCollectionRefresh();
    } catch (error) {
      setStatus(error.message);
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="group-detail">
      <section className="group-detail-hero">
        <div><div className="eyebrow"><Users /> {owner ? "Your Mehfil" : `Hosted by ${detail.group.owner.name}`}</div><h1>{detail.group.name}</h1><p>{detail.group.description || "A private place to practice, cheer, and share the score—not the recording."}</p></div>
        <div className="group-detail-stat"><strong>{detail.members.length}</strong><span>of {detail.limits.members} singers</span><i><ShieldCheck /> Invite-only</i></div>
      </section>
      <div className="group-detail-grid">
        <WeeklyLeaderboard detail={detail} />
        <aside className="group-community-panel">
          {owner && <GroupInviteManager detail={detail} onRefresh={onRefresh} />}
          <MemberRoster detail={detail} onRefresh={onRefresh} />
          <section className="group-privacy-note"><ShieldCheck /><div><strong>Scores together. Recordings apart.</strong><p>Groups receive song, score, tier, and date only. Audio, recipients, contacts, and message history stay outside SurStudio.</p></div></section>
          <div className="group-exit">
            {confirmExit ? <div><p>{owner ? "Archiving closes the group and revokes its invite. Existing personal scores remain private in each singer’s account." : "Leaving removes you from this scoreboard. Your personal score history remains yours."}</p><span><button type="button" disabled={working} onClick={exit}>{working ? "Working…" : owner ? "Archive group" : "Leave group"}</button><button type="button" onClick={() => setConfirmExit(false)}>Cancel</button></span></div> : <button className="text-button danger" type="button" onClick={() => setConfirmExit(true)}>{owner ? <Archive /> : <LogOut />} {owner ? "Archive this group" : "Leave this group"}</button>}
            {status && <InlineNotice tone="error">{status}</InlineNotice>}
          </div>
        </aside>
      </div>
    </div>
  );
}

export function GroupsView({ account, inviteToken = "", onInviteHandled, preview = false }) {
  const [collection, setCollection] = useState(preview ? PREVIEW_COLLECTION : null);
  const [selectedId, setSelectedId] = useState(preview ? PREVIEW_GROUP_ID : "");
  const [detail, setDetail] = useState(preview ? PREVIEW_DETAIL : null);
  const [invitePreview, setInvitePreview] = useState(null);
  const [loadingInvite, setLoadingInvite] = useState(Boolean(inviteToken));
  const [joining, setJoining] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refreshCollection = useCallback(async (preferredId = "") => {
    if (preview) return;
    if (!account.authenticated) return;
    setLoading(true);
    setError("");
    try {
      const next = await loadGroups();
      setCollection(next);
      setSelectedId((current) => preferredId || (next.groups.some((group) => group.id === current) ? current : next.groups[0]?.id || ""));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [account.authenticated, preview]);

  const refreshDetail = useCallback(async () => {
    if (preview) return;
    if (!selectedId || !account.authenticated) {
      setDetail(null);
      return;
    }
    setLoading(true);
    setError("");
    try {
      setDetail(await loadGroup(selectedId));
    } catch (requestError) {
      setDetail(null);
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [account.authenticated, preview, selectedId]);

  useEffect(() => { refreshCollection(); }, [refreshCollection]);
  useEffect(() => { refreshDetail(); }, [refreshDetail]);
  useEffect(() => {
    let active = true;
    if (preview) return undefined;
    if (!inviteToken) {
      setInvitePreview(null);
      setLoadingInvite(false);
      return undefined;
    }
    setLoadingInvite(true);
    loadInvitePreview(inviteToken)
      .then(({ invite }) => { if (active) setInvitePreview(invite); })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoadingInvite(false); });
    return () => { active = false; };
  }, [inviteToken, preview]);

  const joinInvite = async () => {
    setJoining(true);
    setError("");
    try {
      const joined = await joinGroupInvite(inviteToken);
      onInviteHandled?.();
      setInvitePreview(null);
      await refreshCollection(joined.group.id);
      setSelectedId(joined.group.id);
      setDetail(joined);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setJoining(false);
    }
  };

  const limits = collection?.limits || GROUP_LIMITS;
  const ownedCount = collection?.ownedActiveCount || 0;
  const selectedSummary = useMemo(() => collection?.groups.find((group) => group.id === selectedId) || null, [collection, selectedId]);

  return (
    <main className="groups-view">
      <section className="groups-hero page-shell">
        <div><div className="eyebrow"><Users /> Mehfil Groups</div><h1>Your circle.<br /><em>Your scoreboard.</em></h1><p>Invite friends and family, sing on your own schedule, and let everyone’s best take of the week speak for itself.</p></div>
        <div className="groups-hero-proof"><span><strong>{limits.owned}</strong><small>groups you can create</small></span><span><strong>{limits.members}</strong><small>singers per group</small></span><span><ShieldCheck /><small>recordings always private</small></span></div>
      </section>

      <div className="groups-content page-shell">
        {loadingInvite && <div className="groups-loading"><LoaderCircle className="spinning" /> Reading invitation…</div>}
        {invitePreview && <InviteWelcome invite={invitePreview} account={account} joining={joining} onJoin={joinInvite} />}
        {error && <InlineNotice tone="error">{error}</InlineNotice>}
        {!account.authenticated ? <SignInGate authConfigured={account.authConfigured} /> : (
          <>
            <div className="groups-toolbar"><div><div className="eyebrow eyebrow-muted"><Users /> Your circles</div><h2>Choose where to sing together.</h2><p>{collection?.groups.length || 0} joined · {ownedCount}/{limits.owned} created by you</p></div><GroupCreator ownedCount={ownedCount} limit={limits.owned} onCreated={(groupId) => refreshCollection(groupId)} /></div>
            {loading && !collection && <div className="groups-loading"><LoaderCircle className="spinning" /> Loading your Mehfils…</div>}
            {collection && <GroupList groups={collection.groups} selectedId={selectedId} onSelect={setSelectedId} />}
            {selectedId && loading && !detail && <div className="groups-loading detail"><LoaderCircle className="spinning" /> Preparing the scoreboard…</div>}
            {detail && selectedSummary && <GroupDetail detail={detail} onRefresh={refreshDetail} onCollectionRefresh={refreshCollection} onSelectNone={() => { setSelectedId(""); setDetail(null); }} />}
          </>
        )}
      </div>
    </main>
  );
}
