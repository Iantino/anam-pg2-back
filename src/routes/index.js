const express = require("express");
const router = express.Router();

router.use("/", require("./auth.routes"));
router.use("/usuarios", require("./usuarios.routes"));
router.use("/institucion", require("./institucion.routes"));
router.use("/", require("./catalogos.routes")); // /tipos-tramite, /estados-tramite
router.use("/tramites", require("./tramites.routes"));
router.use("/tramites-publico", require("./tramitesPublico.routes"));
router.use("/informacion-publica", require("./informacionPublica.routes"));
router.use("/alcalde", require("./alcalde.routes"));
router.use("/contacto", require("./contacto.routes"));
router.use("/reportes", require("./reportes.routes"));
router.use("/auditoria", require("./auditoria.routes"));

module.exports = router;
