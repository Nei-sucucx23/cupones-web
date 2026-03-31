const express = require("express");
const app = express();

app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.send(`
    <h2>🎟️ Sistema de Cupones</h2>
    <form method="POST" action="/test">
      <input name="nombre" placeholder="Nombre">
      <button>Enviar</button>
    </form>
  `);
});

app.post("/test", (req, res) => {
  res.send("Hola " + req.body.nombre);
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log("Servidor OK en " + PORT);
});