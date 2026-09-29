// Crea un usuario Administrador desde la terminal del servidor.
//
// Uso:  npm run crear-admin
//
// Sirve para crear el primer Administrador en una instalación nueva (sin
// entrar a MySQL a mano) o para recuperar el acceso si se olvida la
// contraseña del único Administrador. Si el usuario ya existe, ofrece
// restablecer su contraseña y desbloquearlo.

require("dotenv").config();
const readline = require("readline");
const bcrypt = require("bcryptjs");
const { pool } = require("../src/config/db");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const preguntar = (texto) => new Promise((resolve) => rl.question(texto, (r) => resolve(r.trim())));

// Lee la contraseña sin mostrarla en pantalla.
function preguntarOculto(texto) {
  return new Promise((resolve) => {
    const escribirOriginal = rl._writeToOutput;
    rl._writeToOutput = (s) => {
      if (s.includes(texto)) escribirOriginal.call(rl, s);
      else escribirOriginal.call(rl, "*");
    };
    rl.question(texto, (r) => {
      rl._writeToOutput = escribirOriginal;
      process.stdout.write("\n");
      resolve(r);
    });
  });
}

async function main() {
  console.log("\n=== Crear usuario Administrador ===\n");

  const [roles] = await pool.query(`SELECT id FROM roles WHERE nombre = 'Administrador'`);
  if (roles.length === 0) {
    throw new Error("No existe el rol 'Administrador' en la tabla roles. Importa primero los catálogos.");
  }
  const rolId = roles[0].id;

  const usuario = await preguntar("Usuario (para iniciar sesión): ");
  if (!usuario) throw new Error("El usuario es obligatorio.");

  const [existentes] = await pool.query(`SELECT id, nombre FROM usuarios WHERE usuario = ?`, [usuario]);

  let nombre = existentes[0]?.nombre;
  if (existentes.length > 0) {
    const r = await preguntar(`El usuario "${usuario}" ya existe (${nombre}). ¿Restablecer su contraseña y hacerlo Administrador? (s/n): `);
    if (r.toLowerCase() !== "s") throw new Error("Operación cancelada.");
  } else {
    nombre = await preguntar("Nombre completo: ");
    if (!nombre) throw new Error("El nombre es obligatorio.");
  }

  const password = await preguntarOculto("Contraseña (mínimo 8 caracteres): ");
  if (password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.");
  const confirmacion = await preguntarOculto("Repite la contraseña: ");
  if (password !== confirmacion) throw new Error("Las contraseñas no coinciden.");

  const hash = await bcrypt.hash(password, 10);

  if (existentes.length > 0) {
    await pool.query(
      `UPDATE usuarios
       SET password_hash = ?, rol_id = ?, estado = 'activo', intentos_fallidos = 0, bloqueado_hasta = NULL
       WHERE id = ?`,
      [hash, rolId, existentes[0].id]
    );
    await pool.query(
      `INSERT INTO auditoria (usuario_id, accion, tabla_afectada, registro_id, detalle)
       VALUES (NULL, 'modificar', 'usuarios', ?, 'Contraseña restablecida desde la terminal del servidor')`,
      [existentes[0].id]
    );
    console.log(`\n✅ Contraseña restablecida. "${usuario}" ya puede iniciar sesión como Administrador.\n`);
  } else {
    const [res] = await pool.query(
      `INSERT INTO usuarios (nombre, usuario, password_hash, rol_id, estado) VALUES (?, ?, ?, ?, 'activo')`,
      [nombre, usuario, hash, rolId]
    );
    await pool.query(
      `INSERT INTO auditoria (usuario_id, accion, tabla_afectada, registro_id, detalle)
       VALUES (NULL, 'crear', 'usuarios', ?, 'Administrador creado desde la terminal del servidor')`,
      [res.insertId]
    );
    console.log(`\n✅ Administrador "${usuario}" creado. Ya puede iniciar sesión en /admin/login.\n`);
  }
}

main()
  .catch((err) => {
    console.error(`\n❌ ${err.message}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    rl.close();
    await pool.end();
  });
