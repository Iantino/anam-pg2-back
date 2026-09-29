const express = require("express");
const router = express.Router();
const { enviarMensaje, listarMensajes, marcarAtendido } = require("../controllers/contacto.controller");
const requireAuth = require("../middleware/requireAuth");
const requireRole = require("../middleware/requireRole");

router.post("/", enviarMensaje); // público

router.get("/", requireAuth, requireRole("Administrador", "Operativo"), listarMensajes);
router.put("/:id/atendido", requireAuth, requireRole("Administrador", "Operativo"), marcarAtendido);

module.exports = router;
