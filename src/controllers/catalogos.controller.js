// Catálogos de apoyo para el módulo de trámites (tabla 6 del documento):
// tipos_tramite y estados_tramite. Lectura pública (el sitio y el formulario
// de trámites los necesitan), escritura solo para Administrador.

const { pool } = require("../config/db");
const asyncHandler = require("../utils/asyncHandler");

const listarTiposTramite = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT id, nombre, descripcion FROM tipos_tramite WHERE estado = 'activo' ORDER BY nombre`
  );
  res.json(rows);
});

const listarEstadosTramite = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(`SELECT id, nombre, descripcion FROM estados_tramite ORDER BY id`);
  res.json(rows);
});

const crearTipoTramite = asyncHandler(async (req, res) => {
  const { nombre, descripcion } = req.body;
  if (!nombre) return res.status(400).json({ error: "El nombre es obligatorio." });

  const [resultado] = await pool.query(
    `INSERT INTO tipos_tramite (nombre, descripcion) VALUES (?, ?)`,
    [nombre, descripcion || null]
  );
  res.status(201).json({ id: resultado.insertId, nombre, descripcion });
});

module.exports = { listarTiposTramite, listarEstadosTramite, crearTipoTramite };
