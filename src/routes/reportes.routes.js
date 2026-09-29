const express = require("express");
const router = express.Router();
const { reporteTramites, exportarTramitesCSV, exportarTramitesExcel } = require("../controllers/reportes.controller");
const requireAuth = require("../middleware/requireAuth");
const requireRole = require("../middleware/requireRole");

// Solo Administrador: los reportes y exportaciones incluyen TODOS los trámites
// (con datos personales como DPI), y el Operativo solo debe ver los suyos.
router.use(requireAuth, requireRole("Administrador"));

router.get("/tramites", reporteTramites);
router.get("/tramites/exportar", exportarTramitesCSV);
router.get("/tramites/exportar-excel", exportarTramitesExcel);

module.exports = router;
