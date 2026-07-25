import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Activity,
  AlertTriangle,
  AudioLines,
  BookOpenText,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleGauge,
  Clock3,
  Cloud,
  Download,
  FileAudio,
  Film,
  Heart,
  Languages,
  Library,
  ListMusic,
  ListChecks,
  LoaderCircle,
  LogIn,
  LogOut,
  Mic2,
  MessageCircle,
  Minus,
  Music2,
  Pause,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Search,
  Share2,
  Shuffle,
  SlidersHorizontal,
  Sparkles,
  Square,
  TimerReset,
  Target,
  Trophy,
  Volume2,
  WandSparkles,
  Wind,
  X,
} from "lucide-react";
import { SiYoutube as Youtube } from "react-icons/si";
import { demoLyrics, featuredSongs, genres, moods, studioFeatures } from "./data.js";
import { Builder } from "./Builder.jsx";
import { AudioTrackPlayer } from "./AudioTrackPlayer.jsx";
import { MacNativePanel } from "./MacNativePanel.jsx";
import { GroupsView } from "./Groups.jsx";
import { hasNativeMacBridge } from "./nativeMac.js";
import { createScoreCardFile, shareScoreCard } from "./scoreShare.js";
import { buildPracticeRoutine, practiceFocuses } from "./practice.js";
import { getPracticeRhythm, localDateKey, mergeDailyActivity } from "./habits.js";
import { normalizeInviteToken } from "./groupRules.js";
import {
  calculatePerformanceBreakdown,
  chooseNextYouTubeResult,
  createTimedLyrics,
  detectPitch,
  extractYouTubeId,
  fitLyricTimings,
  formatTime,
  makeKaraokeSearchQuery,
} from "./utils.js";
import {
  beginGoogleSignIn,
  beginSignOut,
  loadAccount,
  loadRemoteScores,
  mergeScores,
  saveRemoteScore,
} from "./account.js";

const STORAGE_KEY = "surstudio-library-v1";
const EMPTY_LIBRARY = { favorites: [], takes: [], activity: [], lastTrack: null };
const SCORECARD_PREVIEW = {
  overall: 8.7,
  tier: "Spotlight",
  message: "Enter closer to the highlighted phrase starts on your next take.",
  recommendation: { metric: "timing", title: "Lock in the entry", action: "Tap the pulse once, then A/B loop the phrase and enter with the highlighted first word." },
  metrics: { pitch: 86, timing: 74, range: 91, control: 82 },
};
const SILENT_PREVIEW_AUDIO = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";
const DASHBOARD_PREVIEW_LIBRARY = {
  favorites: [featuredSongs[0].id, featuredSongs[2].id],
  activity: [0, 1, 3, 5].map((offset) => ({ date: localDateKey(new Date(Date.now() - offset * 86400000)), practiced: true, recorded: offset < 2 })),
  lastTrack: featuredSongs[0],
  takes: [
    { id: "preview-1", title: "Lag Jaa Gale", artist: "Lata Mangeshkar", score: 9.0, tier: "Legendary", metrics: { pitch: 86, timing: 88, range: 94, control: 79 }, createdAt: new Date().toISOString() },
    { id: "preview-2", title: "Pehla Nasha", artist: "Udit Narayan & Sadhana Sargam", score: 8.4, tier: "Spotlight", metrics: { pitch: 82, timing: 76, range: 89, control: 83 }, createdAt: new Date(Date.now() - 86400000).toISOString() },
    { id: "preview-3", title: "Kesariya", artist: "Arijit Singh", score: 7.9, tier: "In tune", metrics: { pitch: 78, timing: 73, range: 84, control: 80 }, createdAt: new Date(Date.now() - 3 * 86400000).toISOString() },
  ],
};

function readLibrary() {
  try {
    return { ...EMPTY_LIBRARY, ...(JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}) };
  } catch {
    return EMPTY_LIBRARY;
  }
}

function writeLibrary(value) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

function persistableTrack(track) {
  if (!track) return null;
  const { instrumentalUrl, instrumentalFile: _instrumentalFile, ...savedTrack } = track;
  if (instrumentalUrl && !instrumentalUrl.startsWith("blob:")) savedTrack.instrumentalUrl = instrumentalUrl;
  return savedTrack;
}

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (window.__surStudioYouTubePromise) return window.__surStudioYouTubePromise;

  window.__surStudioYouTubePromise = new Promise((resolve) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      resolve(window.YT);
    };
    if (!document.getElementById("youtube-iframe-api")) {
      const script = document.createElement("script");
      script.id = "youtube-iframe-api";
      script.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(script);
    }
  });
  return window.__surStudioYouTubePromise;
}

function Brand() {
  return (
    <a className="brand" href="#top" aria-label="SurStudio home">
      <span className="brand-mark"><Mic2 aria-hidden="true" /></span>
      <span>
        <strong>SurStudio</strong>
        <small>your voice, your mehfil</small>
      </span>
    </a>
  );
}

function Header({ currentView, onNavigate, onOpenBuilder, libraryCount, account, scoreSyncState, hostedGroups }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const navigate = (view) => {
    onNavigate(view);
    setMenuOpen(false);
  };

  return (
    <header className="site-header">
      <div className="header-inner">
        <Brand />
        <button
          className="mobile-menu"
          type="button"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((value) => !value)}
        >
          {menuOpen ? <X /> : <ListMusic />}
        </button>
        <nav className={menuOpen ? "main-nav is-open" : "main-nav"} aria-label="Primary navigation">
          <button className={currentView === "discover" ? "active" : ""} onClick={() => navigate("discover")}>Discover</button>
          <button className={currentView === "studio" ? "active" : ""} onClick={() => navigate("studio")}>Studio</button>
          <button className={currentView === "library" ? "active" : ""} onClick={() => navigate("library")}>
            Progress {libraryCount > 0 && <span className="nav-count">{libraryCount}</span>}
          </button>
          {hostedGroups && <button className={currentView === "groups" ? "active" : ""} onClick={() => navigate("groups")}>Groups</button>}
        </nav>
        <div className="header-actions">
          <button className="button button-compact button-primary header-cta" type="button" onClick={onOpenBuilder}>
            <Youtube /> Add song
          </button>
          {account.authConfigured && (
            <div className="account-control">
              {account.authenticated ? (
                <>
                  <button className="account-button" type="button" aria-expanded={accountOpen} aria-label="Open account menu" onClick={() => setAccountOpen((value) => !value)}>
                    {account.user?.image ? <img src={account.user.image} alt="" referrerPolicy="no-referrer" /> : <span>{(account.user?.name || account.user?.email || "S").slice(0, 1).toUpperCase()}</span>}
                    <strong>{account.user?.name?.split(" ")[0] || "Account"}</strong>
                    <ChevronDown />
                  </button>
                  {accountOpen && (
                    <div className="account-menu">
                      <small>Signed in as</small>
                      <strong>{account.user?.name || "SurStudio singer"}</strong>
                      <span>{account.user?.email}</span>
                      <i className={scoreSyncState === "error" ? "sync-error" : ""}><Cloud /> {scoreSyncState === "syncing" ? "Syncing scores…" : scoreSyncState === "error" ? "Scores saved locally" : "Scores synced"}</i>
                      <button type="button" onClick={beginSignOut}><LogOut /> Sign out</button>
                    </div>
                  )}
                </>
              ) : (
                <button className="account-sign-in" type="button" onClick={beginGoogleSignIn}><LogIn /> Sign in</button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function Hero({ onOpenBuilder, onPickSong }) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    if (!query.trim()) return [];
    const needle = query.toLowerCase();
    return featuredSongs.filter((song) => `${song.title} ${song.artist} ${song.film}`.toLowerCase().includes(needle)).slice(0, 4);
  }, [query]);

  const submit = (event) => {
    event.preventDefault();
    const youtubeId = extractYouTubeId(query);
    if (youtubeId) {
      onOpenBuilder(query);
      return;
    }
    if (results[0]) {
      onPickSong(results[0]);
      return;
    }
    if (query.trim()) onOpenBuilder({ title: query.trim(), searchQuery: makeKaraokeSearchQuery(query.trim()) });
  };

  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-glow hero-glow-one" />
      <div className="hero-glow hero-glow-two" />
      <div className="hero-content">
        <div className="eyebrow"><Sparkles /> Built for Bollywood voices</div>
        <h1 id="hero-title">Every song can become<br /><em>your stage.</em></h1>
        <p className="hero-copy">Find a favourite or turn a YouTube music video into a focused karaoke session with automatic Hindi lyrics, smarter sync, guided practice, live pitch steadiness, and private recording.</p>

        <form className="song-search" onSubmit={submit}>
          <Search aria-hidden="true" />
          <input
            aria-label="Search songs or paste a YouTube URL"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Song, singer, film — or paste a YouTube URL"
          />
          {query && <button className="clear-search" type="button" aria-label="Clear search" onClick={() => setQuery("")}><X /></button>}
          <button className="button button-primary search-submit" type="submit">Sing now <ArrowRight /></button>
          {results.length > 0 && (
            <div className="search-results" role="listbox" aria-label="Song suggestions">
              {results.map((song) => (
                <button key={song.id} type="button" onClick={() => onPickSong(song)}>
                  <span className={`result-orb ${song.accent}`}><Music2 /></span>
                  <span><strong>{song.title}</strong><small>{song.artist} · {song.film}</small></span>
                  <ChevronRight />
                </button>
              ))}
            </div>
          )}
        </form>

        <div className="hero-actions">
          <button className="text-action" type="button" onClick={() => onOpenBuilder()}><Youtube /> Import from YouTube</button>
          <span>No paid AI account · Optional local instrumental</span>
        </div>

        <div className="feature-ribbon" aria-label="Included karaoke tools">
          <span><Mic2 /> Record locally</span>
          <span><Languages /> Hindi + Roman</span>
          <span><TimerReset /> A/B loops</span>
          <span><CircleGauge /> Voice score</span>
        </div>
      </div>
    </section>
  );
}

function PracticePulse({ library, onPickSong, onResume }) {
  const rhythm = getPracticeRhythm(library.activity);
  const today = library.activity.find((entry) => entry.date === localDateKey()) || {};
  const wins = [today.started, today.practiced, today.recorded].filter(Boolean).length;
  const activeDays = rhythm.filter((day) => day.active).length;
  const lastTrack = library.lastTrack;
  const headline = wins === 3 ? "Tonight’s practice is complete." : wins === 2 ? "One take will close the loop." : wins === 1 ? "Your rehearsal is ready." : lastTrack ? "Come back to the line you were shaping." : "Make one song yours tonight.";
  const steps = [
    { label: "Choose a song", complete: Boolean(today.started), icon: Music2 },
    { label: "Finish one card", complete: Boolean(today.practiced), icon: Target },
    { label: "Record one take", complete: Boolean(today.recorded), icon: Mic2 },
  ];

  return (
    <section className="practice-pulse page-shell" aria-labelledby="practice-pulse-title">
      <div className="practice-pulse-copy">
        <div className="eyebrow eyebrow-muted"><Activity /> Your practice pulse</div>
        <h2 id="practice-pulse-title">{headline}</h2>
        <p>{lastTrack ? `${lastTrack.title} is ready where you left it. A small, finished rehearsal beats a long session you avoid.` : "Start with one familiar song. SurStudio will turn it into three small, finishable steps."}</p>
        <button className="button button-primary" type="button" onClick={() => lastTrack ? onResume(lastTrack) : onPickSong(featuredSongs[2])}>
          <Play fill="currentColor" /> {lastTrack ? `Resume ${lastTrack.title}` : "Start with Kesariya"}
        </button>
      </div>

      <div className="practice-pulse-panel">
        <div className="pulse-panel-head"><span><strong>{wins}/3</strong><small>tonight’s small wins</small></span><span><strong>{activeDays}</strong><small>practice days this week</small></span></div>
        <div className="pulse-steps" aria-label={`${wins} of 3 practice steps complete`}>
          {steps.map(({ label, complete, icon: Icon }) => <div key={label} className={complete ? "complete" : ""}><span>{complete ? <Check /> : <Icon />}</span><strong>{label}</strong></div>)}
        </div>
        <div className="practice-rhythm" aria-label={`${activeDays} meaningful practice days in the last seven days`}>
          {rhythm.map((day) => <span key={day.key} className={day.active ? "active" : day.today ? "today" : ""} aria-label={`${day.key}: ${day.active ? "practiced" : "no practice saved"}`}><i />{day.label}</span>)}
        </div>
        <p>No streak pressure. The rhythm records finished practice—not app opens.</p>
      </div>
    </section>
  );
}

function SongCard({ song, isFavorite, onFavorite, onPick, lyricAnalysis, analysisPending }) {
  const quality = lyricAnalysis?.quality;
  const qualityTone = quality?.overall >= 85 ? "ready" : quality?.overall >= 70 ? "strong" : quality?.overall >= 50 ? "review" : "missing";
  const qualityLabel = analysisPending ? "Checking lyric match" : quality ? quality.label : lyricAnalysis?.status === "unavailable" ? "Check unavailable" : "Lyrics not checked";
  return (
    <article className="song-card">
      <button className={`song-art ${song.accent}`} type="button" onClick={() => onPick(song)} aria-label={`Sing ${song.title}`}>
        <span className="song-film">{song.film}</span>
        <span className="song-note"><Music2 /></span>
        <span className="song-key">{song.key ? `Key ${song.key}` : "Key in studio"}</span>
        <span className="play-bubble"><Play fill="currentColor" /></span>
      </button>
      <div className="song-card-copy">
        <div>
          <h3>{song.title}</h3>
          <p>{song.artist}</p>
        </div>
        <button className={isFavorite ? "icon-button favorite active" : "icon-button favorite"} type="button" aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"} onClick={() => onFavorite(song.id)}>
          <Heart fill={isFavorite ? "currentColor" : "none"} />
        </button>
      </div>
      <div className={`lyric-readiness ${qualityTone}`} aria-label={quality ? `Lyric quality ${quality.overall} percent. ${quality.label}` : qualityLabel} title={quality ? `Match ${quality.match} · Timing ${quality.timing} · Completeness ${quality.completeness} · Script ${quality.script}` : qualityLabel}>
        <span>{analysisPending ? <LoaderCircle className="spinning" /> : <CircleGauge />}</span>
        <span><strong>{quality ? `${quality.overall}%` : analysisPending ? "Analyzing" : "Not scored"}</strong><small>{qualityLabel}</small></span>
        {quality && <i>{quality.synchronized ? "Timed" : "Plain"} · {quality.lineCount} lines</i>}
      </div>
      <div className="song-tags"><span>{song.language}</span><span>{song.difficulty}</span></div>
    </article>
  );
}

function Discovery({ onOpenBuilder, onPickSong, onResumeTrack, favorites, onFavorite, library }) {
  const [activeGenre, setActiveGenre] = useState(null);
  const [activeMood, setActiveMood] = useState(null);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogSort, setCatalogSort] = useState("curated");
  const [visibleLimit, setVisibleLimit] = useState(12);
  const [lyricAnalyses, setLyricAnalyses] = useState({});
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisMessage, setAnalysisMessage] = useState("");
  const catalogRef = useRef(null);
  const filteredSongs = useMemo(() => {
    const query = catalogQuery.trim().toLowerCase();
    const filtered = featuredSongs.filter((song) => {
      if (!query && activeMood && !song.moods?.includes(activeMood)) return false;
      if (!query && activeGenre && !song.genres?.includes(activeGenre)) return false;
      if (query && !`${song.title} ${song.artist} ${song.film} ${song.language}`.toLowerCase().includes(query)) return false;
      return true;
    });
    if (catalogSort === "title") return [...filtered].sort((a, b) => a.title.localeCompare(b.title));
    if (catalogSort === "lyrics") return [...filtered].sort((a, b) => (lyricAnalyses[b.id]?.quality?.overall ?? -1) - (lyricAnalyses[a.id]?.quality?.overall ?? -1));
    return filtered;
  }, [activeGenre, activeMood, catalogQuery, catalogSort, lyricAnalyses]);
  const visibleSongs = filteredSongs.slice(0, visibleLimit);
  const pendingAnalysisSongs = visibleSongs.filter((song) => !lyricAnalyses[song.id]).slice(0, 12);
  const pendingAnalysisKey = pendingAnalysisSongs.map((song) => song.id).join("|");
  const scoredCount = filteredSongs.filter((song) => lyricAnalyses[song.id]?.quality).length;
  const catalogTitle = catalogQuery.trim() ? `Results for “${catalogQuery.trim()}”` : activeMood ? `${activeMood} picks` : activeGenre ? `${activeGenre} songs` : "Bollywood songbook";

  useEffect(() => {
    if (!pendingAnalysisKey) return undefined;
    const controller = new AbortController();
    setAnalysisLoading(true);
    setAnalysisMessage("");
    fetch("/api/catalog-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ songs: pendingAnalysisSongs.map(({ id, title, artist, language }) => ({ id, title, artist, language })) }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Lyric analysis is unavailable.");
        setLyricAnalyses((current) => ({ ...current, ...Object.fromEntries((data.analyses || []).map((analysis) => [analysis.id, analysis])) }));
      })
      .catch((error) => { if (error.name !== "AbortError") setAnalysisMessage(error.message); })
      .finally(() => { if (!controller.signal.aborted) setAnalysisLoading(false); });
    return () => controller.abort();
  }, [pendingAnalysisKey]);

  const showCatalog = ({ genre = null, mood = null } = {}) => {
    setActiveGenre(genre);
    setActiveMood(mood);
    setCatalogQuery("");
    setVisibleLimit(12);
    window.requestAnimationFrame(() => catalogRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <>
      <Hero onOpenBuilder={onOpenBuilder} onPickSong={onPickSong} />
      <PracticePulse library={library} onPickSong={onPickSong} onResume={onResumeTrack} />

      <section ref={catalogRef} className="browse-section page-shell" aria-labelledby="featured-title">
        <div className="section-heading">
          <div>
            <div className="eyebrow eyebrow-muted"><Radio /> Curated for tonight</div>
            <h2 id="featured-title">{catalogTitle}</h2>
            <p aria-live="polite">{filteredSongs.length} {filteredSongs.length === 1 ? "song" : "songs"} · {scoredCount} lyric {scoredCount === 1 ? "check" : "checks"} ready</p>
          </div>
          <button className="text-button" type="button" onClick={() => showCatalog()}>Show all songs <ArrowRight /></button>
        </div>

        <div className="catalog-tools">
          <label className="catalog-search"><Search /><input value={catalogQuery} onChange={(event) => { setCatalogQuery(event.target.value); setActiveGenre(null); setActiveMood(null); setVisibleLimit(12); }} placeholder={`Search ${featuredSongs.length} songs, singers, or films`} aria-label="Search the song catalog" /></label>
          <label className="catalog-sort"><SlidersHorizontal /><span>Sort</span><select value={catalogSort} onChange={(event) => setCatalogSort(event.target.value)} aria-label="Sort song catalog"><option value="curated">Curated order</option><option value="lyrics">Best lyric quality</option><option value="title">Song A–Z</option></select></label>
          <div className={analysisLoading ? "catalog-analysis-status loading" : "catalog-analysis-status"}><CircleGauge /><span><strong>{analysisLoading ? "Analyzing lyrics" : analysisMessage ? "Analysis paused" : "Lyric readiness"}</strong><small>{analysisLoading ? `Checking ${pendingAnalysisSongs.length} songs against public matches` : analysisMessage || "Match, timing, completeness, and script"}</small></span></div>
        </div>

        <div className="chip-row" aria-label="Browse genres">
          {genres.map((genre) => <button key={genre} className={activeGenre === genre ? "chip active" : "chip"} type="button" aria-pressed={activeGenre === genre} onClick={() => showCatalog({ genre })}>{genre}</button>)}
        </div>

        <div className="song-grid">
          {visibleSongs.map((song) => (
            <SongCard key={song.id} song={song} isFavorite={favorites.includes(song.id)} onFavorite={onFavorite} onPick={onPickSong} lyricAnalysis={lyricAnalyses[song.id]} analysisPending={analysisLoading && pendingAnalysisSongs.some((pending) => pending.id === song.id)} />
          ))}
          {!visibleSongs.length && <div className="catalog-empty"><span><Search /></span><h3>No built-in songs in this filter yet</h3><p>SurStudio can still build one from a YouTube video and look for its lyrics.</p><button className="button button-secondary" type="button" onClick={() => onOpenBuilder()}>Build this session <ArrowRight /></button></div>}
        </div>
        {visibleSongs.length < filteredSongs.length && <div className="catalog-more"><button className="button button-secondary" type="button" onClick={() => setVisibleLimit((current) => current + 12)}>Load {Math.min(12, filteredSongs.length - visibleSongs.length)} more songs <Plus /></button><span>{visibleSongs.length} of {filteredSongs.length} shown</span></div>}
      </section>

      <section className="studio-story" aria-labelledby="power-title">
        <div className="page-shell story-grid">
          <div className="story-copy">
            <div className="eyebrow"><AudioLines /> More than a player</div>
            <h2 id="power-title">A rehearsal room that listens back.</h2>
            <p>Build a session around the exact phrase you want to master. Your recordings stay in this browser unless you choose to download them.</p>
            <span className="story-note"><CheckCircle2 /> Every finished rehearsal becomes a one-tap resume.</span>
          </div>
          <div className="feature-stack">
            {studioFeatures.map((feature, index) => {
              const icons = [BookOpenText, RotateCcw, Mic2, CircleGauge];
              const Icon = icons[index];
              return <article key={feature.id} className="power-card"><span><Icon /></span><div><h3>{feature.title}</h3><p>{feature.description}</p></div><small>0{index + 1}</small></article>;
            })}
          </div>
        </div>
      </section>

      <section className="mood-section page-shell" aria-labelledby="mood-title">
        <div className="section-heading compact-heading"><div><div className="eyebrow eyebrow-muted"><Sparkles /> Match the moment</div><h2 id="mood-title">What are you singing for?</h2></div></div>
        <div className="mood-grid">
          {moods.map((mood, index) => {
            const icons = [FlameIcon, Heart, Clock3, ListMusic, AudioLines, Mic2];
            const Icon = icons[index];
            return <button type="button" key={mood} className={activeMood === mood ? "active" : ""} aria-pressed={activeMood === mood} onClick={() => showCatalog({ mood })}><Icon /><span>{mood}</span><ArrowRight /></button>;
          })}
        </div>
      </section>

      <section className="youtube-callout page-shell">
        <div className="youtube-mark"><Youtube /></div>
        <div><div className="eyebrow eyebrow-muted">One URL, far less setup</div><h2>Already found the right track?</h2><p>Paste a YouTube URL. SurStudio reads the title, finds lyrics, and uses synced timestamps when available. Attach a locally made instrumental whenever you want no-vocals playback.</p></div>
        <span className="callout-note"><Youtube /> Import from the hero or use Add song in the header.</span>
      </section>
    </>
  );
}

function FlameIcon(props) {
  return <Sparkles {...props} />;
}

function YouTubePlayer({ track, onReadyChange, onPlaybackError, currentTime, setCurrentTime, duration, setDuration, playing, setPlaying, volume, speed, loop }) {
  const mountRef = useRef(null);
  const playerRef = useRef(null);
  const loopRef = useRef(loop);
  loopRef.current = loop;

  useEffect(() => {
    let cancelled = false;
    let interval;
    loadYouTubeApi().then((YT) => {
      if (cancelled || !mountRef.current) return;
      playerRef.current = new YT.Player(mountRef.current, {
        videoId: track.youtubeId,
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1, controls: 0, origin: window.location.origin, widget_referrer: window.location.href },
        events: {
          onReady: (event) => {
            if (cancelled) return;
            onReadyChange(true);
            setDuration(event.target.getDuration() || track.duration || 240);
            event.target.setVolume(volume);
            interval = window.setInterval(() => {
              const time = event.target.getCurrentTime?.() || 0;
              const activeLoop = loopRef.current;
              if (activeLoop.a !== null && activeLoop.b !== null && time >= activeLoop.b) {
                event.target.seekTo(activeLoop.a, true);
              }
              setCurrentTime(time);
            }, 200);
          },
          onStateChange: (event) => {
            if (event.data === YT.PlayerState.PLAYING) setPlaying(true);
            if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) setPlaying(false);
          },
          onError: (event) => {
            if (cancelled) return;
            const blocked = event.data === 101 || event.data === 150;
            const unavailable = event.data === 100;
            onReadyChange(false);
            setPlaying(false);
            onPlaybackError?.({
              code: event.data,
              title: blocked ? "This YouTube video can’t be embedded" : unavailable ? "This YouTube video is unavailable" : "YouTube playback could not start",
              message: blocked ? "The video owner only allows playback on YouTube. Choose another karaoke version and SurStudio will keep your lyrics and practice setup ready." : "Choose another karaoke version or attach a local instrumental to continue.",
            });
          },
        },
      });
    });
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      try { playerRef.current?.destroy(); } catch { /* player already gone */ }
      onReadyChange(false);
    };
  }, [track.youtubeId]);

  useEffect(() => { playerRef.current?.setVolume?.(volume); }, [volume]);
  useEffect(() => { playerRef.current?.setPlaybackRate?.(speed); }, [speed]);
  useEffect(() => {
    if (!playerRef.current?.playVideo) return;
    if (playing) playerRef.current.playVideo();
    else playerRef.current.pauseVideo();
  }, [playing]);

  useEffect(() => {
    const seek = (event) => playerRef.current?.seekTo?.(event.detail, true);
    window.addEventListener("surstudio:seek", seek);
    return () => window.removeEventListener("surstudio:seek", seek);
  }, []);

  return <div className="youtube-player" ref={mountRef} title={`YouTube player for ${track.title}`} />;
}

function readPracticeState(key) {
  try {
    return JSON.parse(localStorage.getItem(`surstudio-practice-${key}`)) || {};
  } catch {
    return {};
  }
}

function TakeScorecard({ analysis, recordingUrl, track, onClose, onRetake }) {
  const [shareLabel, setShareLabel] = useState("Share score");
  const [messageLabel, setMessageLabel] = useState("Messages");
  const metrics = [
    { id: "pitch", label: "Pitch", detail: "Distance from the nearest musical note", icon: Target },
    { id: "timing", label: "Timing", detail: "Entries near highlighted phrase starts", icon: TimerReset },
    { id: "range", label: "Range", detail: "Comfortable note span captured in this take", icon: AudioLines },
    { id: "control", label: "Control", detail: "Even breath energy across voiced phrases", icon: SlidersHorizontal },
  ];
  const shareScore = async (destination = "picker") => {
    const setLabel = destination === "messages" ? setMessageLabel : setShareLabel;
    setLabel("Preparing card…");
    try {
      const result = await shareScoreCard({ ...track, score: analysis.overall, metrics: analysis.metrics, tier: analysis.tier, createdAt: new Date().toISOString() }, destination);
      setLabel(result.downloaded ? "Card downloaded" : destination === "messages" ? "Opened Messages" : "Share opened");
    } catch (error) {
      if (error?.name !== "AbortError") setLabel("Could not share");
    }
  };

  return (
    <div className="scorecard-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className="scorecard-sheet" role="dialog" aria-modal="true" aria-labelledby="scorecard-title">
        <button className="scorecard-close" type="button" aria-label="Close scorecard" onClick={onClose}><X /></button>
        <header className="scorecard-hero">
          <span className="scorecard-kicker">Your score</span>
          <h2 id="scorecard-title">{analysis.overall}</h2>
          <small>/10</small>
          <div className="scorecard-tier"><Trophy /><strong>{analysis.tier}</strong></div>
          <p>{analysis.message}</p>
        </header>

        <div className="score-metrics" aria-label="Performance score breakdown">
          {metrics.map(({ id, label, detail, icon: Icon }) => <div className={`score-metric metric-${id}`} key={id}>
            <div className="score-metric-head"><span><Icon /></span><div><strong>{label}</strong><small>{detail}</small></div><b>{analysis.metrics[id]}</b></div>
            <div className="score-meter" role="progressbar" aria-label={`${label} score`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={analysis.metrics[id]}><i style={{ width: `${analysis.metrics[id]}%` }} /></div>
          </div>)}
        </div>

        {analysis.recommendation && <section className="score-recommendation" aria-labelledby="score-recommendation-title"><span><Sparkles /></span><div><small>How to improve</small><strong id="score-recommendation-title">{analysis.recommendation.title}</strong><p>{analysis.recommendation.action}</p></div></section>}

        <p className="scorecard-note"><CircleGauge /> Browser-local coaching estimate. Pitch is measured against musical note centres, not the original singer’s melody.</p>

        <div className="scorecard-playback">
          <div><span><Play /></span><div><small>Your recording is ready</small><strong>Play it back, then polish one thing</strong></div></div>
          <audio controls src={recordingUrl} />
        </div>

        <div className="scorecard-actions">
          <a className="button score-download" href={recordingUrl} download={`${track.title.replace(/\s+/g, "-").toLowerCase()}-take.webm`}><Download /> Download</a>
          <button className="button score-share" type="button" onClick={() => shareScore("picker")}><Share2 /> {shareLabel}</button>
          <button className="button score-message" type="button" onClick={() => shareScore("messages")}><MessageCircle /> {messageLabel}</button>
          <button className="score-retake" type="button" onClick={onRetake}><RotateCcw /> Record another take</button>
        </div>
      </section>
    </div>
  );
}

function KaraokeStudio({ track, onBack, onReplaceVideo, onSavedTake, onPracticeProgress }) {
  const practiceKey = track.youtubeId || track.id;
  const savedPractice = useMemo(() => readPracticeState(practiceKey), [practiceKey]);
  const [ready, setReady] = useState(false);
  const [playerError, setPlayerError] = useState(null);
  const [playbackTrack, setPlaybackTrack] = useState(track);
  const [replacingPlayback, setReplacingPlayback] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(track.duration || 240);
  const [volume, setVolume] = useState(88);
  const [speed, setSpeed] = useState(1);
  const [keyShift, setKeyShift] = useState(0);
  const [scriptMode, setScriptMode] = useState("devanagari");
  const [lyricOffset, setLyricOffset] = useState(0);
  const [loop, setLoop] = useState({ a: null, b: null });
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingUrl, setRecordingUrl] = useState("");
  const [takeScore, setTakeScore] = useState(null);
  const [takeAnalysis, setTakeAnalysis] = useState(null);
  const [scorecardOpen, setScorecardOpen] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [pitchData, setPitchData] = useState(null);
  const [pitchStability, setPitchStability] = useState(null);
  const [micMessage, setMicMessage] = useState("");
  const [theater, setTheater] = useState(false);
  const [practiceFocus, setPracticeFocus] = useState(savedPractice.focus || "Warm-up");
  const [routineOffset, setRoutineOffset] = useState(savedPractice.offset || 0);
  const [routineCompleted, setRoutineCompleted] = useState(savedPractice.completed || []);
  const [hardLines, setHardLines] = useState(savedPractice.hardLines || []);
  const [breathLines, setBreathLines] = useState(savedPractice.breathLines || []);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const animationRef = useRef(null);
  const lyricsScrollRef = useRef(null);
  const levelSamplesRef = useRef([]);
  const pitchSamplesRef = useRef([]);
  const pitchCentsRef = useRef([]);
  const timingSamplesRef = useRef([]);
  const currentTimeRef = useRef(currentTime);
  const chunksRef = useRef([]);
  const fallbackCandidatesRef = useRef([]);
  const triedVideoIdsRef = useRef(new Set([track.youtubeId].filter(Boolean)));
  const handledPlaybackErrorsRef = useRef(new Set());
  const fallbackLoadingRef = useRef(false);
  const Player = playbackTrack.instrumentalUrl ? AudioTrackPlayer : YouTubePlayer;
  const routine = useMemo(() => buildPracticeRoutine(practiceFocus, routineOffset), [practiceFocus, routineOffset]);

  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);
  useEffect(() => {
    setPlaybackTrack(track);
    setPlayerError(null);
    setReplacingPlayback(false);
    fallbackCandidatesRef.current = [];
    triedVideoIdsRef.current = new Set([track.youtubeId].filter(Boolean));
    handledPlaybackErrorsRef.current = new Set();
    fallbackLoadingRef.current = false;
  }, [track.youtubeId, track.instrumentalUrl]);

  const handleReadyChange = (value) => {
    setReady(value);
    if (value) {
      setPlayerError(null);
      setReplacingPlayback(false);
    }
  };

  const handlePlaybackError = async (error) => {
    const canTryAlternative = !playbackTrack.instrumentalUrl && [100, 101, 150].includes(error?.code);
    const failedVideoId = playbackTrack.youtubeId;
    if (!canTryAlternative || fallbackLoadingRef.current || handledPlaybackErrorsRef.current.has(failedVideoId)) {
      if (!canTryAlternative && !fallbackLoadingRef.current) setPlayerError(error);
      return;
    }

    handledPlaybackErrorsRef.current.add(failedVideoId);
    fallbackLoadingRef.current = true;
    setReady(false);
    setPlaying(false);
    setPlayerError(null);
    setReplacingPlayback(true);
    try {
      let candidates = fallbackCandidatesRef.current;
      if (!candidates.length) {
        const query = makeKaraokeSearchQuery(track.title, track.artist);
        const upstream = await fetch(`/api/youtube-search?q=${encodeURIComponent(query)}`);
        const payload = await upstream.json();
        if (!upstream.ok) throw new Error(payload.error || "Alternative search failed.");
        candidates = payload.results || [];
        fallbackCandidatesRef.current = candidates;
      }
      const next = chooseNextYouTubeResult(candidates, [...triedVideoIdsRef.current]);
      if (!next) throw new Error("No more playable karaoke versions were found.");
      triedVideoIdsRef.current.add(next.id);
      setCurrentTime(0);
      setDuration(next.duration || track.duration || 240);
      setPlaybackTrack({
        ...track,
        youtubeId: next.id,
        sourceUrl: next.url || `https://www.youtube.com/watch?v=${next.id}`,
        duration: next.duration || track.duration,
        playbackTitle: next.title,
        playbackChannel: next.channel,
      });
    } catch {
      setReplacingPlayback(false);
      setPlayerError({
        ...error,
        title: "No playable YouTube version was found",
        message: "SurStudio tried the available karaoke alternatives. Open YouTube to watch this version, or choose a different upload while keeping your lyrics and practice setup.",
      });
    } finally {
      fallbackLoadingRef.current = false;
    }
  };

  const lyricTiming = useMemo(() => fitLyricTimings(track.lyrics || [], track.duration, duration, track.syncKind), [track.lyrics, track.duration, duration, track.syncKind]);
  const timingScale = lyricTiming.scale;
  const lyrics = lyricTiming.cues;
  const activeLyricIndex = useMemo(() => {
    const syncedTime = currentTime + lyricOffset;
    let index = 0;
    lyrics.forEach((line, lineIndex) => { if (line.start <= syncedTime) index = lineIndex; });
    return index;
  }, [currentTime, lyricOffset, lyrics]);

  useEffect(() => {
    const activeLine = lyricsScrollRef.current?.children?.[activeLyricIndex];
    activeLine?.scrollIntoView?.({ block: "center", behavior: "smooth" });
  }, [activeLyricIndex]);

  useEffect(() => {
    localStorage.setItem(`surstudio-practice-${practiceKey}`, JSON.stringify({
      focus: practiceFocus,
      offset: routineOffset,
      completed: routineCompleted,
      hardLines,
      breathLines,
    }));
  }, [practiceKey, practiceFocus, routineOffset, routineCompleted, hardLines, breathLines]);

  const seekTo = (value) => {
    setCurrentTime(value);
    window.dispatchEvent(new CustomEvent("surstudio:seek", { detail: value }));
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    setPitchData(null);
    cancelAnimationFrame(animationRef.current);
    audioContextRef.current?.close();
    streamRef.current?.getTracks().forEach((item) => item.stop());
  };

  const startRecording = async () => {
    if (recording) {
      stopRecording();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setMicMessage("Recording is not supported in this browser.");
      return;
    }
    try {
      setMicMessage("");
      chunksRef.current = [];
      levelSamplesRef.current = [];
      pitchSamplesRef.current = [];
      pitchCentsRef.current = [];
      timingSamplesRef.current = [];
      setTakeScore(null);
      setTakeAnalysis(null);
      setScorecardOpen(false);
      setPitchStability(null);
      setRecordingUrl("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const url = URL.createObjectURL(blob);
        const analysis = calculatePerformanceBreakdown({
          levelSamples: levelSamplesRef.current,
          pitchSamples: pitchSamplesRef.current,
          pitchCents: pitchCentsRef.current,
          timingSamples: timingSamplesRef.current,
          lyrics,
        });
        const score = analysis.overall;
        const stability = analysis.metrics.pitch;
        setRecordingUrl(url);
        setTakeScore(score);
        setTakeAnalysis(analysis);
        setScorecardOpen(true);
        setPitchStability(stability);
        onSavedTake({ id: crypto.randomUUID(), title: track.title, artist: track.artist, score, pitchStability: stability, metrics: analysis.metrics, tier: analysis.tier, createdAt: new Date().toISOString() });
      };
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const context = new AudioContext();
      audioContextRef.current = context;
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      context.createMediaStreamSource(stream).connect(analyser);
      const buffer = new Float32Array(analyser.fftSize);
      let frame = 0;
      let missedPitchFrames = 0;
      const meter = () => {
        analyser.getFloatTimeDomainData(buffer);
        let sum = 0;
        buffer.forEach((value) => { sum += value * value; });
        const rms = Math.sqrt(sum / buffer.length);
        setMicLevel(Math.min(1, rms * 5));
        levelSamplesRef.current.push(rms);
        timingSamplesRef.current.push({ time: currentTimeRef.current, level: rms });
        frame += 1;
        if (frame % 8 === 0) {
          const detected = detectPitch(buffer, context.sampleRate);
          if (detected) {
            setPitchData(detected);
            pitchSamplesRef.current.push(detected.frequency);
            pitchCentsRef.current.push(detected.cents);
            missedPitchFrames = 0;
          } else {
            missedPitchFrames += 1;
            if (missedPitchFrames > 3) setPitchData(null);
          }
        }
        animationRef.current = requestAnimationFrame(meter);
      };
      meter();
      recorder.start(250);
      setRecordingSeconds(0);
      setRecording(true);
    } catch (error) {
      setMicMessage(error?.name === "NotAllowedError" ? "Microphone access was not granted. You can retry whenever you’re ready." : "Could not start the microphone. Check your input device and try again.");
    }
  };

  useEffect(() => {
    if (!recording) return undefined;
    const timer = window.setInterval(() => setRecordingSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  useEffect(() => () => {
    cancelAnimationFrame(animationRef.current);
    streamRef.current?.getTracks().forEach((item) => item.stop());
    if (recordingUrl) URL.revokeObjectURL(recordingUrl);
  }, [recordingUrl]);

  const setLoopPoint = (point) => {
    setLoop((value) => {
      const next = { ...value, [point]: Number(currentTime.toFixed(1)) };
      if (point === "b" && next.a !== null && next.b <= next.a) next.b = Number((next.a + 2).toFixed(1));
      return next;
    });
  };

  const loopActivePhrase = () => {
    const start = lyrics[activeLyricIndex]?.start || 0;
    const nextStart = lyrics[activeLyricIndex + 1]?.start;
    const end = Math.max(start + 1.5, nextStart ? nextStart - 0.12 : Math.min(duration, start + 8));
    setLoop({ a: Number(start.toFixed(2)), b: Number(end.toFixed(2)) });
    setHardLines((value) => value.includes(activeLyricIndex) ? value : [...value, activeLyricIndex]);
    seekTo(start);
  };

  const toggleBreathMark = () => {
    setBreathLines((value) => value.includes(activeLyricIndex) ? value.filter((index) => index !== activeLyricIndex) : [...value, activeLyricIndex]);
  };

  const toggleRoutineItem = (id) => {
    setRoutineCompleted((value) => {
      const alreadyComplete = value.includes(id);
      if (!alreadyComplete) onPracticeProgress?.(track);
      return alreadyComplete ? value.filter((item) => item !== id) : [...value, id];
    });
  };

  const shuffleRoutine = () => {
    setRoutineOffset((value) => value + 1);
    setRoutineCompleted([]);
  };

  return (
    <>
    <main className={theater ? "studio-view theater-mode" : "studio-view"}>
      <div className="studio-topbar page-shell">
        <button className="back-link" type="button" onClick={onBack}><ChevronLeft /> Back to discover</button>
        <div className="studio-status"><span className={ready ? "status-dot live" : "status-dot"} /> {replacingPlayback ? "Finding a playable version" : playerError ? "Choose another video" : ready ? "Player ready" : "Connecting player"}</div>
        <button className="text-button" type="button" onClick={() => setTheater((value) => !value)}><Film /> {theater ? "Exit lyric view" : "Lyric view"}</button>
      </div>

      <div className="studio-layout page-shell">
        <section className="player-column" aria-label="Karaoke player">
          <div className="player-frame">
            <Player
              track={playbackTrack}
              onReadyChange={handleReadyChange}
              onPlaybackError={handlePlaybackError}
              currentTime={currentTime}
              setCurrentTime={setCurrentTime}
              duration={duration}
              setDuration={setDuration}
              playing={playing}
              setPlaying={setPlaying}
              volume={volume}
              speed={speed}
              loop={loop}
            />
            {!ready && !playerError && <div className="player-loading"><span className="loader" /><strong>{replacingPlayback ? "Finding a playable karaoke version" : "Preparing your rehearsal room"}</strong><small>{replacingPlayback ? "SurStudio is checking the next matching upload automatically." : playbackTrack.instrumentalUrl ? "Loading your local instrumental." : "The video stays hosted by YouTube."}</small></div>}
            {playerError && <div className="player-error" role="alert"><span><AlertTriangle /></span><strong>{playerError.title}</strong><p>{playerError.message}</p><div><button className="button button-primary" type="button" onClick={() => onReplaceVideo(track)}>Choose another video</button><a className="button button-secondary" href={playbackTrack.sourceUrl || `https://www.youtube.com/watch?v=${playbackTrack.youtubeId}`} target="_blank" rel="noreferrer">Watch on YouTube</a></div></div>}
            <div className={playbackTrack.instrumentalUrl ? "player-badge local" : "player-badge"}>{playbackTrack.instrumentalUrl ? <><FileAudio /> Local instrumental</> : <><Youtube /> Embedded playback</>}</div>
          </div>

          <div className="track-heading">
            <div><span>{track.language || "Hindi"} · custom karaoke{timingScale !== 1 ? " · timing fitted to playback" : ""}</span><h1>{track.title}</h1><p>{track.artist || "Your imported track"}</p></div>
            <div className="key-display"><small>Guide key</small><strong>{keyShift > 0 ? `+${keyShift}` : keyShift}</strong></div>
          </div>

          <div className="transport-panel">
            <div className="timeline-row"><span>{formatTime(currentTime)}</span><input aria-label="Song position" type="range" min="0" max={Math.max(1, duration)} step="0.1" value={Math.min(currentTime, duration)} onChange={(event) => seekTo(Number(event.target.value))} /><span>{formatTime(duration)}</span></div>
            <div className="transport-row">
              <div className="volume-control"><Volume2 /><input aria-label="Playback volume" type="range" min="0" max="100" value={volume} onChange={(event) => setVolume(Number(event.target.value))} /></div>
              <button className="skip-button" type="button" aria-label="Back ten seconds" onClick={() => seekTo(Math.max(0, currentTime - 10))}><RotateCcw /></button>
              <button className="main-play" type="button" aria-label={playing ? "Pause" : "Play"} onClick={() => setPlaying((value) => !value)} disabled={!ready}>{playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}</button>
              <button className="skip-button" type="button" aria-label="Forward ten seconds" onClick={() => seekTo(Math.min(duration, currentTime + 10))}><RotateCcw className="flip" /></button>
              <div className="tempo-control"><small>Tempo</small><select aria-label="Playback speed" value={speed} onChange={(event) => setSpeed(Number(event.target.value))}><option value="0.75">0.75×</option><option value="1">1.00×</option><option value="1.25">1.25×</option><option value="1.5">1.50×</option></select></div>
            </div>
          </div>

          <div className="practice-tools">
            <MacNativePanel lyrics={lyrics} />
            <article className="tool-card">
              <div className="tool-title"><span><TimerReset /></span><div><h3>Practice loop</h3><p>Mark the phrase you want to repeat.</p></div></div>
              <div className="loop-controls"><button type="button" onClick={() => setLoopPoint("a")} className={loop.a !== null ? "set" : ""}>A <span>{loop.a === null ? "Set start" : formatTime(loop.a)}</span></button><div className="loop-line" /><button type="button" onClick={() => setLoopPoint("b")} className={loop.b !== null ? "set" : ""}>B <span>{loop.b === null ? "Set end" : formatTime(loop.b)}</span></button><button className="icon-button" aria-label="Clear loop" type="button" onClick={() => setLoop({ a: null, b: null })}><X /></button></div>
            </article>

            <article className="tool-card">
              <div className="tool-title"><span><SlidersHorizontal /></span><div><h3>Key guide</h3><p>Transpose the note guide for your range.</p></div></div>
              <div className="key-stepper"><button type="button" aria-label="Lower guide key" onClick={() => setKeyShift((value) => Math.max(-6, value - 1))}><Minus /></button><strong>{keyShift > 0 ? `+${keyShift}` : keyShift} semitones</strong><button type="button" aria-label="Raise guide key" onClick={() => setKeyShift((value) => Math.min(6, value + 1))}><Plus /></button></div>
              <p className="tool-note">Guide display only; playback pitch is not altered.</p>
            </article>

            <article className="tool-card practice-coach-card">
              <div className="tool-title"><span><ListChecks /></span><div><h3>Tonight’s practice deck</h3><p>Three focused steps, saved for this song.</p></div><strong className="routine-score">{routineCompleted.filter((id) => routine.some((item) => item.id === id)).length}/3</strong></div>
              <div className="focus-chips" aria-label="Practice focus">
                {practiceFocuses.map((focus) => <button key={focus} type="button" className={practiceFocus === focus ? "active" : ""} onClick={() => { setPracticeFocus(focus); setRoutineCompleted([]); }}>{focus}</button>)}
              </div>
              <div className="routine-list">
                {routine.map((item) => {
                  const complete = routineCompleted.includes(item.id);
                  return <button key={item.id} type="button" className={complete ? "complete" : ""} onClick={() => toggleRoutineItem(item.id)}><span>{complete ? <Check /> : <i />}</span><div><strong>{item.title}</strong><small>{item.detail}</small></div><em>{item.duration}</em></button>;
                })}
              </div>
              <button className="shuffle-routine" type="button" onClick={shuffleRoutine}><Shuffle /> Shuffle this focus</button>
            </article>
          </div>
        </section>

        <aside className="lyrics-column" aria-label="Synchronized lyrics">
          <div className="lyrics-head">
            <div><div className="eyebrow eyebrow-muted"><BookOpenText /> Live lyrics</div><h2>Sing the next line</h2></div>
            <div className="segmented"><button type="button" className={scriptMode === "devanagari" ? "active" : ""} onClick={() => setScriptMode("devanagari")}>हिंदी</button><button type="button" className={scriptMode === "roman" ? "active" : ""} onClick={() => setScriptMode("roman")}>Roman</button></div>
          </div>
          <div ref={lyricsScrollRef} className="lyrics-scroll" aria-live="polite">
            {lyrics.map((line, index) => {
              const classes = ["lyric-line", index === activeLyricIndex ? "active" : index < activeLyricIndex ? "past" : "", hardLines.includes(index) ? "hard-line" : ""].filter(Boolean).join(" ");
              return (
                <button key={line.id} className={classes} type="button" onClick={() => seekTo(line.start)}>
                  <span>{formatTime(line.start)}</span><strong>{scriptMode === "roman" ? line.roman : line.text}</strong><span className="lyric-flags">{hardLines.includes(index) && <Target />}{breathLines.includes(index) && <Wind />}{index === activeLyricIndex && <AudioLines />}</span>
                </button>
              );
            })}
          </div>
          <div className="phrase-actions"><button type="button" className={hardLines.includes(activeLyricIndex) ? "active" : ""} onClick={loopActivePhrase}><Target /> {hardLines.includes(activeLyricIndex) ? "Hard line looped" : "Loop hard line"}</button><button type="button" className={breathLines.includes(activeLyricIndex) ? "active" : ""} onClick={toggleBreathMark}><Wind /> {breathLines.includes(activeLyricIndex) ? "Breath marked" : "Mark breath"}</button></div>
          <div className="sync-control"><span>Lyric sync</span><button type="button" onClick={() => setLyricOffset((value) => Number((value - 0.25).toFixed(2)))}>-0.25s</button><strong>{lyricOffset > 0 ? "+" : ""}{lyricOffset.toFixed(2)}s</strong><button type="button" onClick={() => setLyricOffset((value) => Number((value + 0.25).toFixed(2)))}>+0.25s</button></div>

          <div className={recording ? "recorder-panel is-recording" : "recorder-panel"}>
            <div className="recorder-top"><div><span className="record-dot" /><strong>{recording ? `Recording ${formatTime(recordingSeconds)}` : "Record your take"}</strong><small>{recording ? "Your microphone is live" : "Private and saved only in this browser"}</small></div><div className="level-meter" aria-label="Microphone level"><i style={{ width: `${Math.round(micLevel * 100)}%` }} /></div></div>
            <div className={recording ? "pitch-readout is-live" : "pitch-readout"}><span><Activity /> Live pitch</span><strong>{pitchData?.note || "—"}</strong><small>{pitchData ? `${pitchData.frequency} Hz · ${pitchData.cents > 0 ? "+" : ""}${pitchData.cents} cents` : recording ? "Sing a steady note" : "Appears while recording"}</small></div>
            <button className={recording ? "button record-button stop" : "button record-button"} type="button" onClick={startRecording}>{recording ? <><Square fill="currentColor" /> Stop & score</> : <><Mic2 /> Start recording</>}</button>
            {micMessage && <p className="mic-message">{micMessage}</p>}
            {recordingUrl && <div className="take-result"><div className="score-ring"><strong>{takeScore}</strong><span>/10</span></div><div><strong>{takeAnalysis?.tier || "Take saved"}{pitchStability !== null ? ` · ${pitchStability}% pitch` : ""}</strong><audio controls src={recordingUrl} /><div className="take-result-links"><button type="button" onClick={() => setScorecardOpen(true)}><CircleGauge /> View full score</button><a href={recordingUrl} download={`${track.title.replace(/\s+/g, "-").toLowerCase()}-take.webm`}><Download /> Download</a></div></div></div>}
          </div>
        </aside>
      </div>
    </main>
    {scorecardOpen && takeAnalysis && recordingUrl && <TakeScorecard analysis={takeAnalysis} recordingUrl={recordingUrl} track={track} onClose={() => setScorecardOpen(false)} onRetake={() => { setScorecardOpen(false); startRecording(); }} />}
    </>
  );
}

function LegacyBuilder({ seed, onClose, onBuild }) {
  const [url, setUrl] = useState(seed?.url ?? "https://www.youtube.com/watch?v=9URJJEk7GkE");
  const [title, setTitle] = useState(seed?.title || "My Hindi karaoke session");
  const [artist, setArtist] = useState(seed?.artist || "");
  const [language, setLanguage] = useState(seed?.language || "Hindi");
  const [lyrics, setLyrics] = useState(demoLyrics);
  const [leadIn, setLeadIn] = useState(8);
  const videoId = extractYouTubeId(url);

  const submit = (event) => {
    event.preventDefault();
    if (!videoId || !title.trim() || !lyrics.trim()) return;
    onBuild({
      id: `youtube-${videoId}`,
      youtubeId: videoId,
      title: title.trim(),
      artist: artist.trim() || "YouTube import",
      language,
      duration: 240,
      lyrics: createTimedLyrics(lyrics, 240, Number(leadIn)),
    });
  };

  return (
    <div className="builder-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className="builder-sheet" role="dialog" aria-modal="true" aria-labelledby="builder-title">
        <div className="builder-header"><div><div className="eyebrow"><Youtube /> Creator studio</div><h2 id="builder-title">Build karaoke from YouTube</h2><p>Use an embeddable video you’re allowed to use. SurStudio does not download or extract the media.</p></div><button className="icon-button close-builder" type="button" aria-label="Close builder" onClick={onClose}><X /></button></div>
        <form className="builder-form" onSubmit={submit}>
          <div className="field full-field"><label htmlFor="youtube-url">YouTube video URL</label><div className={videoId ? "input-with-icon valid" : "input-with-icon"}><Youtube /><input id="youtube-url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=..." aria-describedby="url-help" />{videoId && <Check />}</div><small id="url-help">{videoId ? `Video detected: ${videoId}` : "Paste a standard YouTube, Shorts, Live, or youtu.be URL."}</small></div>
          <div className="field"><label htmlFor="track-title">Song title</label><input id="track-title" value={title} onChange={(event) => setTitle(event.target.value)} required /></div>
          <div className="field"><label htmlFor="track-artist">Singer / channel</label><input id="track-artist" value={artist} onChange={(event) => setArtist(event.target.value)} placeholder="Optional" /></div>
          <div className="field"><label htmlFor="track-language">Lyric language</label><select id="track-language" value={language} onChange={(event) => setLanguage(event.target.value)}><option>Hindi</option><option>Hinglish</option><option>Urdu / Hindi</option><option>Punjabi</option><option>Tamil</option><option>Telugu</option><option>Other</option></select></div>
          <div className="field"><label htmlFor="lead-in">First lyric starts</label><div className="suffix-input"><input id="lead-in" type="number" min="0" max="60" value={leadIn} onChange={(event) => setLeadIn(event.target.value)} /><span>seconds</span></div></div>
          <div className="field full-field"><div className="label-row"><label htmlFor="lyrics">Lyrics — one line per cue</label><span><Languages /> Devanagari auto-romanizes</span></div><textarea id="lyrics" rows="7" value={lyrics} onChange={(event) => setLyrics(event.target.value)} required /><small>{lyrics.split(/\r?\n/).filter((line) => line.trim()).length} lyric cues · timing can be fine-tuned inside the studio</small></div>
          <div className="builder-summary"><div><WandSparkles /><span><strong>What SurStudio will create</strong><small>Embedded player · timed lyric cues · Hindi/Roman switch · practice loops · local recording</small></span></div><button className="button button-primary build-submit" type="submit" disabled={!videoId || !title.trim() || !lyrics.trim()}>Build my karaoke <ArrowRight /></button></div>
        </form>
      </section>
    </div>
  );
}

function LibraryView({ library, onDiscover, onResumeTrack, account, scoreSyncState }) {
  const rhythm = getPracticeRhythm(library.activity);
  const activeDays = rhythm.filter((day) => day.active).length;
  const bestTake = library.takes.reduce((best, take) => !best || Number(take.score) > Number(best.score) ? take : best, null);
  const latestTake = library.takes[0] || null;
  const averageScore = library.takes.length ? (library.takes.reduce((sum, take) => sum + Number(take.score || 0), 0) / library.takes.length).toFixed(1) : "—";
  const uniqueSongs = new Set(library.takes.map((take) => take.title)).size;
  return (
    <main className="library-view page-shell">
      <div className="library-hero"><div className="eyebrow"><Library /> Your singer dashboard</div><h1>Notice what is getting easier.</h1><p>{account.authenticated ? "Your score history follows your SurStudio account. Recordings stay on this device, and SurStudio never stores recipients or message history." : account.authConfigured ? "Scores stay safely on this device until you sign in, then your score history can follow you. Recordings and sharing activity remain private." : "Your practice rhythm, scores, and favourites stay on this device. Share only the score cards you choose—SurStudio never stores recipients or message history."}</p></div>
      <section className="dashboard-overview" aria-label="Singer dashboard summary">
        <div className="dashboard-profile">{account.user?.image ? <span className="profile-photo"><img src={account.user.image} alt="" referrerPolicy="no-referrer" /></span> : <span><Mic2 /></span>}<div><small>{account.authenticated ? scoreSyncState === "syncing" ? "Syncing score history" : "Google singer profile" : "Local singer profile"}</small><strong>{account.user?.name || "Your SurStudio journey"}</strong><p>{library.takes.length ? `${library.takes.length} scored ${library.takes.length === 1 ? "take" : "takes"} across ${uniqueSongs} ${uniqueSongs === 1 ? "song" : "songs"}.` : "Your first scored take will start the dashboard."}</p></div></div>
        <div className="dashboard-stats"><span><small>Best take</small><strong>{bestTake ? bestTake.score : "—"}<i>{bestTake ? "/10" : ""}</i></strong></span><span><small>Average</small><strong>{averageScore}<i>{library.takes.length ? "/10" : ""}</i></strong></span><span><small>This week</small><strong>{activeDays}<i> days</i></strong></span></div>
        {latestTake ? <DashboardShareCard take={latestTake} /> : <button className="dashboard-first-take" type="button" onClick={onDiscover}><CircleGauge /><span><strong>Make your first share card</strong><small>Record a take to unlock a private score image.</small></span><ArrowRight /></button>}
      </section>
      <section className="library-rhythm" aria-label="Seven day practice rhythm"><div><strong>{activeDays}</strong><span>meaningful practice days this week</span></div><div className="practice-rhythm">{rhythm.map((day) => <span key={day.key} className={day.active ? "active" : day.today ? "today" : ""} aria-label={`${day.key}: ${day.active ? "practiced" : "no practice saved"}`}><i />{day.label}</span>)}</div>{library.lastTrack && <button className="button button-secondary" type="button" onClick={() => onResumeTrack(library.lastTrack)}><Play fill="currentColor" /> Resume {library.lastTrack.title}</button>}</section>
      <div className="library-grid">
        <section><div className="section-heading compact-heading"><div><h2>Recent scores</h2><p>{library.takes.length} saved {library.takes.length === 1 ? "take" : "takes"}</p></div></div>{library.takes.length ? <div className="takes-list">{library.takes.map((take) => <article key={take.id}><span className="mini-score">{take.score}</span><div><strong>{take.title}</strong><small>{take.artist} · {new Date(take.createdAt).toLocaleDateString()}{take.tier ? ` · ${take.tier}` : take.pitchStability != null ? ` · ${take.pitchStability}% pitch` : ""}</small>{take.metrics && <span className="take-metrics"><i>P {take.metrics.pitch}</i><i>T {take.metrics.timing}</i><i>R {take.metrics.range}</i><i>C {take.metrics.control}</i></span>}</div><TakeShareButtons take={take} /></article>)}</div> : <EmptyState icon={Mic2} title="No takes yet" copy="Open a song, allow your microphone, and record your first performance." onAction={onDiscover} />}</section>
        <section><div className="section-heading compact-heading"><div><h2>Favourite songs</h2><p>{library.favorites.length} saved</p></div></div>{library.favorites.length ? <div className="favorite-list">{featuredSongs.filter((song) => library.favorites.includes(song.id)).map((song) => <article key={song.id}><span className={`result-orb ${song.accent}`}><Music2 /></span><div><strong>{song.title}</strong><small>{song.artist}</small></div><Heart fill="currentColor" /></article>)}</div> : <EmptyState icon={Heart} title="Nothing saved yet" copy="Tap the heart on a Bollywood favourite to keep it close." onAction={onDiscover} />}</section>
      </div>
    </main>
  );
}

function DashboardShareCard({ take }) {
  return <article className="dashboard-share-card"><div><small>Latest score card</small><strong>{take.title}</strong><span>{take.score}<i>/10</i> · {take.tier || "Practice take"}</span></div><TakeShareButtons take={take} featured /></article>;
}

function TakeShareButtons({ take, featured = false }) {
  const [status, setStatus] = useState("");
  const share = async (destination) => {
    setStatus("Preparing…");
    try {
      const result = await shareScoreCard(take, destination);
      setStatus(result.downloaded ? "Card downloaded" : destination === "messages" ? "Messages opened" : "Share opened");
    } catch (error) {
      if (error?.name !== "AbortError") setStatus("Could not share");
      else setStatus("");
    }
  };
  return <div className={featured ? "take-share-actions featured" : "take-share-actions"}><button type="button" onClick={() => share("picker")} aria-label={`Share score card for ${take.title}`}><Share2 /> {featured && "Share card"}</button><button type="button" onClick={() => share("messages")} aria-label={`Share ${take.title} score in Messages`}><MessageCircle /> {featured && "Messages"}</button>{status && <small>{status}</small>}</div>;
}

function ScoreCardImagePreview({ take }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let active = true;
    let objectUrl = "";
    createScoreCardFile(take).then((file) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(file);
      setUrl(objectUrl);
    });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [take]);
  return <div className="score-card-image-preview" aria-label="Generated score card preview">{url ? <img src={url} alt="Generated SurStudio score sharing card" /> : <LoaderCircle className="spinning" />}</div>;
}

function EmptyState({ icon: Icon, title, copy, onAction }) {
  return <div className="empty-state"><span><Icon /></span><h3>{title}</h3><p>{copy}</p><button className="button button-secondary" type="button" onClick={onAction}>Browse songs</button></div>;
}

function Footer() {
  return <footer className="site-footer"><div className="page-shell"><Brand /><p>Your online karaoke studio for smarter practice, stronger performances, and one more take.</p><div><span>Automatic lyric match</span><span>Hindi + Bollywood ready</span><span>Private recording</span></div></div></footer>;
}

export function App() {
  const dashboardPreview = import.meta.env.DEV && new URLSearchParams(window.location.search).has("dashboard-preview");
  const shareCardPreview = import.meta.env.DEV && new URLSearchParams(window.location.search).has("share-card-preview");
  const groupsPreview = import.meta.env.DEV && new URLSearchParams(window.location.search).has("groups-preview");
  const hostedGroups = !hasNativeMacBridge();
  const initialInviteToken = normalizeInviteToken(new URLSearchParams(window.location.search).get("invite"));
  const [view, setView] = useState(dashboardPreview ? "library" : groupsPreview || initialInviteToken ? "groups" : "discover");
  const [inviteToken, setInviteToken] = useState(initialInviteToken);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderSeed, setBuilderSeed] = useState(null);
  const [library, setLibrary] = useState(() => dashboardPreview ? DASHBOARD_PREVIEW_LIBRARY : readLibrary());
  const [activeTrack, setActiveTrack] = useState(() => readLibrary().lastTrack || null);
  const [scorePreviewOpen, setScorePreviewOpen] = useState(() => import.meta.env.DEV && new URLSearchParams(window.location.search).has("score-preview"));
  const [account, setAccount] = useState(() => groupsPreview ? {
    authenticated: true,
    authConfigured: true,
    databaseConfigured: true,
    scoreSyncAvailable: true,
    groupsAvailable: true,
    user: { id: "preview-rahul", name: "Rahul", email: "preview@surstudio.local", image: null },
  } : { authenticated: false, authConfigured: false, databaseConfigured: false, scoreSyncAvailable: false, groupsAvailable: false, user: null });
  const [scoreSyncState, setScoreSyncState] = useState("local");

  useEffect(() => { if (!dashboardPreview) writeLibrary(library); }, [dashboardPreview, library]);
  useEffect(() => {
    if (!dashboardPreview) return undefined;
    window.__surStudioCreateScoreCard = createScoreCardFile;
    return () => { delete window.__surStudioCreateScoreCard; };
  }, [dashboardPreview]);
  useEffect(() => {
    if (dashboardPreview || groupsPreview) return undefined;
    let active = true;
    const synchronize = async () => {
      const currentAccount = await loadAccount();
      if (!active) return;
      setAccount(currentAccount);
      if (!currentAccount.scoreSyncAvailable) {
        setScoreSyncState("local");
        return;
      }
      setScoreSyncState("syncing");
      try {
        const localScores = readLibrary().takes || [];
        const remoteScores = await loadRemoteScores();
        const remoteIds = new Set(remoteScores.map((score) => score.id));
        const pending = localScores.filter((score) => score?.id && !remoteIds.has(score.id));
        if (pending.length) await Promise.all(pending.slice(0, 100).map((score) => saveRemoteScore(score)));
        const synchronizedScores = pending.length ? await loadRemoteScores() : remoteScores;
        if (!active) return;
        setLibrary((value) => ({ ...value, takes: mergeScores(value.takes, synchronizedScores) }));
        setScoreSyncState("synced");
      } catch {
        if (active) setScoreSyncState("error");
      }
    };
    synchronize();
    return () => { active = false; };
  }, [dashboardPreview, groupsPreview]);

  const openBuilder = (value) => {
    setBuilderSeed(typeof value === "string" ? { url: value } : value || null);
    setBuilderOpen(true);
  };

  const buildTrack = (track) => {
    setActiveTrack(track);
    setLibrary((value) => ({ ...value, lastTrack: persistableTrack(track), activity: mergeDailyActivity(value.activity, { started: true, trackId: track.youtubeId || track.id, title: track.title }) }));
    setBuilderOpen(false);
    setView("studio");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const pickSong = (song) => {
    openBuilder({ url: "", title: song.title, artist: song.artist, language: song.language, searchQuery: makeKaraokeSearchQuery(song.title, song.artist) });
  };

  const toggleFavorite = (id) => {
    setLibrary((value) => ({ ...value, favorites: value.favorites.includes(id) ? value.favorites.filter((item) => item !== id) : [...value.favorites, id] }));
  };

  const saveTake = (take) => {
    setLibrary((value) => ({ ...value, takes: mergeScores([take], value.takes), activity: mergeDailyActivity(value.activity, { recorded: true, title: take.title }) }));
    if (account.scoreSyncAvailable) {
      setScoreSyncState("syncing");
      saveRemoteScore(take)
        .then((saved) => {
          setLibrary((value) => ({ ...value, takes: mergeScores(value.takes, [saved]) }));
          setScoreSyncState("synced");
        })
        .catch(() => setScoreSyncState("error"));
    }
  };

  const savePracticeProgress = (track) => {
    setLibrary((value) => ({ ...value, activity: mergeDailyActivity(value.activity, { practiced: true, trackId: track.youtubeId || track.id, title: track.title }) }));
  };

  const resumeTrack = (track) => {
    setActiveTrack(track);
    setLibrary((value) => ({ ...value, activity: mergeDailyActivity(value.activity, { started: true, trackId: track.youtubeId || track.id, title: track.title }) }));
    setView("studio");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const navigate = (nextView) => {
    if (nextView === "studio" && !activeTrack) {
      openBuilder();
      return;
    }
    setView(nextView);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleInvite = () => {
    setInviteToken("");
    const url = new URL(window.location.href);
    url.searchParams.delete("invite");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  };

  return (
    <div id="top" className="app-shell">
      <Header currentView={view} onNavigate={navigate} onOpenBuilder={() => openBuilder()} libraryCount={library.takes.length} account={account} scoreSyncState={scoreSyncState} hostedGroups={hostedGroups} />
      {view === "discover" && <Discovery onOpenBuilder={openBuilder} onPickSong={pickSong} onResumeTrack={resumeTrack} favorites={library.favorites} onFavorite={toggleFavorite} library={library} />}
      {view === "studio" && activeTrack && <KaraokeStudio track={activeTrack} onBack={() => navigate("discover")} onReplaceVideo={(track) => openBuilder({ url: "", title: track.title, artist: track.artist, language: track.language, searchQuery: makeKaraokeSearchQuery(track.title, track.artist) })} onSavedTake={saveTake} onPracticeProgress={savePracticeProgress} />}
      {view === "library" && <LibraryView library={library} onDiscover={() => navigate("discover")} onResumeTrack={resumeTrack} account={account} scoreSyncState={scoreSyncState} />}
      {view === "groups" && <GroupsView account={account} inviteToken={inviteToken} onInviteHandled={handleInvite} preview={groupsPreview} />}
      {view !== "studio" && <Footer />}
      {builderOpen && <Builder seed={builderSeed} onClose={() => setBuilderOpen(false)} onBuild={buildTrack} />}
      {scorePreviewOpen && <TakeScorecard analysis={SCORECARD_PREVIEW} recordingUrl={SILENT_PREVIEW_AUDIO} track={featuredSongs[0]} onClose={() => setScorePreviewOpen(false)} onRetake={() => setScorePreviewOpen(false)} />}
      {shareCardPreview && <ScoreCardImagePreview take={DASHBOARD_PREVIEW_LIBRARY.takes[0]} />}
    </div>
  );
}
