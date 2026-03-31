process.on('uncaughtException', console.error);
process.on('unhandledRejection', console.error);

const express = require("express");
const mysql = require("mysql2");
const PDFDocument = require("pdfkit");
const fs = require("fs");

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));


// ======================
// MYSQL UNIVERSAL (LOCAL + RAILWAY)
// ======================
let db;

if (process.env.MYSQL_URL) {
  console.log("🌍 Railway DB");

  db = mysql.createConnection(process.env.MYSQL_URL);

} else {
  console.log("💻 Local DB");

  db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "fr@ctales", // CAMBIA si es diferente
    database: "cupones_db"
  });
}

db.connect(err => {
  if (err) {
    console.error("❌ MySQL error:", err);
    return;
  }
  console.log("✅ MySQL conectado");
});


// ======================
// ROOT (MUY IMPORTANTE)
// ======================
app.get("/", (req, res) => {
  res.send("✅ API funcionando correctamente");
});


// ======================
// FORMULARIO
// ======================
app.get("/app", (req, res) => {
  res.send(`
  <html>
  <body style="background:#000;color:white;text-align:center;font-family:sans-serif">
    <h2>🎟️ Generar Cupón</h2>

    <form method="POST" action="/generar">
      <input name="nombre" placeholder="Nombre" required><br><br>
      <input name="telefono" placeholder="Teléfono" required><br><br>
      <input name="dpi" placeholder="DPI" required><br><br>
      <input name="compra" placeholder="Monto compra" required><br><br>
      <button>Generar</button>
    </form>

    <br>
    <a href="/admin" style="color:gold;">Panel Admin</a>
  </body>
  </html>
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
      return res.send("Compra insuficiente");
    }

    let html = `<body style="background:#000;text-align:center;color:white">`;

    for (let i = 0; i < cantidad; i++) {

      const [result] = await db.promise().query(
        "INSERT INTO cupones (cliente, telefono, dpi, monto, codigo, usado) VALUES (?, ?, ?, ?, ?, 0)",
        [nombre, telefono, dpi, monto, "temp"]
      );

      const id = result.insertId;
      const codigo = "2026" + String(id).padStart(4, "0");

      await db.promise().query(
        "UPDATE cupones SET codigo=? WHERE id=?",
        [codigo, id]
      );

      html += `
      <div style="margin:20px;padding:20px;border:2px solid gold">
        <h2>${codigo}</h2>
        <p>${nombre}</p>
        <a href="/pdf/${codigo}">Descargar PDF</a>
      </div>
      `;
    }

    res.send(html);

  } catch (e) {
    console.error(e);
    res.send("Error generando");
  }
});


// ======================
// PDF (SIN ERRORES)
// ======================
app.get("/pdf/:codigo", async (req, res) => {
  try {
    const codigo = req.params.codigo;

    const [rows] = await db.promise().query(
      "SELECT * FROM cupones WHERE codigo=?",
      [codigo]
    );

    if (!rows.length) return res.send("No existe");

    const c = rows[0];

    const doc = new PDFDocument({
      size: [500, 250],
      margin: 0
    });

    res.setHeader("Content-Type", "application/pdf");
    doc.pipe(res);

    doc.font("Helvetica")
      .fontSize(25)
      .text("CUPÓN", 0, 80, { align: "center" });

    doc.fontSize(20)
      .text(codigo, 0, 120, { align: "center" });

    doc.fontSize(14)
      .text(c.cliente, 0, 160, { align: "center" });

    doc.end();

  } catch (error) {
    console.error(error);
    res.send("Error PDF");
  }
});


// ======================
// ADMIN
// ======================
app.get("/admin", async (req, res) => {
  try {
    const [rows] = await db.promise().query("SELECT * FROM cupones ORDER BY id DESC");

    let lista = rows.map(c => `
      <tr>
        <td>${c.codigo}</td>
        <td>${c.cliente}</td>
        <td>${c.telefono}</td>
        <td>${c.dpi}</td>
        <td>${c.monto}</td>
      </tr>
    `).join("");

    res.send(`
    <body style="background:#000;color:white;text-align:center">
      <h1>Admin</h1>
      <table border="1" style="margin:auto">
        ${lista}
      </table>
    </body>
    `);

  } catch (e) {
    res.send("Error admin");
  }
});


// ======================
const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log("🚀 Servidor en puerto " + PORT);
});