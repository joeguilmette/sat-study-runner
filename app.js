const STORAGE_KEY = "sat-study-runner-settings-v1";

const state = {
  bank: null,
  categoryMap: new Map(),
  questionMap: new Map(),
  settings: {
    mode: "practice",
    shuffle: true,
    questionCount: "all",
    categoryIds: [],
    includeSynthetic: false,
  },
  session: null,
};

const elements = {
  bankSummary: document.querySelector("#bank-summary"),
  loadingView: document.querySelector("#loading-view"),
  errorView: document.querySelector("#error-view"),
  errorMessage: document.querySelector("#error-message"),
  setupView: document.querySelector("#setup-view"),
  categoryList: document.querySelector("#category-list"),
  questionCount: document.querySelector("#question-count"),
  shuffleToggle: document.querySelector("#shuffle-toggle"),
  includeSyntheticToggle: document.querySelector("#include-synthetic-toggle"),
  availableCount: document.querySelector("#available-count"),
  sessionSize: document.querySelector("#session-size"),
  selectedCategoriesCount: document.querySelector("#selected-categories-count"),
  selectionHint: document.querySelector("#selection-hint"),
  startSession: document.querySelector("#start-session"),
  selectAllCategories: document.querySelector("#select-all-categories"),
  selectStudyFirst: document.querySelector("#select-study-first"),
  clearCategories: document.querySelector("#clear-categories"),
  quizView: document.querySelector("#quiz-view"),
  progressLabel: document.querySelector("#progress-label"),
  questionTitle: document.querySelector("#question-title"),
  modeBadge: document.querySelector("#mode-badge"),
  originBadge: document.querySelector("#origin-badge"),
  scoreLabel: document.querySelector("#score-label"),
  progressFill: document.querySelector("#progress-fill"),
  questionMeta: document.querySelector("#question-meta"),
  questionText: document.querySelector("#question-text"),
  choices: document.querySelector("#choices"),
  feedbackCard: document.querySelector("#feedback-card"),
  primaryAction: document.querySelector("#primary-action"),
  quitSession: document.querySelector("#quit-session"),
  resultsView: document.querySelector("#results-view"),
  resultsSummary: document.querySelector("#results-summary"),
  resultsCards: document.querySelector("#results-cards"),
  categoryBreakdown: document.querySelector("#category-breakdown"),
  reviewList: document.querySelector("#review-list"),
  retryMissed: document.querySelector("#retry-missed"),
  retrySameSet: document.querySelector("#retry-same-set"),
  returnToSetup: document.querySelector("#return-to-setup"),
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindSetupEvents();
  loadSettings();

  try {
    const response = await fetch("./sat-results.enriched.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    state.bank = await response.json();
    state.categoryMap = new Map(
      state.bank.study_analysis.study_categories.map((category) => [category.id, category]),
    );
    state.questionMap = new Map(state.bank.questions.map((question) => [question.id, question]));

    reconcileSettings();
    renderBankSummary();
    renderSetup();
    showView("setup");
  } catch (error) {
    showError(
      `Make sure the site is being served over HTTP. Original error: ${error.message}`,
    );
  }
}

function bindSetupEvents() {
  document.querySelectorAll('input[name="session-mode"]').forEach((input) => {
    input.addEventListener("change", () => {
      state.settings.mode = input.value;
      persistSettings();
    });
  });

  elements.questionCount.addEventListener("change", () => {
    state.settings.questionCount = elements.questionCount.value;
    persistSettings();
    updateSetupCounts();
  });

  elements.shuffleToggle.addEventListener("change", () => {
    state.settings.shuffle = elements.shuffleToggle.checked;
    persistSettings();
  });

  elements.includeSyntheticToggle.addEventListener("change", () => {
    state.settings.includeSynthetic = elements.includeSyntheticToggle.checked;
    persistSettings();
    updateSetupCounts();
  });

  elements.categoryList.addEventListener("change", (event) => {
    if (!(event.target instanceof HTMLInputElement)) {
      return;
    }

    if (event.target.name !== "category-filter") {
      return;
    }

    if (event.target.checked) {
      if (!state.settings.categoryIds.includes(event.target.value)) {
        state.settings.categoryIds.push(event.target.value);
      }
    } else {
      state.settings.categoryIds = state.settings.categoryIds.filter(
        (id) => id !== event.target.value,
      );
    }

    persistSettings();
    updateSetupCounts();
  });

  elements.selectAllCategories.addEventListener("click", () => {
    state.settings.categoryIds = getAllCategories().map((category) => category.id);
    renderSetup();
  });

  elements.selectStudyFirst.addEventListener("click", () => {
    state.settings.categoryIds = getAllCategories()
      .filter((category) => category.priority_band === "study first")
      .map((category) => category.id);
    renderSetup();
  });

  elements.clearCategories.addEventListener("click", () => {
    state.settings.categoryIds = [];
    renderSetup();
  });

  elements.startSession.addEventListener("click", () => {
    startSessionFromSelection();
  });

  elements.primaryAction.addEventListener("click", () => {
    handlePrimaryAction();
  });

  elements.quitSession.addEventListener("click", () => {
    state.session = null;
    showView("setup");
    renderSetup();
  });

  elements.retrySameSet.addEventListener("click", () => {
    if (!state.session) {
      return;
    }

    startSessionFromIds(state.session.questionIds);
  });

  elements.retryMissed.addEventListener("click", () => {
    if (!state.session) {
      return;
    }

    const missedIds = getSessionReview()
      .filter((item) => !item.isCorrect)
      .map((item) => item.question.id);

    if (missedIds.length) {
      startSessionFromIds(missedIds);
    }
  });

  elements.returnToSetup.addEventListener("click", () => {
    showView("setup");
    renderSetup();
  });
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }

    const parsed = JSON.parse(raw);
    state.settings = {
      ...state.settings,
      ...parsed,
      categoryIds: Array.isArray(parsed.categoryIds) ? parsed.categoryIds : [],
    };
  } catch (_error) {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function persistSettings() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings));
}

function reconcileSettings() {
  const categoryIds = new Set(getAllCategories().map((category) => category.id));
  state.settings.categoryIds = state.settings.categoryIds.filter((id) => categoryIds.has(id));

  if (state.settings.categoryIds.length === 0) {
    state.settings.categoryIds = getAllCategories().map((category) => category.id);
  }

  if (!["practice", "quiz"].includes(state.settings.mode)) {
    state.settings.mode = "practice";
  }

  if (typeof state.settings.shuffle !== "boolean") {
    state.settings.shuffle = true;
  }

  if (typeof state.settings.includeSynthetic !== "boolean") {
    state.settings.includeSynthetic = false;
  }

  persistSettings();
}

function renderBankSummary() {
  const { total, real, synthetic } = getQuestionOriginCounts(state.bank.questions);
  const categories = getAllCategories().length;
  const firstBucket = getAllCategories()[0];
  elements.bankSummary.textContent =
    `Practice Test ${state.bank.practice_test} question bank with ${real} real misses and ${synthetic} synthetic drills ` +
    `(${total} questions total) across ` +
    `${categories} study categories. Highest-priority bucket: ${firstBucket.label}.`;
}

function renderSetup() {
  document.querySelectorAll('input[name="session-mode"]').forEach((input) => {
    input.checked = input.value === state.settings.mode;
  });

  elements.shuffleToggle.checked = state.settings.shuffle;
  elements.includeSyntheticToggle.checked = state.settings.includeSynthetic;
  renderCategoryList();
  renderQuestionCountOptions();
  updateSetupCounts();
  persistSettings();
}

function renderCategoryList() {
  elements.categoryList.replaceChildren();

  const fragment = document.createDocumentFragment();

  getAllCategories().forEach((category) => {
    const article = document.createElement("article");
    article.className = "category-card";

    const label = document.createElement("label");

    const header = document.createElement("div");
    header.className = "category-header";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = "category-filter";
    checkbox.value = category.id;
    checkbox.checked = state.settings.categoryIds.includes(category.id);

    const copy = document.createElement("div");

    const title = document.createElement("div");
    title.className = "category-title";
    title.textContent = category.label;

    const subtitle = document.createElement("div");
    subtitle.className = "category-copy";
    subtitle.textContent =
      `${category.miss_count} misses. ${category.rationale}`;

    const tagRow = document.createElement("div");
    tagRow.className = "tag-row";

    const priorityTag = makeTag(`#${category.priority_rank} ${category.priority_band}`, "priority-high");
    const roiTag = makeTag(`${category.estimated_roi} ROI`);
    const timeTag = makeTag(`${category.time_to_improve} time`);

    tagRow.append(priorityTag, roiTag, timeTag);
    copy.append(title, subtitle, tagRow);
    header.append(checkbox, copy);
    label.append(header);
    article.append(label);
    fragment.append(article);
  });

  elements.categoryList.append(fragment);
}

function renderQuestionCountOptions() {
  const available = getFilteredQuestionsFromSettings().length;
  const options = [
    { value: "all", label: `All available (${available})` },
    { value: "5", label: "5 questions" },
    { value: "10", label: "10 questions" },
    { value: "15", label: "15 questions" },
    { value: "20", label: "20 questions" },
  ];

  elements.questionCount.replaceChildren();

  for (const option of options) {
    const el = document.createElement("option");
    el.value = option.value;
    el.textContent = option.label;
    elements.questionCount.append(el);
  }

  const requested = state.settings.questionCount;
  const valid = options.some((option) => option.value === requested);
  state.settings.questionCount = valid ? requested : "all";
  elements.questionCount.value = state.settings.questionCount;
}

function updateSetupCounts() {
  const filtered = getFilteredQuestionsFromSettings();
  const available = filtered.length;
  const selectedCategories = state.settings.categoryIds.length;
  const sessionSize = Math.min(available, getRequestedQuestionCount(available));
  const totalCategories = getAllCategories().length;
  const { real, synthetic } = getQuestionOriginCounts(filtered);
  const questionLabel = sessionSize === 1 ? "question" : "questions";
  const categoryLabel = selectedCategories === 1 ? "category" : "categories";
  const mixText = synthetic
    ? `${real} real and ${synthetic} synthetic drills match.`
    : `${real} real questions match. Synthetic drills are off.`;

  elements.availableCount.textContent = String(available);
  elements.sessionSize.textContent = String(sessionSize);
  elements.selectedCategoriesCount.textContent = String(selectedCategories);
  elements.startSession.disabled = available === 0;
  elements.startSession.textContent = available === 0
    ? "Adjust filters to start"
    : `Start ${state.settings.mode} session`;

  if (available === 0) {
    elements.selectionHint.textContent =
      "No questions match the current category selection. Expand the focus list to build a session.";
  } else if (selectedCategories === totalCategories) {
    elements.selectionHint.textContent =
      `All categories are active. ${mixText} This run will include ${sessionSize} ${questionLabel}.`;
  } else {
    elements.selectionHint.textContent =
      `${selectedCategories} ${categoryLabel} selected, ${available} matching questions, ${mixText} ${sessionSize} ${questionLabel} in this run.`;
  }

  renderQuestionCountOptions();
}

function startSessionFromSelection() {
  const questions = getFilteredQuestionsFromSettings();
  if (!questions.length) {
    return;
  }

  startSession(questions);
}

function startSessionFromIds(ids) {
  const lookup = new Map(state.bank.questions.map((question) => [question.id, question]));
  const questions = ids.map((id) => lookup.get(id)).filter(Boolean);
  if (!questions.length) {
    return;
  }

  startSession(questions, ids);
}

function startSession(questionList, fixedIds = null) {
  const questions = fixedIds
    ? questionList.slice()
    : prepareQuestionsForSession(questionList).slice(
        0,
        getRequestedQuestionCount(questionList.length),
      );

  const orderedQuestions = fixedIds
    ? (state.settings.shuffle ? shuffle(questionList.slice()) : questionList.slice())
    : questions;

  state.session = {
    mode: state.settings.mode,
    questions: orderedQuestions,
    questionIds: orderedQuestions.map((question) => question.id),
    currentIndex: 0,
    answers: {},
  };

  showView("quiz");
  renderQuestion();
}

function prepareQuestionsForSession(questionList) {
  const questions = questionList.slice();

  if (state.settings.shuffle) {
    return shuffle(questions);
  }

  return questions.sort(compareQuestions);
}

function renderQuestion() {
  const question = getCurrentQuestion();
  const answerState = getCurrentAnswerState();
  const index = state.session.currentIndex + 1;
  const total = state.session.questions.length;

  elements.progressLabel.textContent = `Question ${index} of ${total}`;
  elements.questionTitle.textContent = formatQuestionTitle(question);
  elements.modeBadge.textContent = state.session.mode === "practice" ? "Practice mode" : "Quiz mode";
  elements.originBadge.textContent = getQuestionOriginLabel(question);
  elements.originBadge.className = `badge badge-origin ${isSyntheticQuestion(question) ? "badge-synthetic" : "badge-real"}`;
  elements.scoreLabel.textContent = makeScoreLabel();
  elements.progressFill.style.width = `${(index / total) * 100}%`;
  elements.questionText.textContent = question.question_text;

  renderQuestionMeta(question);
  renderChoices(question, answerState);
  renderFeedback(question, answerState);

  if (state.session.mode === "practice") {
    elements.primaryAction.textContent = answerState.revealed
      ? (index === total ? "Finish session" : "Next question")
      : "Check answer";
  } else {
    elements.primaryAction.textContent = index === total ? "Finish quiz" : "Save and continue";
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderQuestionMeta(question) {
  elements.questionMeta.replaceChildren();

  const tags = [
    `${question.domain}`,
    `${question.study_category_label}`,
    `Priority #${question.study_priority_rank}`,
  ];

  tags.forEach((text) => {
    elements.questionMeta.append(makeTag(text));
  });

  elements.questionMeta.append(
    makeTag(
      getQuestionOriginLabel(question),
      isSyntheticQuestion(question) ? "tag-synthetic" : "tag-real",
    ),
  );

  if (isSyntheticQuestion(question)) {
    elements.questionMeta.append(
      makeTag(`Based on ${formatQuestionShort(getSourceQuestion(question))}`),
    );
  }
}

function renderChoices(question, answerState) {
  elements.choices.replaceChildren();
  const fragment = document.createDocumentFragment();

  getChoiceEntries(question).forEach(([letter, text]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice";

    if (answerState.selectedLetter === letter) {
      button.classList.add("selected");
    }

    if (answerState.revealed || state.session.mode === "quiz" && answerState.finalized) {
      if (letter === question.correct_answer.letter) {
        button.classList.add("correct");
      } else if (
        answerState.selectedLetter === letter &&
        answerState.selectedLetter !== question.correct_answer.letter
      ) {
        button.classList.add("incorrect");
      }
    }

    button.disabled = answerState.revealed;
    button.addEventListener("click", () => {
      selectChoice(letter);
    });

    const letterPill = document.createElement("span");
    letterPill.className = "choice-letter";
    letterPill.textContent = letter;

    const textSpan = document.createElement("span");
    textSpan.textContent = text;

    button.append(letterPill, textSpan);
    fragment.append(button);
  });

  elements.choices.append(fragment);
}

function renderFeedback(question, answerState) {
  elements.feedbackCard.replaceChildren();

  if (state.session.mode !== "practice" || !answerState.revealed) {
    elements.feedbackCard.className = "feedback-card hidden";
    return;
  }

  const category = state.categoryMap.get(question.study_category_id);
  const isCorrect = answerState.selectedLetter === question.correct_answer.letter;
  elements.feedbackCard.className = `feedback-card ${isCorrect ? "correct" : "incorrect"}`;

  const title = document.createElement("h3");
  title.className = "feedback-title";
  title.textContent = isCorrect ? "Correct" : "Incorrect";

  const correctLine = document.createElement("p");
  correctLine.innerHTML =
    `<strong>Correct answer:</strong> ${question.correct_answer.letter}. ${escapeHtml(question.correct_answer.text)}`;

  elements.feedbackCard.append(title, correctLine);

  if (!isCorrect && answerState.selectedLetter) {
    const selectedLine = document.createElement("p");
    selectedLine.innerHTML =
      `<strong>Your answer:</strong> ${answerState.selectedLetter}. ${escapeHtml(
        question.choices[answerState.selectedLetter],
      )}`;
    elements.feedbackCard.append(selectedLine);
  }

  if (question.selected_incorrect_answer) {
    const originalMiss = document.createElement("p");
    const missLabel = isSyntheticQuestion(question) ? "Trap answer" : "Original missed answer";
    originalMiss.innerHTML =
      `<strong>${missLabel}:</strong> ${question.selected_incorrect_answer.letter}. ${escapeHtml(
        question.selected_incorrect_answer.text,
      )}`;
    elements.feedbackCard.append(originalMiss);
  }

  if (question.answer_explanation?.why_correct) {
    const whyCorrect = document.createElement("p");
    whyCorrect.innerHTML =
      `<strong>Why it works:</strong> ${escapeHtml(question.answer_explanation.why_correct)}`;
    elements.feedbackCard.append(whyCorrect);
  }

  if (question.answer_explanation?.why_selected_answer_is_wrong && question.selected_incorrect_answer) {
    const whyWrong = document.createElement("p");
    whyWrong.innerHTML =
      `<strong>Why the original miss fails:</strong> ${escapeHtml(
        question.answer_explanation.why_selected_answer_is_wrong,
      )}`;
    elements.feedbackCard.append(whyWrong);
  }

  if (question.answer_explanation?.takeaway) {
    const takeaway = document.createElement("p");
    takeaway.innerHTML =
      `<strong>Takeaway:</strong> ${escapeHtml(question.answer_explanation.takeaway)}`;
    elements.feedbackCard.append(takeaway);
  }

  if (category) {
    const focus = document.createElement("p");
    focus.innerHTML =
      `<strong>Study focus:</strong> ${escapeHtml(category.label)}. ${escapeHtml(
        category.study_actions[0],
      )}`;
    elements.feedbackCard.append(focus);
  }
}

function handlePrimaryAction() {
  const question = getCurrentQuestion();
  const answerState = getCurrentAnswerState();

  if (!answerState.selectedLetter) {
    elements.feedbackCard.className = "feedback-card incorrect";
    elements.feedbackCard.textContent = "Select an answer before continuing.";
    return;
  }

  if (state.session.mode === "practice") {
    if (!answerState.revealed) {
      answerState.revealed = true;
      answerState.finalized = true;
      answerState.isCorrect = answerState.selectedLetter === question.correct_answer.letter;
      renderQuestion();
      return;
    }

    moveToNextQuestion();
    return;
  }

  answerState.finalized = true;
  answerState.isCorrect = answerState.selectedLetter === question.correct_answer.letter;
  moveToNextQuestion();
}

function moveToNextQuestion() {
  if (state.session.currentIndex === state.session.questions.length - 1) {
    renderResults();
    showView("results");
    return;
  }

  state.session.currentIndex += 1;
  renderQuestion();
}

function renderResults() {
  const reviewItems = getSessionReview();
  const correctCount = reviewItems.filter((item) => item.isCorrect).length;
  const total = reviewItems.length;
  const missedCount = total - correctCount;
  const percent = total ? Math.round((correctCount / total) * 100) : 0;
  const { real, synthetic } = getQuestionOriginCounts(reviewItems.map((item) => item.question));

  elements.resultsSummary.textContent =
    `${correctCount} correct out of ${total}. ${percent}% accuracy this run. ` +
    `${real} real, ${synthetic} synthetic.`;

  elements.resultsCards.replaceChildren(
    makeResultCard("Accuracy", `${percent}%`),
    makeResultCard("Correct", String(correctCount)),
    makeResultCard("Missed", String(missedCount)),
  );

  renderCategoryBreakdown(reviewItems);
  renderReviewList(reviewItems);

  elements.retryMissed.disabled = missedCount === 0;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderCategoryBreakdown(reviewItems) {
  elements.categoryBreakdown.replaceChildren();

  const byCategory = new Map();
  reviewItems.forEach((item) => {
    const key = item.question.study_category_id;
    const entry = byCategory.get(key) || {
      label: item.question.study_category_label,
      correct: 0,
      total: 0,
    };

    entry.total += 1;
    if (item.isCorrect) {
      entry.correct += 1;
    }

    byCategory.set(key, entry);
  });

  const fragment = document.createDocumentFragment();
  Array.from(byCategory.values())
    .sort((left, right) => left.label.localeCompare(right.label))
    .forEach((entry) => {
      const card = document.createElement("article");
      card.className = "breakdown-card";

      const heading = document.createElement("h3");
      heading.textContent = entry.label;

      const summary = document.createElement("p");
      summary.textContent = `${entry.correct} / ${entry.total} correct`;

      card.append(heading, summary);
      fragment.append(card);
    });

  elements.categoryBreakdown.append(fragment);
}

function renderReviewList(reviewItems) {
  elements.reviewList.replaceChildren();

  const missed = reviewItems.filter((item) => !item.isCorrect);
  const source = missed.length ? missed : reviewItems;

  if (!source.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "Nothing to review.";
    elements.reviewList.append(empty);
    return;
  }

  const fragment = document.createDocumentFragment();

  source.forEach((item) => {
    const { question } = item;
    const article = document.createElement("article");
    article.className = `review-item ${item.isCorrect ? "correct-review" : "incorrect-review"}`;

    const heading = document.createElement("h3");
    heading.textContent = `${formatQuestionTitle(question)} · ${question.domain}`;

    const category = document.createElement("p");
    category.className = "review-answer";
    category.textContent = question.study_category_label;

    const origin = document.createElement("p");
    origin.innerHTML = `<strong>Type:</strong> ${escapeHtml(getQuestionOriginLabel(question))}${
      isSyntheticQuestion(question)
        ? ` · ${escapeHtml(`Based on ${formatQuestionShort(getSourceQuestion(question))}`)}`
        : ""
    }`;

    const prompt = document.createElement("p");
    prompt.textContent = question.question_text.split("\n").slice(-1)[0];

    const selected = document.createElement("p");
    selected.innerHTML =
      `<strong>Your answer:</strong> ${item.answer.selectedLetter}. ${escapeHtml(
        question.choices[item.answer.selectedLetter],
      )}`;

    const correct = document.createElement("p");
    correct.innerHTML =
      `<strong>Correct answer:</strong> ${question.correct_answer.letter}. ${escapeHtml(
        question.correct_answer.text,
      )}`;

    article.append(heading, category, origin, prompt, selected, correct);

    if (question.answer_explanation?.why_correct) {
      const rationale = document.createElement("p");
      rationale.className = "review-answer";
      rationale.innerHTML =
        `<strong>Why it works:</strong> ${escapeHtml(question.answer_explanation.why_correct)}`;
      article.append(rationale);
    }

    fragment.append(article);
  });

  elements.reviewList.append(fragment);
}

function getSessionReview() {
  return state.session.questions.map((question) => {
    const answer = state.session.answers[question.id];
    return {
      question,
      answer,
      isCorrect: answer.selectedLetter === question.correct_answer.letter,
    };
  });
}

function selectChoice(letter) {
  const answerState = getCurrentAnswerState();
  if (answerState.revealed) {
    return;
  }

  answerState.selectedLetter = letter;
  renderQuestion();
}

function getCurrentQuestion() {
  return state.session.questions[state.session.currentIndex];
}

function getCurrentAnswerState() {
  const question = getCurrentQuestion();
  if (!state.session.answers[question.id]) {
    state.session.answers[question.id] = {
      selectedLetter: "",
      finalized: false,
      revealed: false,
      isCorrect: false,
    };
  }

  return state.session.answers[question.id];
}

function getAllCategories() {
  return state.bank.study_analysis.study_categories
    .slice()
    .sort((left, right) => left.priority_rank - right.priority_rank);
}

function getFilteredQuestionsFromSettings() {
  const allowed = new Set(state.settings.categoryIds);
  return state.bank.questions.filter((question) => {
    if (!allowed.has(question.study_category_id)) {
      return false;
    }

    return state.settings.includeSynthetic || !isSyntheticQuestion(question);
  });
}

function getRequestedQuestionCount(available) {
  if (state.settings.questionCount === "all") {
    return available;
  }

  const requested = Number(state.settings.questionCount);
  if (!Number.isFinite(requested) || requested <= 0) {
    return available;
  }

  return Math.min(requested, available);
}

function getChoiceEntries(question) {
  return Object.entries(question.choices).sort(([left], [right]) => left.localeCompare(right));
}

function makeScoreLabel() {
  const answers = Object.values(state.session.answers).filter((answer) => answer.finalized);
  if (!answers.length) {
    return state.session.mode === "practice" ? "Score: 0 / 0" : "Answers saved: 0";
  }

  if (state.session.mode === "practice") {
    const correct = answers.filter((answer) => answer.isCorrect).length;
    return `Score: ${correct} / ${answers.length}`;
  }

  return `Answers saved: ${answers.length} / ${state.session.questions.length}`;
}

function getQuestionOriginCounts(questionList) {
  return questionList.reduce((counts, question) => {
    counts.total += 1;
    if (isSyntheticQuestion(question)) {
      counts.synthetic += 1;
    } else {
      counts.real += 1;
    }
    return counts;
  }, {
    total: 0,
    real: 0,
    synthetic: 0,
  });
}

function isSyntheticQuestion(question) {
  return question.question_source_type === "synthetic";
}

function getSourceQuestion(question) {
  return state.questionMap.get(question.source_question_id) || question;
}

function getQuestionOriginLabel(question) {
  return isSyntheticQuestion(question) ? "Synthetic drill" : "Real SAT miss";
}

function formatQuestionShort(question) {
  return `${question.module_label} Q${question.question_number}`;
}

function formatQuestionTitle(question) {
  if (!isSyntheticQuestion(question)) {
    return `${question.module_label} · Q${question.question_number}`;
  }

  return `${question.module_label} · Q${question.question_number} · ${question.synthetic_variant_label}`;
}

function compareQuestions(left, right) {
  if (left.study_priority_rank !== right.study_priority_rank) {
    return left.study_priority_rank - right.study_priority_rank;
  }

  if (left.module !== right.module) {
    return left.module - right.module;
  }

  if (left.question_number !== right.question_number) {
    return left.question_number - right.question_number;
  }

  const leftRank = isSyntheticQuestion(left) ? 1 : 0;
  const rightRank = isSyntheticQuestion(right) ? 1 : 0;
  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }

  return (left.synthetic_variant_index || 0) - (right.synthetic_variant_index || 0);
}

function makeTag(text, extraClass = "") {
  const tag = document.createElement("span");
  tag.className = `tag ${extraClass}`.trim();
  tag.textContent = text;
  return tag;
}

function makeResultCard(label, value) {
  const card = document.createElement("article");
  card.className = "result-card";

  const heading = document.createElement("span");
  heading.className = "result-label";
  heading.textContent = label;

  const figure = document.createElement("strong");
  figure.textContent = value;

  card.append(heading, figure);
  return card;
}

function showView(view) {
  elements.loadingView.classList.toggle("hidden", view !== "loading");
  elements.errorView.classList.toggle("hidden", view !== "error");
  elements.setupView.classList.toggle("hidden", view !== "setup");
  elements.quizView.classList.toggle("hidden", view !== "quiz");
  elements.resultsView.classList.toggle("hidden", view !== "results");
}

function showError(message) {
  elements.errorMessage.textContent = message;
  showView("error");
}

function shuffle(items) {
  const copy = items.slice();
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
