const ZONE = 84; // px drag distance to fully commit
const THRESHOLD = ZONE / 2;

const habits = [
  { name: "Hydration", icon: "icon-drop.svg" },
  { name: "Exercise", icon: "icon-heart.svg" },
  { name: "Mobility", icon: "icon-stretch.svg" },
  { name: "Supplement", icon: "icon-vitamin.svg" },
  { name: "Mindfulness", icon: "icon-lotus.svg" },
  { name: "Lifestyle", icon: "icon-sparkel.svg" },
];
const ICON_PATH = "resources/images/icons/";

// committed state per habit: null | true | false
const state = {
  nutrition: null,
  habits: habits.map(() => null),
  recorded: false,
};

const habitList = document.getElementById("habitList");
const pointsNum = document.getElementById("pointsNum");
const recordBtn = document.getElementById("recordBtn");
const nutritionScale = document.getElementById("nutritionScale");

// Panel always rests centered (offset 0), so drag offset is just the
// live pointer delta, clamped to whatever direction the current
// committed state still allows.
function clampForState(committed, rawOffset) {
  if (committed === true) return Math.max(-ZONE, Math.min(0, rawOffset));   // only drag left
  if (committed === false) return Math.max(0, Math.min(ZONE, rawOffset));   // only drag right
  return Math.max(-ZONE, Math.min(ZONE, rawOffset));                        // neutral: both ways
}

function resolveNewState(committed, offset) {
  if (committed === true) return offset <= -THRESHOLD ? null : true;
  if (committed === false) return offset >= THRESHOLD ? null : false;
  if (offset >= THRESHOLD) return true;
  if (offset <= -THRESHOLD) return false;
  return null;
}

function buildRow(h, i) {
  const row = document.createElement("div");
  row.className = "habit-row";
  row.innerHTML = `
    <div class="track track-left"></div>
    <div class="track track-right"></div>
    <div class="thumb-indicator thumb-left">👍</div>
    <div class="thumb-indicator thumb-right">👎</div>
    <div class="panel">
      <img class="icon" src="${ICON_PATH}${h.icon}" alt="" aria-hidden="true">
      <div class="name">${h.name}</div>
    </div>
  `;
  const trackLeft = row.querySelector(".track-left");
  const trackRight = row.querySelector(".track-right");
  const thumbLeft = row.querySelector(".thumb-left");
  const thumbRight = row.querySelector(".thumb-right");
  const panel = row.querySelector(".panel");

  let startX = 0;
  let startY = 0;
  // "pending" = touch down, direction not yet decided
  // "dragging" = confirmed horizontal gesture, we own it
  // "scrolling" = confirmed vertical gesture, hand off to the browser
  let phase = "idle";
  const LOCK = 10; // px of movement before we decide the gesture's direction

  function applyLive(offset) {
    const fraction = offset / ZONE; // -1..1
    panel.style.transform = `translateX(${offset}px)`;
    if (fraction > 0) {
      trackLeft.style.width = `${fraction * ZONE}px`;
      thumbLeft.style.opacity = fraction;
      trackRight.style.width = "0px";
      thumbRight.style.opacity = 0;
    } else if (fraction < 0) {
      trackRight.style.width = `${-fraction * ZONE}px`;
      thumbRight.style.opacity = -fraction;
      trackLeft.style.width = "0px";
      thumbLeft.style.opacity = 0;
    } else {
      trackLeft.style.width = "0px";
      trackRight.style.width = "0px";
      thumbLeft.style.opacity = 0;
      thumbRight.style.opacity = 0;
    }
  }

  function applySettled(val) {
    panel.style.transform = "translateX(0px)";
    trackLeft.style.width = "0px";
    trackRight.style.width = "0px";
    thumbLeft.style.opacity = val === true ? 1 : 0;
    thumbRight.style.opacity = val === false ? 1 : 0;
  }

  applySettled(state.habits[i]);

  row.addEventListener("pointerdown", (e) => {
    phase = "pending";
    startX = e.clientX;
    startY = e.clientY;
    // no setPointerCapture here — we don't yet know if this is a drag,
    // so the browser stays free to treat it as a scroll if it turns out vertical
  });

  row.addEventListener("pointermove", (e) => {
    if (phase === "idle" || phase === "scrolling") return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (phase === "pending") {
      if (Math.abs(dx) < LOCK && Math.abs(dy) < LOCK) return; // not enough movement to decide yet
      if (Math.abs(dy) > Math.abs(dx)) {
        phase = "scrolling"; // vertical intent — bail out, let native scroll handle the rest
        return;
      }
      // horizontal intent confirmed — now, and only now, take over the gesture
      phase = "dragging";
      row.classList.add("dragging");
      row.setPointerCapture(e.pointerId);
    }

    const clamped = clampForState(state.habits[i], dx);
    applyLive(clamped);
  });

  function endDrag(e) {
    const wasDragging = phase === "dragging";
    phase = "idle";
    row.classList.remove("dragging");
    if (!wasDragging) return; // tap or a gesture that resolved to scrolling — no commit
    const raw = e.clientX - startX;
    const clamped = clampForState(state.habits[i], raw);
    const next = resolveNewState(state.habits[i], clamped);
    state.habits[i] = next;
    state.recorded = false;
    // force reflow so the transition (re-enabled by removing .dragging) applies
    void row.offsetWidth;
    applySettled(next);
    updateTotals();
  }

  row.addEventListener("pointerup", endDrag);
  row.addEventListener("pointercancel", endDrag);

  return row;
}

function renderHabits() {
  habitList.innerHTML = "";
  habits.forEach((h, i) => habitList.appendChild(buildRow(h, i)));
}

function updateTotals() {
  const habitPoints = state.habits.filter((s) => s === true).length;
  const total = (state.nutrition ?? 0) + habitPoints;

  pointsNum.textContent = total;
  pointsNum.classList.add("bump");
  setTimeout(() => pointsNum.classList.remove("bump"), 150);

  recordBtn.classList.remove("ready", "saved");
  if (state.recorded) {
    recordBtn.textContent = "Recorded!";
    recordBtn.classList.add("saved");
  } else if (total > 0) {
    recordBtn.textContent = `Record ${total} Point${total === 1 ? "" : "s"}`;
    recordBtn.classList.add("ready");
  } else {
    recordBtn.textContent = "Record Points";
  }
}

function renderNutrition() {
  [...nutritionScale.children].forEach((btn) => {
    const val = Number(btn.dataset.val);
    btn.classList.toggle("active", state.nutrition !== null && val <= state.nutrition);
  });
}

nutritionScale.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const val = Number(btn.dataset.val);
  state.nutrition = state.nutrition === val ? null : val;
  state.recorded = false;
  renderNutrition();
  updateTotals();
});

recordBtn.addEventListener("click", () => {
  const habitPoints = state.habits.filter((s) => s === true).length;
  const total = (state.nutrition ?? 0) + habitPoints;
  if (total > 0 && !state.recorded) {
    state.recorded = true;
    updateTotals();
    sessionStorage.setItem("habitPoints", total);
    setTimeout(() => {
      window.location.href = "confirmation.html";
    }, 400); // brief pause so "Recorded!" is visible before the screen changes
  }
});

renderHabits();
renderNutrition();
updateTotals();
