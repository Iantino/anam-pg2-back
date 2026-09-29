// Módulo 4.8: Reportes y estadísticas
//
//  - Reporte de solicitudes por estado
//  - Reporte por rango de fechas
//  - Cantidad de trámites recibidos, pendientes, en proceso y finalizados
//  - Indicadores básicos para apoyar la toma de decisiones
//  - Exportación a PDF y Excel, de acuerdo con el requerimiento académico

const ExcelJS = require("exceljs");
const { pool } = require("../config/db");
const asyncHandler = require("../utils/asyncHandler");

function construirFiltroFechas(desde, hasta) {
  const condiciones = [];
  const valores = [];
  if (desde) { condiciones.push("t.fecha_recepcion >= ?"); valores.push(desde); }
  if (hasta) { condiciones.push("t.fecha_recepcion <= ?"); valores.push(hasta); }
  const where = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";
  return { where, valores };
}

async function obtenerConteos(where, valores) {
  const [porEstado] = await pool.query(
    `SELECT et.nombre AS estado, COUNT(*) AS total
     FROM tramites t
     JOIN estados_tramite et ON et.id = t.estado_id
     ${where}
     GROUP BY et.nombre`,
    valores
  );

  const [porTipo] = await pool.query(
    `SELECT tt.nombre AS tipo, COUNT(*) AS total
     FROM tramites t
     JOIN tipos_tramite tt ON tt.id = t.tipo_id
     ${where}
     GROUP BY tt.nombre`,
    valores
  );

  const [totalRow] = await pool.query(
    `SELECT COUNT(*) AS total FROM tramites t ${where}`,
    valores
  );

  return { total: totalRow[0].total, porEstado, porTipo };
}

async function obtenerDetalleTramites(where, valores) {
  const [rows] = await pool.query(
    `SELECT t.codigo, tt.nombre AS tipo, et.nombre AS estado,
            COALESCE(uc.nombre, t.solicitante_nombre) AS creador,
            (t.usuario_creador_id IS NULL) AS es_publico,
            ur.nombre AS responsable, t.fecha_recepcion, t.fecha_actualizacion
     FROM tramites t
     JOIN tipos_tramite tt ON tt.id = t.tipo_id
     JOIN estados_tramite et ON et.id = t.estado_id
     LEFT JOIN usuarios uc ON uc.id = t.usuario_creador_id
     LEFT JOIN usuarios ur ON ur.id = t.responsable_id
     ${where}
     ORDER BY t.fecha_recepcion DESC`,
    valores
  );
  return rows;
}

const reporteTramites = asyncHandler(async (req, res) => {
  const { where, valores } = construirFiltroFechas(req.query.desde, req.query.hasta);
  const conteos = await obtenerConteos(where, valores);
  res.json(conteos);
});

// Exportación a CSV (se abre directamente en Excel, sin estilos).
const exportarTramitesCSV = asyncHandler(async (req, res) => {
  const { where, valores } = construirFiltroFechas(req.query.desde, req.query.hasta);
  const rows = await obtenerDetalleTramites(where, valores);

  const encabezado = "Codigo,Tipo,Estado,Creador,Responsable,FechaRecepcion";
  const filas = rows.map((r) =>
    [r.codigo, r.tipo, r.estado, r.creador, r.responsable || "", r.fecha_recepcion].join(",")
  );
  const csv = [encabezado, ...filas].join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=reporte_tramites.csv");
  res.send(csv);
});

// Exportación a un archivo .xlsx real, con dos hojas: detalle y resumen.
const exportarTramitesExcel = asyncHandler(async (req, res) => {
  const { where, valores } = construirFiltroFechas(req.query.desde, req.query.hasta);
  const [rows, conteos] = await Promise.all([
    obtenerDetalleTramites(where, valores),
    obtenerConteos(where, valores),
  ]);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Sistema Municipal - San Pablo Jocopilas";
  workbook.created = new Date();

  // --- Hoja 1: detalle de trámites ---
  const hojaDetalle = workbook.addWorksheet("Trámites");
  hojaDetalle.columns = [
    { header: "Código", key: "codigo", width: 20 },
    { header: "Tipo", key: "tipo", width: 26 },
    { header: "Estado", key: "estado", width: 16 },
    { header: "Creado por", key: "creador", width: 26 },
    { header: "Origen", key: "origen", width: 14 },
    { header: "Responsable", key: "responsable", width: 26 },
    { header: "Fecha de recepción", key: "fecha_recepcion", width: 20 },
    { header: "Última actualización", key: "fecha_actualizacion", width: 20 },
  ];
  hojaDetalle.getRow(1).font = { bold: true };
  hojaDetalle.getRow(1).fill = {
    type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F3EC" },
  };

  rows.forEach((r) => {
    hojaDetalle.addRow({
      codigo: r.codigo,
      tipo: r.tipo,
      estado: r.estado,
      creador: r.creador,
      origen: r.es_publico ? "Ciudadano (público)" : "Personal municipal",
      responsable: r.responsable || "Sin asignar",
      fecha_recepcion: r.fecha_recepcion,
      fecha_actualizacion: r.fecha_actualizacion,
    });
  });

  // --- Hoja 2: resumen (mismos datos que el panel de Reportes) ---
  const hojaResumen = workbook.addWorksheet("Resumen");
  hojaResumen.addRow(["Total de trámites", conteos.total]);
  hojaResumen.addRow([]);

  hojaResumen.addRow(["Por estado"]).font = { bold: true };
  hojaResumen.addRow(["Estado", "Cantidad"]).font = { bold: true };
  conteos.porEstado.forEach((e) => hojaResumen.addRow([e.estado, e.total]));

  hojaResumen.addRow([]);
  hojaResumen.addRow(["Por tipo de trámite"]).font = { bold: true };
  hojaResumen.addRow(["Tipo", "Cantidad"]).font = { bold: true };
  conteos.porTipo.forEach((t) => hojaResumen.addRow([t.tipo, t.total]));

  hojaResumen.columns = [{ width: 30 }, { width: 14 }];

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", "attachment; filename=reporte_tramites.xlsx");

  await workbook.xlsx.write(res);
  res.end();
});

module.exports = { reporteTramites, exportarTramitesCSV, exportarTramitesExcel };
