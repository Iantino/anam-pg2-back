// Módulo 4.2: Administración de usuarios y roles
//
//  - Crear, consultar, modificar y desactivar usuarios
//  - Asignar un rol a cada usuario
//  - Registrar quién creó o modificó una cuenta

const bcrypt = require("bcryptjs");
const { pool } = require("../config/db");
const { registrarAuditoria } = require("../utils/auditoria");
const asyncHandler = require("../utils/asyncHandler");

const listarUsuarios = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT u.id, u.nombre, u.usuario, u.estado, u.fecha_creacion, r.nombre AS rol
     FROM usuarios u
     JOIN roles r ON r.id = u.rol_id
     ORDER BY u.nombre`
  );
  res.json(rows);
});

const listarRoles = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(`SELECT id, nombre, descripcion FROM roles ORDER BY nombre`);
  res.json(rows);
});

const crearUsuario = asyncHandler(async (req, res) => {
  const { nombre, usuario, password, rol_id } = req.body;

  if (!nombre || !usuario || !password || !rol_id) {
    return res.status(400).json({ error: "nombre, usuario, password y rol_id son obligatorios." });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres." });
  }

  const [existentes] = await pool.query(`SELECT id FROM usuarios WHERE usuario = ?`, [usuario]);
  if (existentes.length > 0) {
    return res.status(409).json({ error: "Ese nombre de usuario ya existe." });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const creadorId = req.session.usuario.id;

  const [resultado] = await pool.query(
    `INSERT INTO usuarios (nombre, usuario, password_hash, rol_id, estado, creado_por)
     VALUES (?, ?, ?, ?, 'activo', ?)`,
    [nombre, usuario, passwordHash, rol_id, creadorId]
  );

  await registrarAuditoria({
    usuarioId: creadorId,
    accion: "crear",
    tabla: "usuarios",
    registroId: resultado.insertId,
    detalle: `Usuario creado: ${usuario}`,
  });

  res.status(201).json({ id: resultado.insertId, nombre, usuario, rol_id, estado: "activo" });
});

const actualizarUsuario = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { nombre, rol_id, estado, password } = req.body;
  const editorId = req.session.usuario.id;

  const campos = [];
  const valores = [];

  if (nombre) { campos.push("nombre = ?"); valores.push(nombre); }
  if (rol_id) { campos.push("rol_id = ?"); valores.push(rol_id); }
  if (estado && ["activo", "inactivo"].includes(estado)) { campos.push("estado = ?"); valores.push(estado); }
  if (password) {
    if (password.length < 8) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres." });
    }
    campos.push("password_hash = ?");
    valores.push(await bcrypt.hash(password, 10));
  }

  if (campos.length === 0) {
    return res.status(400).json({ error: "No se enviaron campos para actualizar." });
  }

  campos.push("actualizado_por = ?");
  valores.push(editorId);
  valores.push(id);

  const [resultado] = await pool.query(
    `UPDATE usuarios SET ${campos.join(", ")} WHERE id = ?`,
    valores
  );

  if (resultado.affectedRows === 0) {
    return res.status(404).json({ error: "Usuario no encontrado." });
  }

  await registrarAuditoria({
    usuarioId: editorId,
    accion: "modificar",
    tabla: "usuarios",
    registroId: id,
    detalle: `Campos actualizados: ${Object.keys(req.body).join(", ")}`,
  });

  res.json({ mensaje: "Usuario actualizado correctamente." });
});

module.exports = { listarUsuarios, listarRoles, crearUsuario, actualizarUsuario };
