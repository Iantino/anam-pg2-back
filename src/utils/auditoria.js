// Sección 4.9 (Auditoría e historial) y sección 8:
//   "Registrar creación, modificación y eliminación lógica de registros."
//   "No guardar contraseñas ni datos sensibles en registros de auditoría."

const { pool } = require("../config/db");

/**
 * Registra una acción en la tabla de auditoría.
 * @param {object} datos
 * @param {number|null} datos.usuarioId - id del usuario que realizó la acción (null si es del sistema)
 * @param {string} datos.accion - 'crear' | 'modificar' | 'eliminar' | 'login' | 'logout' | etc.
 * @param {string} datos.tabla - nombre de la tabla afectada
 * @param {number|null} datos.registroId - id del registro afectado
 * @param {string} [datos.detalle] - texto descriptivo (NUNCA incluir contraseñas ni datos sensibles)
 */
async function registrarAuditoria({ usuarioId, accion, tabla, registroId, detalle }) {
  try {
    await pool.query(
      `INSERT INTO auditoria (usuario_id, accion, tabla_afectada, registro_id, detalle)
       VALUES (?, ?, ?, ?, ?)`,
      [usuarioId ?? null, accion, tabla, registroId ?? null, detalle ?? null]
    );
  } catch (err) {
    // La auditoría nunca debe tumbar la operación principal; solo se registra el error técnico.
    console.error("No se pudo registrar auditoría:", err.message);
  }
}

module.exports = { registrarAuditoria };
