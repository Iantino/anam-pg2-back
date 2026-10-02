const express = require("express");
const router = express.Router();
const {
  crearTramite, listarTramites, obtenerExpediente, cambiarEstado, asignarResponsable,
} = require("../controllers/tramites.controller");
const { subirDocumento, descargarDocumento, eliminarDocumento } = require("../controllers/documentos.controller");
const requireAuth = require("../middleware/requireAuth");
const requireRole = require("../middleware/requireRole");
const upload = require("../middleware/upload");

// Todo el módulo de trámites requiere sesión activa (uso interno del personal
// municipal); la información pública general vive en /api/informacion-publica.
// El Operativo solo accede a sus trámites asignados (ver utils/accesoTramite.js);
// asignar responsables es exclusivo del Administrador.
router.use(requireAuth);

router.get("/", listarTramites);
router.post("/", crearTramite);
router.get("/:id", obtenerExpediente);
router.put("/:id/estado", cambiarEstado);
router.put("/:id/responsable", requireRole("Administrador"), asignarResponsable);

router.post("/:id/documentos", upload.single("archivo"), subirDocumento);
router.get("/documentos/:id/descargar", descargarDocumento);
router.delete("/documentos/:id", eliminarDocumento);

module.exports = router;
