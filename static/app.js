/* ============================================================
   VERDANT & VINE — multi-step booking experience
   Client validation mirrors server rules in app.py.
   POST contract: /api/bookings with
   {name, email, phone, event_date, guests, service_type, message}
   ============================================================ */

// Server rules, mirrored exactly
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const PHONE_RE = /^\+?[0-9\s().\-]{7,20}$/;
const SERVER_SERVICE_TYPE = "Event Catering"; // one of app.py SERVICE_TYPES

const STEP_NAMES = ["Event details", "Services", "Contact", "Review"];

const state = {
  eventDate: "",
  guests: 20,
  eventType: "",
  menuStyle: "",
  addOns: [],
  name: "",
  email: "",
  phone: "",
  notes: "",
};

let currentStep = 0;
const MAX_STEP = 3;

// ---------- Helpers ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function todayStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function prettyDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

function setError(inputId, errId, message) {
  const err = document.getElementById(errId);
  const field = document.getElementById(inputId)?.closest(".field");
  err.textContent = message || "";
  if (field) {
    field.classList.toggle("invalid", !!message);
    field.classList.toggle("valid", !message && !!document.getElementById(inputId)?.value);
  }
  return !message;
}

// ---------- Field validators (mirror app.py) ----------
function validateDate() {
  const el = $("#eventDate");
  const v = el.value.trim();
  if (!v) return setError("eventDate", "err-eventDate", "Please choose a date for your event.");
  if (v <= todayStr())
    return setError("eventDate", "err-eventDate", "Your event needs to be in the future — pick a day after today.");
  state.eventDate = v;
  return setError("eventDate", "err-eventDate", "");
}

function validateGuests() {
  const n = state.guests;
  if (!Number.isInteger(n) || n < 1 || n > 500)
    return setError("guests", "err-guests", "Guest count must be between 1 and 500.");
  return setError("guests", "err-guests", "");
}

function validateEventType() {
  if (!state.eventType)
    return setError("eventType", "err-eventType", "Please choose what you're celebrating.");
  return setError("eventType", "err-eventType", "");
}

function validateMenuStyle() {
  const err = $("#err-menuStyle");
  if (!state.menuStyle) {
    err.textContent = "Please pick a service style — plated, buffet, stations, or cocktail.";
    return false;
  }
  err.textContent = "";
  return true;
}

function validateName() {
  const v = $("#fullName").value.trim();
  if (v.length < 2)
    return setError("fullName", "err-fullName", "Please enter your full name so we know who we're talking to.");
  state.name = v;
  return setError("fullName", "err-fullName", "");
}

function validateEmail() {
  const v = $("#email").value.trim();
  if (!EMAIL_RE.test(v))
    return setError("email", "err-email", "That email doesn't look quite right — please double-check it.");
  state.email = v;
  return setError("email", "err-email", "");
}

function validatePhone() {
  const v = $("#phone").value.trim();
  if (!PHONE_RE.test(v))
    return setError("phone", "err-phone", "Please enter a valid phone number (e.g. 555-123-4567).");
  state.phone = v;
  return setError("phone", "err-phone", "");
}

function validateNotes() {
  const v = $("#notes").value;
  if (v.length > 1000)
    return setError("notes", "err-notes", "Keep your notes under 1,000 characters, please.");
  state.notes = v.trim();
  return setError("notes", "err-notes", "");
}

const STEP_VALIDATORS = {
  0: [validateDate, validateGuests, validateEventType],
  1: [validateMenuStyle],
  2: [validateName, validateEmail, validatePhone],
  3: [validateNotes],
};

function validateStep(i) {
  const results = STEP_VALIDATORS[i].map((fn) => fn());
  const ok = results.every(Boolean);
  if (!ok) {
    // Focus the first invalid control for keyboard users
    const panel = $(`.step-panel[data-panel="${i}"]`);
    const bad = panel.querySelector(".field.invalid input, .field.invalid select, .field.invalid textarea");
    (bad || panel.querySelector(".panel-title")).focus?.();
  }
  return ok;
}

// ---------- Step navigation ----------
function renderProgress() {
  $$("#stepsList .step").forEach((li, i) => {
    li.classList.toggle("is-current", i === currentStep);
    li.classList.toggle("is-done", i < currentStep);
    if (i === currentStep) li.setAttribute("aria-current", "step");
    else li.removeAttribute("aria-current");
    // Completed steps are clickable to revisit
    li.tabIndex = i < currentStep ? 0 : -1;
    li.setAttribute("role", i < currentStep ? "button" : "listitem");
    li.setAttribute("aria-label",
      i < currentStep ? `Go back to step ${i + 1}: ${STEP_NAMES[i]}` : `Step ${i + 1}: ${STEP_NAMES[i]}`);
  });
  $("#stepsCaption").textContent = `Step ${currentStep + 1} of 4 — ${STEP_NAMES[currentStep]}`;
}

function goTo(i, dir = "forward") {
  if (i < 0 || i > MAX_STEP) return;
  const prev = $(`.step-panel[data-panel="${currentStep}"]`);
  const next = $(`.step-panel[data-panel="${i}"]`);
  currentStep = i;
  prev.classList.remove("is-active");
  prev.hidden = true;
  next.hidden = false;
  next.dataset.dir = dir;
  // Force reflow so the entrance animation replays
  void next.offsetWidth;
  next.classList.add("is-active");
  if (i === 3) renderReview();
  renderProgress();
  const title = next.querySelector(".panel-title");
  title.focus({ preventScroll: true });
  $("#formCard").scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------- Review ----------
function reviewRow(label, value, editStep) {
  return `<div><dt>${label}</dt><dd>${value}<button type="button" class="review-edit" data-edit="${editStep}">Edit</button></dd></div>`;
}

function summaryRows() {
  return [
    ["Event date", prettyDate(state.eventDate)],
    ["Guests", `${state.guests} guest${state.guests === 1 ? "" : "s"}`],
    ["Event type", state.eventType],
    ["Service style", state.menuStyle],
    ["Add-ons", state.addOns.length ? state.addOns.join(", ") : "None"],
    ["Name", state.name],
    ["Email", state.email],
    ["Phone", state.phone],
  ];
}

function renderReview() {
  const rows = [
    reviewRow("Event date", prettyDate(state.eventDate), 0),
    reviewRow("Guests", `${state.guests} guest${state.guests === 1 ? "" : "s"}`, 0),
    reviewRow("Event type", state.eventType, 0),
    reviewRow("Service style", state.menuStyle, 1),
    reviewRow("Add-ons", state.addOns.length ? state.addOns.join(", ") : "None", 1),
    reviewRow("Name", state.name, 2),
    reviewRow("Email", state.email, 2),
    reviewRow("Phone", state.phone, 2),
  ];
  $("#reviewList").innerHTML = rows.join("");
}

// ---------- Submit ----------
function buildMessage() {
  const details = [
    `Event type: ${state.eventType}`,
    `Service style: ${state.menuStyle}`,
    `Add-ons: ${state.addOns.length ? state.addOns.join(", ") : "none"}`,
  ].join(" · ");
  const msg = state.notes ? `${details}\n\nGuest notes: ${state.notes}` : details;
  return msg.slice(0, 1000); // server cap
}

async function submitBooking() {
  if (!validateStep(3)) return;
  const btn = $("#submitBtn");
  btn.disabled = true;
  btn.classList.add("is-loading");
  $("#formError").textContent = "";

  const payload = {
    name: state.name,
    email: state.email,
    phone: state.phone,
    event_date: state.eventDate,
    guests: state.guests,
    service_type: SERVER_SERVICE_TYPE,
    message: buildMessage(),
  };

  try {
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (res.ok && data.success) {
      showSuccess(data);
    } else if (res.status === 400 && data.errors) {
      applyServerErrors(data.errors);
    } else {
      $("#formError").textContent =
        "Something went wrong on our end — please try again, or call us at (503) 555-0148.";
    }
  } catch (e) {
    $("#formError").textContent =
      "We couldn't reach the server. Check your connection and try again.";
  } finally {
    btn.disabled = false;
    btn.classList.remove("is-loading");
  }
}

// Map server-side 400 errors back onto the right step + field
const SERVER_FIELD_MAP = {
  name: { step: 2, input: "fullName", err: "err-fullName" },
  email: { step: 2, input: "email", err: "err-email" },
  phone: { step: 2, input: "phone", err: "err-phone" },
  event_date: { step: 0, input: "eventDate", err: "err-eventDate" },
  guests: { step: 0, input: "guests", err: "err-guests" },
};

function applyServerErrors(errors) {
  let firstStep = null;
  for (const [key, message] of Object.entries(errors)) {
    const map = SERVER_FIELD_MAP[key];
    if (!map) continue;
    setError(map.input, map.err, message);
    if (firstStep === null) firstStep = map.step;
  }
  if (firstStep !== null) goTo(firstStep, "back");
}

function showSuccess(data) {
  $("#successMessage").textContent = data.message;
  $("#successRef").textContent = data.reference;
  $("#successSummary").innerHTML = summaryRows()
    .map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`)
    .join("");
  $("#bookingForm").hidden = true;
  $("#stepsList").closest(".steps-nav").hidden = true;
  const panel = $("#successPanel");
  panel.hidden = false;
  $("#successTitle").focus({ preventScroll: true });
  $("#formCard").scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetAll() {
  Object.assign(state, {
    eventDate: "", guests: 20, eventType: "", menuStyle: "",
    addOns: [], name: "", email: "", phone: "", notes: "",
  });
  const form = $("#bookingForm");
  form.reset();
  $("#guests").value = "20";
  $("#guestsValue").textContent = "20";
  updateStepperButtons();
  $$(".field").forEach((f) => f.classList.remove("invalid", "valid"));
  $$(".error").forEach((e) => (e.textContent = ""));
  $("#successPanel").hidden = true;
  $("#bookingForm").hidden = false;
  $("#stepsList").closest(".steps-nav").hidden = false;
  currentStep = -1; // force full refresh below
  goTo(0, "back");
}

// ---------- Wiring ----------
function updateStepperButtons() {
  $("#guestsMinus").disabled = state.guests <= 1;
  $("#guestsPlus").disabled = state.guests >= 500;
}

function init() {
  // Date picker: no past dates
  const dateEl = $("#eventDate");
  dateEl.min = todayStr();

  // Stepper
  updateStepperButtons();
  $("#guestsMinus").addEventListener("click", () => {
    state.guests = Math.max(1, state.guests - 1);
    syncStepper();
  });
  $("#guestsPlus").addEventListener("click", () => {
    state.guests = Math.min(500, state.guests + 1);
    syncStepper();
  });
  function syncStepper() {
    $("#guests").value = String(state.guests);
    $("#guestsValue").textContent = String(state.guests);
    updateStepperButtons();
    setError("guests", "err-guests", "");
  }

  // Step 1 inputs → state
  dateEl.addEventListener("change", () => { state.eventDate = dateEl.value; validateDate(); });
  $("#eventType").addEventListener("change", (e) => { state.eventType = e.target.value; validateEventType(); });

  // Step 2 inputs → state
  $$('input[name="menu_style"]').forEach((r) =>
    r.addEventListener("change", () => { state.menuStyle = r.value; validateMenuStyle(); }));
  $$('input[name="addon"]').forEach((c) =>
    c.addEventListener("change", () => {
      state.addOns = $$('input[name="addon"]:checked').map((x) => x.value);
    }));

  // Step 3 real-time validation
  $("#fullName").addEventListener("blur", validateName);
  $("#email").addEventListener("blur", validateEmail);
  $("#phone").addEventListener("blur", validatePhone);
  $("#fullName").addEventListener("input", () => { if ($("#fullName").closest(".field").classList.contains("invalid")) validateName(); });
  $("#email").addEventListener("input", () => { if ($("#email").closest(".field").classList.contains("invalid")) validateEmail(); });
  $("#phone").addEventListener("input", () => { if ($("#phone").closest(".field").classList.contains("invalid")) validatePhone(); });

  // Continue / back
  $$("[data-next]").forEach((btn) =>
    btn.addEventListener("click", () => {
      if (validateStep(currentStep)) goTo(currentStep + 1, "forward");
    }));
  $$("[data-back]").forEach((btn) =>
    btn.addEventListener("click", () => goTo(currentStep - 1, "back")));

  // Clickable completed steps
  $("#stepsList").addEventListener("click", (e) => {
    const li = e.target.closest(".step");
    if (!li) return;
    const i = Number(li.dataset.step);
    if (i < currentStep) goTo(i, "back");
  });
  $("#stepsList").addEventListener("keydown", (e) => {
    const li = e.target.closest(".step");
    if (!li) return;
    const i = Number(li.dataset.step);
    if (i < currentStep && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      goTo(i, "back");
    }
  });

  // Review "Edit" buttons (delegated)
  $("#reviewList").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-edit]");
    if (btn) goTo(Number(btn.dataset.edit), "back");
  });

  // Submit + reset
  $("#submitBtn").addEventListener("click", submitBooking);
  $("#bookAnother").addEventListener("click", resetAll);

  // Prevent accidental Enter-submit mid-flow; Enter on step 4 submits
  $("#bookingForm").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") {
      e.preventDefault();
      if (currentStep < 3 && validateStep(currentStep)) goTo(currentStep + 1, "forward");
      else if (currentStep === 3) submitBooking();
    }
  });

  renderProgress();

  // Nav shadow on scroll
  const nav = $("#siteNav");
  addEventListener("scroll", () => nav.classList.toggle("scrolled", scrollY > 24), { passive: true });

  // Scroll reveals
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add("visible"); io.unobserve(en.target); }
    });
  }, { threshold: 0.12 });
  $$(".reveal").forEach((el) => io.observe(el));
}

document.addEventListener("DOMContentLoaded", init);
