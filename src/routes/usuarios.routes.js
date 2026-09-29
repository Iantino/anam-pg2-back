const express = require("express");
const router = express.Router();
const {
  listarUsuarios, listarRoles, crearUsuario, actualizarUsuario,
} = require("../controllers/usuarios.controller");
const requireAuth = require("../middleware/requireAuth");
const requireRole = require("../middleware/requireRole");

// Todo este módulo requiere sesión activa y rol Administrador.
router.use(requireAuth, requireRole("Administrador"));

router.get("/", listarUsuarios);
router.post("/", crearUsuario);
router.put("/:id", actualizarUsuario);
router.get("/roles/lista", listarRoles);

module.exports = router;
