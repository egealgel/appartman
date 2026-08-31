require("dotenv").config();

const express = require("express");
const session = require("express-session");
const path = require("path");
const { seed } = require("./db");
const api = require("./routes/api");

const app = express();

app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "apartman-gizli-anahtar-degistirin",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 gün
    },
  }),
);

app.use("/api", api);
app.use(express.static(path.join(__dirname, "public")));

(async () => {
  await seed();
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Apartman uygulaması çalışıyor: http://localhost:${PORT}`);
  });
})().catch((err) => {
  console.error("Uygulama başlatılamadı:", err);
  process.exit(1);
});
