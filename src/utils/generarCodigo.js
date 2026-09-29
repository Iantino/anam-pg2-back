// Sección 4.4: "Generación automática de un identificador único."
// Sección 7 (Reglas de negocio): "Cada trámite debe tener un código único
// generado por el sistema."
//
// Formato: TRM-2026-000123  (prefijo, año, correlativo con ceros a la izquierda)

const { pool } = require("../config/db");

async function generarCodigoTramite() {
  const anio = new Date().getFullYear();

  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total FROM tramites
     WHERE YEAR(fecha_recepcion) = ?`,
    [anio]
  );

  const correlativo = (rows[0].total + 1).toString().padStart(6, "0");
  return `TRM-${anio}-${correlativo}`;
}

module.exports = { generarCodigoTramite };
