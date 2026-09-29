// Sección 4.6 (Gestión documental) y sección 8 (Seguridad):
//   "Validar extensión y tamaño."
//   "Evitar que archivos ejecutables puedan cargarse como documentos."
//   "Controlar el tipo y tamaño de los archivos subidos."

const multer = require("multer");
const path = require("path");
const crypto = require("crypto");

// Extensiones permitidas para documentos municipales.
const EXTENSIONES_PERMITIDAS = [
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".jpg", ".jpeg", ".png",
];

// Extensiones explícitamente prohibidas (ejecutables y scripts), como
// segunda barrera aunque no estén en la lista de permitidas.
const EXTENSIONES_PROHIBIDAS = [
  ".exe", ".bat", ".cmd", ".sh", ".msi", ".js", ".php", ".jar", ".com", ".vbs",
];

const TAMANO_MAXIMO_BYTES = 10 * 1024 * 1024; // 10 MB

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "..", "..", "uploads"));
  },
  filename: (req, file, cb) => {
    // Nunca confiar en el nombre original para guardar el archivo:
    // se genera un nombre aleatorio y se conserva el original solo en la BD.
    const sufijo = crypto.randomBytes(16).toString("hex");
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${sufijo}${ext}`);
  },
});

function filtroArchivo(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();

  if (EXTENSIONES_PROHIBIDAS.includes(ext)) {
    return cb(new Error("Tipo de archivo no permitido por seguridad."));
  }
  if (!EXTENSIONES_PERMITIDAS.includes(ext)) {
    return cb(new Error("Extensión no permitida. Usa PDF, Word, Excel o imágenes."));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter: filtroArchivo,
  limits: { fileSize: TAMANO_MAXIMO_BYTES },
});

module.exports = upload;
