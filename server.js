require("dotenv").config();

const express = require("express");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const cors = require("cors");

const { pool, verificarConexion } = require("./src/config/db");
const rutasApi = require("./src/routes");

const app = express();
const ES_PRODUCCION = process.env.NODE_ENV === "production";
const SECRETO_EJEMPLO = "cambia_esto_en_produccion";

// En producción no se permite arrancar con la clave de sesión de ejemplo:
// con ella cualquiera podría falsificar cookies de sesión.
if (
  ES_PRODUCCION &&
  (
    !process.env.SESSION_SECRET ||
    process.env.SESSION_SECRET.length < 32 ||
    process.env.SESSION_SECRET.startsWith("cambia")
  )
) {
  console.error(
    "❌ Define SESSION_SECRET en el .env con una cadena aleatoria de al menos 32 caracteres."
  );
  process.exit(1);
}

// Detrás de Railway/Nginx (HTTPS), Express recibe la petición
// internamente como HTTP. Esto permite utilizar cookies Secure.
if (ES_PRODUCCION) {
  app.set("trust proxy", 1);
}

// ---------------------------------------------------------------------
// Middlewares generales
// ---------------------------------------------------------------------

app.use(express.json());

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || "http://localhost:3000",
    credentials: true,
  })
);

// ---------------------------------------------------------------------
// Sesiones
// ---------------------------------------------------------------------
//
// Las sesiones se guardan en MySQL mediante express-mysql-session.
// De esta manera las sesiones no dependen de la memoria del servidor.
//
// En producción:
// - secure: true → la cookie solo viaja mediante HTTPS.
// - sameSite: "none" → permite que la cookie viaje entre Vercel
//   y Railway, que son dominios diferentes.
// - httpOnly: true → JavaScript del navegador no puede leer la cookie.
// ---------------------------------------------------------------------

const sessionStore = new MySQLStore(
  {
    createDatabaseTable: true,
    clearExpired: true,
    checkExpirationInterval: 1000 * 60 * 15,
  },
  pool
);

app.use(
  session({
    secret: process.env.SESSION_SECRET || SECRETO_EJEMPLO,

    store: sessionStore,

    resave: false,

    saveUninitialized: false,

    cookie: {
      httpOnly: true,

      // En Railway estamos usando HTTPS.
      secure: ES_PRODUCCION,

      // Necesario para permitir la cookie entre
      // muni-san-pablo-jocopilas.vercel.app
      // y anam-pg2-back-production.up.railway.app
      sameSite: "none",

      // 8 horas
      maxAge: 1000 * 60 * 60 * 8,
    },
  })
);

// ---------------------------------------------------------------------
// Rutas
// ---------------------------------------------------------------------

app.get("/", (req, res) => {
  res.json({
    mensaje: "API - Sistema Municipal San Pablo Jocopilas",
  });
});

app.use("/api", rutasApi);

// ---------------------------------------------------------------------
// Manejo de errores centralizado
// ---------------------------------------------------------------------

app.use((req, res) => {
  res.status(404).json({
    error: "Ruta no encontrada.",
  });
});

app.use((err, req, res, next) => {
  console.error(err);

  // Error de multer: archivo demasiado grande
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      error: "El archivo supera el tamaño máximo permitido.",
    });
  }

  // Errores relacionados con archivos
  if (
    err.message?.includes("no permitid") ||
    err.message?.includes("archivo")
  ) {
    return res.status(400).json({
      error: err.message,
    });
  }

  res.status(500).json({
    error: "Ocurrió un error interno. Intenta de nuevo más tarde.",
  });
});

// ---------------------------------------------------------------------
// Arranque del servidor
// ---------------------------------------------------------------------

const PORT = process.env.PORT || 4000;

async function iniciar() {
  try {
    await verificarConexion();

    app.listen(PORT, () => {
      console.log(
        `🚀 Servidor escuchando en http://localhost:${PORT} (${
          ES_PRODUCCION ? "producción" : "desarrollo"
        })`
      );
    });
  } catch (err) {
    console.error(
      "❌ No se pudo conectar a la base de datos:",
      err.message
    );

    process.exit(1);
  }
}

iniciar();