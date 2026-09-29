// Módulo 4.7: Información pública
//
//  - Crear y actualizar información destinada a consulta pública
//  - Separar la información pública de la administrativa interna
//  - Controlar qué usuario puede publicar o modificar contenido

const { pool } = require("../config/db");
const { registrarAuditoria } = require("../utils/auditoria");
const asyncHandler = require("../utils/asyncHandler");

// Público: solo devuelve contenido con estado = 'publicado'.
// Lo puede consumir directamente el sitio Next.js (páginas municipalidad/trámites).
const listarPublico = asyncHandler(async (req, res) => {
  const { categoria } = req.query;
  const condiciones = ["estado = 'publicado'"];
  const valores = [];

  if (categoria) {
    condiciones.push("categoria = ?");
    valores.push(categoria);
  }

  const [rows] = await pool.query(
    `SELECT id, titulo, contenido, categoria, fecha_actualizacion
     FROM informacion_publica
     WHERE ${condiciones.join(" AND ")}
     ORDER BY fecha_actualizacion DESC`,
    valores
  );
  res.json(rows);
});

// Interno: administración completa (borradores incluidos).
const listarTodo = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT ip.*, u.nombre AS autor
     FROM informacion_publica ip
     JOIN usuarios u ON u.id = ip.usuario_id
     ORDER BY ip.fecha_actualizacion DESC`
  );
  res.json(rows);
});

const crear = asyncHandler(async (req, res) => {
  const { titulo, contenido, categoria, estado } = req.body;
  const usuarioId = req.session.usuario.id;

  if (!titulo || !contenido) {
    return res.status(400).json({ error: "titulo y contenido son obligatorios." });
  }

  const [resultado] = await pool.query(
    `INSERT INTO informacion_publica (titulo, contenido, categoria, estado, usuario_id)
     VALUES (?, ?, ?, ?, ?)`,
    [titulo, contenido, categoria || null, estado === "publicado" ? "publicado" : "borrador", usuarioId]
  );

  await registrarAuditoria({
    usuarioId, accion: "crear", tabla: "informacion_publica", registroId: resultado.insertId,
  });

  res.status(201).json({ id: resultado.insertId });
});

const actualizar = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { titulo, contenido, categoria, estado } = req.body;
  const usuarioId = req.session.usuario.id;

  const [resultado] = await pool.query(
    `UPDATE informacion_publica
     SET titulo = ?, contenido = ?, categoria = ?, estado = ?
     WHERE id = ?`,
    [titulo, contenido, categoria || null, estado, id]
  );

  if (resultado.affectedRows === 0) {
    return res.status(404).json({ error: "Contenido no encontrado." });
  }

  await registrarAuditoria({
    usuarioId, accion: "modificar", tabla: "informacion_publica", registroId: id,
  });

  res.json({ mensaje: "Contenido actualizado correctamente." });
});

module.exports = { listarPublico, listarTodo, crear, actualizar };
