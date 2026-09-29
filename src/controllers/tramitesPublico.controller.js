// Formulario público de solicitud de trámites (sin login).
//
// Así es como lo hacen en la práctica otras municipalidades guatemaltecas
// (Quetzaltenango, Tacaná, PGN, Vicepresidencia, etc.): un formulario
// abierto donde el ciudadano se identifica con nombre y DPI, sin necesidad
// de crear una cuenta. La Ley de Acceso a la Información Pública (Art. 20)
// exige identificar al solicitante, no que tenga usuario/contraseña.

const { pool } = require("../config/db");
const { generarCodigoTramite } = require("../utils/generarCodigo");
const { registrarAuditoria } = require("../utils/auditoria");
const asyncHandler = require("../utils/asyncHandler");

const ESTADO_INICIAL_ID = 1; // "Recibido"

// Las solicitudes de información pública NO entran por aquí: se hacen en el
// portal oficial de la Municipalidad y las atiende la Unidad de Información
// Pública (Decreto 57-2008). El frontend ya redirige; esto es la validación
// del lado del servidor.
const URL_PORTAL_INFO_PUBLICA =
  "https://munisanpablojocopilas.laip.gt/index.php/informacion-publica/solicitudes-en-linea";

function esTipoInformacionPublica(nombre) {
  return /informaci[oó]n\s+p[uú]blica/i.test(nombre || "");
}

function esCorreoValido(correo) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
}

function esDpiValido(dpi) {
  // CUI/DPI de Guatemala: 13 dígitos (se permiten espacios/guiones al escribirlo).
  const limpio = dpi.replace(/[\s-]/g, "");
  return /^\d{13}$/.test(limpio);
}

const crearSolicitudPublica = asyncHandler(async (req, res) => {
  const {
    tipo_id,
    solicitante_nombre,
    solicitante_dpi,
    solicitante_correo,
    solicitante_telefono,
    observaciones,
    sitio_web, // honeypot anti-spam
  } = req.body;

  // Honeypot: si un bot llenó este campo oculto, respondemos "éxito" sin guardar nada.
  if (sitio_web) {
    return res.status(201).json({ mensaje: "Solicitud registrada correctamente.", codigo: null });
  }

  if (!tipo_id || !solicitante_nombre?.trim() || !solicitante_dpi?.trim() ||
      !solicitante_correo?.trim() || !solicitante_telefono?.trim() || !observaciones?.trim()) {
    return res.status(400).json({
      error: "Tipo de trámite, nombre, DPI, correo, teléfono y descripción son obligatorios.",
    });
  }
  if (!esDpiValido(solicitante_dpi)) {
    return res.status(400).json({ error: "El DPI debe tener 13 dígitos." });
  }
  if (!esCorreoValido(solicitante_correo)) {
    return res.status(400).json({ error: "El correo electrónico no es válido." });
  }
  if (observaciones.length > 5000) {
    return res.status(400).json({ error: "La descripción es demasiado larga." });
  }

  const [tipoRows] = await pool.query(
    `SELECT id, nombre FROM tipos_tramite WHERE id = ? AND estado = 'activo'`,
    [tipo_id]
  );
  if (tipoRows.length === 0) {
    return res.status(400).json({ error: "El tipo de trámite no es válido." });
  }
  if (esTipoInformacionPublica(tipoRows[0].nombre)) {
    return res.status(400).json({
      error: `Las solicitudes de información pública se realizan en el portal oficial: ${URL_PORTAL_INFO_PUBLICA}`,
    });
  }

  const codigo = await generarCodigoTramite();

  const [resultado] = await pool.query(
    `INSERT INTO tramites
       (codigo, tipo_id, usuario_creador_id, solicitante_nombre, solicitante_dpi,
        solicitante_correo, solicitante_telefono, estado_id, observaciones)
     VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?)`,
    [
      codigo, tipo_id,
      solicitante_nombre.trim(),
      solicitante_dpi.replace(/[\s-]/g, ""),
      solicitante_correo.trim(),
      solicitante_telefono.trim(),
      ESTADO_INICIAL_ID,
      observaciones.trim(),
    ]
  );

  const tramiteId = resultado.insertId;

  await pool.query(
    `INSERT INTO historial_tramite (tramite_id, usuario_id, estado_anterior, estado_nuevo, comentario)
     VALUES (?, NULL, NULL, ?, 'Solicitud registrada por el ciudadano desde el sitio público.')`,
    [tramiteId, ESTADO_INICIAL_ID]
  );

  await registrarAuditoria({
    usuarioId: null,
    accion: "crear",
    tabla: "tramites",
    registroId: tramiteId,
    detalle: `Trámite público ${codigo} registrado por ${solicitante_nombre.trim()}`,
  });

  res.status(201).json({ mensaje: "Solicitud registrada correctamente.", codigo });
});

module.exports = { crearSolicitudPublica };
