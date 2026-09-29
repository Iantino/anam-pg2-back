// Biografía del alcalde
//
//  - Público: consulta la biografía (solo si está publicada) y su foto
//  - Administrador: edita todos los campos, sube la foto y decide si se publica

const path = require("path");
const fs = require("fs");
const { pool } = require("../config/db");
const { registrarAuditoria } = require("../utils/auditoria");
const asyncHandler = require("../utils/asyncHandler");
const { CARPETA_ALCALDE } = require("../middleware/uploadImagen");

// Campos editables y su longitud máxima (null = TEXT, sin límite práctico).
const CAMPOS = {
  nombre_completo: 150,
  cargo: 100,
  periodo: 50,
  partido_politico: 150,
  fecha_nacimiento: null,
  lugar_nacimiento: 150,
  familia: null,
  resumen: null,
  formacion_academica: null,
  trayectoria_profesional: null,
  trayectoria_politica: null,
  logros: null,
  ejes_trabajo: null,
  mensaje: null,
};

const ETIQUETAS = {
  nombre_completo: "Nombre completo",
  cargo: "Cargo",
  periodo: "Periodo",
  partido_politico: "Partido político",
  lugar_nacimiento: "Lugar de nacimiento",
};

// Nunca se envía al navegador la ruta interna del archivo, solo si hay foto.
function formatear(fila) {
  const { foto_ruta, actualizado_por, ...resto } = fila;
  return { ...resto, publicado: Boolean(fila.publicado), tiene_foto: Boolean(foto_ruta) };
}

async function obtenerFila() {
  const [rows] = await pool.query(`SELECT * FROM biografia_alcalde WHERE id = 1`);
  return rows[0] || null;
}

// GET /api/alcalde  (público)
const obtenerPublico = asyncHandler(async (req, res) => {
  const fila = await obtenerFila();
  if (!fila || !fila.publicado) {
    return res.status(404).json({ error: "La biografía aún no está publicada." });
  }
  res.json(formatear(fila));
});

// GET /api/alcalde/admin  (Administrador)
const obtenerAdmin = asyncHandler(async (req, res) => {
  const fila = await obtenerFila();
  if (!fila) {
    return res.status(404).json({
      error: "Falta crear la tabla biografia_alcalde (ejecuta el script 002_biografia_alcalde.sql).",
    });
  }
  res.json(formatear(fila));
});

// PUT /api/alcalde  (Administrador)
const actualizar = asyncHandler(async (req, res) => {
  const datos = {};

  for (const [campo, maximo] of Object.entries(CAMPOS)) {
    const valor = typeof req.body[campo] === "string" ? req.body[campo].trim() : "";

    if (maximo && valor.length > maximo) {
      return res.status(400).json({
        error: `${ETIQUETAS[campo] || campo} no puede tener más de ${maximo} caracteres.`,
      });
    }
    datos[campo] = valor === "" ? null : valor;
  }

  if (datos.fecha_nacimiento && !/^\d{4}-\d{2}-\d{2}$/.test(datos.fecha_nacimiento)) {
    return res.status(400).json({ error: "La fecha de nacimiento no es válida." });
  }

  // Columnas NOT NULL: se guardan como texto vacío / valor por defecto.
  datos.nombre_completo = datos.nombre_completo || "";
  datos.cargo = datos.cargo || "Alcalde Municipal";

  const publicado = Boolean(req.body.publicado);

  // Regla: no se puede publicar una biografía sin nombre y sin reseña.
  if (publicado && (!datos.nombre_completo || !datos.resumen)) {
    return res.status(400).json({
      error: "Para publicar la biografía se necesita al menos el nombre completo y la reseña biográfica.",
    });
  }

  const columnas = Object.keys(datos);
  const valores = Object.values(datos);
  const usuarioId = req.session.usuario.id;

  const [resultado] = await pool.query(
    `UPDATE biografia_alcalde
     SET ${columnas.map((c) => `${c} = ?`).join(", ")}, publicado = ?, actualizado_por = ?
     WHERE id = 1`,
    [...valores, publicado ? 1 : 0, usuarioId]
  );

  // Por si la fila inicial no existe (script ejecutado a medias).
  if (resultado.affectedRows === 0) {
    await pool.query(
      `INSERT INTO biografia_alcalde (id, ${columnas.join(", ")}, publicado, actualizado_por)
       VALUES (1, ${columnas.map(() => "?").join(", ")}, ?, ?)`,
      [...valores, publicado ? 1 : 0, usuarioId]
    );
  }

  await registrarAuditoria({
    usuarioId,
    accion: "modificar",
    tabla: "biografia_alcalde",
    registroId: 1,
    detalle: publicado ? "Biografía actualizada (publicada)" : "Biografía actualizada (sin publicar)",
  });

  res.json(formatear(await obtenerFila()));
});

// POST /api/alcalde/foto  (Administrador)
const subirFoto = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No se recibió ninguna imagen." });
  }

  const anterior = await obtenerFila();

  const [resultado] = await pool.query(
    `UPDATE biografia_alcalde SET foto_ruta = ?, actualizado_por = ? WHERE id = 1`,
    [req.file.filename, req.session.usuario.id]
  );

  if (resultado.affectedRows === 0) {
    fs.unlink(req.file.path, () => {});
    return res.status(404).json({
      error: "Falta crear la tabla biografia_alcalde (ejecuta el script 002_biografia_alcalde.sql).",
    });
  }

  // Borrar la foto anterior para no acumular archivos huérfanos.
  if (anterior?.foto_ruta) {
    fs.unlink(path.join(CARPETA_ALCALDE, path.basename(anterior.foto_ruta)), () => {});
  }

  await registrarAuditoria({
    usuarioId: req.session.usuario.id,
    accion: "modificar",
    tabla: "biografia_alcalde",
    registroId: 1,
    detalle: "Foto del alcalde actualizada",
  });

  res.json(formatear(await obtenerFila()));
});

// GET /api/alcalde/foto  (público si está publicada; el admin puede verla antes)
const servirFoto = asyncHandler(async (req, res) => {
  const fila = await obtenerFila();
  const esAdmin = req.session?.usuario?.rol === "Administrador";

  if (!fila?.foto_ruta || (!fila.publicado && !esAdmin)) {
    return res.status(404).json({ error: "Foto no disponible." });
  }

  // path.basename evita que una ruta manipulada salga de la carpeta.
  const archivo = path.join(CARPETA_ALCALDE, path.basename(fila.foto_ruta));
  if (!fs.existsSync(archivo)) {
    return res.status(404).json({ error: "Foto no disponible." });
  }

  res.sendFile(archivo);
});

module.exports = { obtenerPublico, obtenerAdmin, actualizar, subirFoto, servirFoto };
