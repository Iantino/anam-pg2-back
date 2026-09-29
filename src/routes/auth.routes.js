const express = require("express");
const router = express.Router();
const { login, logout, sesionActual } = require("../controllers/auth.controller");
const requireAuth = require("../middleware/requireAuth");

router.post("/login", login);
router.post("/logout", requireAuth, logout);
router.get("/sesion", requireAuth, sesionActual);

module.exports = router;
