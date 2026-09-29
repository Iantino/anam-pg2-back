// Formulario público de Contacto del sitio (no forma parte de los 9
// módulos administrativos del documento; es la bandeja de mensajes
// ciudadanos que llegan desde app/contacto/page.tsx del frontend).

const { pool } = require("../config/db");
const { registrarAuditoria } = require("../utils/auditoria");
const asyncHandler = require("../utils/asyncHandler");

const ASUNTOS_VALIDOS = [
  "Información general",
  "Trámites y servicios",
  "IUSI",
  "Solicitud de información pública",
  "Otro",
];

function esCorreoValido(correo) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
}

// Público: cualquiera puede enviar un mensaje, sin necesidad de sesión.
const enviarMensaje = asyncHandler(async (req, res) => {
  const { nombre, correo, asunto, mensaje, sitio_web } = req.body;

  // Honeypot anti-spam: un campo oculto que un humano nunca llena.
  // Si viene con contenido, es casi seguro un bot; respondemos "éxito"
  // sin guardar nada, para no darle pistas a quien lo esté probando.
  if (sitio_web) {
    return res.status(201).json({ mensaje: "Mensaje enviado correctamente." });
  }

  if (!nombre?.trim() || !correo?.trim() || !mensaje?.trim()) {
    return res.status(400).json({ error: "Nombre, correo y mensaje son obligatorios." });
  }
  if (!esCorreoValido(correo)) {
    return res.status(400).json({ error: "El correo electrónico no es válido." });
  }
  if (mensaje.length > 5000) {
    return res.status(400).json({ error: "El mensaje es demasiado largo." });
  }

  const asuntoFinal = ASUNTOS_VALIDOS.includes(asunto) ? asunto : "Otro";

  const [resultado] = await pool.query(
    `INSERT INTO mensajes_contacto (nombre, correo, asunto, mensaje)
     VALUES (?, ?, ?, ?)`,
    [nombre.trim(), correo.trim(), asuntoFinal, mensaje.trim()]
  );

  await registrarAuditoria({
    usuarioId: null, // mensaje público, no hay usuario del sistema autenticado
    accion: "crear",
    tabla: "mensajes_contacto",
    registroId: resultado.insertId,
    detalle: `Nuevo mensaje de contacto de ${correo.trim()}`,
  });

  res.status(201).json({ mensaje: "Mensaje enviado correctamente." });
});

// Interno: bandeja de mensajes para el personal municipal.
const listarMensajes = asyncHandler(async (req, res) => {
  const { estado } = req.query;
  const condiciones = [];
  const valores = [];
  if (estado) { condiciones.push("estado = ?"); valores.push(estado); }
  const where = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";

  const [rows] = await pool.query(
    `SELECT id, nombre, correo, asunto, mensaje, estado, fecha_creacion
     FROM mensajes_contacto
     ${where}
     ORDER BY fecha_creacion DESC`,
    valores
  );
  res.json(rows);
});

// Marcar un mensaje como atendido.
const marcarAtendido = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [resultado] = await pool.query(
    `UPDATE mensajes_contacto SET estado = 'atendido' WHERE id = ?`,
    [id]
  );
  if (resultado.affectedRows === 0) {
    return res.status(404).json({ error: "Mensaje no encontrado." });
  }
  res.json({ mensaje: "Mensaje marcado como atendido." });
});

module.exports = { enviarMensaje, listarMensajes, marcarAtendido };
