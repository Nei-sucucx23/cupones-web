const express = require("express");
const mysql = require("mysql2");

const app = express();
app.use(express.urlencoded({ extended: true }));

// ======================
// CONEXIÓN MYSQL (RAILWAY)
// ======================
let db;

if (process.env.MYSQL_URL) {
  console.log("🌍 Conectando a Railway DB");

  const url = new URL(process.env.MYSQL_URL);

  db = mysql.createConnection({
    host: url.hostname,
    port: url.port,
    user: url.username,
    password: url.password,
    database: url.pathname.replace("/", ""),
    ssl: { rejectUnauthorized: false }
  });

} else {
  console.log("💻 Conectando a DB local");

  db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "fr@ctales",
    database: "cupones_db"
  });
}

// PROBAR CONEXIÓN
db.connect(err => {
  if (err) {
    console.error("❌ Error MySQL:", err);
  } else {
    console.log("✅ MySQL conectado");
  }
});

// ======================
// RUTAS
// ======================
app.get("/", (req, res) => {
  res.send(`
    <h2>🎟️ Sistema de Cupones</h2>

    <form method="POST" action="/guardar">
      <input name="nombre" placeholder="Nombre" required><br><br>
      <button>Guardar en DB</button>
    </form>

    <br><a href="/ver">Ver registros</a>
  `);
});

// GUARDAR
app.post("/guardar", (req, res) => {
  const { nombre } = req.body;

  db.query(
    "INSERT INTO cupones (cliente) VALUES (?)",
    [nombre],
    (err) => {
      if (err) {
        console.error(err);
        return res.send("❌ Error guardando");
      }

      res.send("✅ Guardado correctamente");
    }
  );
});

// VER DATOS
app.get("/ver", (req, res) => {
  db.query("SELECT * FROM cupones", (err, rows) => {
    if (err) return res.send("Error");

    let lista = rows.map(r => `<li>${r.cliente}</li>`).join("");

    res.send(`
      <h2>📋 Registros</h2>
      <ul>${lista}</ul>
      <a href="/">Volver</a>
    `);
  });
});

// ======================
const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log("🚀 Servidor en " + PORT);
});