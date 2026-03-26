// ============================================
// QUIZ ENGINE — JSON-driven, works with any quiz
// Wrapped in IIFE to avoid polluting global scope
// ============================================
(function() {
'use strict';

// ============================================
// 1. QUIZ TYPE DETECTION & LOADING
// ============================================
var root = document.getElementById('quiz-root');
if (!root) return;

// Show loading state
root.innerHTML = '<div style="text-align:center;padding:80px 20px;font-family:sans-serif;color:#4A6B65;">Laden...</div>';

// Determine quiz type from ?type= param or pathname
function detectQuizType() {
  var params = new URLSearchParams(window.location.search);
  var typeParam = params.get('type');
  if (typeParam) return typeParam;
  var path = window.location.pathname.toLowerCase();
  if (path.indexOf('/ai-quiz') !== -1) return 'ai';
  if (path.indexOf('/funnel-quiz') !== -1) return 'funnel';
  return 'funnel'; // default
}

var QUIZ_TYPE = detectQuizType();

// Check for ?result= param (shared result link)
var pendingResult = null;
(function() {
  var params = new URLSearchParams(window.location.search);
  var resultParam = params.get('result');
  if (resultParam) {
    try {
      var decoded = JSON.parse(atob(resultParam));
      if (decoded && decoded.t) {
        QUIZ_TYPE = decoded.t;
        pendingResult = decoded;
      }
    } catch(e) {
      pendingResult = null;
    }
  }
})();

// Capture UTM parameters
var UTM_PARAMS = {};
(function() {
  var params = new URLSearchParams(window.location.search);
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(function(key) {
    var val = params.get(key);
    if (val) UTM_PARAMS[key] = val;
  });
})();

// Fetch JSON and boot
var jsonUrl = 'content/' + QUIZ_TYPE + '-quiz.json';
fetch(jsonUrl)
  .then(function(res) {
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  })
  .then(function(data) {
    initQuiz(normalizeQuizData(data));
  })
  .catch(function(err) {
    console.error('Quiz load error:', err);
    root.textContent = '';
    var errWrap = document.createElement('div');
    errWrap.style.cssText = 'text-align:center;padding:80px 20px;font-family:sans-serif;color:#4A6B65;';
    var errTitle = document.createElement('p');
    errTitle.style.cssText = 'font-size:18px;font-weight:500;margin-bottom:8px;';
    errTitle.textContent = 'Quiz konnte nicht geladen werden.';
    var errSub = document.createElement('p');
    errSub.style.fontSize = '14px';
    errSub.textContent = 'Bitte lade die Seite neu oder versuche es sp\u00e4ter erneut.';
    errWrap.appendChild(errTitle);
    errWrap.appendChild(errSub);
    root.appendChild(errWrap);
  });

// ============================================
// 2. JSON NORMALIZATION
// ============================================
// Different quiz JSONs may use slightly different field names.
// This normalizer ensures the engine can access everything uniformly.
function normalizeQuizData(d) {
  // Landing
  var landing = d.landing || {};
  landing.headline = landing.headline || landing.h1 || '';
  landing.subtitle = landing.subtitle || landing.sub || '';

  // Gate
  var gate = d.gate || {};
  gate.headline = gate.headline || gate.h2 || '';
  gate.subtitle = gate.subtitle || gate.sub || '';
  gate.submitButton = gate.submitButton || gate.submitBtn || 'Absenden';
  gate.submitLoadingText = gate.submitLoadingText || 'Wird ausgewertet\u2026';
  gate.peekIcon = gate.peekIcon || '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="vertical-align:-2px;margin-right:4px;"><path d="M8 3C4.4 3 1.4 5.4.5 8c.9 2.6 3.9 5 7.5 5s6.6-2.4 7.5-5c-.9-2.6-3.9-5-7.5-5z" stroke="currentColor" stroke-width="1.2"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.2"/></svg>';
  gate.peekText = gate.peekText || 'Deine Ergebnisse warten';
  gate.finePrint = gate.finePrint || '';

  // Segments — normalize threshold key
  var segments = d.segments || {};
  ['A', 'B', 'C'].forEach(function(s) {
    if (segments[s]) {
      segments[s].threshold = segments[s].threshold !== undefined ? segments[s].threshold : segments[s].maxPct;
    }
  });

  // Milestones — normalize keys
  var milestones = d.milestones || {};
  var m1 = milestones.m1 || milestones['1'] || {};
  var m2 = milestones.m2 || milestones['2'] || {};
  milestones.m1 = { headline: m1.headline || m1.h || '', subtitle: m1.subtitle || m1.sub || '' };
  milestones.m2 = { headline: m2.headline || m2.h || '', subtitle: m2.subtitle || m2.sub || '' };

  // Part labels — normalize part2 to always have prefix + icpNames
  var partLabels = d.partLabels || {};
  if (!partLabels.icpNames && partLabels.part2 && typeof partLabels.part2 === 'object') {
    // ai-quiz style: part2 is an object { coach: "Teil 2: Coach & Consulting", ... }
    partLabels.icpNames = {};
    Object.keys(partLabels.part2).forEach(function(k) {
      var val = partLabels.part2[k];
      var idx = val.indexOf(': ');
      partLabels.icpNames[k] = idx !== -1 ? val.substring(idx + 2) : val;
    });
    partLabels.part2Prefix = partLabels.part2Prefix || 'Teil 2: ';
  }
  partLabels.part2Prefix = partLabels.part2Prefix || 'Teil 2: ';
  partLabels.icpNames = partLabels.icpNames || {};

  // Resume
  var resume = d.resume || {};
  resume.title = resume.title || 'Weitermachen?';
  resume.subtitle = resume.subtitle || 'Du hast das Quiz schon angefangen. M\u00f6chtest du dort weitermachen, wo du aufgeh\u00f6rt hast?';
  resume.continueButton = resume.continueButton || 'Weitermachen';
  resume.restartButton = resume.restartButton || 'Neu starten';

  // CTA card
  var ctaCard = d.ctaCard || {};
  ctaCard.badge = ctaCard.badge || '';
  ctaCard.headline = ctaCard.headline || '';
  ctaCard.nextLevelTitle = ctaCard.nextLevelTitle || d.nextLevelTitle || 'N\u00e4chstes Level: Fortgeschrittene Strategien';

  // Meta
  var meta = d.meta || {};
  meta.webhookUrl = meta.webhookUrl || '';
  meta.bookingUrl = meta.bookingUrl || '';
  meta.storageKey = meta.storageKey || 'fq-progress';
  meta.slug = meta.slug || QUIZ_TYPE;
  meta.source = meta.source || '';
  meta.mode = meta.mode || '';

  var thankyou = d.thankyou || {};
  thankyou.headline = thankyou.headline || 'Danke für deine Antworten!';
  thankyou.subtitle = thankyou.subtitle || 'Wir melden uns in Kürze bei dir.';
  thankyou.ctaText = thankyou.ctaText || '';
  thankyou.finePrint = thankyou.finePrint || '';

  // Share text & WA debug
  d.shareText = d.shareText || 'Ich habe gerade mein Ergebnis bekommen: {score}/{max} ({segment}). Probier es auch: {url}';
  d.waDebugIntro = d.waDebugIntro || 'Hier ist deine Analyse auf einen Blick:';

  return {
    meta: meta,
    landing: landing,
    gate: gate,
    resume: resume,
    milestones: milestones,
    partLabels: partLabels,
    dimOrder: d.dimOrder || [],
    dimensions: d.dimensions || {},
    segments: segments,
    icpQuestion: d.icpQuestion,
    generalQuestions: d.generalQuestions || [],
    icpQuestions: d.icpQuestions || {},
    leverDetails: d.leverDetails || {},
    icpLeverTips: d.icpLeverTips || {},
    icpNextLevel: d.icpNextLevel || {},
    resultContent: d.resultContent || {},
    icpStats: d.icpStats || {},
    ctaCard: ctaCard,
    thankyou: thankyou,
    shareText: d.shareText,
    waDebugIntro: d.waDebugIntro
  };
}

// ============================================
// 3. INIT QUIZ — main entry point after JSON loads
// ============================================
function initQuiz(quizData) {

  // ============================================
  // 3a. BUILD HTML
  // ============================================
  function buildHTML() {
    var checkSVG = '<svg width="28" height="22" viewBox="0 0 28 22" fill="none"><path d="M2 11L10 19L26 3" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    var resumeIconSVG = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>';

    // Build all screen sections as DOM elements
    root.textContent = '';

    // -- Skip link --
    var skipLink = document.createElement('a');
    skipLink.href = '#fq-question-content';
    skipLink.className = 'fq-sr-only fq-skip-link';
    skipLink.textContent = 'Zum Quiz-Inhalt springen';
    root.appendChild(skipLink);

    // -- Landing screen --
    var landingScreen = document.createElement('div');
    landingScreen.className = 'fq-screen fq-screen--landing fq-active';
    var landingInner = document.createElement('div');
    landingInner.className = 'fq-landing-inner';

    var landingBadge = document.createElement('div');
    landingBadge.className = 'fq-badge fq-stagger-item';
    if (quizData.meta.mode === 'sales') { landingBadge.classList.add('fq-badge--live'); }
    landingBadge.id = 'fq-landing-badge';
    landingInner.appendChild(landingBadge);

    var landingH1 = document.createElement('h1');
    landingH1.className = 'fq-landing-h1 fq-stagger-item';
    landingH1.id = 'fq-landing-h1';
    landingInner.appendChild(landingH1);

    var landingSub = document.createElement('p');
    landingSub.className = 'fq-landing-sub fq-stagger-item';
    landingSub.id = 'fq-landing-sub';
    landingInner.appendChild(landingSub);

    var startBtn = document.createElement('button');
    startBtn.className = 'fq-btn-primary fq-stagger-item fq-scale-in';
    startBtn.id = 'fq-start-btn';
    landingInner.appendChild(startBtn);

    var landingSocial = document.createElement('p');
    landingSocial.className = 'fq-social-proof fq-stagger-item';
    landingSocial.id = 'fq-landing-social';
    landingInner.appendChild(landingSocial);

    landingScreen.appendChild(landingInner);
    root.appendChild(landingScreen);

    // -- Quiz screen --
    var quizScreen = document.createElement('div');
    quizScreen.className = 'fq-screen fq-screen--quiz';
    var quizInner = document.createElement('div');
    quizInner.className = 'fq-quiz-inner';

    var partLabelEl = document.createElement('div');
    partLabelEl.id = 'fq-part-label';
    partLabelEl.className = 'fq-part-label';
    quizInner.appendChild(partLabelEl);

    var progressWrap = document.createElement('div');
    progressWrap.className = 'fq-progress-wrap';
    var progressTrack = document.createElement('div');
    progressTrack.className = 'fq-progress-track';
    var progressFill = document.createElement('div');
    progressFill.className = 'fq-progress-fill';
    progressFill.id = 'fq-progress-fill';
    progressTrack.appendChild(progressFill);
    progressWrap.appendChild(progressTrack);
    var marker1 = document.createElement('div');
    marker1.className = 'fq-progress-marker';
    progressWrap.appendChild(marker1);
    var marker2 = document.createElement('div');
    marker2.className = 'fq-progress-marker';
    marker2.style.left = '70%';
    progressWrap.appendChild(marker2);
    quizInner.appendChild(progressWrap);

    var questionContent = document.createElement('div');
    questionContent.id = 'fq-question-content';
    questionContent.className = 'fq-question-content';
    quizInner.appendChild(questionContent);

    var quizNav = document.createElement('div');
    quizNav.className = 'fq-quiz-nav';
    var backBtn = document.createElement('button');
    backBtn.className = 'fq-back-link fq-hidden';
    backBtn.id = 'fq-back-btn';
    backBtn.textContent = '\u2190 Zur\u00fcck';
    quizNav.appendChild(backBtn);
    var nextBtn = document.createElement('button');
    nextBtn.className = 'fq-btn-next';
    nextBtn.id = 'fq-next-btn';
    nextBtn.disabled = true;
    nextBtn.textContent = 'Weiter \u2192';
    quizNav.appendChild(nextBtn);
    quizInner.appendChild(quizNav);

    quizScreen.appendChild(quizInner);
    root.appendChild(quizScreen);

    // -- Gate screen --
    var gateScreen = document.createElement('div');
    gateScreen.className = 'fq-screen fq-screen--gate';
    var gateInner = document.createElement('div');
    gateInner.className = 'fq-gate-inner';

    var gateStatus = document.createElement('div');
    gateStatus.className = 'fq-gate-status fq-stagger-item';
    var gateStatusDot = document.createElement('span');
    gateStatusDot.className = 'fq-gate-status-dot';
    gateStatus.appendChild(gateStatusDot);
    var gateStatusText = document.createElement('span');
    gateStatusText.className = 'fq-gate-status-text';
    gateStatusText.id = 'fq-gate-status-text';
    gateStatus.appendChild(gateStatusText);
    gateInner.appendChild(gateStatus);

    var gateH2 = document.createElement('h2');
    gateH2.className = 'fq-gate-h2 fq-stagger-item';
    gateH2.id = 'fq-gate-h2';
    gateInner.appendChild(gateH2);

    var gateSub = document.createElement('p');
    gateSub.className = 'fq-gate-sub fq-stagger-item';
    gateSub.id = 'fq-gate-sub';
    gateInner.appendChild(gateSub);

    // Gate form
    var gateForm = document.createElement('form');
    gateForm.id = 'fq-gate-form';
    gateForm.setAttribute('novalidate', '');

    // Helper to build form fields
    function buildField(labelText, inputId, inputType, placeholder, autocomplete, errorId, errorText, hintText, iconSvg) {
      var field = document.createElement('div');
      field.className = 'fq-field fq-stagger-item';
      var label = document.createElement('label');
      label.className = 'fq-label';
      label.setAttribute('for', inputId);
      if (labelText.indexOf('<') !== -1) {
        // Contains HTML (e.g., optional span)
        label.textContent = '';
        var tempDiv = document.createElement('div');
        tempDiv.textContent = labelText; // safe text
        label.textContent = labelText;
      } else {
        label.textContent = labelText;
      }
      field.appendChild(label);
      var iconWrap = document.createElement('div');
      iconWrap.className = 'fq-field-icon-wrap';
      var iconSpan = document.createElement('span');
      iconSpan.className = 'fq-field-icon';
      iconSpan.textContent = ''; // Will be populated via safe SVG below
      iconWrap.appendChild(iconSpan);
      var input = document.createElement('input');
      input.className = 'fq-input';
      input.id = inputId;
      input.type = inputType;
      input.placeholder = placeholder;
      input.autocomplete = autocomplete;
      iconWrap.appendChild(input);
      field.appendChild(iconWrap);
      if (errorId) {
        var errDiv = document.createElement('div');
        errDiv.className = 'fq-field-error';
        errDiv.id = errorId;
        errDiv.textContent = errorText;
        field.appendChild(errDiv);
      }
      if (hintText) {
        var hintDiv = document.createElement('div');
        hintDiv.className = 'fq-field-hint';
        hintDiv.textContent = hintText;
        field.appendChild(hintDiv);
      }
      return { field: field, iconSpan: iconSpan };
    }

    // Person icon SVG (used for name fields)
    var personIconSvgStr = '<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="5.5" r="3" stroke="currentColor" stroke-width="1.5"/><path d="M2.5 16c0-3 2.9-5.5 6.5-5.5s6.5 2.5 6.5 5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
    var emailIconSvgStr = '<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="4" width="14" height="10" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M2 6l7 4.5L16 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    var phoneIconSvgStr = '<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="4" y="1.5" width="10" height="15" rx="2" stroke="currentColor" stroke-width="1.5"/><line x1="7.5" y1="13.5" x2="10.5" y2="13.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

    function setSvgIcon(iconSpan, svgStr) {
      // Trusted SVG from our own code, not user input
      iconSpan.innerHTML = svgStr;
    }

    var nameField = buildField('Vorname', 'fq-input-name', 'text', 'Max', 'given-name', 'fq-error-name', 'Bitte gib deinen Vornamen ein.', null, null);
    setSvgIcon(nameField.iconSpan, personIconSvgStr);
    gateForm.appendChild(nameField.field);

    var lastnameField = buildField('Nachname', 'fq-input-lastname', 'text', 'Mustermann', 'family-name', 'fq-error-lastname', 'Bitte gib deinen Nachnamen ein.', null, null);
    setSvgIcon(lastnameField.iconSpan, personIconSvgStr);
    gateForm.appendChild(lastnameField.field);

    var emailField = buildField('E-Mail', 'fq-input-email', 'email', 'max@beispiel.de', 'email', 'fq-error-email', 'Bitte gib eine g\u00fcltige E-Mail-Adresse ein.', null, null);
    setSvgIcon(emailField.iconSpan, emailIconSvgStr);
    gateForm.appendChild(emailField.field);

    // Phone field with optional label
    var phoneFieldResult = buildField('Handynummer', 'fq-input-phone', 'tel', '+49 170 ...', 'tel', null, null, 'F\u00fcr WhatsApp-Zusammenfassung', null);
    // Add "(optional)" to the label
    var phoneLabel = phoneFieldResult.field.querySelector('.fq-label');
    var optSpan = document.createElement('span');
    optSpan.style.fontWeight = '400';
    optSpan.style.textTransform = 'none';
    optSpan.textContent = ' (optional)';
    phoneLabel.appendChild(optSpan);
    setSvgIcon(phoneFieldResult.iconSpan, phoneIconSvgStr);
    gateForm.appendChild(phoneFieldResult.field);

    var submitBtn2 = document.createElement('button');
    submitBtn2.className = 'fq-btn-submit fq-stagger-item fq-scale-in';
    submitBtn2.id = 'fq-submit-btn';
    submitBtn2.type = 'submit';
    gateForm.appendChild(submitBtn2);

    gateInner.appendChild(gateForm);

    var finePrint = document.createElement('p');
    finePrint.className = 'fq-fine-print';
    finePrint.id = 'fq-gate-fineprint';
    gateInner.appendChild(finePrint);

    var gateLogos = document.createElement('div');
    gateLogos.className = 'fq-gate-logos fq-stagger-item';
    for (var li = 0; li < 3; li++) {
      var logoPlaceholder = document.createElement('span');
      logoPlaceholder.className = 'fq-gate-logo-placeholder';
      logoPlaceholder.textContent = 'LOGO';
      gateLogos.appendChild(logoPlaceholder);
    }
    gateInner.appendChild(gateLogos);

    gateScreen.appendChild(gateInner);
    root.appendChild(gateScreen);

    // -- Result screen --
    var resultScreen = document.createElement('div');
    resultScreen.className = 'fq-screen fq-screen--result';
    var confettiCanvas = document.createElement('canvas');
    confettiCanvas.className = 'fq-confetti';
    confettiCanvas.id = 'fq-confetti';
    confettiCanvas.setAttribute('aria-hidden', 'true');
    resultScreen.appendChild(confettiCanvas);
    var resultInner = document.createElement('div');
    resultInner.className = 'fq-result-inner';
    resultInner.id = 'fq-result-inner';
    resultScreen.appendChild(resultInner);
    root.appendChild(resultScreen);

    // -- Thankyou screen (sales mode) --
    var thankyouScreen = document.createElement('div');
    thankyouScreen.className = 'fq-screen fq-screen--thankyou';
    var thankyouInner = document.createElement('div');
    thankyouInner.className = 'fq-thankyou-inner';
    thankyouInner.id = 'fq-thankyou-inner';
    thankyouScreen.appendChild(thankyouInner);
    root.appendChild(thankyouScreen);

    // -- Milestone 1 --
    var ms1 = document.createElement('div');
    ms1.className = 'fq-milestone';
    ms1.id = 'fq-milestone';
    ms1.setAttribute('role', 'dialog');
    ms1.setAttribute('aria-label', quizData.milestones.m1.headline);
    var ms1Inner = document.createElement('div');
    ms1Inner.className = 'fq-milestone-inner';
    var ms1Check = document.createElement('div');
    ms1Check.className = 'fq-milestone-check';
    ms1Check.innerHTML = checkSVG;
    ms1Inner.appendChild(ms1Check);
    var ms1H = document.createElement('div');
    ms1H.className = 'fq-milestone-h';
    ms1H.id = 'fq-milestone-h1';
    ms1Inner.appendChild(ms1H);
    var ms1Sub = document.createElement('div');
    ms1Sub.className = 'fq-milestone-sub';
    ms1Sub.id = 'fq-milestone-sub1';
    ms1Inner.appendChild(ms1Sub);
    var ms1Stats = document.createElement('div');
    ms1Stats.className = 'fq-milestone-stats';
    ms1Stats.id = 'fq-milestone-stats-1';
    ms1Inner.appendChild(ms1Stats);
    ms1.appendChild(ms1Inner);
    root.appendChild(ms1);

    // -- Milestone 2 --
    var ms2 = document.createElement('div');
    ms2.className = 'fq-milestone';
    ms2.id = 'fq-milestone-2';
    ms2.setAttribute('role', 'dialog');
    ms2.setAttribute('aria-label', quizData.milestones.m2.headline);
    var ms2Inner = document.createElement('div');
    ms2Inner.className = 'fq-milestone-inner';
    var ms2Check = document.createElement('div');
    ms2Check.className = 'fq-milestone-check';
    ms2Check.innerHTML = checkSVG;
    ms2Inner.appendChild(ms2Check);
    var ms2H = document.createElement('div');
    ms2H.className = 'fq-milestone-h';
    ms2H.id = 'fq-milestone-h2';
    ms2Inner.appendChild(ms2H);
    var ms2SubEl = document.createElement('div');
    ms2SubEl.className = 'fq-milestone-sub';
    ms2SubEl.id = 'fq-milestone-sub2';
    ms2Inner.appendChild(ms2SubEl);
    var ms2Stats = document.createElement('div');
    ms2Stats.className = 'fq-milestone-stats';
    ms2Stats.id = 'fq-milestone-stats-2';
    ms2Inner.appendChild(ms2Stats);
    ms2.appendChild(ms2Inner);
    root.appendChild(ms2);

    // -- Resume dialog --
    var resumeOverlay = document.createElement('div');
    resumeOverlay.className = 'fq-resume-overlay';
    resumeOverlay.id = 'fq-resume-overlay';
    var resumeCard = document.createElement('div');
    resumeCard.className = 'fq-resume-card';
    var resumeIcon = document.createElement('div');
    resumeIcon.className = 'fq-resume-icon';
    resumeIcon.innerHTML = resumeIconSVG;
    resumeCard.appendChild(resumeIcon);
    var resumeTitle = document.createElement('div');
    resumeTitle.className = 'fq-resume-title';
    resumeTitle.id = 'fq-resume-title';
    resumeCard.appendChild(resumeTitle);
    var resumeSubEl = document.createElement('div');
    resumeSubEl.className = 'fq-resume-sub';
    resumeSubEl.id = 'fq-resume-sub';
    resumeCard.appendChild(resumeSubEl);
    var resumeButtons = document.createElement('div');
    resumeButtons.className = 'fq-resume-buttons';
    var resumeContinue = document.createElement('button');
    resumeContinue.className = 'fq-resume-btn-primary';
    resumeContinue.id = 'fq-resume-continue';
    resumeButtons.appendChild(resumeContinue);
    var resumeRestart = document.createElement('button');
    resumeRestart.className = 'fq-resume-btn-secondary';
    resumeRestart.id = 'fq-resume-restart';
    resumeButtons.appendChild(resumeRestart);
    resumeCard.appendChild(resumeButtons);
    resumeOverlay.appendChild(resumeCard);
    root.appendChild(resumeOverlay);
  }

  // ============================================
  // 3b. POPULATE TEXT FROM JSON
  // ============================================
  function populateText() {
    // Landing
    setText('fq-landing-badge', quizData.landing.badge);
    setText('fq-landing-h1', quizData.landing.headline);
    setText('fq-landing-sub', quizData.landing.subtitle);
    setText('fq-start-btn', quizData.landing.cta);
    setText('fq-landing-social', quizData.landing.socialProof);

    // Gate
    setText('fq-gate-status-text', quizData.gate.statusText);
    setText('fq-gate-h2', quizData.gate.headline);
    setText('fq-gate-sub', quizData.gate.subtitle);
    setText('fq-submit-btn', quizData.gate.submitButton);
    setText('fq-gate-fineprint', quizData.gate.finePrint);

    // Milestones — subtitles may contain \n for line breaks
    setText('fq-milestone-h1', quizData.milestones.m1.headline);
    setMilestoneSubtitle('fq-milestone-sub1', quizData.milestones.m1.subtitle);
    setText('fq-milestone-h2', quizData.milestones.m2.headline);
    setMilestoneSubtitle('fq-milestone-sub2', quizData.milestones.m2.subtitle);

    // Resume
    setText('fq-resume-title', quizData.resume.title);
    setText('fq-resume-sub', quizData.resume.subtitle);
    setText('fq-resume-continue', quizData.resume.continueButton);
    setText('fq-resume-restart', quizData.resume.restartButton);
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text || '';
  }

  function setMilestoneSubtitle(id, text) {
    // Milestone subtitles may have \n that should become <br>
    var el = document.getElementById(id);
    if (!el || !text) return;
    el.textContent = '';
    var parts = text.split('\n');
    parts.forEach(function(part, i) {
      el.appendChild(document.createTextNode(part));
      if (i < parts.length - 1) el.appendChild(document.createElement('br'));
    });
  }

  // ============================================
  // 3c. GENERIC SCORES INIT
  // ============================================
  function initScores() {
    var s = {};
    quizData.dimOrder.forEach(function(k) { s[k] = 0; });
    return s;
  }

  // ============================================
  // 3d. STATE
  // ============================================
  var selectedICP = null;
  var allQuestions = [];
  var currentQuestion = 0;
  var userAnswers = [];
  var quizResults = null;
  var TOTAL_QUESTIONS = 20;
  var GENERAL_END_INDEX = 1 + quizData.generalQuestions.length;
  var PART2_END_INDEX = GENERAL_END_INDEX + 6;

  // ============================================
  // 3e. BUILD QUESTIONS
  // ============================================
  function buildQuestions() {
    allQuestions = [quizData.icpQuestion].concat(quizData.generalQuestions);
    if (selectedICP) {
      allQuestions = allQuestions.concat(quizData.icpQuestions[selectedICP]);
    }
    TOTAL_QUESTIONS = allQuestions.length;
    GENERAL_END_INDEX = 1 + quizData.generalQuestions.length;
    PART2_END_INDEX = GENERAL_END_INDEX + 6;
    userAnswers = allQuestions.map(function(q) {
      return q.type === 'multi' ? [] : null;
    });
  }

  // ============================================
  // 3f. SCORING
  // ============================================
  function calculateDimensionMaxes(questions) {
    var maxes = initScores();
    questions.forEach(function(q) {
      if (q.type === 'icp-select') return;
      if (q.type === 'single') {
        var qMax = {};
        q.options.forEach(function(opt) {
          if (!opt.scores) return;
          Object.keys(opt.scores).forEach(function(dim) {
            if (!qMax[dim] || opt.scores[dim] > qMax[dim]) qMax[dim] = opt.scores[dim];
          });
        });
        Object.keys(qMax).forEach(function(dim) { maxes[dim] = (maxes[dim] || 0) + qMax[dim]; });
      } else if (q.type === 'multi') {
        q.options.forEach(function(opt) {
          if (!opt.scores) return;
          Object.keys(opt.scores).forEach(function(dim) { maxes[dim] = (maxes[dim] || 0) + opt.scores[dim]; });
        });
      }
    });
    return maxes;
  }

  function calculateResults(answers) {
    var scores = initScores();
    answers.forEach(function(answer, qi) {
      var q = allQuestions[qi];
      if (q.type === 'icp-select') return;
      if (q.type === 'single' && answer !== null) {
        var opt = q.options[answer];
        if (opt.scores) Object.keys(opt.scores).forEach(function(dim) { scores[dim] = (scores[dim] || 0) + opt.scores[dim]; });
      } else if (q.type === 'multi' && Array.isArray(answer)) {
        answer.forEach(function(oi) {
          var opt = q.options[oi];
          if (opt.scores) Object.keys(opt.scores).forEach(function(dim) { scores[dim] = (scores[dim] || 0) + opt.scores[dim]; });
        });
      }
    });
    var maxes = calculateDimensionMaxes(allQuestions);
    var totalScore = Object.values(scores).reduce(function(a, b) { return a + b; }, 0);
    var maxScore = Object.values(maxes).reduce(function(a, b) { return a + b; }, 0);
    var pct = maxScore > 0 ? totalScore / maxScore : 0;

    var segment, segmentLabel;
    if (pct <= quizData.segments.A.threshold) { segment = 'A'; segmentLabel = quizData.segments.A.label; }
    else if (pct <= quizData.segments.B.threshold) { segment = 'B'; segmentLabel = quizData.segments.B.label; }
    else { segment = 'C'; segmentLabel = quizData.segments.C.label; }

    var dimArr = Object.keys(scores).map(function(key) {
      var val = scores[key]; var max = maxes[key] || 1;
      return { key: key, label: quizData.dimensions[key], score: val, max: max, percentage: val / max };
    }).sort(function(a, b) { return a.percentage - b.percentage; });

    return {
      scores: scores, totalScore: totalScore, maxScore: maxScore,
      segment: segment, segmentLabel: segmentLabel,
      weakest: dimArr[0], secondWeakest: dimArr[1], dimPercentages: dimArr
    };
  }

  // ============================================
  // 3g. SCREEN MANAGEMENT
  // ============================================
  function showScreen(name) {
    var screens = document.querySelectorAll('#quiz-root .fq-screen');
    var target = null;
    screens.forEach(function(s) { if (s.classList.contains('fq-screen--' + name)) target = s; });
    if (!target) return;
    var current = document.querySelector('#quiz-root .fq-screen.fq-active');
    if (current === target) return;
    if (current) {
      current.style.opacity = '0';
      setTimeout(function() {
        current.classList.remove('fq-active'); current.style.display = ''; current.style.opacity = '';
        target.style.opacity = '0'; target.style.display = 'block'; target.classList.add('fq-active');
        playWhoosh();
        requestAnimationFrame(function() { requestAnimationFrame(function() { target.style.opacity = '1'; }); });
        // Trigger stagger entrance for new screen
        var staggerItems = target.querySelectorAll('.fq-stagger-item');
        staggerItems.forEach(function(el) { el.classList.remove('fq-entered'); });
        staggerItems.forEach(function(el, i) {
          setTimeout(function() { el.classList.add('fq-entered'); }, 120 * i + 200);
        });
        if (!target.classList.contains('fq-screen--result')) {
          document.getElementById('quiz-root').scrollIntoView({ behavior: 'smooth' });
        }
      }, 250);
    } else {
      target.classList.add('fq-active'); target.style.opacity = '1';
    }
  }

  // ============================================
  // 3h. MILESTONES
  // ============================================
  function showMilestone(cb) {
    var el = document.getElementById('fq-milestone');
    var statsContainer = document.getElementById('fq-milestone-stats-1');
    while (statsContainer.firstChild) statsContainer.removeChild(statsContainer.firstChild);
    var answeredCount = 0;
    var interimScores = initScores();
    for (var i = 0; i < GENERAL_END_INDEX; i++) {
      if (userAnswers[i] !== null && userAnswers[i] !== undefined) {
        answeredCount++;
        var q = allQuestions[i];
        if (q.type === 'single' && typeof userAnswers[i] === 'number') {
          var opt = q.options[userAnswers[i]];
          if (opt && opt.scores) { Object.keys(opt.scores).forEach(function(k) { interimScores[k] = (interimScores[k] || 0) + opt.scores[k]; }); }
        } else if (q.type === 'multi' && Array.isArray(userAnswers[i])) {
          userAnswers[i].forEach(function(oi) {
            var opt2 = q.options[oi];
            if (opt2 && opt2.scores) { Object.keys(opt2.scores).forEach(function(k) { interimScores[k] = (interimScores[k] || 0) + opt2.scores[k]; }); }
          });
        }
      }
    }
    var totalInterim = Object.values(interimScores).reduce(function(a, b) { return a + b; }, 0);
    var stats = [
      { value: answeredCount, label: 'Fragen' },
      { value: totalInterim, label: 'Punkte' }
    ];
    stats.forEach(function(s, idx) {
      var card = document.createElement('div'); card.className = 'fq-milestone-stat';
      var val = document.createElement('div'); val.className = 'fq-milestone-stat-value'; val.textContent = s.value;
      var label = document.createElement('div'); label.className = 'fq-milestone-stat-label'; label.textContent = s.label;
      card.appendChild(val); card.appendChild(label);
      statsContainer.appendChild(card);
      setTimeout(function() { card.classList.add('fq-visible'); }, 300 + idx * 150);
    });

    el.classList.add('fq-visible');
    playSuccess();
    setTimeout(function() {
      el.classList.remove('fq-visible');
      if (cb) setTimeout(cb, 300);
    }, 3200);
  }

  function showMilestone2(cb) {
    var el = document.getElementById('fq-milestone-2');
    var statsContainer = document.getElementById('fq-milestone-stats-2');
    while (statsContainer.firstChild) statsContainer.removeChild(statsContainer.firstChild);
    var interimScores = initScores();
    var answeredCount = 0;
    for (var i = 0; i < PART2_END_INDEX; i++) {
      if (userAnswers[i] !== null && userAnswers[i] !== undefined) {
        answeredCount++;
        var q = allQuestions[i];
        if (q.type === 'single' && typeof userAnswers[i] === 'number') {
          var opt = q.options[userAnswers[i]];
          if (opt && opt.scores) { Object.keys(opt.scores).forEach(function(k) { interimScores[k] = (interimScores[k] || 0) + opt.scores[k]; }); }
        } else if (q.type === 'multi' && Array.isArray(userAnswers[i])) {
          userAnswers[i].forEach(function(oi) {
            var opt2 = q.options[oi];
            if (opt2 && opt2.scores) { Object.keys(opt2.scores).forEach(function(k) { interimScores[k] = (interimScores[k] || 0) + opt2.scores[k]; }); }
          });
        }
      }
    }
    var totalInterim = Object.values(interimScores).reduce(function(a, b) { return a + b; }, 0);
    var pctComplete = Math.round((answeredCount / TOTAL_QUESTIONS) * 100);
    var stats = [
      { value: pctComplete + '%', label: 'Komplett' },
      { value: totalInterim, label: 'Punkte' }
    ];
    stats.forEach(function(s, idx) {
      var card = document.createElement('div'); card.className = 'fq-milestone-stat';
      var val = document.createElement('div'); val.className = 'fq-milestone-stat-value'; val.textContent = s.value;
      var label = document.createElement('div'); label.className = 'fq-milestone-stat-label'; label.textContent = s.label;
      card.appendChild(val); card.appendChild(label);
      statsContainer.appendChild(card);
      setTimeout(function() { card.classList.add('fq-visible'); }, 300 + idx * 150);
    });

    el.classList.add('fq-visible');
    playSuccess();
    setTimeout(function() {
      el.classList.remove('fq-visible');
      if (cb) setTimeout(cb, 300);
    }, 3200);
  }

  // ============================================
  // 3i. QUESTION HELPERS
  // ============================================
  function hasAnswer(qi) {
    var q = allQuestions[qi];
    if (q.type === 'multi') return userAnswers[qi].length > 0;
    if (q.type === 'icp-select') return userAnswers[qi] !== null;
    return userAnswers[qi] !== null;
  }

  // ============================================
  // 3j. QUESTION RENDERING
  // ============================================
  function buildOptionEl(qi, oi, q) {
    var opt = q.options[oi];
    var isICP = q.type === 'icp-select';
    var isMulti = q.type === 'multi';
    var isSelected;
    if (isICP || q.type === 'single') isSelected = userAnswers[qi] === oi;
    else isSelected = userAnswers[qi].indexOf(oi) !== -1;

    var el = document.createElement('div');
    el.className = 'fq-option' + (isSelected ? ' fq-selected' : '') + (isICP ? ' fq-option-icp' : '');
    el.setAttribute('role', q.type === 'multi' ? 'checkbox' : 'radio');
    el.setAttribute('aria-checked', String(isSelected));
    el.setAttribute('tabindex', '0');
    el.dataset.qi = qi; el.dataset.oi = oi;

    if (isICP) {
      var row = document.createElement('div'); row.className = 'fq-option-icp-row';
      var indicator = document.createElement('span'); indicator.className = 'fq-option-indicator';
      var textEl = document.createElement('span'); textEl.className = 'fq-option-text'; textEl.textContent = opt.text;
      row.appendChild(indicator); row.appendChild(textEl);
      el.appendChild(row);
      if (opt.desc) {
        var descEl = document.createElement('div'); descEl.className = 'fq-option-icp-desc'; descEl.textContent = opt.desc;
        el.appendChild(descEl);
      }
    } else {
      var indicator2 = document.createElement('span');
      if (isMulti) {
        indicator2.className = 'fq-option-checkbox';
        var svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svgEl.setAttribute('width', '12'); svgEl.setAttribute('height', '10'); svgEl.setAttribute('viewBox', '0 0 12 10'); svgEl.setAttribute('fill', 'none');
        var pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathEl.setAttribute('d', 'M1 5L4.5 8.5L11 1.5'); pathEl.setAttribute('stroke', 'white'); pathEl.setAttribute('stroke-width', '2');
        pathEl.setAttribute('stroke-linecap', 'round'); pathEl.setAttribute('stroke-linejoin', 'round');
        svgEl.appendChild(pathEl); indicator2.appendChild(svgEl);
      } else {
        indicator2.className = 'fq-option-indicator';
      }
      var textEl2 = document.createElement('span'); textEl2.className = 'fq-option-text'; textEl2.textContent = opt.text;
      el.appendChild(indicator2); el.appendChild(textEl2);
    }

    function onSelect() { selectOption(qi, oi); }
    el.addEventListener('click', onSelect);
    el.addEventListener('keydown', function(e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } });
    return el;
  }

  function renderInfoBox(q, parentEl) {
    if (!q.info) return;
    var infoBox = document.createElement('div'); infoBox.className = 'fq-info-box';
    var infoHeader = document.createElement('button'); infoHeader.className = 'fq-info-header';
    infoHeader.setAttribute('type', 'button'); infoHeader.setAttribute('aria-expanded', 'false');
    var infoIcon = document.createElement('span'); infoIcon.className = 'fq-info-icon';
    if (q.info.icon) {
      // Trusted SVG from our own quiz JSON, not user input
      infoIcon.innerHTML = q.info.icon; // eslint-disable-line -- trusted content
    }
    var infoLabel = document.createElement('span'); infoLabel.className = 'fq-info-label'; infoLabel.textContent = q.info.label;
    var infoChevron = document.createElement('span'); infoChevron.className = 'fq-info-chevron'; infoChevron.textContent = '\u25BC';
    infoHeader.appendChild(infoIcon); infoHeader.appendChild(infoLabel); infoHeader.appendChild(infoChevron);
    var infoText = document.createElement('div'); infoText.className = 'fq-info-text';
    // Info text contains trusted HTML from our own JSON (benchmarks, strong tags, lists)
    // This is content we author, not user input
    infoText.innerHTML = q.info.text; // eslint-disable-line -- trusted content from quiz JSON
    infoHeader.addEventListener('click', function() {
      var expanded = infoBox.classList.toggle('fq-expanded');
      infoHeader.setAttribute('aria-expanded', String(expanded));
    });
    infoBox.appendChild(infoHeader); infoBox.appendChild(infoText);
    parentEl.appendChild(infoBox);
  }

  function renderQuestion(qi, direction) {
    var q = allQuestions[qi];
    var content = document.getElementById('fq-question-content');

    // Update part label from quizData
    var partLabel = document.getElementById('fq-part-label');
    if (qi < GENERAL_END_INDEX) {
      partLabel.textContent = quizData.partLabels.part1;
    } else if (qi < PART2_END_INDEX) {
      var icpName = quizData.partLabels.icpNames[selectedICP] || 'Dein Bereich';
      partLabel.textContent = quizData.partLabels.part2Prefix + icpName;
    } else {
      partLabel.textContent = quizData.partLabels.part3;
    }

    function doRender() {
      while (content.firstChild) content.removeChild(content.firstChild);

      var indic = document.createElement('div'); indic.className = 'fq-question-indicator';
      indic.textContent = 'Frage ' + (qi + 1) + ' von ' + TOTAL_QUESTIONS;

      var qText = document.createElement('div'); qText.className = 'fq-question-text';
      qText.textContent = q.question;

      var hint = document.createElement('div'); hint.className = 'fq-question-hint';
      if (q.hint) hint.textContent = q.hint;

      var opts = document.createElement('div'); opts.className = 'fq-options';
      opts.setAttribute('role', q.type === 'multi' ? 'group' : 'radiogroup');
      opts.setAttribute('aria-label', q.question);
      q.options.forEach(function(_, oi) { opts.appendChild(buildOptionEl(qi, oi, q)); });

      content.appendChild(indic);
      content.appendChild(qText);
      content.appendChild(hint);

      renderInfoBox(q, content);

      content.appendChild(opts);

      // Stagger option reveals
      var optionEls = opts.querySelectorAll('.fq-option');
      optionEls.forEach(function(optEl, i) {
        optEl.style.opacity = '0';
        optEl.style.transform = 'translateY(12px)';
        optEl.style.transition = 'none';
        setTimeout(function() {
          optEl.style.transition = 'opacity 500ms ease-out, transform 600ms cubic-bezier(0.22, 1.3, 0.36, 1)';
          optEl.style.opacity = '1';
          optEl.style.transform = 'translateY(0)';
        }, 100 * i + (direction === 'init' ? 0 : 180));
      });

      // Progress — use Math.max(TOTAL_QUESTIONS, 20) as divisor
      var progressDivisor = Math.max(TOTAL_QUESTIONS, 20);
      document.getElementById('fq-progress-fill').style.width = (((qi + 1) / progressDivisor) * 100) + '%';
      var progressTrackEl = document.querySelector('#quiz-root .fq-progress-track');
      if (progressTrackEl) {
        progressTrackEl.setAttribute('role', 'progressbar');
        progressTrackEl.setAttribute('aria-valuenow', qi + 1);
        progressTrackEl.setAttribute('aria-valuemin', 1);
        progressTrackEl.setAttribute('aria-valuemax', TOTAL_QUESTIONS);
        progressTrackEl.setAttribute('aria-label', 'Fortschritt: Frage ' + (qi + 1) + ' von ' + TOTAL_QUESTIONS);
      }

      // Nav
      var bBtn = document.getElementById('fq-back-btn');
      var nBtn = document.getElementById('fq-next-btn');
      if (qi === 0) bBtn.classList.add('fq-hidden'); else bBtn.classList.remove('fq-hidden');
      nBtn.textContent = qi === TOTAL_QUESTIONS - 1 ? 'Ergebnis anzeigen \u2192' : 'Weiter \u2192';
      nBtn.disabled = !hasAnswer(qi);

      // Animate in
      if (direction !== 'init') {
        var inX = direction === 'forward' ? '20px' : '-20px';
        content.style.transition = 'none'; content.style.opacity = '0'; content.style.transform = 'translateX(' + inX + ')';
        requestAnimationFrame(function() { requestAnimationFrame(function() {
          content.style.transition = 'opacity 400ms ease-out, transform 500ms cubic-bezier(0.22, 1.3, 0.36, 1)';
          content.style.opacity = '1'; content.style.transform = 'translateX(0)';
        }); });
      } else {
        content.style.transition = ''; content.style.opacity = '1'; content.style.transform = 'translateX(0)';
      }
    }

    if (direction === 'init') { doRender(); }
    else {
      var outX = direction === 'forward' ? '-20px' : '20px';
      content.style.transition = 'opacity 250ms ease-out, transform 250ms ease-out';
      content.style.opacity = '0'; content.style.transform = 'translateX(' + outX + ')';
      setTimeout(doRender, 260);
    }
  }

  function selectOption(qi, oi) {
    var q = allQuestions[qi];
    if (q.type === 'icp-select') {
      userAnswers[qi] = oi;
      selectedICP = q.options[oi].value;
      buildQuestions();
      // Restore the ICP answer
      userAnswers[0] = oi;
    } else if (q.type === 'single') {
      userAnswers[qi] = oi;
    } else {
      var arr = userAnswers[qi];
      var idx = arr.indexOf(oi);
      if (idx === -1) arr.push(oi); else arr.splice(idx, 1);
    }
    var options = document.querySelectorAll('#fq-question-content .fq-option');
    options.forEach(function(el) {
      var elOi = parseInt(el.dataset.oi);
      var sel;
      if (q.type === 'multi') sel = userAnswers[qi].indexOf(elOi) !== -1;
      else sel = userAnswers[qi] === elOi;
      el.classList.toggle('fq-selected', sel);
      el.setAttribute('aria-checked', String(sel));
    });
    playTick();
    document.getElementById('fq-next-btn').disabled = !hasAnswer(qi);
    saveProgress();
  }

  // ============================================
  // 3k. CONFETTI
  // ============================================
  function launchConfetti() {
    var canvas = document.getElementById('fq-confetti');
    var resultScreenEl = canvas.parentElement;
    var W = resultScreenEl.offsetWidth;
    var H = Math.min(resultScreenEl.offsetHeight, 800);
    canvas.width = W; canvas.height = H;
    canvas.style.display = 'block';
    var ctx = canvas.getContext('2d');

    var palette = [
      {r:25,g:63,b:59}, {r:28,g:185,b:158}, {r:161,g:207,b:21},
      {r:92,g:251,b:245}, {r:212,g:175,b:55}, {r:201,g:196,b:181},
      {r:45,g:107,b:99}, {r:139,g:191,b:182}
    ];

    var particles = [];
    var originX = W * 0.5;
    var originY = H * 0.7;
    var totalCount = Math.max(80, Math.min(200, Math.floor(W / 5)));

    var bursts = [
      { ratio: 0.25, spread: 26, startVelocity: 55, decay: 0.94, scalar: 1.2 },
      { ratio: 0.20, spread: 60, startVelocity: 45, decay: 0.94, scalar: 1.0 },
      { ratio: 0.35, spread: 100, startVelocity: 45, decay: 0.92, scalar: 0.7 },
      { ratio: 0.10, spread: 120, startVelocity: 25, decay: 0.93, scalar: 1.5 },
      { ratio: 0.10, spread: 120, startVelocity: 45, decay: 0.93, scalar: 0.5 }
    ];

    bursts.forEach(function(b) {
      var n = Math.floor(totalCount * b.ratio);
      for (var i = 0; i < n; i++) {
        var angle = (90 * Math.PI / 180);
        var spreadRad = (b.spread * Math.PI / 180);
        var angle2D = -angle + ((0.5 * spreadRad) - (Math.random() * spreadRad));
        var vel = (b.startVelocity * 0.5) + (Math.random() * b.startVelocity);
        var col = palette[Math.floor(Math.random() * palette.length)];
        var sc = b.scalar;
        particles.push({
          x: originX, y: originY,
          wobble: Math.random() * 10,
          wobbleSpeed: Math.min(0.11, Math.random() * 0.1 + 0.05),
          velocity: vel, angle2D: angle2D,
          tiltAngle: (Math.random() * 0.5 + 0.25) * Math.PI,
          color: col, tick: 0,
          totalTicks: 260 + Math.floor(Math.random() * 120),
          decay: b.decay, drift: (Math.random() - 0.5) * 0.5,
          gravity: 2, scalar: sc,
          ovalScalar: 0.6 + Math.random() * 0.4
        });
      }
    });

    function frame() {
      ctx.clearRect(0, 0, W, H);
      var alive = false;
      particles.forEach(function(p) {
        if (p.tick >= p.totalTicks) return;
        alive = true;

        p.x += Math.cos(p.angle2D) * p.velocity + p.drift;
        p.y += Math.sin(p.angle2D) * p.velocity + p.gravity;
        p.velocity *= p.decay;
        p.wobble += p.wobbleSpeed;
        p.tiltAngle += 0.1;

        var wobbleX = p.x + ((10 * p.scalar) * Math.cos(p.wobble));
        var wobbleY = p.y + ((10 * p.scalar) * Math.sin(p.wobble));
        var tiltSin = Math.sin(p.tiltAngle);
        var tiltCos = Math.cos(p.tiltAngle);
        var progress = p.tick / p.totalTicks;
        var alpha = 1 - progress;

        var x1 = p.x + (p.scalar * tiltCos * 0.5);
        var y1 = p.y + (p.scalar * tiltSin * 0.5);
        var x2 = wobbleX + (p.scalar * tiltCos * -0.5);
        var y2 = wobbleY + (p.scalar * tiltSin * -0.5);

        ctx.fillStyle = 'rgba(' + p.color.r + ',' + p.color.g + ',' + p.color.b + ',' + alpha + ')';

        var rx = Math.abs(x2 - x1) * 0.5 * p.ovalScalar;
        var ry = Math.abs(y2 - y1) * 0.5 * p.ovalScalar;
        rx = Math.max(rx, 1); ry = Math.max(ry, 1);
        var cx = (x1 + x2) * 0.5;
        var cy = (y1 + y2) * 0.5;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(Math.PI / 10 * p.wobble);
        ctx.scale(1, ry / Math.max(rx, 0.01));
        ctx.beginPath();
        ctx.arc(0, 0, rx, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        p.tick++;
      });
      if (alive) {
        requestAnimationFrame(frame);
      } else {
        canvas.style.display = 'none';
      }
    }
    frame();
  }

  // ============================================
  // 3l. SOUND EFFECTS
  // ============================================
  var audioCtx = null;
  function getAudioCtx() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
    }
    return audioCtx;
  }

  function playTick() {
    var ctx = getAudioCtx(); if (!ctx) return;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    var filter = ctx.createBiquadFilter();
    osc.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 380;
    osc.type = 'sine';
    filter.type = 'lowpass';
    filter.frequency.value = 600;
    gain.gain.setValueAtTime(0.035, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.06);
  }

  function playSuccess() {
    var ctx = getAudioCtx(); if (!ctx) return;
    var notes = [
      { freq: 880, delay: 0, dur: 0.35, vol: 0.04 },
      { freq: 1320, delay: 0.12, dur: 0.4, vol: 0.03 }
    ];
    notes.forEach(function(n) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      var filter = ctx.createBiquadFilter();
      osc.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = n.freq;
      osc.type = 'sine';
      filter.type = 'lowpass';
      filter.frequency.value = 2000;
      filter.Q.value = 0.5;
      var t = ctx.currentTime + n.delay;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(n.vol, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + n.dur);
      osc.start(t);
      osc.stop(t + n.dur + 0.05);
    });
  }

  function playWhoosh() {
    var ctx = getAudioCtx(); if (!ctx) return;
    var bufferSize = Math.floor(ctx.sampleRate * 0.12);
    var buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < bufferSize; i++) {
      var env = Math.sin(Math.PI * i / bufferSize);
      data[i] = (Math.random() * 2 - 1) * env;
    }
    var source = ctx.createBufferSource();
    source.buffer = buffer;
    var filter = ctx.createBiquadFilter();
    filter.type = 'bandpass'; filter.frequency.value = 500; filter.Q.value = 0.3;
    var gain = ctx.createGain();
    source.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.02, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    source.start(ctx.currentTime);
  }

  function playConfettiPop() {
    var ctx = getAudioCtx(); if (!ctx) return;
    var osc1 = ctx.createOscillator();
    var osc2 = ctx.createOscillator();
    var gain1 = ctx.createGain();
    var filter = ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 1500;
    osc1.connect(filter); osc2.connect(filter);
    filter.connect(gain1); gain1.connect(ctx.destination);
    osc1.type = 'sine'; osc2.type = 'sine';
    osc1.frequency.setValueAtTime(440, ctx.currentTime);
    osc1.frequency.linearRampToValueAtTime(880, ctx.currentTime + 0.3);
    osc2.frequency.setValueAtTime(554, ctx.currentTime);
    osc2.frequency.linearRampToValueAtTime(1108, ctx.currentTime + 0.3);
    gain1.gain.setValueAtTime(0, ctx.currentTime);
    gain1.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 0.05);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc1.start(ctx.currentTime); osc1.stop(ctx.currentTime + 0.5);
    osc2.start(ctx.currentTime); osc2.stop(ctx.currentTime + 0.5);
  }

  function animateCounter(el, target, duration) {
    var startTime = null;
    function step(ts) {
      if (!startTime) startTime = ts;
      var p = Math.min((ts - startTime) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = String(Math.round(eased * target));
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // ============================================
  // 3m. RESULT RENDERING
  // ============================================
  function renderResult(results) {
    var totalScore = results.totalScore;
    var maxScore = results.maxScore;
    var segment = results.segment;
    var segmentLabel = results.segmentLabel;
    var weakest = results.weakest;
    var secondWeakest = results.secondWeakest;
    var dimPercentages = results.dimPercentages;
    var circumference = 2 * Math.PI * 70;

    var sc = quizData.resultContent[segment];
    var resultRoot = document.getElementById('fq-result-inner');
    while (resultRoot.firstChild) resultRoot.removeChild(resultRoot.firstChild);

    // Ring
    var ringWrap = document.createElement('div'); ringWrap.className = 'fq-ring-wrap';
    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'fq-ring-svg'); svg.setAttribute('viewBox', '0 0 160 160');
    var trackCircle = document.createElementNS(svgNS, 'circle');
    trackCircle.setAttribute('cx', '80'); trackCircle.setAttribute('cy', '80'); trackCircle.setAttribute('r', '70');
    trackCircle.setAttribute('fill', 'none'); trackCircle.setAttribute('stroke', 'var(--fq-border-subtle)'); trackCircle.setAttribute('stroke-width', '8');
    var progCircle = document.createElementNS(svgNS, 'circle');
    progCircle.setAttribute('id', 'fq-ring-progress'); progCircle.setAttribute('cx', '80'); progCircle.setAttribute('cy', '80'); progCircle.setAttribute('r', '70');
    progCircle.setAttribute('fill', 'none'); progCircle.setAttribute('stroke', 'var(--fq-accent)'); progCircle.setAttribute('stroke-width', '8');
    progCircle.setAttribute('stroke-linecap', 'round');
    progCircle.setAttribute('stroke-dasharray', circumference.toFixed(2));
    progCircle.setAttribute('stroke-dashoffset', circumference.toFixed(2));
    progCircle.setAttribute('transform', 'rotate(-90 80 80)');
    progCircle.style.transition = 'stroke-dashoffset 1200ms ease-out';
    var scoreTextEl = document.createElementNS(svgNS, 'text');
    scoreTextEl.setAttribute('id', 'fq-score-counter');
    scoreTextEl.setAttribute('x', '80'); scoreTextEl.setAttribute('y', '76'); scoreTextEl.setAttribute('text-anchor', 'middle');
    scoreTextEl.setAttribute('dominant-baseline', 'middle'); scoreTextEl.setAttribute('font-family', 'var(--fq-font)');
    scoreTextEl.setAttribute('font-size', '40'); scoreTextEl.setAttribute('font-weight', '700'); scoreTextEl.setAttribute('fill', 'var(--fq-text-primary)');
    scoreTextEl.textContent = '0';
    var maxTextEl = document.createElementNS(svgNS, 'text');
    maxTextEl.setAttribute('x', '80'); maxTextEl.setAttribute('y', '100'); maxTextEl.setAttribute('text-anchor', 'middle');
    maxTextEl.setAttribute('dominant-baseline', 'middle'); maxTextEl.setAttribute('font-family', 'var(--fq-font)');
    maxTextEl.setAttribute('font-size', '16'); maxTextEl.setAttribute('fill', 'var(--fq-text-tertiary)');
    maxTextEl.textContent = '/' + maxScore;
    svg.appendChild(trackCircle); svg.appendChild(progCircle); svg.appendChild(scoreTextEl); svg.appendChild(maxTextEl);
    ringWrap.appendChild(svg); ringWrap.classList.add('fq-reveal-scale'); resultRoot.appendChild(ringWrap);

    // Segment badge
    var badgeWrap = document.createElement('div'); badgeWrap.className = 'fq-segment-badge fq-reveal-scale';
    var badge = document.createElement('span'); badge.className = 'fq-badge'; badge.textContent = segmentLabel;
    badgeWrap.appendChild(badge); resultRoot.appendChild(badgeWrap);

    // Dimension bars
    var dims = document.createElement('div'); dims.className = 'fq-dims fq-reveal';
    quizData.dimOrder.forEach(function(key, idx) {
      var dim = null;
      dimPercentages.forEach(function(d) { if (d.key === key) dim = d; });
      if (!dim) return;
      var isWeakest = dim.key === weakest.key;
      var row = document.createElement('div'); row.className = 'fq-dim-row';
      var header = document.createElement('div'); header.className = 'fq-dim-header';
      var labelEl = document.createElement('span'); labelEl.className = 'fq-dim-label' + (isWeakest ? ' fq-weakest' : '');
      labelEl.textContent = dim.label;
      if (isWeakest) {
        var tag = document.createElement('span'); tag.className = 'fq-dim-tag'; tag.textContent = sc.hebelTag;
        labelEl.appendChild(tag);
      }
      var scoreEl = document.createElement('span'); scoreEl.className = 'fq-dim-score'; scoreEl.textContent = dim.score + '/' + dim.max;
      header.appendChild(labelEl); header.appendChild(scoreEl);
      var barTrack = document.createElement('div'); barTrack.className = 'fq-dim-bar-track';
      var barFill = document.createElement('div'); barFill.className = 'fq-dim-bar-fill';
      barFill.dataset.target = (dim.percentage * 100).toFixed(1);
      barFill.dataset.idx = idx;
      barTrack.appendChild(barFill);
      row.appendChild(header); row.appendChild(barTrack);
      dims.appendChild(row);
    });
    resultRoot.appendChild(dims);

    // Benchmark comparison
    var benchPctRaw = (totalScore / maxScore);
    var percentile;
    if (benchPctRaw <= 0.25) percentile = Math.round(10 + benchPctRaw * 80);
    else if (benchPctRaw <= 0.5) percentile = Math.round(30 + (benchPctRaw - 0.25) * 100);
    else if (benchPctRaw <= 0.75) percentile = Math.round(55 + (benchPctRaw - 0.5) * 120);
    else percentile = Math.round(85 + (benchPctRaw - 0.75) * 60);
    percentile = Math.min(percentile, 99);

    var benchBar = document.createElement('div'); benchBar.className = 'fq-benchmark-bar fq-reveal';
    var benchTrackEl = document.createElement('div'); benchTrackEl.className = 'fq-benchmark-track';
    var benchFill = document.createElement('div'); benchFill.className = 'fq-benchmark-fill';
    benchTrackEl.appendChild(benchFill);
    var benchText = document.createElement('div'); benchText.className = 'fq-benchmark-text';
    var benchStrong = document.createElement('strong');
    benchStrong.textContent = 'Top ' + (100 - percentile) + '%';
    benchText.appendChild(document.createTextNode('Du liegst im '));
    benchText.appendChild(benchStrong);
    benchText.appendChild(document.createTextNode(' aller bisherigen Teilnehmer.'));
    benchBar.appendChild(benchTrackEl);
    benchBar.appendChild(benchText);
    resultRoot.appendChild(benchBar);
    setTimeout(function() {
      benchFill.style.width = percentile + '%';
    }, 500);

    // Diagnosis card
    var textBlock = document.createElement('div'); textBlock.className = 'fq-result-text-block';
    var diagCard = document.createElement('div'); diagCard.className = 'fq-result-diagnosis-card fq-reveal';
    var h2 = document.createElement('h2'); h2.className = 'fq-result-h2'; h2.textContent = sc.headline;
    var p1 = document.createElement('p'); p1.className = 'fq-result-p'; p1.textContent = sc.p1;
    var p2 = document.createElement('p'); p2.className = 'fq-result-p'; p2.textContent = sc.p2;
    diagCard.appendChild(h2); diagCard.appendChild(p1); diagCard.appendChild(p2);
    var icpStatText = quizData.icpStats[segment] && quizData.icpStats[segment][selectedICP];
    if (icpStatText) {
      var statWrap = document.createElement('div'); statWrap.className = 'fq-result-icp-stat';
      var statIcon = document.createElement('div'); statIcon.className = 'fq-result-icp-stat-icon';
      var starSvg = document.createElementNS(svgNS, 'svg');
      starSvg.setAttribute('width', '20'); starSvg.setAttribute('height', '20'); starSvg.setAttribute('viewBox', '0 0 20 20'); starSvg.setAttribute('fill', 'none');
      var starPath = document.createElementNS(svgNS, 'path');
      starPath.setAttribute('d', 'M10 2L12.5 7.5L18 8.5L14 12.5L15 18L10 15.5L5 18L6 12.5L2 8.5L7.5 7.5L10 2Z');
      starPath.setAttribute('stroke', 'currentColor'); starPath.setAttribute('stroke-width', '1.3'); starPath.setAttribute('stroke-linejoin', 'round');
      starSvg.appendChild(starPath); statIcon.appendChild(starSvg);
      var statTextEl = document.createElement('div'); statTextEl.className = 'fq-result-icp-stat-text'; statTextEl.textContent = icpStatText;
      statWrap.appendChild(statIcon); statWrap.appendChild(statTextEl);
      diagCard.appendChild(statWrap);
    }
    textBlock.appendChild(diagCard);

    // Lever cards
    var leverWrap = document.createElement('div'); leverWrap.style.marginTop = '24px';
    var leverTitle = document.createElement('div'); leverTitle.className = 'fq-lever-title'; leverTitle.style.marginBottom = '16px'; leverTitle.textContent = sc.leverTitle;
    leverWrap.appendChild(leverTitle);
    [weakest, secondWeakest].forEach(function(dim, idx) {
      var detail = quizData.leverDetails[dim.key];
      if (!detail) return;
      var card = document.createElement('div'); card.className = 'fq-lever-card fq-reveal';
      var cardHeader = document.createElement('div'); cardHeader.className = 'fq-lever-card-header';
      var cardName = document.createElement('span'); cardName.className = 'fq-lever-card-name'; cardName.textContent = dim.label;
      cardHeader.appendChild(cardName);
      if (idx === 0) {
        var leverTag = document.createElement('span'); leverTag.className = 'fq-dim-tag'; leverTag.textContent = sc.hebelTag;
        cardHeader.appendChild(leverTag);
      }
      card.appendChild(cardHeader);
      var diagEl = document.createElement('p'); diagEl.className = 'fq-lever-card-diagnosis'; diagEl.textContent = detail.diagnosis;
      card.appendChild(diagEl);
      var actionsWrap = document.createElement('div'); actionsWrap.className = 'fq-lever-card-actions';
      detail.actions.forEach(function(actionText) {
        var actionEl = document.createElement('div'); actionEl.className = 'fq-lever-card-action'; actionEl.textContent = actionText;
        actionsWrap.appendChild(actionEl);
      });
      card.appendChild(actionsWrap);
      var icpTip = quizData.icpLeverTips[selectedICP] && quizData.icpLeverTips[selectedICP][dim.key];
      if (icpTip) {
        var tipWrap = document.createElement('div'); tipWrap.className = 'fq-lever-protipp';
        var tipLabelEl = document.createElement('div'); tipLabelEl.className = 'fq-lever-protipp-label'; tipLabelEl.textContent = 'Pro-Tipp';
        var tipTextEl = document.createElement('div'); tipTextEl.className = 'fq-lever-protipp-text'; tipTextEl.textContent = icpTip;
        tipWrap.appendChild(tipLabelEl); tipWrap.appendChild(tipTextEl);
        card.appendChild(tipWrap);
      }
      leverWrap.appendChild(card);
    });
    textBlock.appendChild(leverWrap);

    // Next Level section
    var nextLevelData = quizData.icpNextLevel[selectedICP];
    if (nextLevelData) {
      var nlSection = document.createElement('div'); nlSection.className = 'fq-next-level';
      var nlTitle = document.createElement('div'); nlTitle.className = 'fq-next-level-title'; nlTitle.textContent = quizData.ctaCard.nextLevelTitle;
      nlSection.appendChild(nlTitle);
      nextLevelData.forEach(function(item) {
        var nlCard = document.createElement('div'); nlCard.className = 'fq-next-level-card fq-reveal';
        var nlCardTitle = document.createElement('div'); nlCardTitle.className = 'fq-next-level-card-title'; nlCardTitle.textContent = item.title;
        var nlCardText = document.createElement('div'); nlCardText.className = 'fq-next-level-card-text'; nlCardText.textContent = item.text;
        nlCard.appendChild(nlCardTitle); nlCard.appendChild(nlCardText);
        nlSection.appendChild(nlCard);
      });
      textBlock.appendChild(nlSection);
    }
    resultRoot.appendChild(textBlock);

    // CTA Card
    var ctaCardEl = document.createElement('div'); ctaCardEl.className = 'fq-cta-card fq-reveal';
    var ctaBadge = document.createElement('div'); ctaBadge.className = 'fq-cta-card-badge';
    ctaBadge.textContent = quizData.ctaCard.badge;
    ctaCardEl.appendChild(ctaBadge);
    var ctaHeadline = document.createElement('div'); ctaHeadline.className = 'fq-cta-card-headline';
    // CTA headline uses <em> for italic — trusted content from our JSON
    ctaHeadline.innerHTML = quizData.ctaCard.headline; // eslint-disable-line -- trusted quiz JSON content
    ctaCardEl.appendChild(ctaHeadline);
    var ctaSub = document.createElement('div'); ctaSub.className = 'fq-cta-card-sub';
    ctaSub.textContent = sc.ctaP.replace(/\n\n/g, ' ');
    ctaCardEl.appendChild(ctaSub);
    var ctaBtn = document.createElement('button'); ctaBtn.className = 'fq-btn-cta';
    ctaBtn.textContent = sc.ctaBtn;
    ctaBtn.addEventListener('click', function() { window.open(quizData.meta.bookingUrl, '_blank'); });
    ctaCardEl.appendChild(ctaBtn);
    resultRoot.appendChild(ctaCardEl);

    // Share section
    var shareSection = document.createElement('div'); shareSection.className = 'fq-share-section fq-reveal';
    var shareLabelEl = document.createElement('div'); shareLabelEl.className = 'fq-share-label';
    shareLabelEl.textContent = 'Teile dein Ergebnis';
    shareSection.appendChild(shareLabelEl);
    var shareBtns = document.createElement('div'); shareBtns.className = 'fq-share-buttons';

    // LinkedIn share
    var linkedinBtn = document.createElement('a'); linkedinBtn.className = 'fq-share-btn';
    linkedinBtn.href = 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(window.location.href);
    linkedinBtn.target = '_blank'; linkedinBtn.rel = 'noopener';
    var liSvg = document.createElementNS(svgNS, 'svg');
    liSvg.setAttribute('viewBox', '0 0 24 24'); liSvg.setAttribute('fill', 'currentColor');
    var liPath = document.createElementNS(svgNS, 'path');
    liPath.setAttribute('d', 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z');
    liSvg.appendChild(liPath); linkedinBtn.appendChild(liSvg);
    linkedinBtn.appendChild(document.createTextNode('LinkedIn'));
    shareBtns.appendChild(linkedinBtn);

    // WhatsApp share
    var whatsappBtn = document.createElement('a'); whatsappBtn.className = 'fq-share-btn';
    var shareTextStr = quizData.shareText
      .replace('{score}', totalScore)
      .replace('{max}', maxScore)
      .replace('{segment}', segmentLabel)
      .replace('{url}', window.location.href);
    whatsappBtn.href = 'https://wa.me/?text=' + encodeURIComponent(shareTextStr);
    whatsappBtn.target = '_blank'; whatsappBtn.rel = 'noopener';
    var waSvg = document.createElementNS(svgNS, 'svg');
    waSvg.setAttribute('viewBox', '0 0 24 24'); waSvg.setAttribute('fill', 'currentColor');
    var waPath = document.createElementNS(svgNS, 'path');
    waPath.setAttribute('d', 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z');
    waSvg.appendChild(waPath); whatsappBtn.appendChild(waSvg);
    whatsappBtn.appendChild(document.createTextNode('WhatsApp'));
    shareBtns.appendChild(whatsappBtn);

    shareSection.appendChild(shareBtns);
    resultRoot.appendChild(shareSection);

    // WhatsApp debug preview
    var waDebug = document.createElement('div'); waDebug.className = 'fq-reveal';
    waDebug.style.cssText = 'margin-top:32px;padding:20px;border-radius:12px;background:rgba(25,63,59,0.04);border:1px dashed rgba(25,63,59,0.2);font-family:monospace;font-size:12px;color:var(--fq-text-secondary);line-height:1.7;white-space:pre-wrap;word-break:break-word;';
    var waLabelEl = document.createElement('div');
    waLabelEl.style.cssText = 'font-family:var(--fq-font);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--fq-text-tertiary);margin-bottom:10px;';
    waLabelEl.textContent = 'DEBUG: WhatsApp-Nachricht (Vorschau)';
    var waMsg = 'Hallo [Vorname]! \ud83d\udc4b\n\n' + quizData.waDebugIntro + '\n\n';
    waMsg += '\ud83c\udfaf Score: ' + totalScore + '/' + maxScore + ' (' + segmentLabel + ')\n\n';
    waMsg += 'Deine Dimensionen:\n';
    dimPercentages.forEach(function(d) {
      var bar = d.percentage >= 0.6 ? '\u2705' : d.percentage >= 0.35 ? '\u26a0\ufe0f' : '\u274c';
      waMsg += bar + ' ' + d.label + ': ' + d.score + '/' + d.max + '\n';
    });
    waMsg += '\n\ud83d\udd0d Gr\u00f6\u00dfter Hebel: ' + weakest.label + '\n';
    waMsg += '\n\u27a1\ufe0f Deine vollst\u00e4ndige Analyse mit konkreten Empfehlungen findest du hier: [LINK]\n\n';
    waMsg += 'Fragen? Antworte einfach auf diese Nachricht.';
    waDebug.appendChild(waLabelEl);
    waDebug.appendChild(document.createTextNode(waMsg));
    resultRoot.appendChild(waDebug);
    var waBottom = document.createElement('div');
    waBottom.style.cssText = 'padding-bottom:48px;';
    resultRoot.appendChild(waBottom);

    // Animate ring + counter
    setTimeout(function() {
      var ring = document.getElementById('fq-ring-progress');
      if (ring) { ring.style.strokeDashoffset = (circumference * (1 - totalScore / maxScore)).toFixed(2); }
      var counter = document.getElementById('fq-score-counter');
      if (counter) animateCounter(counter, totalScore, 1400);
    }, 120);

    // Animate bars
    var bars = resultRoot.querySelectorAll('.fq-dim-bar-fill');
    bars.forEach(function(bar, i) {
      setTimeout(function() {
        bar.style.transition = 'width 1200ms cubic-bezier(0.22, 1.3, 0.36, 1)';
        bar.style.width = bar.dataset.target + '%';
      }, 400 + i * 150);
    });

    // Scroll-triggered reveals
    var revealEls = resultRoot.querySelectorAll('.fq-reveal, .fq-reveal-scale');
    if ('IntersectionObserver' in window) {
      var revealObs = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            var parent = entry.target.parentElement;
            var siblings = parent.querySelectorAll('.fq-reveal, .fq-reveal-scale');
            var revIdx = Array.prototype.indexOf.call(siblings, entry.target);
            setTimeout(function() {
              entry.target.classList.add('fq-revealed');
            }, Math.min(Math.max(0, revIdx * 120), 600));
            revealObs.unobserve(entry.target);
          }
        });
      }, { threshold: 0.15 });
      revealEls.forEach(function(el) { revealObs.observe(el); });
    } else {
      revealEls.forEach(function(el) { el.classList.add('fq-revealed'); });
    }

    // Persist result in URL for sharing/revisiting
    try {
      var resultData = {
        t: quizData.meta.slug,
        s: results.totalScore,
        m: results.maxScore,
        g: results.segment,
        i: selectedICP,
        w: results.weakest.key,
        w2: results.secondWeakest.key
      };
      var encoded = btoa(JSON.stringify(resultData));
      var newUrl = window.location.pathname + '?type=' + quizData.meta.slug + '&result=' + encoded;
      history.replaceState(null, '', newUrl);
      try { sessionStorage.setItem('fq-own-result', encoded); } catch(e) {}
      // Update share button hrefs to use the result URL
      var shareUrl = window.location.href;
      var liBtn = resultRoot.querySelector('.fq-share-btn[href*="linkedin"]');
      if (liBtn) liBtn.href = 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(shareUrl);
      var waBtn = resultRoot.querySelector('.fq-share-btn[href*="wa.me"]');
      if (waBtn) {
        var updatedShareText = quizData.shareText
          .replace('{score}', results.totalScore)
          .replace('{max}', results.maxScore)
          .replace('{segment}', results.segmentLabel)
          .replace('{url}', shareUrl);
        waBtn.href = 'https://wa.me/?text=' + encodeURIComponent(updatedShareText);
      }
    } catch(e) {}

    // Confetti
    setTimeout(function() { launchConfetti(); playConfettiPop(); }, 600);
    setTimeout(playSuccess, 200);
  }

  // ============================================
  // 3n. WEBHOOK
  // ============================================
  function sendWebhook(formData) {
    if (!quizResults) return;
    var payload = {
      firstName: formData.firstName, lastName: formData.lastName,
      email: formData.email, phone: formData.phone || null,
      icp: selectedICP,
      quiz: {
        totalScore: quizResults.totalScore, maxScore: quizResults.maxScore,
        segment: quizResults.segment, segmentLabel: quizResults.segmentLabel,
        scores: quizResults.scores, weakestDimension: quizResults.weakest.key,
        weakestDimensionLabel: quizResults.weakest.label,
        secondWeakestDimension: quizResults.secondWeakest.key,
        answers: userAnswers
      },
      submittedAt: new Date().toISOString(),
      source: quizData.meta.source,
      utm: UTM_PARAMS
    };
    if (quizData.meta.webhookUrl) {
      fetch(quizData.meta.webhookUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(function(err) { console.error('Webhook Error:', err); });
    }
  }

  // ============================================
  // 3o. SESSION STORAGE
  // ============================================
  function saveProgress() {
    try {
      var data = {
        slug: quizData.meta.slug,
        currentQuestion: currentQuestion,
        selectedICP: selectedICP,
        userAnswers: userAnswers,
        timestamp: Date.now()
      };
      sessionStorage.setItem(quizData.meta.storageKey, JSON.stringify(data));
    } catch(e) {}
  }

  function clearProgress() {
    try { sessionStorage.removeItem(quizData.meta.storageKey); } catch(e) {}
  }

  function loadProgress() {
    try {
      var raw = sessionStorage.getItem(quizData.meta.storageKey);
      if (!raw) return null;
      var data = JSON.parse(raw);
      // Expire after 30 minutes
      if (Date.now() - data.timestamp > 30 * 60 * 1000) { clearProgress(); return null; }
      // Validate slug matches current quiz
      if (data.slug !== quizData.meta.slug) { clearProgress(); return null; }
      return data;
    } catch(e) { return null; }
  }

  // ============================================
  // 3p. GATE FORM & BLURRED PREVIEW
  // ============================================
  function buildPreviewHTML() {
    // Build blurred preview using DOM methods for safety, but the preview
    // is entirely composed of our own score data (no user input), so inline
    // styles via a container are acceptable.
    var container = document.createElement('div');
    container.style.cssText = 'max-width:640px;margin:0 auto;text-align:center;';

    // Score ring SVG
    var ringDiv = document.createElement('div');
    ringDiv.style.cssText = 'display:flex;justify-content:center;margin-bottom:16px;';
    var svgNS = 'http://www.w3.org/2000/svg';
    var pSvg = document.createElementNS(svgNS, 'svg');
    pSvg.setAttribute('width', '200'); pSvg.setAttribute('height', '200'); pSvg.setAttribute('viewBox', '0 0 200 200');
    var pCirc = 2 * Math.PI * 85;
    var pOffset = pCirc * (1 - quizResults.totalScore / quizResults.maxScore);
    var bgCircle = document.createElementNS(svgNS, 'circle');
    bgCircle.setAttribute('cx', '100'); bgCircle.setAttribute('cy', '100'); bgCircle.setAttribute('r', '85');
    bgCircle.setAttribute('fill', 'none'); bgCircle.setAttribute('stroke', 'rgba(25,63,59,0.12)'); bgCircle.setAttribute('stroke-width', '10');
    pSvg.appendChild(bgCircle);
    var fgCircle = document.createElementNS(svgNS, 'circle');
    fgCircle.setAttribute('cx', '100'); fgCircle.setAttribute('cy', '100'); fgCircle.setAttribute('r', '85');
    fgCircle.setAttribute('fill', 'none'); fgCircle.setAttribute('stroke', 'var(--fq-accent)'); fgCircle.setAttribute('stroke-width', '10');
    fgCircle.setAttribute('stroke-dasharray', pCirc.toFixed(2)); fgCircle.setAttribute('stroke-dashoffset', pOffset.toFixed(2));
    fgCircle.setAttribute('transform', 'rotate(-90 100 100)'); fgCircle.setAttribute('stroke-linecap', 'round');
    pSvg.appendChild(fgCircle);
    var pScoreText = document.createElementNS(svgNS, 'text');
    pScoreText.setAttribute('x', '100'); pScoreText.setAttribute('y', '90'); pScoreText.setAttribute('text-anchor', 'middle');
    pScoreText.setAttribute('dominant-baseline', 'middle'); pScoreText.setAttribute('font-family', 'var(--fq-font)');
    pScoreText.setAttribute('font-size', '52'); pScoreText.setAttribute('font-weight', '700'); pScoreText.setAttribute('fill', 'var(--fq-text-primary)');
    pScoreText.textContent = String(quizResults.totalScore);
    pSvg.appendChild(pScoreText);
    var pMaxText = document.createElementNS(svgNS, 'text');
    pMaxText.setAttribute('x', '100'); pMaxText.setAttribute('y', '118'); pMaxText.setAttribute('text-anchor', 'middle');
    pMaxText.setAttribute('dominant-baseline', 'middle'); pMaxText.setAttribute('font-family', 'var(--fq-font)');
    pMaxText.setAttribute('font-size', '18'); pMaxText.setAttribute('fill', 'var(--fq-text-tertiary)');
    pMaxText.textContent = '/' + quizResults.maxScore + ' Punkte';
    pSvg.appendChild(pMaxText);
    ringDiv.appendChild(pSvg);
    container.appendChild(ringDiv);

    // Segment badge
    var badgeDiv = document.createElement('div');
    badgeDiv.style.cssText = 'display:flex;justify-content:center;margin-bottom:28px;';
    var pBadge = document.createElement('span');
    pBadge.className = 'fq-badge';
    pBadge.style.cssText = 'font-size:14px;padding:8px 20px;';
    pBadge.textContent = quizResults.segmentLabel;
    badgeDiv.appendChild(pBadge);
    container.appendChild(badgeDiv);

    // Dimension bars
    var dimsDiv = document.createElement('div');
    dimsDiv.style.cssText = 'max-width:520px;margin:0 auto;';
    quizData.dimOrder.forEach(function(key) {
      var dim = null;
      quizResults.dimPercentages.forEach(function(d) { if (d.key === key) dim = d; });
      if (!dim) return;
      var rowDiv = document.createElement('div');
      rowDiv.style.marginBottom = '20px';
      var headerDiv = document.createElement('div');
      headerDiv.style.cssText = 'display:flex;justify-content:space-between;margin-bottom:6px;';
      var labelSpan = document.createElement('span');
      labelSpan.style.cssText = 'font-size:15px;font-weight:500;color:var(--fq-text-primary);';
      labelSpan.textContent = dim.label;
      var scoreSpan = document.createElement('span');
      scoreSpan.style.cssText = 'font-size:15px;font-weight:600;color:var(--fq-accent);';
      scoreSpan.textContent = dim.score + '/' + dim.max;
      headerDiv.appendChild(labelSpan); headerDiv.appendChild(scoreSpan);
      rowDiv.appendChild(headerDiv);
      var barOuter = document.createElement('div');
      barOuter.style.cssText = 'width:100%;height:8px;background:rgba(25,63,59,0.1);border-radius:4px;overflow:hidden;';
      var barInner = document.createElement('div');
      barInner.style.cssText = 'height:100%;width:' + (dim.percentage * 100).toFixed(1) + '%;background:linear-gradient(90deg,#193F3B,#1CB99E);border-radius:4px;';
      barOuter.appendChild(barInner);
      rowDiv.appendChild(barOuter);
      dimsDiv.appendChild(rowDiv);
    });
    container.appendChild(dimsDiv);

    // Fake text blocks
    var fakeDiv = document.createElement('div');
    fakeDiv.style.cssText = 'max-width:520px;margin:24px auto 0;';
    var fakeLines = [
      { h: '24px', bg: 'rgba(25,63,59,0.08)', r: '6px', mb: '12px', w: '75%' },
      { h: '16px', bg: 'rgba(25,63,59,0.05)', r: '4px', mb: '8px', w: '100%' },
      { h: '16px', bg: 'rgba(25,63,59,0.05)', r: '4px', mb: '8px', w: '90%' },
      { h: '16px', bg: 'rgba(25,63,59,0.05)', r: '4px', mb: '0', w: '60%' }
    ];
    fakeLines.forEach(function(fl) {
      var line = document.createElement('div');
      line.style.cssText = 'height:' + fl.h + ';background:' + fl.bg + ';border-radius:' + fl.r + ';margin-bottom:' + fl.mb + ';width:' + fl.w + ';';
      fakeDiv.appendChild(line);
    });
    container.appendChild(fakeDiv);

    return container;
  }

  function showGateWithPreview() {
    var gateScreen = document.querySelector('.fq-screen--gate');
    var existingPreview = gateScreen.querySelector('.fq-gate-preview');
    if (existingPreview) existingPreview.remove();
    var preview = document.createElement('div');
    preview.className = 'fq-gate-preview';
    preview.appendChild(buildPreviewHTML());
    gateScreen.insertBefore(preview, gateScreen.firstChild);

    // Add peek text
    if (!gateScreen.querySelector('.fq-gate-peek')) {
      var peek = document.createElement('div');
      peek.className = 'fq-gate-peek';
      // Trusted SVG + text from our own quiz JSON
      var peekIconStr = quizData.gate.peekIcon || '';
      peek.innerHTML = peekIconStr + quizData.gate.peekText;
      var gateInner = gateScreen.querySelector('.fq-gate-inner');
      var statusBadge = gateInner.querySelector('.fq-gate-status');
      if (statusBadge && statusBadge.nextSibling) {
        gateInner.insertBefore(peek, statusBadge.nextSibling);
      } else {
        gateInner.insertBefore(peek, gateInner.firstChild);
      }
    }
    showScreen('gate');
  }

  // ============================================
  // 3p-2. THANK-YOU SCREEN (sales mode)
  // ============================================
  function renderThankyou() {
    var ty = quizData.thankyou || {};
    var inner = document.getElementById('fq-thankyou-inner');
    if (!inner) return;
    while (inner.firstChild) inner.removeChild(inner.firstChild);

    // Check icon
    var iconWrap = document.createElement('div');
    iconWrap.className = 'fq-thankyou-icon fq-stagger-item';
    iconWrap.innerHTML = '<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><path d="M4 16L12 24L28 8" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    inner.appendChild(iconWrap);

    // Headline
    var h2 = document.createElement('h2');
    h2.className = 'fq-thankyou-h2 fq-stagger-item';
    h2.textContent = ty.headline;
    inner.appendChild(h2);

    // Blurred results preview card — shows segment + dim bars with blurred scores
    if (quizResults) {
      var previewCard = document.createElement('div');
      previewCard.className = 'fq-ty-preview fq-stagger-item';

      var previewHdr = document.createElement('div');
      previewHdr.className = 'fq-ty-preview-header';
      previewHdr.textContent = 'Vorschau deiner Analyse';
      previewCard.appendChild(previewHdr);

      // Segment row — label revealed to create curiosity
      var segRow = document.createElement('div');
      segRow.className = 'fq-ty-segment-row';
      var segKey = document.createElement('span');
      segKey.className = 'fq-ty-seg-key';
      segKey.textContent = 'Ergebnis:';
      var segVal = document.createElement('span');
      segVal.className = 'fq-ty-seg-val';
      segVal.textContent = quizResults.segmentLabel;
      segRow.appendChild(segKey);
      segRow.appendChild(segVal);
      previewCard.appendChild(segRow);

      // Dimension bars — labels visible, scores blurred
      var dimsWrap = document.createElement('div');
      dimsWrap.className = 'fq-ty-dims';
      var dimMap = {};
      (quizResults.dimPercentages || []).forEach(function(d) { dimMap[d.key] = d; });
      (quizData.dimOrder || []).forEach(function(key) {
        var dim = dimMap[key];
        if (!dim) return;
        var row = document.createElement('div');
        row.className = 'fq-ty-dim-row';
        var lbl = document.createElement('span');
        lbl.className = 'fq-ty-dim-label';
        lbl.textContent = dim.label;
        row.appendChild(lbl);
        var barWrap = document.createElement('div');
        barWrap.className = 'fq-ty-dim-bar-wrap';
        var barFill = document.createElement('div');
        barFill.className = 'fq-ty-dim-bar-fill';
        barFill.style.width = Math.round(dim.percentage * 100) + '%';
        barWrap.appendChild(barFill);
        row.appendChild(barWrap);
        var pct = document.createElement('span');
        pct.className = 'fq-ty-dim-pct fq-ty-blurred';
        pct.textContent = Math.round(dim.percentage * 100) + '%';
        row.appendChild(pct);
        dimsWrap.appendChild(row);
      });
      previewCard.appendChild(dimsWrap);

      // Locked footer
      var previewFtr = document.createElement('div');
      previewFtr.className = 'fq-ty-preview-footer';
      previewFtr.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align:-2px;margin-right:5px;"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>Vollst\u00e4ndige Auswertung im Gespr\u00e4ch';
      previewCard.appendChild(previewFtr);

      inner.appendChild(previewCard);
    }

    // Subtitle
    var sub = document.createElement('p');
    sub.className = 'fq-thankyou-sub fq-stagger-item';
    sub.textContent = ty.subtitle;
    inner.appendChild(sub);

    // CTA button
    if (quizData.meta.bookingUrl && ty.ctaText) {
      var ctaBtn = document.createElement('a');
      ctaBtn.className = 'fq-btn-cta fq-stagger-item';
      ctaBtn.href = quizData.meta.bookingUrl;
      ctaBtn.target = '_blank';
      ctaBtn.rel = 'noopener';
      ctaBtn.textContent = ty.ctaText;
      inner.appendChild(ctaBtn);
    }

    // Fine print
    if (ty.finePrint) {
      var fine = document.createElement('p');
      fine.className = 'fq-fine-print fq-stagger-item';
      fine.textContent = ty.finePrint;
      inner.appendChild(fine);
    }

    var staggerItems = inner.querySelectorAll('.fq-stagger-item');
    staggerItems.forEach(function(el, i) {
      setTimeout(function() { el.classList.add('fq-entered'); }, 120 * i + 350);
    });
  }

  // ============================================
  // 3q. BOOT — build DOM, populate, wire events
  // ============================================
  buildHTML();
  populateText();
  buildQuestions();

  // If a ?result= param was decoded, skip straight to the result screen
  if (pendingResult) {
    selectedICP = pendingResult.i || null;
    buildQuestions(); // needed so leverDetails lookup works
    renderSharedResult(pendingResult);
    showScreen('result');
    return; // skip normal quiz flow (event wiring etc. not needed)
  }

  // Start button
  document.getElementById('fq-start-btn').addEventListener('click', function() {
    showScreen('quiz');
    setTimeout(function() { renderQuestion(0, 'init'); }, 160);
  });

  // Next button
  document.getElementById('fq-next-btn').addEventListener('click', function() {
    if (!hasAnswer(currentQuestion)) return;
    if (currentQuestion < TOTAL_QUESTIONS - 1) {
      var nextQ = currentQuestion + 1;
      if (nextQ === GENERAL_END_INDEX && selectedICP) {
        showMilestone(function() {
          currentQuestion = nextQ;
          renderQuestion(currentQuestion, 'forward');
          saveProgress();
        });
      } else if (nextQ === PART2_END_INDEX) {
        showMilestone2(function() {
          currentQuestion = nextQ;
          renderQuestion(currentQuestion, 'forward');
          saveProgress();
        });
      } else {
        currentQuestion = nextQ;
        renderQuestion(currentQuestion, 'forward');
        saveProgress();
      }
    } else {
      quizResults = calculateResults(userAnswers);
      showGateWithPreview();
    }
  });

  // Back button
  document.getElementById('fq-back-btn').addEventListener('click', function() {
    if (currentQuestion > 0) { currentQuestion--; renderQuestion(currentQuestion, 'backward'); saveProgress(); }
  });

  // Gate form submit
  document.getElementById('fq-gate-form').addEventListener('submit', function(e) {
    e.preventDefault();
    var nameEl = document.getElementById('fq-input-name');
    var lastnameEl = document.getElementById('fq-input-lastname');
    var emailEl = document.getElementById('fq-input-email');
    var phoneEl = document.getElementById('fq-input-phone');
    var nameErr = document.getElementById('fq-error-name');
    var lastnameErr = document.getElementById('fq-error-lastname');
    var emailErr = document.getElementById('fq-error-email');
    var valid = true;
    nameEl.classList.remove('fq-error'); lastnameEl.classList.remove('fq-error'); emailEl.classList.remove('fq-error');
    nameErr.classList.remove('fq-visible'); lastnameErr.classList.remove('fq-visible'); emailErr.classList.remove('fq-visible');
    if (!nameEl.value.trim()) { nameEl.classList.add('fq-error'); nameErr.classList.add('fq-visible'); valid = false; }
    if (!lastnameEl.value.trim()) { lastnameEl.classList.add('fq-error'); lastnameErr.classList.add('fq-visible'); valid = false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailEl.value.trim())) { emailEl.classList.add('fq-error'); emailErr.classList.add('fq-visible'); valid = false; }
    if (!valid) return;
    var submitBtnEl = document.getElementById('fq-submit-btn');
    submitBtnEl.textContent = quizData.gate.submitLoadingText; submitBtnEl.disabled = true;
    sendWebhook({ firstName: nameEl.value.trim(), lastName: lastnameEl.value.trim(), email: emailEl.value.trim(), phone: phoneEl.value.trim() });
    var previewEl = document.querySelector('.fq-gate-preview');
    if (previewEl) previewEl.remove();
    if (quizData.meta.mode === 'sales') {
      renderThankyou();
      showScreen('thankyou');
    } else {
      renderResult(quizResults);
      showScreen('result');
    }
    clearProgress();
  });

  // ============================================
  // 3r. RESUME / LANDING STAGGER
  // ============================================
  (function() {
    var saved = loadProgress();
    if (saved && saved.currentQuestion > 0 && saved.selectedICP) {
      var overlay = document.getElementById('fq-resume-overlay');
      overlay.classList.add('fq-visible');

      document.getElementById('fq-resume-continue').addEventListener('click', function() {
        selectedICP = saved.selectedICP;
        buildQuestions();
        userAnswers = saved.userAnswers;
        currentQuestion = saved.currentQuestion;
        overlay.classList.remove('fq-visible');
        showScreen('quiz');
        setTimeout(function() { renderQuestion(currentQuestion, 'init'); }, 160);
      });

      document.getElementById('fq-resume-restart').addEventListener('click', function() {
        clearProgress();
        overlay.classList.remove('fq-visible');
        var items = document.querySelectorAll('.fq-screen--landing .fq-stagger-item');
        items.forEach(function(el, i) {
          setTimeout(function() { el.classList.add('fq-entered'); }, 150 * i);
        });
      });
    } else {
      var items = document.querySelectorAll('.fq-screen--landing .fq-stagger-item');
      items.forEach(function(el, i) {
        setTimeout(function() { el.classList.add('fq-entered'); }, 150 * i);
      });
    }
  })();

  // ============================================
  // 3s. MAGNETIC CTA BUTTONS
  // ============================================
  (function() {
    if ('ontouchstart' in window) return;
    var selectors = '.fq-btn-primary, .fq-btn-next, .fq-btn-submit, .fq-btn-cta';
    var maxDist = 60;
    var maxShift = 4;

    document.getElementById('quiz-root').addEventListener('mousemove', function(e) {
      var btns = document.querySelectorAll(selectors);
      btns.forEach(function(btn) {
        if (btn.disabled || btn.dataset.magneticPaused) return;
        var rect = btn.getBoundingClientRect();
        var cx = rect.left + rect.width / 2;
        var cy = rect.top + rect.height / 2;
        var dx = e.clientX - cx;
        var dy = e.clientY - cy;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < maxDist) {
          var strength = (1 - dist / maxDist);
          var tx = dx * strength * (maxShift / maxDist);
          var ty = dy * strength * (maxShift / maxDist);
          btn.style.transform = 'translate(' + tx.toFixed(1) + 'px, ' + ty.toFixed(1) + 'px)';
        } else {
          if (btn.style.transform.indexOf('translate') !== -1) {
            btn.style.transform = '';
          }
        }
      });
    });

    document.getElementById('quiz-root').addEventListener('mousedown', function(e) {
      var btn = e.target.closest(selectors);
      if (btn && !btn.disabled) {
        btn.style.transform = '';
        btn.dataset.magneticPaused = '1';
      }
    });
    document.getElementById('quiz-root').addEventListener('mouseup', function(e) {
      var btn = e.target.closest(selectors);
      if (btn) { delete btn.dataset.magneticPaused; }
    });

    document.getElementById('quiz-root').addEventListener('mouseleave', function() {
      var btns = document.querySelectorAll(selectors);
      btns.forEach(function(btn) { btn.style.transform = ''; delete btn.dataset.magneticPaused; });
    });
  })();

  // ============================================
  // 3t. IFRAME HEIGHT REPORTING
  // ============================================
  function reportHeight() {
    var height = document.getElementById('quiz-root').offsetHeight;
    window.parent.postMessage({ type: 'quiz-resize', height: height }, '*');
  }
  if (typeof ResizeObserver !== 'undefined') {
    var ro = new ResizeObserver(function() { reportHeight(); });
    ro.observe(document.getElementById('quiz-root'));
  }

  // ============================================
  // 3u. SHARED RESULT RENDERING (from ?result= URL)
  // ============================================
  function renderSharedResult(data) {
    var totalScore = data.s;
    var maxScore = data.m;
    var segment = data.g;
    var weakestKey = data.w;
    var secondWeakestKey = data.w2;

    var segData = quizData.segments[segment] || {};
    var segmentLabel = segData.label || segment;
    var sc = quizData.resultContent[segment];
    if (!sc) return; // cannot render without content data

    var circumference = 2 * Math.PI * 70;
    var svgNS = 'http://www.w3.org/2000/svg';
    var resultRoot = document.getElementById('fq-result-inner');
    while (resultRoot.firstChild) resultRoot.removeChild(resultRoot.firstChild);

    // "Take the quiz yourself" banner — only show if it's not the user's own result
    var resultScreen = document.querySelector('#quiz-root .fq-screen--result');
    var existingBanner = resultScreen.querySelector('.fq-shared-banner');
    if (existingBanner) existingBanner.remove();
    var isOwnResult = false;
    try { isOwnResult = sessionStorage.getItem('fq-own-result') === btoa(JSON.stringify(data)); } catch(e) {}
    if (!isOwnResult) {
      var takeBanner = document.createElement('a');
      takeBanner.className = 'fq-shared-banner';
      takeBanner.href = window.location.pathname + '?type=' + quizData.meta.slug;
      takeBanner.style.cssText = 'display:block;text-align:center;padding:14px 20px;margin:0 0 24px;background:var(--fq-accent);color:#fff;font-size:14px;font-weight:500;text-decoration:none;font-family:var(--fq-font);letter-spacing:0.01em;border-radius:10px;';
      takeBanner.textContent = 'Du siehst ein geteiltes Ergebnis. Mach das Quiz selbst \u2192';
      resultScreen.insertBefore(takeBanner, resultRoot);
    }

    // Ring
    var ringWrap = document.createElement('div'); ringWrap.className = 'fq-ring-wrap';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'fq-ring-svg'); svg.setAttribute('viewBox', '0 0 160 160');
    var trackCircle = document.createElementNS(svgNS, 'circle');
    trackCircle.setAttribute('cx', '80'); trackCircle.setAttribute('cy', '80'); trackCircle.setAttribute('r', '70');
    trackCircle.setAttribute('fill', 'none'); trackCircle.setAttribute('stroke', 'var(--fq-border-subtle)'); trackCircle.setAttribute('stroke-width', '8');
    var progCircle = document.createElementNS(svgNS, 'circle');
    progCircle.setAttribute('id', 'fq-ring-progress'); progCircle.setAttribute('cx', '80'); progCircle.setAttribute('cy', '80'); progCircle.setAttribute('r', '70');
    progCircle.setAttribute('fill', 'none'); progCircle.setAttribute('stroke', 'var(--fq-accent)'); progCircle.setAttribute('stroke-width', '8');
    progCircle.setAttribute('stroke-linecap', 'round');
    progCircle.setAttribute('stroke-dasharray', circumference.toFixed(2));
    progCircle.setAttribute('stroke-dashoffset', circumference.toFixed(2));
    progCircle.setAttribute('transform', 'rotate(-90 80 80)');
    progCircle.style.transition = 'stroke-dashoffset 1200ms ease-out';
    var scoreTextEl = document.createElementNS(svgNS, 'text');
    scoreTextEl.setAttribute('id', 'fq-score-counter');
    scoreTextEl.setAttribute('x', '80'); scoreTextEl.setAttribute('y', '76'); scoreTextEl.setAttribute('text-anchor', 'middle');
    scoreTextEl.setAttribute('dominant-baseline', 'middle'); scoreTextEl.setAttribute('font-family', 'var(--fq-font)');
    scoreTextEl.setAttribute('font-size', '40'); scoreTextEl.setAttribute('font-weight', '700'); scoreTextEl.setAttribute('fill', 'var(--fq-text-primary)');
    scoreTextEl.textContent = '0';
    var maxTextEl = document.createElementNS(svgNS, 'text');
    maxTextEl.setAttribute('x', '80'); maxTextEl.setAttribute('y', '100'); maxTextEl.setAttribute('text-anchor', 'middle');
    maxTextEl.setAttribute('dominant-baseline', 'middle'); maxTextEl.setAttribute('font-family', 'var(--fq-font)');
    maxTextEl.setAttribute('font-size', '16'); maxTextEl.setAttribute('fill', 'var(--fq-text-tertiary)');
    maxTextEl.textContent = '/' + maxScore;
    svg.appendChild(trackCircle); svg.appendChild(progCircle); svg.appendChild(scoreTextEl); svg.appendChild(maxTextEl);
    ringWrap.appendChild(svg); ringWrap.classList.add('fq-reveal-scale'); resultRoot.appendChild(ringWrap);

    // Segment badge
    var badgeWrap = document.createElement('div'); badgeWrap.className = 'fq-segment-badge fq-reveal-scale';
    var badge = document.createElement('span'); badge.className = 'fq-badge'; badge.textContent = segmentLabel;
    badgeWrap.appendChild(badge); resultRoot.appendChild(badgeWrap);

    // NOTE: No dimension bars in shared view (no per-dimension data in URL)
    // NOTE: No benchmark bar in shared view (not meaningful without real score distribution)

    // Diagnosis card
    var textBlock = document.createElement('div'); textBlock.className = 'fq-result-text-block';
    var diagCard = document.createElement('div'); diagCard.className = 'fq-result-diagnosis-card fq-reveal';
    var h2El = document.createElement('h2'); h2El.className = 'fq-result-h2'; h2El.textContent = sc.headline;
    var p1El = document.createElement('p'); p1El.className = 'fq-result-p'; p1El.textContent = sc.p1;
    var p2El = document.createElement('p'); p2El.className = 'fq-result-p'; p2El.textContent = sc.p2;
    diagCard.appendChild(h2El); diagCard.appendChild(p1El); diagCard.appendChild(p2El);
    var icpStatText = quizData.icpStats[segment] && quizData.icpStats[segment][selectedICP];
    if (icpStatText) {
      var statWrap = document.createElement('div'); statWrap.className = 'fq-result-icp-stat';
      var statIcon = document.createElement('div'); statIcon.className = 'fq-result-icp-stat-icon';
      var starSvg = document.createElementNS(svgNS, 'svg');
      starSvg.setAttribute('width', '20'); starSvg.setAttribute('height', '20'); starSvg.setAttribute('viewBox', '0 0 20 20'); starSvg.setAttribute('fill', 'none');
      var starPath = document.createElementNS(svgNS, 'path');
      starPath.setAttribute('d', 'M10 2L12.5 7.5L18 8.5L14 12.5L15 18L10 15.5L5 18L6 12.5L2 8.5L7.5 7.5L10 2Z');
      starPath.setAttribute('stroke', 'currentColor'); starPath.setAttribute('stroke-width', '1.3'); starPath.setAttribute('stroke-linejoin', 'round');
      starSvg.appendChild(starPath); statIcon.appendChild(starSvg);
      var statTextEl = document.createElement('div'); statTextEl.className = 'fq-result-icp-stat-text'; statTextEl.textContent = icpStatText;
      statWrap.appendChild(statIcon); statWrap.appendChild(statTextEl);
      diagCard.appendChild(statWrap);
    }
    textBlock.appendChild(diagCard);

    // Lever cards (weakest + secondWeakest)
    var leverWrap = document.createElement('div'); leverWrap.style.marginTop = '24px';
    var leverTitle = document.createElement('div'); leverTitle.className = 'fq-lever-title'; leverTitle.style.marginBottom = '16px'; leverTitle.textContent = sc.leverTitle;
    leverWrap.appendChild(leverTitle);
    var leverKeys = [weakestKey, secondWeakestKey];
    leverKeys.forEach(function(key, idx) {
      var detail = quizData.leverDetails[key];
      if (!detail) return;
      var dimLabel = quizData.dimensions[key] || key;
      var card = document.createElement('div'); card.className = 'fq-lever-card fq-reveal';
      var cardHeader = document.createElement('div'); cardHeader.className = 'fq-lever-card-header';
      var cardName = document.createElement('span'); cardName.className = 'fq-lever-card-name'; cardName.textContent = dimLabel;
      cardHeader.appendChild(cardName);
      if (idx === 0) {
        var leverTag = document.createElement('span'); leverTag.className = 'fq-dim-tag'; leverTag.textContent = sc.hebelTag;
        cardHeader.appendChild(leverTag);
      }
      card.appendChild(cardHeader);
      var diagEl = document.createElement('p'); diagEl.className = 'fq-lever-card-diagnosis'; diagEl.textContent = detail.diagnosis;
      card.appendChild(diagEl);
      var actionsWrap = document.createElement('div'); actionsWrap.className = 'fq-lever-card-actions';
      detail.actions.forEach(function(actionText) {
        var actionEl = document.createElement('div'); actionEl.className = 'fq-lever-card-action'; actionEl.textContent = actionText;
        actionsWrap.appendChild(actionEl);
      });
      card.appendChild(actionsWrap);
      var icpTip = quizData.icpLeverTips[selectedICP] && quizData.icpLeverTips[selectedICP][key];
      if (icpTip) {
        var tipWrap = document.createElement('div'); tipWrap.className = 'fq-lever-protipp';
        var tipLabelEl = document.createElement('div'); tipLabelEl.className = 'fq-lever-protipp-label'; tipLabelEl.textContent = 'Pro-Tipp';
        var tipTextEl = document.createElement('div'); tipTextEl.className = 'fq-lever-protipp-text'; tipTextEl.textContent = icpTip;
        tipWrap.appendChild(tipLabelEl); tipWrap.appendChild(tipTextEl);
        card.appendChild(tipWrap);
      }
      leverWrap.appendChild(card);
    });
    textBlock.appendChild(leverWrap);

    // Next Level section
    var nextLevelData = quizData.icpNextLevel[selectedICP];
    if (nextLevelData) {
      var nlSection = document.createElement('div'); nlSection.className = 'fq-next-level';
      var nlTitle = document.createElement('div'); nlTitle.className = 'fq-next-level-title'; nlTitle.textContent = quizData.ctaCard.nextLevelTitle;
      nlSection.appendChild(nlTitle);
      nextLevelData.forEach(function(item) {
        var nlCard = document.createElement('div'); nlCard.className = 'fq-next-level-card fq-reveal';
        var nlCardTitle = document.createElement('div'); nlCardTitle.className = 'fq-next-level-card-title'; nlCardTitle.textContent = item.title;
        var nlCardText = document.createElement('div'); nlCardText.className = 'fq-next-level-card-text'; nlCardText.textContent = item.text;
        nlCard.appendChild(nlCardTitle); nlCard.appendChild(nlCardText);
        nlSection.appendChild(nlCard);
      });
      textBlock.appendChild(nlSection);
    }
    resultRoot.appendChild(textBlock);

    // CTA Card
    var ctaCardEl = document.createElement('div'); ctaCardEl.className = 'fq-cta-card fq-reveal';
    var ctaBadge = document.createElement('div'); ctaBadge.className = 'fq-cta-card-badge';
    ctaBadge.textContent = quizData.ctaCard.badge;
    ctaCardEl.appendChild(ctaBadge);
    var ctaHeadline = document.createElement('div'); ctaHeadline.className = 'fq-cta-card-headline';
    ctaHeadline.innerHTML = quizData.ctaCard.headline; // eslint-disable-line -- trusted quiz JSON content
    ctaCardEl.appendChild(ctaHeadline);
    var ctaSub = document.createElement('div'); ctaSub.className = 'fq-cta-card-sub';
    ctaSub.textContent = sc.ctaP.replace(/\n\n/g, ' ');
    ctaCardEl.appendChild(ctaSub);
    var ctaBtn = document.createElement('button'); ctaBtn.className = 'fq-btn-cta';
    ctaBtn.textContent = sc.ctaBtn;
    ctaBtn.addEventListener('click', function() { window.open(quizData.meta.bookingUrl, '_blank'); });
    ctaCardEl.appendChild(ctaBtn);
    resultRoot.appendChild(ctaCardEl);

    // Share section
    var shareSection = document.createElement('div'); shareSection.className = 'fq-share-section fq-reveal';
    var shareLabelEl = document.createElement('div'); shareLabelEl.className = 'fq-share-label';
    shareLabelEl.textContent = 'Teile dieses Ergebnis';
    shareSection.appendChild(shareLabelEl);
    var shareBtns = document.createElement('div'); shareBtns.className = 'fq-share-buttons';
    var shareUrl = window.location.href;

    var linkedinBtn = document.createElement('a'); linkedinBtn.className = 'fq-share-btn';
    linkedinBtn.href = 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(shareUrl);
    linkedinBtn.target = '_blank'; linkedinBtn.rel = 'noopener';
    var liSvg = document.createElementNS(svgNS, 'svg');
    liSvg.setAttribute('viewBox', '0 0 24 24'); liSvg.setAttribute('fill', 'currentColor');
    var liPath = document.createElementNS(svgNS, 'path');
    liPath.setAttribute('d', 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z');
    liSvg.appendChild(liPath); linkedinBtn.appendChild(liSvg);
    linkedinBtn.appendChild(document.createTextNode('LinkedIn'));
    shareBtns.appendChild(linkedinBtn);

    var whatsappBtn = document.createElement('a'); whatsappBtn.className = 'fq-share-btn';
    var shareTextStr = quizData.shareText
      .replace('{score}', totalScore)
      .replace('{max}', maxScore)
      .replace('{segment}', segmentLabel)
      .replace('{url}', shareUrl);
    whatsappBtn.href = 'https://wa.me/?text=' + encodeURIComponent(shareTextStr);
    whatsappBtn.target = '_blank'; whatsappBtn.rel = 'noopener';
    var waSvg = document.createElementNS(svgNS, 'svg');
    waSvg.setAttribute('viewBox', '0 0 24 24'); waSvg.setAttribute('fill', 'currentColor');
    var waPath = document.createElementNS(svgNS, 'path');
    waPath.setAttribute('d', 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z');
    waSvg.appendChild(waPath); whatsappBtn.appendChild(waSvg);
    whatsappBtn.appendChild(document.createTextNode('WhatsApp'));
    shareBtns.appendChild(whatsappBtn);

    shareSection.appendChild(shareBtns);
    resultRoot.appendChild(shareSection);

    // WhatsApp debug preview (useful for testing shared view)
    var waDebug = document.createElement('div'); waDebug.className = 'fq-reveal';
    waDebug.style.cssText = 'margin-top:32px;padding:20px;border-radius:12px;background:rgba(25,63,59,0.04);border:1px dashed rgba(25,63,59,0.2);font-family:monospace;font-size:12px;color:var(--fq-text-secondary);line-height:1.7;white-space:pre-wrap;word-break:break-word;';
    var waLabelEl = document.createElement('div');
    waLabelEl.style.cssText = 'font-family:var(--fq-font);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--fq-text-tertiary);margin-bottom:10px;';
    waLabelEl.textContent = 'DEBUG: WhatsApp-Nachricht (Vorschau)';
    var waMsg = 'Hallo [Vorname]! \ud83d\udc4b\n\n' + quizData.waDebugIntro + '\n\n';
    waMsg += '\ud83c\udfaf Score: ' + totalScore + '/' + maxScore + ' (' + segmentLabel + ')\n\n';
    waMsg += '\ud83d\udd0d Gr\u00f6\u00dfter Hebel: ' + (quizData.dimensions[weakestKey] || weakestKey) + '\n';
    waMsg += '\n\u27a1\ufe0f Deine vollst\u00e4ndige Analyse: ' + shareUrl + '\n\n';
    waMsg += 'Fragen? Antworte einfach auf diese Nachricht.';
    waDebug.appendChild(waLabelEl);
    waDebug.appendChild(document.createTextNode(waMsg));
    resultRoot.appendChild(waDebug);
    var waBottom = document.createElement('div');
    waBottom.style.cssText = 'padding-bottom:48px;';
    resultRoot.appendChild(waBottom);

    // Animate ring + counter
    setTimeout(function() {
      var ring = document.getElementById('fq-ring-progress');
      if (ring) { ring.style.strokeDashoffset = (circumference * (1 - totalScore / maxScore)).toFixed(2); }
      var counter = document.getElementById('fq-score-counter');
      if (counter) animateCounter(counter, totalScore, 1400);
    }, 120);

    // Scroll-triggered reveals
    var revealEls = resultRoot.querySelectorAll('.fq-reveal, .fq-reveal-scale');
    if ('IntersectionObserver' in window) {
      var revealObs = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            var parent = entry.target.parentElement;
            var siblings = parent.querySelectorAll('.fq-reveal, .fq-reveal-scale');
            var revIdx = Array.prototype.indexOf.call(siblings, entry.target);
            setTimeout(function() {
              entry.target.classList.add('fq-revealed');
            }, Math.min(Math.max(0, revIdx * 120), 600));
            revealObs.unobserve(entry.target);
          }
        });
      }, { threshold: 0.15 });
      revealEls.forEach(function(el) { revealObs.observe(el); });
    } else {
      revealEls.forEach(function(el) { el.classList.add('fq-revealed'); });
    }
  }

} // end initQuiz

})(); // end IIFE
