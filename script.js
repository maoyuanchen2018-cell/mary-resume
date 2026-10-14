
const yearElement = document.querySelector("#year");

if (yearElement) {
  yearElement.textContent = new Date().getFullYear();
}

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const root = document.documentElement;

function readSetting(key) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    return null;
  }
}

function saveSetting(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (error) {}
}

/* ---------- Language ---------- */

const translations = window.TRANSLATIONS || {};
const uiStrings = window.UI_STRINGS;
const langToggle = document.querySelector(".lang-toggle");
const i18nElements = [...document.querySelectorAll("[data-i18n]")];
const i18nAttrElements = [...document.querySelectorAll("[data-i18n-attr]")];
let currentLang = "en";

// The English text is the HTML itself, so remember it before translating anything
const english = { "meta.title": document.title };
i18nElements.forEach((el) => {
  english[el.dataset.i18n] = el.innerHTML;
});

function parseAttrBindings(el) {
  return el.dataset.i18nAttr.split(";").map((pair) => pair.split("="));
}

i18nAttrElements.forEach((el) => {
  parseAttrBindings(el).forEach(([attr, key]) => {
    english[key] = el.getAttribute(attr);
  });
});

function pageText(key) {
  return (currentLang !== "en" && translations[currentLang]?.[key]) || english[key];
}

// Runtime strings, e.g. t("question", { i: 1, n: 4 })
function t(key, vars = {}) {
  const template = uiStrings[currentLang][key] ?? uiStrings.en[key];
  return template.replace(/\{(\w+)\}/g, (match, name) => vars[name] ?? match);
}

// Hooks that redraw text built in JavaScript; filled in by the sections below
const languageHooks = [];

function setLanguage(lang) {
  currentLang = lang;
  root.lang = lang === "zh" ? "zh-CN" : "en";
  document.title = pageText("meta.title");

  i18nElements.forEach((el) => {
    el.innerHTML = pageText(el.dataset.i18n);
  });
  i18nAttrElements.forEach((el) => {
    parseAttrBindings(el).forEach(([attr, key]) => el.setAttribute(attr, pageText(key)));
  });

  langToggle.textContent = t("langLabel");
  langToggle.setAttribute("aria-label", t("langSwitch"));
  langToggle.lang = lang === "zh" ? "en" : "zh-CN";

  languageHooks.forEach((hook) => hook());
}

langToggle.addEventListener("click", () => {
  const nextLang = currentLang === "zh" ? "en" : "zh";
  setLanguage(nextLang);
  saveSetting("lang", nextLang);
});

/* ---------- Dark mode ---------- */

const themeToggle = document.querySelector(".theme-toggle");
const themeIcon = document.querySelector(".theme-icon");
const systemDark = window.matchMedia("(prefers-color-scheme: dark)");

function applyTheme(theme) {
  root.dataset.theme = theme;
  const isDark = theme === "dark";
  themeIcon.textContent = isDark ? "☀" : "☾";
  themeToggle.setAttribute("aria-label", t(isDark ? "themeToLight" : "themeToDark"));
}

applyTheme(readSetting("theme") || (systemDark.matches ? "dark" : "light"));
languageHooks.push(() => applyTheme(root.dataset.theme));

themeToggle.addEventListener("click", () => {
  const nextTheme = root.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(nextTheme);
  saveSetting("theme", nextTheme);
});

// Follow the system setting until the visitor picks a theme themselves
systemDark.addEventListener("change", (event) => {
  if (!readSetting("theme")) applyTheme(event.matches ? "dark" : "light");
});

/* ---------- Profile photo ---------- */

const heroPhoto = document.querySelector(".hero-photo");
const heroImage = heroPhoto.querySelector("img");

function showPhotoPlaceholder() {
  heroPhoto.classList.add("is-missing");
}

// The image may already have failed before this script ran
if (heroImage.complete && heroImage.naturalWidth === 0) showPhotoPlaceholder();
heroImage.addEventListener("error", showPhotoPlaceholder);

/* ---------- Navigation & smooth scrolling ---------- */

const header = document.querySelector(".site-header");
const nav = document.querySelector("#main-nav");
const menuToggle = document.querySelector(".menu-toggle");
const navLinks = [...nav.querySelectorAll("a")];

function setMenuOpen(isOpen) {
  nav.classList.toggle("is-open", isOpen);
  menuToggle.setAttribute("aria-expanded", String(isOpen));
  menuToggle.setAttribute("aria-label", t(isOpen ? "menuClose" : "menuOpen"));
}

languageHooks.push(() => setMenuOpen(nav.classList.contains("is-open")));

menuToggle.addEventListener("click", () => {
  setMenuOpen(menuToggle.getAttribute("aria-expanded") !== "true");
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && nav.classList.contains("is-open")) {
    setMenuOpen(false);
    menuToggle.focus();
  }
});

document.addEventListener("click", (event) => {
  if (nav.classList.contains("is-open") && !header.contains(event.target)) {
    setMenuOpen(false);
  }
});

function scrollToSection(target) {
  const offset = header.offsetHeight + 16;
  const top = target.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top, behavior: prefersReducedMotion.matches ? "auto" : "smooth" });
}

// Smooth-scroll every in-page link and keep the URL hash in sync
document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    const id = link.getAttribute("href");
    const target = id.length > 1 ? document.querySelector(id) : null;
    if (!target) return;

    event.preventDefault();
    setMenuOpen(false);
    scrollToSection(target);
    history.pushState(null, "", id);
  });
});

function updateHeaderShadow() {
  header.classList.toggle("is-scrolled", window.scrollY > 10);
}

window.addEventListener("scroll", updateHeaderShadow, { passive: true });
updateHeaderShadow();

// Highlight the nav link of the section currently in view
const linkedSections = navLinks
  .map((link) => document.querySelector(link.getAttribute("href")))
  .filter(Boolean);

function setActiveLink(id) {
  navLinks.forEach((link) => {
    const isActive = link.getAttribute("href") === `#${id}`;
    link.classList.toggle("is-active", isActive);
    if (isActive) link.setAttribute("aria-current", "true");
    else link.removeAttribute("aria-current");
  });
}

const sectionObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) setActiveLink(entry.target.id);
    });
  },
  { rootMargin: "-40% 0px -55% 0px" }
);

linkedSections.forEach((section) => sectionObserver.observe(section));

// Clear the highlight when back at the hero
window.addEventListener(
  "scroll",
  () => {
    if (window.scrollY < 200) setActiveLink(null);
  },
  { passive: true }
);

/* ---------- Services filter ---------- */

const filterButtons = [...document.querySelectorAll(".filter-button")];
const serviceCards = [...document.querySelectorAll(".service-card")];
const filterStatus = document.querySelector(".filter-status");
let currentFilter = "all";

function renderFilterStatus() {
  const visibleCount = serviceCards.filter((card) => !card.hidden).length;
  const label = filterButtons.find((button) => button.dataset.filter === currentFilter).textContent;

  if (currentFilter === "all") filterStatus.textContent = t("filterAll", { n: visibleCount });
  else filterStatus.textContent = t(visibleCount === 1 ? "filterOne" : "filterMany", { n: visibleCount, label });
}

function applyFilter(filter) {
  let visibleCount = 0;
  currentFilter = filter;

  filterButtons.forEach((button) => {
    const isActive = button.dataset.filter === filter;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  serviceCards.forEach((card) => {
    const categories = card.dataset.category.split(" ");
    const isVisible = filter === "all" || categories.includes(filter);
    card.hidden = !isVisible;
    card.classList.remove("is-entering", "is-highlighted");

    if (isVisible) {
      // Restart the entrance animation with a small stagger
      void card.offsetWidth;
      card.style.animationDelay = `${visibleCount * 60}ms`;
      card.classList.add("is-entering");
      visibleCount += 1;
    }
  });

  renderFilterStatus();
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => applyFilter(button.dataset.filter));
});

applyFilter("all");
languageHooks.push(renderFilterStatus);

/* ---------- Learning needs assessment ---------- */

const serviceCategories = {
  tutoring: "english",
  reading: "english",
  exam: "exam",
  plan: "design",
  curriculum: "design",
  drama: "projects",
  speaking: "projects",
};

// How strongly each answer points towards each service
const weights = {
  age: {
    young: { reading: 2, tutoring: 1, drama: 1 },
    older: { exam: 1, drama: 1, speaking: 1, tutoring: 1 },
    teen: { speaking: 2, exam: 1, plan: 1 },
    educator: { curriculum: 4, plan: 1 },
  },
  goal: {
    everyday: { tutoring: 3, reading: 2 },
    exam: { exam: 5 },
    speaking: { speaking: 3, drama: 3 },
    program: { curriculum: 4, plan: 3 },
  },
  level: {
    beginner: { reading: 2, tutoring: 1, plan: 1 },
    elementary: { tutoring: 1, reading: 1, exam: 1 },
    intermediate: { speaking: 1, exam: 1, drama: 1 },
    na: { curriculum: 2 },
  },
  format: {
    one: { tutoring: 2, plan: 1, exam: 1 },
    group: { reading: 1, exam: 1, speaking: 1 },
    workshop: { drama: 3, speaking: 1 },
    consult: { plan: 2, curriculum: 2 },
  },
};

const form = document.querySelector(".assessment");
const steps = [...form.querySelectorAll(".assessment-step")];
const progressBar = form.querySelector(".assessment-progress span");
const stepLabel = form.querySelector(".assessment-step-label");
const errorMessage = form.querySelector(".assessment-error");
const backButton = form.querySelector('[data-action="back"]');
const nextButton = form.querySelector('[data-action="next"]');
const stepActions = nextButton.parentElement;
const result = form.querySelector(".assessment-result");
const resultMail = form.querySelector(".result-mail");
let currentStep = 0;
let ranking = null;

// Service titles come from the cards, so they always match the current language
function serviceTitle(id) {
  return document.querySelector(`#service-${id} h3`).textContent.trim();
}

function showStep(index) {
  currentStep = index;
  steps.forEach((step, i) => {
    step.hidden = i !== index;
  });
  progressBar.style.width = `${((index + 1) / steps.length) * 100}%`;
  stepLabel.textContent = t("question", { i: index + 1, n: steps.length });
  backButton.hidden = index === 0;
  nextButton.textContent = t(index === steps.length - 1 ? "seeResult" : "next");
  errorMessage.textContent = "";
}

function getAnswer(step) {
  const checked = step.querySelector("input:checked");
  return checked ? { name: checked.name, value: checked.value, label: checked.parentElement.textContent.trim() } : null;
}

function examLevelFor(age, level) {
  if (age === "young" || level === "beginner") return t("examYle");
  if (level === "intermediate") return "PET";
  return "KET";
}

function renderResult() {
  const answers = steps.map(getAnswer);
  const values = Object.fromEntries(answers.map((a) => [a.name, a.value]));
  const [top, second] = ranking;
  const topTitle = serviceTitle(top);

  let text = uiStrings[currentLang].reasons[top];
  if (top === "exam") text += t("examStart", { level: examLevelFor(values.age, values.level) });

  result.querySelector(".result-title").textContent = topTitle;
  result.querySelector(".result-text").textContent = text;
  result.querySelector(".result-also").textContent = t("alsoLike", { title: serviceTitle(second) });
  stepLabel.textContent = t("complete");

  const summary = answers.map((a, i) => `${steps[i].querySelector("legend").textContent} ${a.label}`).join("\n");
  const subject = t("mailSubject", { title: topTitle });
  const body = t("mailBody", { summary, title: topTitle });
  resultMail.href = `mailto:123456@qq.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function showResult() {
  const scores = Object.fromEntries(Object.keys(serviceCategories).map((id) => [id, 0]));

  steps.map(getAnswer).forEach(({ name, value }) => {
    Object.entries(weights[name][value]).forEach(([id, points]) => {
      scores[id] += points;
    });
  });

  ranking = Object.keys(scores).sort((a, b) => scores[b] - scores[a]);
  renderResult();

  steps.forEach((step) => {
    step.hidden = true;
  });
  stepActions.hidden = true;
  progressBar.style.width = "100%";
  errorMessage.textContent = "";
  result.hidden = false;
  result.focus();
}

languageHooks.push(() => {
  if (result.hidden) showStep(currentStep);
  else renderResult();
});

nextButton.addEventListener("click", () => {
  if (!getAnswer(steps[currentStep])) {
    errorMessage.textContent = t("chooseOption");
    return;
  }
  if (currentStep < steps.length - 1) showStep(currentStep + 1);
  else showResult();
});

backButton.addEventListener("click", () => showStep(currentStep - 1));

// Move forward automatically once an option is clicked
// (keyboard users move between options with arrow keys, so they use Next instead)
let pickedWithPointer = false;
form.addEventListener("pointerdown", () => {
  pickedWithPointer = true;
});
form.addEventListener("keydown", () => {
  pickedWithPointer = false;
});

steps.forEach((step, index) => {
  step.addEventListener("change", () => {
    errorMessage.textContent = "";
    if (pickedWithPointer && index < steps.length - 1) setTimeout(() => showStep(index + 1), 250);
  });
});

form.addEventListener("submit", (event) => event.preventDefault());

form.querySelector('[data-action="restart"]').addEventListener("click", () => {
  form.reset();
  result.hidden = true;
  stepActions.hidden = false;
  showStep(0);
  steps[0].querySelector("input").focus();
});

form.querySelector('[data-action="view"]').addEventListener("click", () => {
  const [top] = ranking;
  const card = document.querySelector(`#service-${top}`);
  applyFilter(serviceCategories[top]);
  card.classList.add("is-highlighted");
  scrollToSection(card);
  setTimeout(() => card.classList.remove("is-highlighted"), 2500);
});

/* ---------- Start-up ---------- */

// The inline script in <head> already picked the language (saved choice, else browser language)
setLanguage(root.lang.startsWith("zh") ? "zh" : "en");
