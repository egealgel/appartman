# appartman

Tek kullanıcılı, apartman yöneticisi için gelir/gider takip web uygulaması. Veriler Supabase (PostgreSQL) üzerinde bulutta saklanır.

## Özellikler

- 🔐 Şifre korumalı tek yönetici girişi
- 📊 Ana panel: aylık toplam gelir, gider, kasa bakiyesi ve aidat ödeme durumu
- 🏠 Daire yönetimi (10 daire: 1 yönetici (Daire 9) + 9 sakin; yönetici dairesi aidat ödemez)
- 💰 Gelirler: Aidat ve Ek Gelir (asansör tamiri, bakım vb.)
- 🧾 Giderler: Temizlik (havale), Elektrik (otomatik ödeme), Su (otomatik ödeme), Diğer Gider
- 📈 Aylık gelir/gider dağılım raporları
- ⬇ Excel indirme: aylık gelir/gider raporu .xlsx olarak indirilebilir
- 🏦 Devir bakiyesi: uygulamadan önce bankada kalan tutar kasaya eklenir
- ⚙️ Aidat tutarı ve şifre değiştirme ayarları
- 📱 Mobil uyumlu arayüz (dokunmatik hedefler, mobil ay seçici)

## Teknoloji

- Node.js + Express
- Supabase (PostgreSQL) — veriler merkezi olarak bulutta saklanır
- Express session ile oturum yönetimi
- Şifreler `crypto.scrypt` ile tuzlanarak (salt) saklanır

