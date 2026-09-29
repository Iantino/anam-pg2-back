const express = require("express");
const router = express.Router();
const { listarAuditoria } = require("../controllers/auditoria.controller");
const requireAuth = require("../middleware/requireAuth");
const requireRole = require("../middleware/requireRole");

router.get("/", requireAuth, requireRole("Administrador"), listarAuditoria);

module.exports = router;
