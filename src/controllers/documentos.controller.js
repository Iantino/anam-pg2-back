// Módulo 4.6: Gestión documental
//
//  - Guardar nombre, tipo, tamaño, fecha y usuario que realizó la carga
//  - Relacionar cada archivo con un expediente concreto
//  - Permitir visualizar o descargar documentos autorizados

const path = require("path");
const fs = require("fs");
const { pool } = require("../config/db");
const { registrarAuditoria } = require("../utils/auditoria");
const asyncHandler = require("../utils/asyncHandler");
const { verificarAccesoTramite, esAdministrador } = require("../utils/accesoTramite");

// Multer entrega el nombre del archivo interpretado como latin1, así que los
// nombres con tildes o ñ llegan dañados ("Ñandú" → "Ã‘andÃº"). Se vuelve a
// interpretar como UTF-8; si el resultado no es válido se deja el original.
function corregirNombreArchivo(nombre) {
  if (/[^\u0000-\u00ff]/.test(nombre)) return nombre; // ya viene en Unicode
  const corregido = Buffer.from(nombre, "latin1").toString("utf8");
  return corregido.includes("\uFFFD") ? nombre : corregido;
}

const subirDocumento = asyncHandler(async (req, res) => {
  const { id: tramiteId } = req.params;
  const usuarioId = req.session.usuario.id;

  if (!req.file) {
    return res.status(400).json({ error: "No se recibió ningún archivo." });
  }

  const acceso = await verificarAccesoTramite(req, tramiteId);
  if (!acceso.ok) {
    fs.unlink(req.file.path, () => {}); // no dejar el archivo huérfano en disco
    return res.status(acceso.status).json({ error: acceso.error });
  }

  const nombreOriginal = corregirNombreArchivo(req.file.originalname);

  const [resultado] = await pool.query(
    `INSERT INTO documentos (tramite_id, nombre_original, ruta, tipo_mime, tamano, usuario_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [tramiteId, nombreOriginal, req.file.filename, req.file.mimetype, req.file.size, usuarioId]
  );

  await registrarAuditoria({
    usuarioId,
    accion: "crear",
    tabla: "documentos",
    registroId: resultado.insertId,
    detalle: `Documento "${nombreOriginal}" asociado al trámite ${tramiteId}`,
  });

  res.status(201).json({
    id: resultado.insertId,
    nombre_original: nombreOriginal,
    tipo_mime: req.file.mimetype,
    tamano: req.file.size,
  });
});

const descargarDocumento = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const [rows] = await pool.query(`SELECT * FROM documentos WHERE id = ?`, [id]);
  if (rows.length === 0) {
    return res.status(404).json({ error: "Documento no encontrado." });
  }

  const documento = rows[0];

  const acceso = await verificarAccesoTramite(req, documento.tramite_id);
  if (!acceso.ok) return res.status(acceso.status).json({ error: acceso.error });
  const rutaAbsoluta = path.join(__dirname, "..", "..", "uploads", documento.ruta);

  await registrarAuditoria({
    usuarioId: req.session.usuario.id,
    accion: "consultar",
    tabla: "documentos",
    registroId: id,
  });

  res.download(rutaAbsoluta, documento.nombre_original);
});

// Eliminar un documento cargado por error.
//  - Administrador: cualquier documento.
//  - Operativo: solo los que él mismo subió, y solo en trámites asignados a él.
// Queda registrado en el historial del trámite y en la auditoría.
const eliminarDocumento = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const usuarioId = req.session.usuario.id;
  const motivo = typeof req.body?.motivo === "string" ? req.body.motivo.trim().slice(0, 500) : "";

  const [rows] = await pool.query(`SELECT * FROM documentos WHERE id = ?`, [id]);
  if (rows.length === 0) {
    return res.status(404).json({ error: "Documento no encontrado." });
  }
  const documento = rows[0];

  const acceso = await verificarAccesoTramite(req, documento.tramite_id);
  if (!acceso.ok) return res.status(acceso.status).json({ error: acceso.error });

  if (!esAdministrador(req) && documento.usuario_id !== usuarioId) {
    return res.status(403).json({
      error: "Solo puedes eliminar documentos que tú subiste. Pide al Administrador que lo elimine.",
    });
  }

  const [tramite] = await pool.query(`SELECT estado_id FROM tramites WHERE id = ?`, [documento.tramite_id]);
  const estadoActual = tramite[0].estado_id;

  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();

    await conexion.query(`DELETE FROM documentos WHERE id = ?`, [id]);

    // Se registra en el historial sin cambiar el estado (anterior = nuevo).
    await conexion.query(
      `INSERT INTO historial_tramite (tramite_id, usuario_id, estado_anterior, estado_nuevo, comentario)
       VALUES (?, ?, ?, ?, ?)`,
      [
        documento.tramite_id,
        usuarioId,
        estadoActual,
        estadoActual,
        `Documento eliminado: "${documento.nombre_original}".${motivo ? ` Motivo: ${motivo}` : ""}`,
      ]
    );

    await conexion.commit();
  } catch (err) {
    await conexion.rollback();
    throw err;
  } finally {
    conexion.release();
  }

  // El archivo físico se borra después de confirmar en la base de datos.
  // Si ya no existe en disco (p. ej. se perdió en un redespliegue), no es error.
  fs.unlink(path.join(__dirname, "..", "..", "uploads", path.basename(documento.ruta)), () => {});

  await registrarAuditoria({
    usuarioId,
    accion: "eliminar",
    tabla: "documentos",
    registroId: Number(id),
    detalle: `Documento "${documento.nombre_original}" eliminado del trámite ${documento.tramite_id}${motivo ? `. Motivo: ${motivo}` : ""}`,
  });

  res.json({ mensaje: "Documento eliminado." });
});

module.exports = { subirDocumento, descargarDocumento, eliminarDocumento };
