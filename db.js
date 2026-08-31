require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "Eksik yapılandırma: .env dosyasında SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY tanımlı olmalı.",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------- Şifre yardımcıları ----------
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${hash}:${salt}`;
}

function verifyPassword(password, stored) {
  const [hash, salt] = stored.split(":");
  const candidate = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(
    Buffer.from(hash, "hex"),
    Buffer.from(candidate, "hex"),
  );
}

// ---------- Varsayılan verileri oluştur ----------
async function seed() {
  const { data: users } = await supabase.from("users").select("id, username");
  if (!users || !users.some((u) => u.username === "saim")) {
    await supabase.from("users").insert({
      username: "saim",
      password_hash: hashPassword("evciler6311"),
      full_name: "Apartman Yöneticisi",
    });
  }

  const { data: apts } = await supabase
    .from("apartments")
    .select("id")
    .limit(1);
  if (!apts || apts.length === 0) {
    const rows = [];
    for (let i = 1; i <= 10; i++) {
      rows.push({
        no: i,
        owner: i === 9 ? "Yönetici" : "",
        is_manager: i === 9 ? 1 : 0,
      });
    }
    await supabase.from("apartments").insert(rows);
  } else {
    // Yönetici dairesi her zaman 9 numaradır
    await supabase.from("apartments").update({ is_manager: 0 }).neq("id", 0);
    await supabase.from("apartments").update({ is_manager: 1 }).eq("no", 9);
    const { data: apt9 } = await supabase
      .from("apartments")
      .select("owner")
      .eq("no", 9)
      .maybeSingle();
    if (apt9 && !apt9.owner) {
      await supabase
        .from("apartments")
        .update({ owner: "Yönetici" })
        .eq("no", 9);
    }
    await supabase
      .from("apartments")
      .update({ owner: "" })
      .eq("no", 1)
      .eq("owner", "Yönetici");
  }

  const { data: settings } = await supabase.from("settings").select("key");
  const keys = new Set((settings || []).map((s) => s.key));
  const rows = [];
  if (!keys.has("aidat_amount")) rows.push({ key: "aidat_amount", value: "0" });
  if (!keys.has("opening_balance"))
    rows.push({ key: "opening_balance", value: "0" });
  if (rows.length) await supabase.from("settings").insert(rows);
}

module.exports = { supabase, hashPassword, verifyPassword, seed };
