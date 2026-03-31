const express = require("express");
const mysql = require("mysql2");

const app = express();
app.use(express.urlencoded({ extended: true }));

// ======================
// MYSQL
// ======================
let db;

if (process.env.MYSQL_URL) {
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
  db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "cupones_db"
  });
}

db.connect(err => {
  if (err) console.error(err);
  else console.log("✅ MySQL conectado");
});

// ======================
// FORMULARIO
// ======================
app.get("/", (req, res) => {
  res.send(`
    <body style="background:black;color:white;text-align:center;font-family:sans-serif">
      <h2>🎟️ Generar Cupones</h2>

      <form method="POST" action="/generar">
        <input name="nombre" placeholder="Nombre" required><br><br>
        <input name="telefono" placeholder="Teléfono" required><br><br>
        <input name="dpi" placeholder="DPI" required><br><br>
        <input name="compra" placeholder="Monto compra" required><br><br>
        <button>Generar</button>
      </form>

      <br><a href="/admin" style="color:gold;">Panel Admin</a>
    </body>
  `);
});

// ======================
// GENERAR CUPONES
// ======================
app.post("/generar", async (req, res) => {
  try {
    const { nombre, telefono, dpi, compra } = req.body;
    const monto = parseFloat(compra) || 0;

    let cantidad = Math.floor(monto / 75);
    if (cantidad > 10) cantidad = 10;

    if (cantidad <= 0) {
      return res.send("<h2 style='color:red'>Compra insuficiente</h2>");
    }

    let html = `<body style="background:black;text-align:center;color:white">`;

    for (let i = 0; i < cantidad; i++) {

      const [result] = await db.promise().query(
        "INSERT INTO cupones (cliente, telefono, dpi, monto, codigo) VALUES (?, ?, ?, ?, 'temp')",
        [nombre, telefono, dpi, monto]
      );

      const id = result.insertId;
      const codigo = "CUP-" + String(id).padStart(5, "0");

      await db.promise().query(
        "UPDATE cupones SET codigo=? WHERE id=?",
        [codigo, id]
      );

      html += `
        <div style="border:2px solid gold;margin:20px;padding:20px;border-radius:15px">
          <h2 style="color:gold">CUPÓN</h2>
          <h1>${codigo}</h1>
          <p>${nombre}</p>
        </div>
      `;
    }

    res.send(html);

  } catch (e) {
    console.error(e);
    res.send("❌ Error generando");
  }
});

// ======================
// ADMIN
// ======================
app.get("/admin", async (req, res) => {
  const [rows] = await db.promise().query("SELECT * FROM cupones ORDER BY id DESC");

  let lista = rows.map(c => `
    <tr>
      <td>${c.codigo}</td>
      <td>${c.cliente}</td>
      <td>Q${c.monto}</td>
      <td style="color:${c.usado ? 'red' : 'lime'}">
        ${c.usado ? 'USADO' : 'ACTIVO'}
      </td>
    </tr>
  `).join("");

  res.send(`
    <body style="background:black;color:white;text-align:center">
      <h1>📊 Panel Admin</h1>

      <table border="1" style="margin:auto">
        <tr>
          <th>Código</th>
          <th>Cliente</th>
          <th>Monto</th>
          <th>Estado</th>
        </tr>
        ${lista}
      </table>

      <br><a href="/" style="color:gold">Volver</a>
    </body>
  `);
});

// ======================
const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log("🚀 Servidor en " + PORT);
});