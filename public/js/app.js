// ---------- Sabitler ve yardımcılar ----------
const CATEGORY_LABELS = {
  aidat: "Aidat",
  ek: "Ek Gelir",
  temizlik: "Temizlik",
  elektrik: "Elektrik",
  su: "Su",
  diger: "Diğer Gider",
};

const fmt = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
});

function formatMoney(v) {
  return fmt.format(Number(v) || 0);
}

function localDateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function localMonthStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "\u0026amp;")
    .replace(/</g, "\u003Clt;")
    .replace(/>/g, "\u003Egt;")
    .replace(/"/g, "\u0026quot;")
    .replace(/'/g, "\u0026#39;");
}

async function api(path, options = {}) {
  const opts = { ...options };
  if (opts.body) {
    opts.headers = {
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    };
    opts.body = JSON.stringify(opts.body);
  }
  const res = await fetch("/api" + path, opts);
  if (res.status === 401) {
    showLogin();
    throw new Error("Oturum süresi doldu.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Bir hata oluştu.");
  return data;
}

function toast(message, type = "ok") {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.className = "toast show " + type;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    el.className = "toast";
  }, 3000);
}

// ---------- Durum ----------
const state = {
  month: localMonthStr(),
  apartments: [],
  aidatAmount: 0,
};

const $ = (id) => document.getElementById(id);

// ---------- Giriş / çıkış ----------
function showLogin() {
  $("app").classList.add("hidden");
  $("login-overlay").classList.remove("hidden");
}

function showApp() {
  $("login-overlay").classList.add("hidden");
  $("app").classList.remove("hidden");
}

$("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("login-error").textContent = "";
  try {
    await api("/login", {
      method: "POST",
      body: {
        username: $("login-username").value.trim(),
        password: $("login-password").value,
      },
    });
    showApp();
    await init();
  } catch (err) {
    $("login-error").textContent = err.message;
  }
});

$("logout-btn").addEventListener("click", async () => {
  try {
    await api("/logout", { method: "POST" });
  } catch (e) {
    /* yok say */
  }
  showLogin();
});

// ---------- Navigasyon ----------
const VIEW_TITLES = {
  dashboard: "Ana Panel",
  apartments: "Daireler",
  incomes: "Gelirler",
  expenses: "Giderler",
  reports: "Raporlar",
  settings: "Ayarlar",
};

const VIEW_RENDERERS = {
  dashboard: renderDashboard,
  apartments: renderApartments,
  incomes: renderIncomes,
  expenses: renderExpenses,
  reports: renderReports,
  settings: renderSettings,
};

document.querySelectorAll(".nav-item").forEach((item) => {
  item.addEventListener("click", (e) => {
    e.preventDefault();
    const view = item.dataset.view;
    document
      .querySelectorAll(".nav-item")
      .forEach((n) => n.classList.toggle("active", n === item));
    document
      .querySelectorAll(".view")
      .forEach((v) => v.classList.toggle("active", v.id === "view-" + view));
    $("view-title").textContent = VIEW_TITLES[view];
    (VIEW_RENDERERS[view] || (() => {}))();
  });
});

function currentView() {
  const active = document.querySelector(".view.active");
  return active ? active.id.replace("view-", "") : "dashboard";
}

function refreshCurrent() {
  (VIEW_RENDERERS[currentView()] || (() => {}))();
}

function buildMonthOptions() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 24, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 6, 1);
  const sel = $("month-picker");
  sel.innerHTML = "";
  const d = new Date(start);
  while (d <= end) {
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("tr-TR", {
      month: "long",
      year: "numeric",
    });
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent =
      label.charAt(0).toLocaleUpperCase("tr-TR") + label.slice(1);
    sel.appendChild(opt);
    d.setMonth(d.getMonth() + 1);
  }
}

function shiftMonth(delta) {
  const [y, m] = state.month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  state.month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  $("month-picker").value = state.month;
  refreshCurrent();
}

$("month-prev").addEventListener("click", () => shiftMonth(-1));
$("month-next").addEventListener("click", () => shiftMonth(1));
$("month-picker").addEventListener("change", (e) => {
  if (e.target.value) state.month = e.target.value;
  refreshCurrent();
});

// ---------- Ortak veri ----------
async function loadCommonData() {
  const [apartments, settings] = await Promise.all([
    api("/apartments"),
    api("/settings"),
  ]);
  state.apartments = apartments;
  state.aidatAmount = settings.aidat_amount;
}

function populateApartmentSelect(sel) {
  sel.innerHTML =
    '<option value="">— Seçin —</option>' +
    state.apartments
      .filter((a) => !a.is_manager)
      .map(
        (a) =>
          `<option value="${a.id}">Daire ${a.no}${a.owner ? " · " + esc(a.owner) : ""}</option>`,
      )
      .join("");
}

// ---------- İşlem satırı ----------
function txRow(tx) {
  const sign = tx.type === "income" ? "+" : "−";
  const cls = tx.type === "income" ? "income" : "expense";
  const label = CATEGORY_LABELS[tx.category] || tx.category;
  const apt = tx.apartment_no ? " · Daire " + tx.apartment_no : "";
  return `<div class="tx-row">
    <div class="tx-info">
      <span class="tx-cat ${cls}">${label}</span>
      ${tx.description ? `<span class="tx-desc">${esc(tx.description)}</span>` : ""}
      <span class="tx-meta">${esc(tx.date)}${apt}</span>
    </div>
    <div class="tx-amount ${cls}">${sign}${formatMoney(tx.amount)}</div>
    <button class="tx-delete" data-id="${tx.id}" title="Sil">🗑</button>
  </div>`;
}

// ---------- Ana Panel ----------
async function renderDashboard() {
  const [summary, txns] = await Promise.all([
    api("/summary?month=" + state.month),
    api("/transactions?month=" + state.month),
  ]);

  $("dash-income").textContent = formatMoney(summary.income_total);
  $("dash-expense").textContent = formatMoney(summary.expense_total);
  $("dash-balance").textContent = formatMoney(summary.balance);
  $("dash-balance").parentElement.className =
    "card " + (summary.balance >= 0 ? "balance" : "negative");
  $("dash-paid").textContent = `${summary.paid_count}/${summary.total_count}`;

  $("dash-apartments").innerHTML = summary.apartments
    .filter((a) => !a.is_manager)
    .map((a) => {
      const cls = a.paid ? "chip paid" : "chip unpaid";
      const mark = a.paid ? "✓" : "✗";
      return `<span class="${cls}" title="${esc(a.owner || "Daire " + a.no)}">${a.no} ${mark}</span>`;
    })
    .join("");

  $("dash-recent").innerHTML = txns.length
    ? txns.slice(0, 8).map(txRow).join("")
    : '<p class="empty">Bu ay henüz işlem yok.</p>';
}

// ---------- Daireler ----------
async function renderApartments() {
  const [apartments, summary] = await Promise.all([
    api("/apartments"),
    api("/summary?month=" + state.month),
  ]);
  state.apartments = apartments;
  const paidSet = new Set(
    summary.apartments.filter((a) => a.paid).map((a) => a.id),
  );

  $("apartments-tbody").innerHTML = apartments
    .map((a) => {
      const paid = paidSet.has(a.id);
      const status = a.is_manager
        ? '<span class="badge manager">Yönetici</span>'
        : `<span class="badge ${paid ? "paid" : "unpaid"}">${paid ? "Ödendi" : "Ödenmedi"}</span>`;
      const payButton =
        !a.is_manager && !paid
          ? `<button class="btn btn-sm btn-primary pay-btn" data-id="${a.id}" data-no="${a.no}">Aidat Al</button>`
          : "";
      return `<tr>
      <td class="apt-no">${a.no}</td>
      <td>${esc(a.owner) || '<span class="muted">—</span>'}</td>
      <td>${esc(a.phone) || '<span class="muted">—</span>'}</td>
      <td>${status}</td>
      <td class="actions">
        ${payButton}
        <button class="btn btn-sm btn-ghost edit-btn" data-id="${a.id}">Düzenle</button>
        <button class="btn btn-sm btn-danger del-apt-btn" data-id="${a.id}">Sil</button>
      </td>
    </tr>`;
    })
    .join("");
}

function openApartmentModal(id = null) {
  $("apartment-form").reset();
  $("apartment-id").value = "";
  if (id) {
    const a = state.apartments.find((x) => x.id === id);
    if (!a) return;
    $("apartment-modal-title").textContent = "Daireyi Düzenle";
    $("apartment-id").value = a.id;
    $("apartment-no").value = a.no;
    $("apartment-owner").value = a.owner || "";
    $("apartment-phone").value = a.phone || "";
    $("apartment-note").value = a.note || "";
    $("apartment-is-manager").checked = !!a.is_manager;
  } else {
    $("apartment-modal-title").textContent = "Yeni Daire";
    $("apartment-no").value = state.apartments.length
      ? Math.max(...state.apartments.map((a) => a.no)) + 1
      : 1;
    $("apartment-is-manager").checked = false;
  }
  $("apartment-modal").classList.remove("hidden");
}

function closeApartmentModal() {
  $("apartment-modal").classList.add("hidden");
}

$("add-apartment-btn").addEventListener("click", () => openApartmentModal());
$("apartment-modal-close").addEventListener("click", closeApartmentModal);
$("apartment-cancel").addEventListener("click", closeApartmentModal);
$("apartment-modal").addEventListener("click", (e) => {
  if (e.target === $("apartment-modal")) closeApartmentModal();
});

$("apartment-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = $("apartment-id").value;
  const body = {
    no: Number($("apartment-no").value),
    owner: $("apartment-owner").value.trim(),
    phone: $("apartment-phone").value.trim(),
    note: $("apartment-note").value.trim(),
    is_manager: $("apartment-is-manager").checked,
  };
  try {
    if (id) await api("/apartments/" + id, { method: "PUT", body });
    else await api("/apartments", { method: "POST", body });
    closeApartmentModal();
    toast("Daire kaydedildi.");
    renderApartments();
  } catch (err) {
    toast(err.message, "error");
  }
});

// ---------- Gelirler ----------
async function renderIncomes() {
  const txns = await api("/transactions?month=" + state.month);
  const incomes = txns.filter((t) => t.type === "income");
  $("income-list").innerHTML = incomes.length
    ? incomes.map(txRow).join("")
    : '<p class="empty">Bu ay gelir kaydı yok.</p>';
  populateApartmentSelect($("income-apartment"));
  $("income-date").value =
    state.month === localMonthStr() ? localDateStr() : `${state.month}-01`;
  const isAidat = $("income-category").value === "aidat";
  $("income-apartment-wrap").style.display = isAidat ? "block" : "none";
}

$("income-category").addEventListener("change", () => {
  const isAidat = $("income-category").value === "aidat";
  $("income-apartment-wrap").style.display = isAidat ? "block" : "none";
  if (isAidat) $("income-amount").value = state.aidatAmount || "";
});

$("income-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const category = $("income-category").value;
  const body = {
    type: "income",
    category,
    amount: Number($("income-amount").value),
    description: $("income-desc").value.trim(),
    date: $("income-date").value,
    apartment_id:
      category === "aidat" ? $("income-apartment").value || null : null,
  };
  try {
    await api("/transactions", { method: "POST", body });
    e.target.reset();
    toast("Gelir kaydedildi.");
    renderIncomes();
  } catch (err) {
    toast(err.message, "error");
  }
});

// ---------- Giderler ----------
async function renderExpenses() {
  const txns = await api("/transactions?month=" + state.month);
  const expenses = txns.filter((t) => t.type === "expense");
  $("expense-list").innerHTML = expenses.length
    ? expenses.map(txRow).join("")
    : '<p class="empty">Bu ay gider kaydı yok.</p>';
  $("expense-date").value =
    state.month === localMonthStr() ? localDateStr() : `${state.month}-01`;
}

$("expense-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const body = {
    type: "expense",
    category: $("expense-category").value,
    amount: Number($("expense-amount").value),
    description: $("expense-desc").value.trim(),
    date: $("expense-date").value,
  };
  try {
    await api("/transactions", { method: "POST", body });
    e.target.reset();
    toast("Gider kaydedildi.");
    renderExpenses();
  } catch (err) {
    toast(err.message, "error");
  }
});

// ---------- Raporlar ----------
function bars(rows, total, isIncome) {
  if (!rows.length) return '<p class="empty">Kayıt yok.</p>';
  return rows
    .map((r) => {
      const pct = total ? Math.round((r.total / total) * 100) : 0;
      const label = CATEGORY_LABELS[r.category] || r.category;
      return `<div class="bar-row">
      <div class="bar-label">${label}<div class="muted">${r.count} işlem</div></div>
      <div class="bar-track"><div class="bar-fill ${isIncome ? "income" : "expense"}" style="width:${pct}%"></div></div>
      <div class="bar-value">${formatMoney(r.total)}<div class="muted">%${pct}</div></div>
    </div>`;
    })
    .join("");
}

async function renderReports() {
  const report = await api("/report?month=" + state.month);
  const incomeTotal = report.incomeByCat.reduce((s, c) => s + c.total, 0);
  const expenseTotal = report.expenseByCat.reduce((s, c) => s + c.total, 0);
  $("report-income-bars").innerHTML = bars(
    report.incomeByCat,
    incomeTotal,
    true,
  );
  $("report-expense-bars").innerHTML = bars(
    report.expenseByCat,
    expenseTotal,
    false,
  );
}

async function downloadExcel() {
  try {
    const res = await fetch("/api/export?month=" + state.month);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Dosya indirilemedi.");
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `apartman-rapor-${state.month}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    toast(err.message, "error");
  }
}

$("export-btn").addEventListener("click", downloadExcel);

// ---------- Ayarlar ----------
async function renderSettings() {
  const settings = await api("/settings");
  $("aidat-amount").value = settings.aidat_amount;
  $("opening-balance").value = settings.opening_balance;
}

$("settings-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api("/settings", {
      method: "PUT",
      body: {
        aidat_amount: Number($("aidat-amount").value),
        opening_balance: Number($("opening-balance").value),
      },
    });
    state.aidatAmount = Number($("aidat-amount").value);
    toast("Ayarlar güncellendi.");
  } catch (err) {
    toast(err.message, "error");
  }
});

$("password-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api("/password", {
      method: "PUT",
      body: {
        current_password: $("current-password").value,
        new_password: $("new-password").value,
      },
    });
    e.target.reset();
    toast("Şifre güncellendi.");
  } catch (err) {
    toast(err.message, "error");
  }
});

// ---------- Global tıklama işlemleri ----------
document.addEventListener("click", async (e) => {
  const txDel = e.target.closest(".tx-delete");
  if (txDel) {
    if (!confirm("Bu işlemi silmek istediğinize emin misiniz?")) return;
    try {
      await api("/transactions/" + txDel.dataset.id, { method: "DELETE" });
      toast("İşlem silindi.");
      refreshCurrent();
    } catch (err) {
      toast(err.message, "error");
    }
    return;
  }

  const pay = e.target.closest(".pay-btn");
  if (pay) {
    const amount = state.aidatAmount || 0;
    if (
      !confirm(
        `Daire ${pay.dataset.no} için ${state.month} ayı aidatı (${formatMoney(amount)}) alınsın mı?`,
      )
    )
      return;
    try {
      await api("/transactions", {
        method: "POST",
        body: {
          type: "income",
          category: "aidat",
          amount,
          description: `${state.month} ayı aidatı`,
          date: `${state.month}-01`,
          apartment_id: Number(pay.dataset.id),
        },
      });
      toast(`Daire ${pay.dataset.no} aidatı kaydedildi.`);
      refreshCurrent();
    } catch (err) {
      toast(err.message, "error");
    }
    return;
  }

  const edit = e.target.closest(".edit-btn");
  if (edit) {
    openApartmentModal(Number(edit.dataset.id));
    return;
  }

  const delApt = e.target.closest(".del-apt-btn");
  if (delApt) {
    if (
      !confirm(
        "Daireyi silmek istediğinize emin misiniz? Geçmiş işlem kayıtları korunur.",
      )
    )
      return;
    try {
      await api("/apartments/" + delApt.dataset.id, { method: "DELETE" });
      toast("Daire silindi.");
      refreshCurrent();
    } catch (err) {
      toast(err.message, "error");
    }
  }
});

// ---------- Başlat ----------
async function init() {
  try {
    await api("/me");
    showApp();
    buildMonthOptions();
    $("month-picker").value = state.month;
    await loadCommonData();
    renderDashboard();
  } catch (e) {
    showLogin();
  }
}

init();
