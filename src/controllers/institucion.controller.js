// Módulo 4.3: Datos institucionales de la municipalidad
// (registro único, ya no es un catálogo de varias municipalidades)

const { pool } = require("../config/db");
const { registrarAuditoria } = require("../utils/auditoria");
const asyncHandler = require("../utils/asyncHandler");

// Público: lo consume tanto el panel administrativo como el sitio público
// (páginas de inicio, municipalidad y contacto del frontend).
const obtenerInstitucion = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(`SELECT * FROM institucion WHERE id = 1`);
  if (rows.length === 0) {
    return res.status(404).json({ error: "No se ha configurado la información institucional." });
  }
  res.json(rows[0]);
});

// Protegido: solo Administrador puede editar los datos institucionales.
const actualizarInstitucion = asyncHandler(async (req, res) => {
  const { nombre, departamento, municipio, direccion, telefono, correo, horario, logo_url } = req.body;

  await pool.query(
    `UPDATE institucion
     SET nombre = ?, departamento = ?, municipio = ?, direccion = ?,
         telefono = ?, correo = ?, horario = ?, logo_url = ?
     WHERE id = 1`,
    [nombre, departamento, municipio, direccion, telefono, correo, horario, logo_url]
  );

  await registrarAuditoria({
    usuarioId: req.session.usuario.id,
    accion: "modificar",
    tabla: "institucion",
    registroId: 1,
  });

  res.json({ mensaje: "Datos institucionales actualizados." });
});

module.exports = { obtenerInstitucion, actualizarInstitucion };
