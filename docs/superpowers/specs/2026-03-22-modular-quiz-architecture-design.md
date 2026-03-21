# Modular Quiz Architecture — Design Spec

## Summary

Refactor the two single-file quizzes (`funnel-diagnose-quiz-v2.html`, `ai-marketing-quiz.html`) into a modular architecture: one shared HTML entry point, one shared CSS file, one shared JS engine, and per-quiz JSON content files. The original V1 file stays as an archive.

**Goal:** Any new quiz = one new JSON file + one new URL parameter. No code changes needed.

**Hosting target:** Vercel (static), potentially Cloudflare Pages or Webflow embed later.

---

## File Structure

```
fsm-funnel-quiz/
  index.html                    ← Single entry point, loads quiz via ?type=
  css/
    quiz.css                    ← All design (glassmorphism, animations, layout, responsive)
  js/
    quiz-engine.js              ← Scoring, navigation, rendering, sounds, sharing, etc.
  content/
    funnel-quiz.json            ← Funnel V2 quiz content
    ai-quiz.json                ← AI marketing quiz content
  funnel-diagnose-quiz.html     ← V1 archive (untouched)
  funnel-diagnose-quiz-v2.html  ← Archive (kept but no longer maintained)
  ai-marketing-quiz.html        ← Archive (kept but no longer maintained)
```

---

## index.html

Minimal HTML skeleton containing:

- `<link>` to `css/quiz.css`
- `<script>` to `js/quiz-engine.js` (deferred)
- The `#quiz-root` div with all 4 screen shells (landing, quiz, gate, result)
- Milestone overlays
- Resume dialog overlay
- No text content — all text is injected by the engine from JSON

### Screen shells

The HTML contains structural elements with IDs/classes but empty text:

```html
<div id="quiz-root">
  <!-- Landing screen -->
  <div class="fq-screen fq-screen--landing fq-active">
    <div class="fq-landing-inner">
      <div class="fq-badge fq-stagger-item" id="fq-landing-badge"></div>
      <h1 class="fq-landing-h1 fq-stagger-item" id="fq-landing-h1"></h1>
      <p class="fq-landing-sub fq-stagger-item" id="fq-landing-sub"></p>
      <button class="fq-btn-primary fq-stagger-item fq-scale-in" id="fq-start-btn"></button>
      <p class="fq-social-proof fq-stagger-item" id="fq-social-proof"></p>
    </div>
  </div>

  <!-- Quiz screen (question content rendered dynamically) -->
  <div class="fq-screen fq-screen--quiz">...</div>

  <!-- Gate screen -->
  <div class="fq-screen fq-screen--gate">
    <div class="fq-gate-inner">
      <div class="fq-gate-status fq-stagger-item">...</div>
      <h2 class="fq-gate-h2 fq-stagger-item" id="fq-gate-h2"></h2>
      <p class="fq-gate-sub fq-stagger-item" id="fq-gate-sub"></p>
      <form id="fq-gate-form">...</form>
      <!-- Logo placeholders, fine print -->
    </div>
  </div>

  <!-- Result screen (content rendered dynamically) -->
  <div class="fq-screen fq-screen--result">...</div>

  <!-- Milestones, resume dialog -->
</div>
```

### Text injection

On load, after JSON is fetched, the engine populates all text elements:

```js
document.getElementById('fq-landing-badge').textContent = quizData.landing.badge;
document.getElementById('fq-landing-h1').textContent = quizData.landing.headline;
// ... etc
```

---

## css/quiz.css

Extracted from the current `<style>` block. Contains ALL CSS:

- Custom properties on `#quiz-root`
- Background gradient blobs + drift animation
- Screen styles (landing, quiz, gate, result)
- Glassmorphism surfaces
- Spring transitions + tactile interactions
- Stagger/reveal animation classes
- Perpetual micro-animations (glow, shimmer, float)
- Milestone, resume dialog, benchmark, share button styles
- Mobile responsive (`@media max-width: 600px`)
- `prefers-reduced-motion` overrides

**No changes to CSS logic.** This is a pure extraction.

---

## js/quiz-engine.js

Single file containing all quiz logic. Structure:

```js
// ============================================
// INITIALIZATION
// ============================================
// - Read ?type= parameter
// - Fetch content/{type}-quiz.json
// - Populate HTML text from JSON
// - Initialize quiz state

// ============================================
// QUIZ DATA (loaded from JSON)
// ============================================
var quizData = null; // Set after fetch

// ============================================
// STATE
// ============================================
var selectedICP = null;
var allQuestions = [];
var currentQuestion = 0;
var userAnswers = [];
var quizResults = null;
var TOTAL_QUESTIONS = 20;
// ... etc

// ============================================
// UTM CAPTURE
// ============================================

// ============================================
// SCORING
// ============================================
// calculateDimensionMaxes(questions)
// calculateResults(answers)
// - These become generic: iterate over quizData.dimensions keys
//   instead of hardcoded TR/LP/CO/FU/SA or SV/CK/LQ/AW/DP

// ============================================
// SCREEN MANAGEMENT
// ============================================
// showScreen(name)
// showMilestone(cb), showMilestone2(cb)

// ============================================
// QUESTION RENDERING
// ============================================
// buildOptionEl(qi, oi, q)
// renderQuestion(qi, direction)
// selectOption(qi, oi)

// ============================================
// RESULT RENDERING
// ============================================
// renderResult(results)
// - Reads text from quizData.resultContent[segment]
// - Reads lever details from quizData.leverDetails
// - Reads ICP tips from quizData.icpLeverTips
// - Reads next level from quizData.icpNextLevel
// - Benchmark, share buttons, WhatsApp debug

// ============================================
// CONFETTI + SOUNDS
// ============================================

// ============================================
// WEBHOOK
// ============================================
// sendWebhook(formData)
// - Uses quizData.meta.source for the source field

// ============================================
// SESSION STORAGE
// ============================================
// saveProgress(), loadProgress(), clearProgress()
// - Uses quizData.meta.storageKey

// ============================================
// EVENT LISTENERS
// ============================================

// ============================================
// MAGNETIC BUTTONS
// ============================================

// ============================================
// IFRAME HEIGHT REPORTING
// ============================================
```

### Key generalization points

1. **Dimensions are ordered arrays:** `quizData.dimOrder` is an explicit array (`["TR","LP","CO","FU","SA"]`) that controls bar chart display order. `quizData.dimensions` maps keys to labels. Score initializers loop over `dimOrder`.

2. **Segment thresholds and labels from JSON:** `quizData.segments.A/B/C` for labels and thresholds.

3. **Questions from JSON:** `quizData.generalQuestions`, `quizData.icpQuestions[selectedICP]`, `quizData.icpQuestion` (ICP selector).

4. **Milestone boundaries are computed, not hardcoded:** `GENERAL_END_INDEX = 1 + quizData.generalQuestions.length` (ICP question + general questions). `PART2_END_INDEX = GENERAL_END_INDEX + 6` (first 6 ICP-specific questions). No hardcoded `8` or `14`.

5. **Progress bar uses TOTAL_QUESTIONS:** Fix the current hardcoded `/ 20` to use the dynamic `TOTAL_QUESTIONS` value (which is correct after ICP selection). Before ICP selection, use `20` as estimate to prevent backwards jump.

6. **All user-facing text from JSON:** Landing, gate, milestones, result headlines, CTA text, part labels, social proof, resume dialog, WhatsApp debug intro, gate submit loading text, gate peek text.

7. **CONFIG (webhook/booking URLs) from JSON:** `quizData.meta.webhookUrl`, `quizData.meta.bookingUrl`.

8. **Session storage validates quiz type:** On resume, engine checks that `saved.slug === quizData.meta.slug` before offering to continue. Prevents cross-quiz resume corruption when both quizzes share `index.html`.

### Engine-owned strings (not in JSON)

These strings are part of quiz UI logic, not content, and stay hardcoded in the engine:

- Navigation: "Weiter →", "← Zurueck", "Ergebnis anzeigen →", "Frage X von Y"
- Benchmark: "Dein Vergleich", "Du liegst vor X% aller bisherigen Teilnehmer.", "Top X%"
- Share: "Teile dein Ergebnis"
- Error: "Quiz konnte nicht geladen werden."

If internationalization is needed later, these can be moved to JSON. For now they stay in the engine.

### HTML fields rendered as innerHTML (trusted content)

These JSON fields may contain HTML and are rendered via `innerHTML`:

- `ctaCard.headline` (contains `<em>` tags)
- `question.info.icon` (SVG markup)
- `question.info.text` (HTML with `<strong>`, `<ul>`, `<span>` benchmarks)
- `gate.peekIcon` (SVG markup)

All other fields are rendered as `textContent`.

---

## content/funnel-quiz.json

Complete content for the Funnel V2 quiz. Structure:

```json
{
  "meta": {
    "title": "Funnel-Diagnose Quiz",
    "slug": "funnel",
    "source": "funnel-diagnose-quiz",
    "storageKey": "fq-progress",
    "webhookUrl": "https://DEIN-WEBHOOK-ENDPOINT.com",
    "bookingUrl": "https://DEIN-CALENDLY-LINK.com"
  },
  "landing": {
    "badge": "Kostenlose Funnel-Analyse",
    "headline": "Wo lässt dein Funnel gerade Umsatz liegen?",
    "subtitle": "20 Fragen. 5 Minuten. Du bekommst eine personalisierte Diagnose...",
    "cta": "Jetzt Funnel analysieren →",
    "socialProof": "Basierend auf Erkenntnissen aus 200+ Kundenprojekten..."
  },
  "gate": {
    "statusText": "Analyse bereit",
    "headline": "Deine Analyse ist fertig.",
    "subtitle": "Trag deine Daten ein...",
    "submitButton": "Meine Analyse anfordern →",
    "submitLoadingText": "Wird ausgewertet\u2026",
    "peekText": "Deine Ergebnisse warten",
    "finePrint": "Kein Spam. Keine Weitergabe..."
  },
  "resume": {
    "title": "Weitermachen?",
    "subtitle": "Du hast das Quiz schon angefangen. Möchtest du dort weitermachen, wo du aufgehört hast?",
    "continueButton": "Weitermachen",
    "restartButton": "Neu starten"
  },
  "milestones": {
    "m1": { "headline": "Teil 1 abgeschlossen!", "subtitle": "Jetzt wird's spezifisch..." },
    "m2": { "headline": "Teil 2 abgeschlossen!", "subtitle": "Fast geschafft..." }
  },
  "partLabels": {
    "part1": "Teil 1: Allgemeine Funnel-Analyse",
    "part2Prefix": "Teil 2: ",
    "part3": "Teil 3: Feintuning & Abschluss",
    "icpNames": { "coach": "Coach & Consulting", "marketer": "Marketing & Agentur", "mittelstand": "Unternehmen & B2B" }
  },
  "dimOrder": ["TR", "LP", "CO", "FU", "SA"],
  "dimensions": {
    "TR": "Traffic & Ads",
    "LP": "Landing Page & Conversion",
    "CO": "Content & Überzeugung",
    "FU": "Follow-up & Nurturing",
    "SA": "Sales & Abschluss"
  },
  "segments": {
    "A": { "label": "Funnel-Baustelle", "threshold": 0.35 },
    "B": { "label": "Funnel mit Potenzial", "threshold": 0.70 },
    "C": { "label": "Funnel-Ready" }
  },
  "icpQuestion": {
    "id": "icp", "type": "icp-select",
    "question": "Was beschreibt dich am besten?",
    "hint": "Wir passen die nächsten Fragen an dein Profil an.",
    "options": [...]
  },
  "generalQuestions": [...],
  "icpQuestions": {
    "coach": [...],
    "marketer": [...],
    "mittelstand": [...]
  },
  "leverDetails": {
    "TR": { "diagnosis": "...", "actions": ["...", "...", "..."] },
    "LP": { ... }, "CO": { ... }, "FU": { ... }, "SA": { ... }
  },
  "icpLeverTips": {
    "coach": { "TR": "...", "LP": "...", ... },
    "marketer": { ... },
    "mittelstand": { ... }
  },
  "icpNextLevel": {
    "coach": [{ "title": "...", "text": "..." }, ...],
    "marketer": [...],
    "mittelstand": [...]
  },
  "resultContent": {
    "A": { "headline": "...", "p1": "...", "p2": "...", "leverTitle": "...", "ctaP": "...", "ctaBtn": "...", "hebelTag": "..." },
    "B": { ... },
    "C": { ... }
  },
  "icpStats": {
    "A": { "coach": "...", "marketer": "...", "mittelstand": "..." },
    "B": { ... },
    "C": { ... }
  },
  "ctaCard": {
    "badge": "Limitierte Plätze",
    "headline": "Dein <em>persönlicher</em> Funnel-Fahrplan",
    "nextLevelTitle": "Nächstes Level: Fortgeschrittene Strategien"
  },
  "shareText": "Ich habe gerade meinen Funnel analysiert und einen Score von {score}/{max} bekommen ({segment}). Probier es auch: {url}",
  "waDebugIntro": "Hier ist deine Funnel-Analyse auf einen Blick:"
}
```

### Loading state

While the JSON is being fetched, the engine shows a minimal loading indicator inside `#quiz-root` (a centered spinner or "Laden..." text). Once JSON arrives, the loading state is replaced with the populated landing screen. This prevents a flash of empty content.
```

## content/ai-quiz.json

Same structure, different content (KI-Marketing-specific). Dimensions are SV/CK/LQ/AW/DP, segments are KI-Einsteiger/KI-Anwender/KI-Vorreiter, all questions/texts are the AI marketing versions.

---

## Loading Flow

```
1. Browser opens index.html?type=ai
2. CSS loads (quiz.css)
3. JS loads (quiz-engine.js, deferred)
4. Engine reads ?type= → "ai"
5. Engine fetches content/ai-quiz.json
6. On success:
   a. Set document title from meta.title
   b. Populate landing/gate/milestone text from JSON
   c. Initialize quiz state (buildQuestions etc.)
   d. Run landing stagger or show resume dialog
7. On error:
   a. Show user-friendly error message in #quiz-root
   b. "Quiz konnte nicht geladen werden. Bitte versuche es erneut."
8. No ?type= parameter:
   a. Default to "funnel" (or show a quiz selector page — future option)
9. Session resume check:
   a. Load saved progress from sessionStorage using `quizData.meta.storageKey`
   b. Validate `saved.slug === quizData.meta.slug` to prevent cross-quiz resume
   c. If mismatch, clear saved progress and proceed fresh
```

---

## Migration Strategy

The refactor must produce **byte-for-byte identical user experience**. No visual changes, no behavioral changes. The user should not be able to tell the quiz was refactored.

### Extraction order

1. Extract CSS from V2 into `css/quiz.css`
2. Extract all JS data objects from V2 into `content/funnel-quiz.json`
3. Extract remaining JS logic into `js/quiz-engine.js`, generalizing hardcoded references
4. Create `index.html` skeleton with empty text elements
5. Wire up the loading flow
6. Verify V2 quiz works identically via `index.html?type=funnel`
7. Extract AI quiz content into `content/ai-quiz.json`
8. Verify AI quiz works identically via `index.html?type=ai`

### What stays unchanged

- All CSS (pure extraction, no modifications)
- All animations, sounds, confetti
- Scoring algorithm and thresholds
- Formular validation
- Webhook payload structure
- sessionStorage save/restore logic
- UTM parameter capture
- Magnetic buttons, share buttons, benchmark
- iFrame height reporting
- Accessibility (skip link, ARIA attributes)
- `prefers-reduced-motion` handling
- Mobile responsive behavior

### Info box HTML in questions

Some questions have `info` objects with HTML content (including SVG icons). These stay in JSON as HTML strings — the engine uses `innerHTML` to render them (as it does today). This is safe because the JSON is our own trusted content, not user input.

---

## Vercel Deployment

Add a `vercel.json` for clean URLs:

```json
{
  "rewrites": [
    { "source": "/quiz", "destination": "/index.html" },
    { "source": "/funnel-quiz", "destination": "/index.html?type=funnel" },
    { "source": "/ai-quiz", "destination": "/index.html?type=ai" }
  ]
}
```

This enables:
- `deinedomain.de/quiz?type=funnel`
- `deinedomain.de/funnel-quiz` (pretty URL)
- `deinedomain.de/ai-quiz` (pretty URL)

---

## Future: Adding a New Quiz

1. Create `content/new-quiz.json` following the same schema
2. Deploy
3. Access via `?type=new-quiz`

No HTML, CSS, or JS changes needed.
