# Modular Quiz Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor two ~2800-line single-file quizzes into a shared CSS + JS engine + per-quiz JSON content architecture.

**Architecture:** One `index.html` entry point loads `css/quiz.css` and `js/quiz-engine.js`. The engine reads `?type=` from the URL, fetches `content/{type}-quiz.json`, and initializes the quiz with that content. All quiz-specific text, questions, and data live in JSON.

**Tech Stack:** Vanilla HTML/CSS/JS, JSON content files, no build tools. Static hosting on Vercel.

**Spec:** `docs/superpowers/specs/2026-03-22-modular-quiz-architecture-design.md`
**Source files:** `funnel-diagnose-quiz-v2.html` (primary reference), `ai-marketing-quiz.html`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `css/quiz.css` | Create | All CSS extracted from V2 style block |
| `js/quiz-engine.js` | Create | All JS logic: scoring, rendering, navigation, animations, sounds |
| `content/funnel-quiz.json` | Create | Funnel V2 quiz content: questions, texts, lever details |
| `content/ai-quiz.json` | Create | AI marketing quiz content |
| `index.html` | Create | Minimal HTML entry point |
| `vercel.json` | Create | URL rewrites for clean quiz URLs |

Existing files (`funnel-diagnose-quiz.html`, `funnel-diagnose-quiz-v2.html`, `ai-marketing-quiz.html`) remain as archives.

---

### Task 1: Extract CSS into css/quiz.css

**Files:**
- Source: `funnel-diagnose-quiz-v2.html` (lines 8-879)
- Create: `css/quiz.css`

- [ ] **Step 1:** Copy the entire content between the opening and closing style tags from `funnel-diagnose-quiz-v2.html` into `css/quiz.css`. Pure extraction, zero modifications. No style tags in the output.

- [ ] **Step 2:** Verify the file starts with `body { background: #FBFAF2; margin: 0; }` and ends with the `@media (prefers-reduced-motion: reduce)` block.

- [ ] **Step 3:** Commit: `git add css/quiz.css && git commit -m "feat: extract CSS into css/quiz.css"`

---

### Task 2: Extract Funnel quiz content into content/funnel-quiz.json

**Files:**
- Source: `funnel-diagnose-quiz-v2.html`
- Create: `content/funnel-quiz.json`

- [ ] **Step 1:** Create `content/funnel-quiz.json` with the complete quiz content.

**JSON structure:**

```
{
  "meta": { title, slug, source, storageKey, webhookUrl, bookingUrl },
  "landing": { badge, headline, subtitle, cta, socialProof },
  "gate": { statusText, headline, subtitle, submitButton, submitLoadingText, peekIcon (SVG string), peekText, finePrint },
  "resume": { title, subtitle, continueButton, restartButton },
  "milestones": { m1: {headline, subtitle}, m2: {headline, subtitle} },
  "partLabels": { part1, part2Prefix, part3, icpNames: {coach, marketer, mittelstand} },
  "dimOrder": ["TR","LP","CO","FU","SA"],
  "dimensions": { TR: label, LP: label, ... },
  "segments": { A: {label, threshold}, B: {label, threshold}, C: {label} },
  "icpQuestion": { full question object },
  "generalQuestions": [ 7 question objects ],
  "icpQuestions": { coach: [12], marketer: [12], mittelstand: [12] },
  "leverDetails": { per dimension: {diagnosis, actions[]} },
  "icpLeverTips": { per ICP per dimension: tip string },
  "icpNextLevel": { per ICP: [{title, text}] },
  "resultContent": { A: {headline, p1, p2, leverTitle, ctaP, ctaBtn, hebelTag}, B, C },
  "icpStats": { A: {coach, marketer, mittelstand}, B, C },
  "ctaCard": { badge, headline, nextLevelTitle },
  "shareText": "template with {score}/{max}/{segment}/{url} placeholders",
  "waDebugIntro": "Hier ist deine Funnel-Analyse auf einen Blick:"
}
```

**Data sources in V2 (line references):**
- `CONFIG` (~line 1012) -> meta.webhookUrl, meta.bookingUrl
- `DIMENSIONS` (~line 1028) -> dimensions + dimOrder
- `LEVER_DETAILS` (~line 1036) -> leverDetails
- `ICP_LEVER_TIPS` (~line 1079) -> icpLeverTips
- `ICP_NEXT_LEVEL` (~line 1103) -> icpNextLevel
- `ICP_QUESTION` (~line 1124) -> icpQuestion
- `GENERAL_QUESTIONS` (~line 1138) -> generalQuestions
- `COACH_QUESTIONS` (~line 1220) -> icpQuestions.coach
- `MARKETER_QUESTIONS` (~line 1359) -> icpQuestions.marketer
- `MITTELSTAND_QUESTIONS` (~line 1494) -> icpQuestions.mittelstand
- `CONTENT` inside renderResult (~line 2260) -> resultContent
- `ICP_STATS` inside renderResult (~line 2297) -> icpStats
- HTML text (lines 884-1002) -> landing, gate, resume, milestones, partLabels, ctaCard

**JSON conversion notes:**
- JS unicode escapes (`\u00e4`) -> actual UTF-8 in JSON (`ae` or the actual character)
- `info.icon` and `info.text` fields contain HTML strings - keep as strings
- Remove trailing commas (invalid JSON)
- All property names double-quoted
- `ctaCard.headline` contains HTML (`<em>` tags) - keep as string

- [ ] **Step 2:** Validate JSON: `python3 -c "import json; json.load(open('content/funnel-quiz.json'))" && echo "Valid"`

- [ ] **Step 3:** Commit: `git add content/funnel-quiz.json && git commit -m "feat: extract funnel quiz content into JSON"`

---

### Task 3: Extract AI quiz content into content/ai-quiz.json

**Files:**
- Source: `ai-marketing-quiz.html`
- Create: `content/ai-quiz.json`

- [ ] **Step 1:** Same structure as funnel-quiz.json. Key differences:
- `meta.slug`: `"ai"`, `meta.source`: `"ai-marketing-quiz"`, `meta.storageKey`: `"fq-ai-progress"`
- `dimOrder`: `["SV","CK","LQ","AW","DP"]`
- `dimensions`: KI-Strategie & Vision, etc.
- `segments`: KI-Einsteiger / KI-Anwender / KI-Vorreiter
- All questions, texts, lever details from the AI quiz file

- [ ] **Step 2:** Validate JSON: `python3 -c "import json; json.load(open('content/ai-quiz.json'))" && echo "Valid"`

- [ ] **Step 3:** Commit: `git add content/ai-quiz.json && git commit -m "feat: extract AI marketing quiz content into JSON"`

---

### Task 4: Create the quiz engine (js/quiz-engine.js)

**Files:**
- Source: `funnel-diagnose-quiz-v2.html` (JS, lines ~1008-2876)
- Create: `js/quiz-engine.js`

This is the largest task. The engine must be fully generic.

- [ ] **Step 1: Initialization and JSON loading**

Wrap everything in an IIFE. Determine quiz type with this priority:
1. `?type=` URL parameter
2. Pathname mapping: `/funnel-quiz` -> `funnel`, `/ai-quiz` -> `ai`
3. Default: `funnel`

```js
var quizType = params.get('type');
if (!quizType) {
  var path = window.location.pathname;
  if (path.indexOf('/funnel-quiz') !== -1) quizType = 'funnel';
  else if (path.indexOf('/ai-quiz') !== -1) quizType = 'ai';
  else quizType = 'funnel';
}
```

Show loading state. Fetch `content/{quizType}-quiz.json`. On success call `initQuiz()`. On error show friendly message.

The `initQuiz()` function:
1. Sets document.title from quizData.meta.title
2. Calls `buildHTML()` to create the DOM structure
3. Calls `populateText()` to fill in JSON content
4. Calls `buildQuestions()` to initialize question state
5. Attaches all event listeners
6. Sets up magnetic buttons and iframe reporting
7. Checks saved progress or runs landing animation

- [ ] **Step 2: buildHTML function**

Builds the entire DOM inside `#quiz-root` using a template string. Includes all 4 screens (landing, quiz, gate, result), both milestone overlays, resume dialog, confetti canvas. All text elements have IDs for population. Form fields include labels, icons, inputs, and error messages.

Must include:
- Skip link: `<a href="#fq-question-content" class="fq-sr-only fq-skip-link">Zum Quiz-Inhalt springen</a>`
- ARIA attributes on milestones: `role="dialog"` and `aria-label`
- ARIA on progress bar: `role="progressbar"` with aria-valuenow/min/max
- ARIA on option containers: `role="radiogroup"` / `role="group"`

Note: The HTML template uses trusted content only (our own markup). The template approach is safe because no user input is involved.

- [ ] **Step 3: populateText function**

Sets textContent on all text elements from quizData. Uses textContent for plain text, sets content directly for HTML fields (ctaCard.headline, milestone subtitles with `<br>` tags).

- [ ] **Step 4: Generalized scoring functions**

`initScores()` creates a zeroed score object from `quizData.dimOrder`. `calculateDimensionMaxes` and `calculateResults` use `initScores()` instead of hardcoded keys. Segment classification reads thresholds from `quizData.segments`.

- [ ] **Step 5: Screen management + question rendering**

Copy showScreen, showMilestone/2, buildOptionEl, renderQuestion, selectOption from V2. Changes:
- `GENERAL_END_INDEX = 1 + quizData.generalQuestions.length` (computed, not hardcoded 8)
- `PART2_END_INDEX = GENERAL_END_INDEX + 6` (computed, not hardcoded 14)
- Part labels from `quizData.partLabels`
- ICP names from `quizData.partLabels.icpNames`
- Milestone interim scores use `initScores()`
- Progress bar divisor: always use `Math.max(TOTAL_QUESTIONS, 20)`. Before ICP selection `TOTAL_QUESTIONS` is 8 (ICP + general only), so `Math.max` returns 20. After ICP selection `TOTAL_QUESTIONS` becomes 20, so it's the same value. This prevents the backwards jump without needing conditional logic.

- [ ] **Step 6: Result rendering**

Copy renderResult. Replace all hardcoded content references:
- `CONTENT[segment]` -> `quizData.resultContent[segment]`
- `ICP_STATS[segment][selectedICP]` -> `quizData.icpStats[segment][selectedICP]`
- `dimOrder` array -> `quizData.dimOrder`
- `LEVER_DETAILS[dim.key]` -> `quizData.leverDetails[dim.key]`
- `ICP_LEVER_TIPS[selectedICP][dim.key]` -> `quizData.icpLeverTips[selectedICP][dim.key]`
- `ICP_NEXT_LEVEL[selectedICP]` -> `quizData.icpNextLevel[selectedICP]`
- CTA card text from `quizData.ctaCard`
- Booking URL from `quizData.meta.bookingUrl`
- Share text from `quizData.shareText` with placeholder replacement
- WhatsApp debug intro from `quizData.waDebugIntro`
- Next level title from `quizData.ctaCard.nextLevelTitle`

- [ ] **Step 7: Sounds, confetti, webhook, utilities**

Copy verbatim from V2: launchConfetti, getAudioCtx, playTick, playSuccess, playWhoosh, playConfettiPop, animateCounter.

Webhook: change `CONFIG.webhookUrl` to `quizData.meta.webhookUrl`, `source` to `quizData.meta.source`.

- [ ] **Step 8: Session storage with slug validation**

saveProgress includes `slug: quizData.meta.slug` in saved data. loadProgress validates `saved.slug === quizData.meta.slug` before returning. Preserves the 30-minute expiry: `if (Date.now() - data.timestamp > 30 * 60 * 1000) { clearProgress(); return null; }`. Uses `quizData.meta.storageKey` for storage key.

- [ ] **Step 9: Event listeners**

Wire up: start button, next button (with milestone triggers), back button, gate form submit (with validation, webhook, loading text from JSON, peek text from JSON), resume dialog buttons.

Gate form submit loading text: `quizData.gate.submitLoadingText`.
Blurred preview: the entire preview-building block (V2 lines ~2662-2721) must use `quizData.dimOrder` for dimension bars, and `quizResults.*` for score data. This block builds inline SVG and HTML for the blurred preview behind the gate card.
Peek element: combine `quizData.gate.peekIcon` (SVG, via setting markup) + `quizData.gate.peekText` (text via textContent) into the peek div.

Share text placeholder replacement:
```js
var shareMsg = quizData.shareText
  .replace('{score}', totalScore)
  .replace('{max}', maxScore)
  .replace('{segment}', segmentLabel)
  .replace('{url}', window.location.href);
```

- [ ] **Step 10: Magnetic buttons, iframe reporting, close IIFE**

Magnetic buttons IIFE (touch detection, mousemove, mousedown/up).
iFrame height reporting (ResizeObserver + postMessage).
Close the outer IIFE.

- [ ] **Step 11:** Commit: `git add js/quiz-engine.js && git commit -m "feat: create quiz engine with JSON-driven content loading"`

---

### Task 5: Create index.html

**Files:**
- Create: `index.html`

- [ ] **Step 1:** Create a minimal HTML file:

```html
<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Quiz</title>
<link rel="stylesheet" href="css/quiz.css">
</head>
<body>
<div id="quiz-root"></div>
<script src="js/quiz-engine.js" defer></script>
</body>
</html>
```

Title is updated dynamically by the engine. The body background comes from quiz.css.

**Spec deviation note:** The spec describes HTML screen shells inside `index.html`. This plan instead has the engine build all DOM via `buildHTML()` in JS. Rationale: since all text comes from JSON anyway, putting empty shells in HTML adds no value and creates two places to maintain structure. The loading state ("Laden...") is shown immediately and replaced once JSON arrives. The skip link, ARIA attributes, and all accessibility elements are included in the `buildHTML()` template.

- [ ] **Step 2:** Commit: `git add index.html && git commit -m "feat: create index.html entry point"`

---

### Task 6: Create vercel.json

**Files:**
- Create: `vercel.json`

- [ ] **Step 1:** Create:

```json
{
  "rewrites": [
    { "source": "/quiz", "destination": "/index.html" },
    { "source": "/funnel-quiz", "destination": "/index.html" },
    { "source": "/ai-quiz", "destination": "/index.html" }
  ]
}
```

The engine maps pathnames to quiz types (from Task 4 Step 1):
- `/funnel-quiz` -> type `funnel`
- `/ai-quiz` -> type `ai`
- `/quiz?type=X` -> type `X`
- everything else -> default `funnel`

- [ ] **Step 2:** Commit: `git add vercel.json && git commit -m "feat: add Vercel config for clean quiz URLs"`

---

### Task 7: Integration test — Funnel quiz

- [ ] **Step 1:** Start local server: `python3 -m http.server 8080`

- [ ] **Step 2:** Open `http://localhost:8080/index.html?type=funnel`. Walk through complete flow: landing -> ICP selection -> 20 questions -> milestones -> gate -> result. Verify all text, animations, scoring, sounds, confetti, share buttons, benchmark, WhatsApp debug match the original `funnel-diagnose-quiz-v2.html`.

- [ ] **Step 3:** Test mobile (375px responsive mode). Verify mobile overrides, touch target sizes, reduced motion.

- [ ] **Step 4:** Fix any issues and commit.

---

### Task 8: Integration test — AI quiz

- [ ] **Step 1:** Open `http://localhost:8080/index.html?type=ai`. Walk through complete flow. Verify all AI-specific content: KI dimensions, KI questions, KI segments, KI lever details.

- [ ] **Step 2:** Compare with original `ai-marketing-quiz.html`. Content should be identical.

- [ ] **Step 3:** Fix any issues and commit.

---

### Task 9: Edge case testing

- [ ] **Step 1:** Test invalid type: `?type=nonexistent` -> should show error message.
- [ ] **Step 2:** Test no parameter: `index.html` -> should default to funnel quiz.
- [ ] **Step 3:** Test session resume: start funnel quiz, answer 5 questions, refresh -> resume dialog should appear.
- [ ] **Step 4:** Test cross-quiz resume: start funnel quiz, change to `?type=ai` -> should NOT offer funnel resume (slug mismatch).
- [ ] **Step 5:** Test UTM: `?type=funnel&utm_source=test` -> verify UTM in webhook payload.
- [ ] **Step 6:** Fix any issues and commit.

---

### Task 10: Push

- [ ] **Step 1:** Verify file structure: `ls css/ js/ content/ index.html vercel.json`
- [ ] **Step 2:** Verify archives untouched: `git diff funnel-diagnose-quiz.html funnel-diagnose-quiz-v2.html ai-marketing-quiz.html` (expect no changes)
- [ ] **Step 3:** Push: `git push origin main`
