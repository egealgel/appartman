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

## Kurulum

### 1. Supabase projesi oluşturun

1. https://supabase.com adresinde hesap açıp yeni bir proje oluşturun.
2. SQL Editor'ü açın ve `supabase/schema.sql` dosyasındaki komutları çalıştırın (tabloları oluşturur).

### 2. Ortam değişkenlerini ayarlayın

`.env.example` dosyasını `.env` olarak kopyalayın ve bilgileri girin:

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=service_role-anahtariniz
PORT=3000
SESSION_SECRET=rastgele-uzun-bir-gizli-anahtar
```

`SUPABASE_URL` ve `SUPABASE_SERVICE_ROLE_KEY` bilgilerini Supabase Dashboard → Project Settings → API bölümünden alabilirsiniz. Service role anahtarı yalnızca sunucu tarafında kullanılır, istemciye asla gönderilmez.

### 3. Çalıştırın

```bash
npm install
npm start
```

Tarayıcıda http://localhost:3000 adresini açın.

## Varsayılan giriş bilgileri

- Kullanıcı adı: `saim`
- Şifre: `evciler6311`

> İlk girişten sonra **Ayarlar → Şifre Değiştir** bölümünden şifreyi mutlaka değiştirin.

## Geliştirme modu

```bash
npm run dev
```

## Yayınlama (deploy)

Uygulama Render, Fly.io, Railway gibi bir servise deploy edilebilir. Ortam değişkenlerini
(`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`) orada da tanımlayın.
