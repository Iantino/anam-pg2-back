// Módulo 4.4 (Gestión de solicitudes y trámites) y 4.5 (Seguimiento de expedientes)
//
//  - Generación automática de identificador único (utils/generarCodigo.js)
//  - Registro de fecha, responsable, tipo de solicitud y observaciones
//  - Asignación del trámite a un usuario
//  - Cambio controlado del estado del trámite (con historial)
//  - Consulta del historial del trámite
//  - Búsqueda por identificador, estado, fechas y responsable

const { pool } = require("../config/db");
const { generarCodigoTramite } = require("../utils/generarCodigo");
const { registrarAuditoria } = require("../utils/auditoria");
const asyncHandler = require("../utils/asyncHandler");
const { esAdministrador, verificarAccesoTramite } = require("../utils/accesoTramite");

// ID del estado inicial "Recibido" según los datos semilla del script SQL.
const ESTADO_INICIAL_ID = 1;

const crearTramite = asyncHandler(async (req, res) => {
  const { tipo_id, observaciones } = req.body;
  const creadorId = req.session.usuario.id;

  if (!tipo_id) {
    return res.status(400).json({ error: "tipo_id es obligatorio." });
  }

  const codigo = await generarCodigoTramite();

  // Si lo registra un Operativo, queda asignado a él; de lo contrario no
  // podría verlo en su lista (solo ve los trámites que tiene asignados).
  const responsableId = esAdministrador(req) ? null : creadorId;

  const [resultado] = await pool.query(
    `INSERT INTO tramites (codigo, tipo_id, usuario_creador_id, responsable_id, estado_id, observaciones)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [codigo, tipo_id, creadorId, responsableId, ESTADO_INICIAL_ID, observaciones || null]
  );

  const tramiteId = resultado.insertId;

  // Primera entrada de historial: se crea la solicitud (regla de negocio,
  // sección 7: "conservar su historial completo").
  await pool.query(
    `INSERT INTO historial_tramite (tramite_id, usuario_id, estado_anterior, estado_nuevo, comentario)
     VALUES (?, ?, NULL, ?, 'Solicitud registrada.')`,
    [tramiteId, creadorId, ESTADO_INICIAL_ID]
  );

  await registrarAuditoria({
    usuarioId: creadorId,
    accion: "crear",
    tabla: "tramites",
    registroId: tramiteId,
    detalle: `Trámite ${codigo} creado`,
  });

  res.status(201).json({ id: tramiteId, codigo, estado_id: ESTADO_INICIAL_ID });
});

// Búsqueda con filtros (sección 4.4): identificador, estado, fechas, responsable.
const listarTramites = asyncHandler(async (req, res) => {
  const { codigo, estado_id, responsable_id, sin_asignar, desde, hasta } = req.query;

  const condiciones = [];
  const valores = [];

  if (esAdministrador(req)) {
    if (sin_asignar === "1") condiciones.push("t.responsable_id IS NULL");
  } else {
    // Operativo: solo sus trámites asignados, sin importar los filtros que envíe.
    condiciones.push("t.responsable_id = ?");
    valores.push(req.session.usuario.id);
  }

  if (codigo) { condiciones.push("t.codigo LIKE ?"); valores.push(`%${codigo}%`); }
  if (estado_id) { condiciones.push("t.estado_id = ?"); valores.push(estado_id); }
  if (responsable_id) { condiciones.push("t.responsable_id = ?"); valores.push(responsable_id); }
  if (desde) { condiciones.push("t.fecha_recepcion >= ?"); valores.push(desde); }
  if (hasta) { condiciones.push("t.fecha_recepcion <= ?"); valores.push(hasta); }

  const where = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";

  // LEFT JOIN en el creador: puede ser un empleado (usuario_creador_id) o,
  // si vino del formulario público, no hay usuario y se usa solicitante_nombre.
  const [rows] = await pool.query(
    `SELECT t.id, t.codigo, tt.nombre AS tipo, et.nombre AS estado,
            COALESCE(uc.nombre, t.solicitante_nombre) AS creador,
            (t.usuario_creador_id IS NULL) AS es_publico,
            ur.nombre AS responsable,
            t.fecha_recepcion, t.fecha_actualizacion
     FROM tramites t
     JOIN tipos_tramite tt ON tt.id = t.tipo_id
     JOIN estados_tramite et ON et.id = t.estado_id
     LEFT JOIN usuarios uc ON uc.id = t.usuario_creador_id
     LEFT JOIN usuarios ur ON ur.id = t.responsable_id
     ${where}
     ORDER BY t.fecha_recepcion DESC
     LIMIT 200`,
    valores
  );

  res.json(rows);
});

// Vista detallada del expediente (sección 4.5): estado, responsable,
// observaciones, documentos e historial completo.
const obtenerExpediente = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const acceso = await verificarAccesoTramite(req, id);
  if (!acceso.ok) return res.status(acceso.status).json({ error: acceso.error });

  const [tramiteRows] = await pool.query(
    `SELECT t.*, tt.nombre AS tipo_nombre, et.nombre AS estado_nombre,
            COALESCE(uc.nombre, t.solicitante_nombre) AS creador_nombre,
            (t.usuario_creador_id IS NULL) AS es_publico,
            ur.nombre AS responsable_nombre
     FROM tramites t
     JOIN tipos_tramite tt ON tt.id = t.tipo_id
     JOIN estados_tramite et ON et.id = t.estado_id
     LEFT JOIN usuarios uc ON uc.id = t.usuario_creador_id
     LEFT JOIN usuarios ur ON ur.id = t.responsable_id
     WHERE t.id = ?`,
    [id]
  );

  if (tramiteRows.length === 0) {
    return res.status(404).json({ error: "Trámite no encontrado." });
  }

  const [documentos] = await pool.query(
    `SELECT d.id, d.nombre_original, d.tipo_mime, d.tamano, d.fecha_carga,
            d.usuario_id, u.nombre AS subido_por
     FROM documentos d
     LEFT JOIN usuarios u ON u.id = d.usuario_id
     WHERE d.tramite_id = ? ORDER BY d.fecha_carga DESC`,
    [id]
  );

  const [historial] = await pool.query(
    `SELECT h.id, ea.nombre AS estado_anterior, en.nombre AS estado_nuevo,
            COALESCE(u.nombre, 'Ciudadano (formulario público)') AS usuario,
            h.comentario, h.fecha
     FROM historial_tramite h
     LEFT JOIN estados_tramite ea ON ea.id = h.estado_anterior
     JOIN estados_tramite en ON en.id = h.estado_nuevo
     LEFT JOIN usuarios u ON u.id = h.usuario_id
     WHERE h.tramite_id = ?
     ORDER BY h.fecha ASC`,
    [id]
  );

  res.json({ ...tramiteRows[0], documentos, historial });
});

// Cambio controlado del estado del trámite (sección 4.4 y regla de negocio:
// "los cambios de estado deben quedar registrados").
const cambiarEstado = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { estado_id, comentario } = req.body;
  const usuarioId = req.session.usuario.id;

  if (!estado_id) {
    return res.status(400).json({ error: "estado_id es obligatorio." });
  }

  const acceso = await verificarAccesoTramite(req, id);
  if (!acceso.ok) return res.status(acceso.status).json({ error: acceso.error });

  const [actual] = await pool.query(`SELECT estado_id FROM tramites WHERE id = ?`, [id]);
  if (actual.length === 0) {
    return res.status(404).json({ error: "Trámite no encontrado." });
  }

  const estadoAnterior = actual[0].estado_id;

  await pool.query(`UPDATE tramites SET estado_id = ? WHERE id = ?`, [estado_id, id]);

  await pool.query(
    `INSERT INTO historial_tramite (tramite_id, usuario_id, estado_anterior, estado_nuevo, comentario)
     VALUES (?, ?, ?, ?, ?)`,
    [id, usuarioId, estadoAnterior, estado_id, comentario || null]
  );

  await registrarAuditoria({
    usuarioId,
    accion: "modificar",
    tabla: "tramites",
    registroId: id,
    detalle: `Estado cambiado de ${estadoAnterior} a ${estado_id}`,
  });

  res.json({ mensaje: "Estado actualizado correctamente." });
});

// Asignación del trámite a un responsable (sección 4.4).
const asignarResponsable = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { responsable_id } = req.body;
  const usuarioId = req.session.usuario.id;

  if (!responsable_id) {
    return res.status(400).json({ error: "responsable_id es obligatorio." });
  }

  const [responsable] = await pool.query(
    `SELECT nombre FROM usuarios WHERE id = ? AND estado = 'activo'`,
    [responsable_id]
  );
  if (responsable.length === 0) {
    return res.status(400).json({ error: "El usuario seleccionado no existe o está inactivo." });
  }

  const [resultado] = await pool.query(
    `UPDATE tramites SET responsable_id = ? WHERE id = ?`,
    [responsable_id, id]
  );

  if (resultado.affectedRows === 0) {
    return res.status(404).json({ error: "Trámite no encontrado." });
  }

  await registrarAuditoria({
    usuarioId,
    accion: "modificar",
    tabla: "tramites",
    registroId: id,
    detalle: `Responsable asignado: ${responsable[0].nombre} (usuario ${responsable_id})`,
  });

  res.json({ mensaje: "Responsable asignado correctamente." });
});

module.exports = {
  crearTramite, listarTramites, obtenerExpediente, cambiarEstado, asignarResponsable,
};
