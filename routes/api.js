const express = require("express");
const ExcelJS = require("exceljs");
const { supabase, hashPassword, verifyPassword } = require("../db");

const router = express.Router();

const INCOME_CATEGORIES = ["aidat", "ek"];
const EXPENSE_CATEGORIES = ["temizlik", "elektrik", "su", "diger"];

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  return res.status(401).json({ error: "Oturum açmanız gerekiyor." });
}

function monthOf(dateStr) {
  return String(dateStr).slice(0, 7);
}

function handleError(res, err) {
  console.error(err);
  return res
    .status(500)
    .json({ error: (err && err.message) || "Bir hata oluştu." });
}

// ---------- Kimlik doğrulama ----------
router.post("/login", async (req, res) => {
  const { username, password } = req.body || {};
  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("username", String(username || ""))
    .maybeSingle();
  if (error) return handleError(res, error);
  if (!user || !verifyPassword(String(password || ""), user.password_hash)) {
    return res.status(401).json({ error: "Kullanıcı adı veya şifre hatalı." });
  }
  req.session.userId = user.id;
  res.json({ username: user.username, full_name: user.full_name });
});

router.post("/logout", requireAuth, (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get("/me", async (req, res) => {
  if (!req.session.userId)
    return res.status(401).json({ error: "Giriş yapılmamış." });
  const { data: user, error } = await supabase
    .from("users")
    .select("username, full_name")
    .eq("id", req.session.userId)
    .maybeSingle();
  if (error) return handleError(res, error);
  res.json(user || {});
});

// ---------- Ayarlar ----------
router.get("/settings", requireAuth, async (req, res) => {
  const { data, error } = await supabase.from("settings").select("key, value");
  if (error) return handleError(res, error);
  const map = {};
  for (const row of data || []) map[row.key] = row.value;
  res.json({
    aidat_amount: map.aidat_amount ? Number(map.aidat_amount) : 0,
    opening_balance: map.opening_balance ? Number(map.opening_balance) : 0,
  });
});

router.put("/settings", requireAuth, async (req, res) => {
  const { aidat_amount, opening_balance } = req.body || {};
  const updates = [];
  if (aidat_amount !== undefined) {
    const amount = Number(aidat_amount);
    if (isNaN(amount) || amount < 0) {
      return res.status(400).json({ error: "Geçerli bir aidat tutarı girin." });
    }
    updates.push({ key: "aidat_amount", value: String(amount) });
  }
  if (opening_balance !== undefined) {
    const ob = Number(opening_balance);
    if (isNaN(ob) || ob < 0) {
      return res
        .status(400)
        .json({ error: "Geçerli bir devir bakiyesi girin." });
    }
    updates.push({ key: "opening_balance", value: String(ob) });
  }
  if (!updates.length) {
    return res.status(400).json({ error: "Güncellenecek bir değer yok." });
  }
  const { error } = await supabase
    .from("settings")
    .upsert(updates, { onConflict: "key" });
  if (error) return handleError(res, error);
  res.json({ ok: true });
});

router.put("/password", requireAuth, async (req, res) => {
  const { current_password, new_password } = req.body || {};
  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", req.session.userId)
    .maybeSingle();
  if (error) return handleError(res, error);
  if (
    !user ||
    !verifyPassword(String(current_password || ""), user.password_hash)
  ) {
    return res.status(400).json({ error: "Mevcut şifre hatalı." });
  }
  if (!new_password || String(new_password).length < 4) {
    return res
      .status(400)
      .json({ error: "Yeni şifre en az 4 karakter olmalı." });
  }
  const { error: updErr } = await supabase
    .from("users")
    .update({ password_hash: hashPassword(String(new_password)) })
    .eq("id", user.id);
  if (updErr) return handleError(res, updErr);
  res.json({ ok: true });
});

// ---------- Daireler ----------
router.get("/apartments", requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from("apartments")
    .select("*")
    .order("is_manager", { ascending: false })
    .order("no", { ascending: true });
  if (error) return handleError(res, error);
  res.json(data || []);
});

router.post("/apartments", requireAuth, async (req, res) => {
  const { no, owner, phone, note, is_manager } = req.body || {};
  const num = Number(no);
  if (!no || isNaN(num))
    return res.status(400).json({ error: "Daire numarası gerekli." });
  const { data, error } = await supabase
    .from("apartments")
    .insert({
      no: num,
      owner: String(owner || ""),
      phone: String(phone || ""),
      note: String(note || ""),
      is_manager: is_manager ? 1 : 0,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505")
      return res
        .status(400)
        .json({ error: "Bu daire numarası zaten kayıtlı." });
    return handleError(res, error);
  }
  res.status(201).json({ id: data.id });
});

router.put("/apartments/:id", requireAuth, async (req, res) => {
  const { no, owner, phone, note, is_manager } = req.body || {};
  const num = Number(no);
  if (!no || isNaN(num))
    return res.status(400).json({ error: "Daire numarası gerekli." });
  const { error } = await supabase
    .from("apartments")
    .update({
      no: num,
      owner: String(owner || ""),
      phone: String(phone || ""),
      note: String(note || ""),
      is_manager: is_manager ? 1 : 0,
    })
    .eq("id", Number(req.params.id));
  if (error) {
    if (error.code === "23505")
      return res
        .status(400)
        .json({ error: "Bu daire numarası zaten kayıtlı." });
    return handleError(res, error);
  }
  res.json({ ok: true });
});

router.delete("/apartments/:id", requireAuth, async (req, res) => {
  const { error } = await supabase
    .from("apartments")
    .delete()
    .eq("id", Number(req.params.id));
  if (error) return handleError(res, error);
  res.json({ ok: true });
});

// ---------- İşlemler (gelir / gider) ----------
router.get("/transactions", requireAuth, async (req, res) => {
  const { month } = req.query;
  let query = supabase
    .from("transactions")
    .select("*, apartments(no)")
    .order("date", { ascending: false })
    .order("id", { ascending: false });
  if (month) query = query.eq("month", String(month));
  else query = query.limit(200);
  const { data, error } = await query;
  if (error) return handleError(res, error);
  const rows = (data || []).map((t) => ({
    ...t,
    apartment_no: t.apartments ? t.apartments.no : null,
  }));
  res.json(rows);
});

router.post("/transactions", requireAuth, async (req, res) => {
  const { type, category, amount, description, date, apartment_id } =
    req.body || {};
  if (!["income", "expense"].includes(type))
    return res.status(400).json({ error: "Geçersiz işlem tipi." });
  if (!category || typeof category !== "string")
    return res.status(400).json({ error: "Kategori gerekli." });
  if (type === "income" && !INCOME_CATEGORIES.includes(category))
    return res.status(400).json({ error: "Geçersiz gelir kategorisi." });
  if (type === "expense" && !EXPENSE_CATEGORIES.includes(category))
    return res.status(400).json({ error: "Geçersiz gider kategorisi." });
  const amt = Number(amount);
  if (isNaN(amt) || amt <= 0)
    return res.status(400).json({ error: "Geçerli bir tutar girin." });
  if (!date) return res.status(400).json({ error: "Tarih gerekli." });

  if (type === "income" && category === "aidat" && apartment_id) {
    const { data: apt, error: aptErr } = await supabase
      .from("apartments")
      .select("is_manager")
      .eq("id", Number(apartment_id))
      .maybeSingle();
    if (aptErr) return handleError(res, aptErr);
    if (apt && apt.is_manager)
      return res.status(400).json({ error: "Yönetici dairesi aidat ödemez." });
  }

  const { data, error } = await supabase
    .from("transactions")
    .insert({
      type,
      category,
      amount: amt,
      description: String(description || ""),
      date: String(date),
      month: monthOf(date),
      apartment_id: apartment_id ? Number(apartment_id) : null,
    })
    .select("id")
    .single();
  if (error) return handleError(res, error);
  res.status(201).json({ id: data.id });
});

router.delete("/transactions/:id", requireAuth, async (req, res) => {
  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", Number(req.params.id));
  if (error) return handleError(res, error);
  res.json({ ok: true });
});

// ---------- Özet ----------
router.get("/summary", requireAuth, async (req, res) => {
  const { month } = req.query;
  if (!month) return res.status(400).json({ error: "Ay parametresi gerekli." });
  const m = String(month);

  const [aptRes, txRes, setRes] = await Promise.all([
    supabase
      .from("apartments")
      .select("*")
      .order("is_manager", { ascending: false })
      .order("no", { ascending: true }),
    supabase
      .from("transactions")
      .select("type, category, amount, apartment_id, month")
      .lte("month", m),
    supabase.from("settings").select("key, value"),
  ]);
  if (aptRes.error) return handleError(res, aptRes.error);
  if (txRes.error) return handleError(res, txRes.error);
  if (setRes.error) return handleError(res, setRes.error);

  let openingBalance = 0;
  for (const row of setRes.data || []) {
    if (row.key === "opening_balance") openingBalance = Number(row.value);
  }

  const txns = txRes.data || [];
  let incomeTotal = 0;
  let expenseTotal = 0;
  let cumIncome = 0;
  let cumExpense = 0;
  const paidSet = new Set();
  for (const t of txns) {
    const amt = Number(t.amount);
    if (t.type === "income") cumIncome += amt;
    else cumExpense += amt;
    if (t.month === m) {
      if (t.type === "income") incomeTotal += amt;
      else expenseTotal += amt;
      if (
        t.type === "income" &&
        t.category === "aidat" &&
        t.apartment_id != null
      ) {
        paidSet.add(t.apartment_id);
      }
    }
  }

  const apartments = aptRes.data || [];
  const aptList = apartments.map((a) => ({ ...a, paid: paidSet.has(a.id) }));
  const payers = aptList.filter((a) => !a.is_manager);

  res.json({
    month: m,
    income_total: incomeTotal,
    expense_total: expenseTotal,
    opening_balance: openingBalance,
    balance: openingBalance + cumIncome - cumExpense,
    apartments: aptList,
    paid_count: payers.filter((a) => a.paid).length,
    total_count: payers.length,
  });
});

// ---------- Rapor ----------
router.get("/report", requireAuth, async (req, res) => {
  const { month } = req.query;
  if (!month) return res.status(400).json({ error: "Ay parametresi gerekli." });
  const m = String(month);

  const { data, error } = await supabase
    .from("transactions")
    .select("type, category, amount, apartments(no)")
    .eq("month", m);
  if (error) return handleError(res, error);

  const incomeMap = {};
  const expenseMap = {};
  const aidatMap = {};

  for (const t of data || []) {
    const amt = Number(t.amount);
    if (t.type === "income") {
      incomeMap[t.category] = incomeMap[t.category] || { total: 0, count: 0 };
      incomeMap[t.category].total += amt;
      incomeMap[t.category].count += 1;
      if (t.category === "aidat" && t.apartments) {
        const no = t.apartments.no;
        aidatMap[no] = (aidatMap[no] || 0) + amt;
      }
    } else {
      expenseMap[t.category] = expenseMap[t.category] || { total: 0, count: 0 };
      expenseMap[t.category].total += amt;
      expenseMap[t.category].count += 1;
    }
  }

  const incomeByCat = Object.entries(incomeMap).map(([category, v]) => ({
    category,
    total: v.total,
    count: v.count,
  }));
  const expenseByCat = Object.entries(expenseMap).map(([category, v]) => ({
    category,
    total: v.total,
    count: v.count,
  }));
  const aidatByApt = Object.entries(aidatMap)
    .map(([no, total]) => ({ no: Number(no), total }))
    .sort((a, b) => a.no - b.no);

  res.json({ month: m, incomeByCat, expenseByCat, aidatByApt });
});

// ---------- Excel dışa aktarma ----------
router.get("/export", requireAuth, async (req, res) => {
  const { month } = req.query;
  if (!month) return res.status(400).json({ error: "Ay parametresi gerekli." });
  const m = String(month);

  const [txRes, setRes] = await Promise.all([
    supabase
      .from("transactions")
      .select("*, apartments(no)")
      .eq("month", m)
      .order("date", { ascending: true })
      .order("id", { ascending: true }),
    supabase.from("settings").select("key, value"),
  ]);
  if (txRes.error) return handleError(res, txRes.error);
  if (setRes.error) return handleError(res, setRes.error);

  const CAT_LABELS = {
    aidat: "Aidat",
    ek: "Ek Gelir",
    temizlik: "Temizlik",
    elektrik: "Elektrik",
    su: "Su",
    diger: "Diğer Gider",
  };
  const TX_TYPES = { income: "Gelir", expense: "Gider" };

  const txns = txRes.data || [];
  const settings = setRes.data || [];
  let opening = 0;
  for (const row of settings) {
    if (row.key === "opening_balance") opening = Number(row.value);
  }

  let income = 0;
  let expense = 0;
  for (const t of txns) {
    if (t.type === "income") income += Number(t.amount);
    else expense += Number(t.amount);
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "appartman";

  const ws = wb.addWorksheet("İşlemler");
  ws.columns = [
    { header: "Tarih", key: "date", width: 14 },
    { header: "Tür", key: "type", width: 10 },
    { header: "Kategori", key: "category", width: 18 },
    { header: "Açıklama", key: "description", width: 32 },
    { header: "Daire", key: "apartment", width: 10 },
    { header: "Tutar (₺)", key: "amount", width: 14 },
  ];
  for (const t of txns) {
    ws.addRow({
      date: t.date,
      type: TX_TYPES[t.type] || t.type,
      category: CAT_LABELS[t.category] || t.category,
      description: t.description || "",
      apartment: t.apartments ? String(t.apartments.no) : "",
      amount: t.type === "income" ? Number(t.amount) : -Number(t.amount),
    });
  }
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2563EB" },
  };
  ws.getColumn("amount").numFmt = "#,##0.00";

  const ws2 = wb.addWorksheet("Özet");
  ws2.columns = [
    { header: "Başlık", key: "label", width: 22 },
    { header: "Değer", key: "value", width: 16 },
  ];
  ws2.addRow({ label: "Ay", value: m });
  ws2.addRow({ label: "Devir (önceden kalan)", value: opening });
  ws2.addRow({ label: "Toplam Gelir", value: income });
  ws2.addRow({ label: "Toplam Gider", value: expense });
  ws2.addRow({ label: "Kasa / Bakiye", value: opening + income - expense });
  ws2.getRow(1).font = { bold: true };
  ws2.getColumn("value").numFmt = "#,##0.00";

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="apartman-rapor-${m}.xlsx"`,
  );
  await wb.xlsx.write(res);
  res.end();
});

module.exports = router;
