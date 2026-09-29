const express = require("express");
const router = express.Router();
const { crearSolicitudPublica } = require("../controllers/tramitesPublico.controller");

router.post("/", crearSolicitudPublica); // público, sin sesión

module.exports = router;
