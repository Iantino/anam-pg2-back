// Módulo 4.9: Auditoría e historial
//
//  - Consulta de actividades realizadas por los usuarios autorizados
//  - "Evitar que usuarios normales puedan alterar los registros de auditoría"
//    -> por eso este controlador NO expone crear/editar/eliminar, solo lectura.

const { pool } = require("../config/db");
const asyncHandler = require("../utils/asyncHandler");

const listarAuditoria = asyncHandler(async (req, res) => {
  const { usuario_id, tabla, desde, hasta } = req.query;

  const condiciones = [];
  const valores = [];
  if (usuario_id) { condiciones.push("a.usuario_id = ?"); valores.push(usuario_id); }
  if (tabla) { condiciones.push("a.tabla_afectada = ?"); valores.push(tabla); }
  if (desde) { condiciones.push("a.fecha >= ?"); valores.push(desde); }
  if (hasta) { condiciones.push("a.fecha <= ?"); valores.push(hasta); }

  const where = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";

  const [rows] = await pool.query(
    `SELECT a.id, u.nombre AS usuario, a.accion, a.tabla_afectada,
            a.registro_id, a.fecha, a.detalle
     FROM auditoria a
     LEFT JOIN usuarios u ON u.id = a.usuario_id
     ${where}
     ORDER BY a.fecha DESC
     LIMIT 500`,
    valores
  );

  res.json(rows);
});

module.exports = { listarAuditoria };
