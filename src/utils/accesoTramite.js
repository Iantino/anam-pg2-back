// Control de acceso a trámites según el rol.
//
//  - Administrador: acceso a todos los trámites.
//  - Operativo: solo a los trámites donde él es el responsable asignado.
//
// Se valida en el servidor (sección 8: "ocultar un botón no constituye
// seguridad"), así que aunque alguien escriba la URL de un trámite ajeno
// o llame a la API directamente, no podrá verlo ni modificarlo.

const { pool } = require("../config/db");

function esAdministrador(req) {
  return req.session?.usuario?.rol === "Administrador";
}

/**
 * Verifica si el usuario de la sesión puede trabajar con un trámite.
 * @returns {Promise<{ ok: true } | { ok: false, status: number, error: string }>}
 */
async function verificarAccesoTramite(req, tramiteId) {
  const [rows] = await pool.query(`SELECT responsable_id FROM tramites WHERE id = ?`, [tramiteId]);

  if (rows.length === 0) {
    return { ok: false, status: 404, error: "Trámite no encontrado." };
  }

  if (!esAdministrador(req) && rows[0].responsable_id !== req.session.usuario.id) {
    return { ok: false, status: 403, error: "Este trámite no está asignado a ti." };
  }

  return { ok: true };
}

module.exports = { esAdministrador, verificarAccesoTramite };
