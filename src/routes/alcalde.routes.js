const express = require("express");
const router = express.Router();
const {
  obtenerPublico, obtenerAdmin, actualizar, subirFoto, servirFoto,
} = require("../controllers/alcalde.controller");
const requireAuth = require("../middleware/requireAuth");
const requireRole = require("../middleware/requireRole");
const { uploadImagen } = require("../middleware/uploadImagen");

router.get("/", obtenerPublico); // público (solo si está publicada)
router.get("/foto", servirFoto); // público (solo si está publicada)

router.get("/admin", requireAuth, requireRole("Administrador"), obtenerAdmin);
router.put("/", requireAuth, requireRole("Administrador"), actualizar);
router.post("/foto", requireAuth, requireRole("Administrador"), uploadImagen.single("foto"), subirFoto);

module.exports = router;
