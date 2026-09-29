const express = require("express");
const router = express.Router();
const { obtenerInstitucion, actualizarInstitucion } = require("../controllers/institucion.controller");
const requireAuth = require("../middleware/requireAuth");
const requireRole = require("../middleware/requireRole");

router.get("/", obtenerInstitucion); // público
router.put("/", requireAuth, requireRole("Administrador"), actualizarInstitucion);

module.exports = router;
