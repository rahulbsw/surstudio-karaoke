export const practiceFocuses = ["Warm-up", "Pitch", "Breath", "Phrasing", "Performance"];

export const practiceDecks = {
  "Warm-up": [
    { id: "warm-lip-trill", title: "Lip trill the chorus", detail: "Keep the jaw loose and the airflow even.", duration: "60 sec" },
    { id: "warm-sirens", title: "Five gentle sirens", detail: "Slide from a comfortable low note to a comfortable high note.", duration: "90 sec" },
    { id: "warm-hum", title: "Hum the first verse", detail: "Feel vibration forward without pushing volume.", duration: "2 min" },
    { id: "warm-vowels", title: "Sing on ‘naa’", detail: "Use the melody without lyrics to free the tongue.", duration: "2 min" },
  ],
  Pitch: [
    { id: "pitch-hum", title: "Hum the hook slowly", detail: "Watch the live note and aim for repeatable starts.", duration: "2 min" },
    { id: "pitch-slow", title: "Run at 0.75×", detail: "Slow the track and hold every landing cleanly.", duration: "3 min" },
    { id: "pitch-a-b", title: "Loop one hard interval", detail: "Repeat the smallest phrase that contains the jump.", duration: "3 min" },
    { id: "pitch-record", title: "Record two clean takes", detail: "Choose consistency over loudness.", duration: "5 min" },
  ],
  Breath: [
    { id: "breath-mark", title: "Mark three breath points", detail: "Place them before you run out, not after.", duration: "1 min" },
    { id: "breath-hiss", title: "Four controlled hisses", detail: "Exhale evenly for 12–16 seconds.", duration: "2 min" },
    { id: "breath-long", title: "Loop the longest phrase", detail: "Sing it at 70% volume with steady support.", duration: "3 min" },
    { id: "breath-silent", title: "Silent low inhale", detail: "Keep shoulders relaxed and ribs open.", duration: "60 sec" },
  ],
  Phrasing: [
    { id: "phrase-speak", title: "Speak the lyric in rhythm", detail: "Find the natural stress before adding melody.", duration: "2 min" },
    { id: "phrase-chorus", title: "Shape the chorus first", detail: "Choose where each phrase grows and releases.", duration: "3 min" },
    { id: "phrase-soft", title: "Sing one verse softly", detail: "Let consonants carry clarity instead of force.", duration: "2 min" },
    { id: "phrase-story", title: "Name the lyric’s intention", detail: "Decide who you are singing to and why.", duration: "60 sec" },
  ],
  Performance: [
    { id: "perform-one", title: "One no-stop run", detail: "Recover in character instead of restarting.", duration: "1 song" },
    { id: "perform-dynamics", title: "Plan three dynamic changes", detail: "Avoid singing every section at one intensity.", duration: "2 min" },
    { id: "perform-mic", title: "Rehearse mic distance", detail: "Move slightly away on strong or high notes.", duration: "2 min" },
    { id: "perform-reflect", title: "Review one take", detail: "Choose only one improvement for the next run.", duration: "3 min" },
  ],
};

export function buildPracticeRoutine(focus = "Warm-up", offset = 0) {
  const deck = practiceDecks[focus] || practiceDecks["Warm-up"];
  return [0, 1, 2].map((step) => deck[(step + offset) % deck.length]);
}
