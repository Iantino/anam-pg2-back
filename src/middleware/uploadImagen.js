// Carga de imágenes públicas (foto del alcalde).
//
// Va separado de middleware/upload.js a propósito: aquel guarda documentos
// privados de los trámites; estas imágenes sí se muestran en el sitio
// público, así que viven en su propia carpeta (uploads/alcalde) y solo
// aceptan formatos de imagen.

const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const CARPETA = path.join(__dirname, "..", "..", "uploads", "alcalde");
fs.mkdirSync(CARPETA, { recursive: true });

const EXTENSIONES_PERMITIDAS = [".jpg", ".jpeg", ".png", ".webp"];
const TAMANO_MAXIMO_BYTES = 5 * 1024 * 1024; // 5 MB

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, CARPETA),
  filename: (req, file, cb) => {
    const sufijo = crypto.randomBytes(16).toString("hex");
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${sufijo}${ext}`);
  },
});

function filtroImagen(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!EXTENSIONES_PERMITIDAS.includes(ext) || !file.mimetype.startsWith("image/")) {
    return cb(new Error("Formato de archivo no permitido. Usa una imagen JPG, PNG o WEBP."));
  }
  cb(null, true);
}

const uploadImagen = multer({
  storage,
  fileFilter: filtroImagen,
  limits: { fileSize: TAMANO_MAXIMO_BYTES },
});

module.exports = { uploadImagen, CARPETA_ALCALDE: CARPETA };
