process.on('uncaughtException', console.error);
process.on('unhandledRejection', console.error);

const express = require("express");
const mysql = require("mysql2");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs"); // 👈 IMPORTANTE
const fs = require("fs");

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

let db;

try {
  console.log("Variables:");
  console.log("HOST:", process.env.MYSQLHOST);
  console.log("USER:", process.env.MYSQLUSER);
  console.log("DB:", process.env.MYSQLDATABASE);
  console.log("PORT:", process.env.MYSQLPORT);

  db = mysql.createConnection({
    host: process.env.MYSQLHOST,
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQL_DATABASE,
    port: process.env.MYSQLPORT,
    ssl: { rejectUnauthorized: false }
  });

  db.connect((err) => {
    if (err) {
      console.error("❌ ERROR CONECTANDO MYSQL:", err);
    } else {
      console.log("✅ MYSQL CONECTADO");
    }
  });

} catch (error) {
  console.error("❌ ERROR GENERAL MYSQL:", error);
}

// ======================
// HOME
// ======================
app.get("/", (req, res) => {
  res.send(`
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

    let html = `<body style="background:#000;text-align:center;font-family:sans-serif">`;

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
      <div style="width:420px;margin:20px auto;padding:20px;border:3px solid gold;border-radius:20px;color:white;">
        <h2 style="color:gold">CUPÓN OFICIAL</h2>
        <h1 style="color:#FFD700">${codigo}</h1>
        <p>${nombre}</p>

        <a href="/pdf/${codigo}" style="
          background:gold;
          color:black;
          padding:10px 20px;
          border-radius:10px;
          text-decoration:none;
          font-weight:bold;
        ">
          Descargar Cupón
        </a>
      </div>
      `;
    }

    res.send(html);

  } catch (e) {
    console.error("❌ ERROR GENERAR:", e);
    res.send("Error generando");
  }
});

// ======================
// PDF
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

    await db.promise().query(
      "UPDATE cupones SET usado=1 WHERE codigo=?",
      [codigo]
    );

    const doc = new PDFDocument({
      size: [500, 250],
      margin: 0
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=${codigo}.pdf`);

    doc.pipe(res);

    if (fs.existsSync("./fondo.jpg")) {
      doc.image("fondo.jpg", 0, 0, { width: 500 });
    }

    doc.fillColor("#ffffff")
      .fontSize(22)
      .text("CUPÓN OFICIAL", 0, 70, { align: "center" });

    doc.fontSize(28)
      .text(codigo, 0, 110, { align: "center" });

    doc.fontSize(14)
      .text(c.cliente, 0, 150, { align: "center" });

    doc.end();

  } catch (error) {
    console.error("❌ ERROR PDF:", error);
    res.send("Error PDF");
  }
});

// ======================
// BACKUP EXCEL
// ======================
app.get("/backup", async (req, res) => {
  try {
    const [rows] = await db.promise().query("SELECT * FROM cupones");

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Cupones");

    worksheet.columns = [
      { header: "ID", key: "id", width: 10 },
      { header: "Código", key: "codigo", width: 20 },
      { header: "Cliente", key: "cliente", width: 25 },
      { header: "Teléfono", key: "telefono", width: 15 },
      { header: "DPI", key: "dpi", width: 20 },
      { header: "Monto", key: "monto", width: 15 },
      { header: "Estado", key: "usado", width: 15 },
    ];

    rows.forEach(c => {
      worksheet.addRow({
        id: c.id,
        codigo: c.codigo,
        cliente: c.cliente,
        telefono: c.telefono,
        dpi: c.dpi,
        monto: c.monto,
        usado: c.usado ? "USADO" : "ACTIVO"
      });
    });

    worksheet.getRow(1).font = { bold: true };

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.setHeader(
      "Content-Disposition",
      "attachment; filename=backup_cupones.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error("❌ ERROR BACKUP:", error);
    res.send("Error generando Excel");
  }
});

// ======================
// ADMIN (ANTI-ERROR)
// ======================
app.get("/admin", async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      "SELECT * FROM cupones ORDER BY id DESC LIMIT 50"
    );

    let lista = "";

    if (rows.length === 0) {
      lista = `
        <tr>
          <td colspan="6" style="padding:20px;color:gray">
            No hay registros aún
          </td>
        </tr>
      `;
    } else {
      lista = rows.map(c => `
        <tr>
          <td>${c.codigo}</td>
          <td>${c.cliente}</td>
          <td>${c.telefono}</td>
          <td>${c.dpi}</td>
          <td>Q${c.monto}</td>
          <td style="color:${c.usado ? 'red' : 'lime'}">
            ${c.usado ? 'USADO' : 'ACTIVO'}
          </td>
          <td>
            <a href="/delete/${c.id}" style="color:red">Eliminar</a>
          </td>
        </tr>
      `).join("");
    }

    res.send(`
    <body style="background:#000;color:white;font-family:sans-serif;text-align:center">
      <h1>📊 Panel Admin</h1>

      <a href="/backup" style="
        background:gold;
        color:black;
        padding:10px 20px;
        border-radius:10px;
        text-decoration:none;
        font-weight:bold;
      ">
        📥 Descargar Excel
      </a>

      <br><br>

      <table style="width:95%;margin:auto;border-collapse:collapse">
        <tr style="background:gold;color:black">
          <th>Código</th>
          <th>Cliente</th>
          <th>Teléfono</th>
          <th>DPI</th>
          <th>Monto</th>
          <th>Estado</th>
          <th>Acción</th>
        </tr>
        ${lista}
      </table>

      <br><a href="/" style="color:gold">Volver</a>
    </body>
    `);

  } catch (error) {
    console.error("❌ ERROR ADMIN:", error);

    res.send(`
      <body style="background:#000;color:white;text-align:center;font-family:sans-serif">
        <h1 style="color:red">Error cargando admin</h1>
        <p>Revisa la conexión a la base de datos</p>
        <a href="/" style="color:gold">Volver</a>
      </body>
    `);
  }
});
// ======================
// DELETE
// ======================
app.get("/delete/:id", async (req, res) => {
  await db.promise().query("DELETE FROM cupones WHERE id=?", [req.params.id]);
  res.redirect("/admin");
});

// ======================
const PORT = process.env.PORT || 8080;

app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 Servidor en " + PORT);
});