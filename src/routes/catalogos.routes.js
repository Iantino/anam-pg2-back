const express = require("express");
const router = express.Router();
const {
  listarTiposTramite, listarEstadosTramite, crearTipoTramite,
} = require("../controllers/catalogos.controller");
const requireAuth = require("../middleware/requireAuth");
const requireRole = require("../middleware/requireRole");

router.get("/tipos-tramite", listarTiposTramite); // público
router.get("/estados-tramite", listarEstadosTramite); // público
router.post("/tipos-tramite", requireAuth, requireRole("Administrador"), crearTipoTramite);

module.exports = router;
