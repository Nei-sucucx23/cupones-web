const express = require("express");
const mysql = require("mysql2");
const QRCode = require("qrcode");
const PDFDocument = require("pdfkit");

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// 🌍 PEGA TU LINK NGROK AQUÍ
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

const db = mysql.createConnection({
  host: process.env.MYSQLHOST || process.env.DB_HOST,
  user: process.env.MYSQLUSER || process.env.DB_USER,
  password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD,
  database: process.env.MYSQLDATABASE || process.env.DB_NAME,
  port: process.env.MYSQLPORT || process.env.DB_PORT
});

db.connect((err) => {
  if (err) {
    console.log("❌ ERROR DB:", err);
  } else {
    console.log("✅ CONECTADO A MYSQL");
  }
});

console.log("HOST:", process.env.MYSQLHOST);
console.log("USER:", process.env.MYSQLUSER);

// ======================
// FORMULARIO
// ======================
app.get("/", (req, res) => {
  res.send(`
    <html>
    <head>
      <style>
        body {
          font-family: Arial;
          text-align: center;
          background: linear-gradient(135deg, #0f2027, #2c5364);
          color: white;
        }
        .card {
          background: white;
          color: black;
          padding: 20px;
          border-radius: 15px;
          max-width: 320px;
          margin: auto;
          margin-top: 50px;
        }
        input, button {
          width: 90%;
          padding: 10px;
          margin: 10px;
          border-radius: 8px;
        }
        button {
          background: #2c5364;
          color: white;
          border: none;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <h2>🎟️ Generar Cupón</h2>
        <form method="POST" action="/generar">
          <input name="nombre" placeholder="Nombre" required/>
          <input name="telefono" placeholder="Teléfono" required/>
          <input name="compra" placeholder="Monto de compra" required/>
          <button>Generar</button>
        </form>
      </div>
    </body>
    </html>
  `);
});

// ======================
// GENERAR CUPONES
// ======================
app.post("/generar", async (req, res) => {
  const { nombre, telefono, compra } = req.body;

  try {
    const monto = parseFloat(compra);

    let cantidad = Math.floor(monto / 75);
    cantidad = Math.min(cantidad, 10);

    if (cantidad <= 0) {
      return res.send("<h2>❌ Compra insuficiente</h2>");
    }

    let html = `<h2 style="color:white;">Cupones generados: ${cantidad}</h2>`;

    for (let i = 0; i < cantidad; i++) {

      const result = await db.promise().query(
        "INSERT INTO cupones(cliente_id, codigo, usado) VALUES (?, ?, 0)",
        [1, "temp"]
      );

      const id = result[0].insertId;
      const codigo = "2026" + String(id).padStart(3, "0");

      await db.promise().query(
        "UPDATE cupones SET codigo=? WHERE id=?",
        [codigo, id]
      );

      const url = `${BASE_URL}/validar/${codigo}`;
      const qr = await QRCode.toDataURL(url);

      html += `
        <div style="background:white; margin:10px; padding:10px; border-radius:10px;">
          <h3>${codigo}</h3>
          <a href="${url}" target="_blank">Descargar PDF</a><br>
          <img src="${qr}" width="120"/>
        </div>
      `;
    }

    res.send(html);

  } catch (error) {
    console.log(error);
    res.send("Error generando cupones");
  }
});

// ======================
// VALIDAR + PDF
// ======================
app.get("/validar/:codigo", async (req, res) => {
  const codigo = req.params.codigo;

  const [rows] = await db.promise().query(
    "SELECT * FROM cupones WHERE codigo=?",
    [codigo]
  );

  if (rows.length === 0) {
    return res.send("<h2>❌ Cupón no válido</h2>");
  }

  const cupon = rows[0];

  if (cupon.usado == 1) {
    return res.send("<h2>⚠️ Este cupón ya fue usado</h2>");
  }

  // ❗ IMPORTANTE: NO marcar usado aquí

  const doc = new PDFDocument({
    size: [300, 150],
    margin: 0
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=${codigo}.pdf`);

  doc.pipe(res);

  // FONDO
  try {
    doc.image("fondo.png", 0, 0, { width: 300, height: 150 });
  } catch {
    doc.rect(0, 0, 300, 150).fill("#111");
  }

  // OVERLAY OSCURO
  doc.rect(0, 0, 300, 150)
    .fillOpacity(0.4)
    .fill("black");

  doc.fillOpacity(1);

  // BORDE
  doc.rect(5, 5, 290, 140)
    .lineWidth(2)
    .stroke("#FFD700");

  // LOGO (TRANSPARENTE PNG)
  try {
    doc.image("logo.png", 15, 15, { width: 40 });
  } catch {}

  // TITULO
  doc.fillColor("#FFD700")
    .fontSize(14)
    .text("CUPÓN OFICIAL", 70, 20);

  // SUBTITULO
  doc.fillColor("white")
    .fontSize(9)
    .text("EVENTO PROMOCIONAL", 70, 40);

  // LINEA
  doc.moveTo(10, 60).lineTo(290, 60).stroke("white");

  // CODIGO
  doc.fillColor("#FFD700")
    .fontSize(22)
    .text(codigo, 20, 75);

  // TEXTO
  doc.fillColor("white")
    .fontSize(8)
    .text("Escanea para reclamar tu premio", 20, 110);

  // EFECTO BOLETO
  for (let i = 0; i < 300; i += 10) {
    doc.circle(i, 148, 2).fill("#FFD700");
  }

  doc.end();
});

// ======================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Servidor corriendo en puerto", PORT);
});