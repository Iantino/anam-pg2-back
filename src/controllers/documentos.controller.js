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
const { verificarAccesoTramite } = require("../utils/accesoTramite");

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

  const [resultado] = await pool.query(
    `INSERT INTO documentos (tramite_id, nombre_original, ruta, tipo_mime, tamano, usuario_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [tramiteId, req.file.originalname, req.file.filename, req.file.mimetype, req.file.size, usuarioId]
  );

  await registrarAuditoria({
    usuarioId,
    accion: "crear",
    tabla: "documentos",
    registroId: resultado.insertId,
    detalle: `Documento "${req.file.originalname}" asociado al trámite ${tramiteId}`,
  });

  res.status(201).json({
    id: resultado.insertId,
    nombre_original: req.file.originalname,
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

module.exports = { subirDocumento, descargarDocumento };
