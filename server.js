const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("🔥 FUNCIONA PERFECTO 🔥");
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, "0.0.0.0", () => {
  console.log("Servidor corriendo en " + PORT);
});