const express = require("express");
const router = express.Router();
const {
  listarPublico, listarTodo, crear, actualizar,
} = require("../controllers/informacionPublica.controller");
const requireAuth = require("../middleware/requireAuth");
const requireRole = require("../middleware/requireRole");

router.get("/", listarPublico); // público, solo contenido publicado

router.get("/admin", requireAuth, requireRole("Administrador", "Operativo"), listarTodo);
router.post("/", requireAuth, requireRole("Administrador", "Operativo"), crear);
router.put("/:id", requireAuth, requireRole("Administrador", "Operativo"), actualizar);

module.exports = router;
