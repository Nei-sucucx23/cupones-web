const express = require("express");
const app = express();

// IMPORTANTE: middleware básico
app.use(express.json());

app.get("/", (req, res) => {
  res.send("🔥 FUNCIONA PERFECTO 🔥");
});

app.get("/health", (req, res) => {
  res.send("OK");
});

const PORT = process.env.PORT || 8080;

// 👇 CAMBIO CLAVE AQUÍ
app.listen(PORT, () => {
  console.log("🚀 Servidor escuchando en puerto " + PORT);
});