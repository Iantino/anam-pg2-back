-- =====================================================================
-- Cambio: Biografía del alcalde
-- Crea la tabla que guarda la biografía que se muestra en el sitio
-- público (/alcalde) y que se edita desde el panel (/admin/alcalde).
--
-- Es un registro único (id = 1), igual que la tabla `institucion`.
-- Se puede ejecutar más de una vez sin problema (IF NOT EXISTS / IGNORE).
-- =====================================================================

USE municipalidad_sanpablojocopilas;

CREATE TABLE IF NOT EXISTS `biografia_alcalde` (
  `id` int NOT NULL DEFAULT '1',

  -- Datos generales
  `nombre_completo` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `cargo` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Alcalde Municipal',
  `periodo` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Ej. 2024 - 2028',
  `partido_politico` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `foto_ruta` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'nombre del archivo en uploads/alcalde',

  -- Datos personales
  `fecha_nacimiento` date DEFAULT NULL,
  `lugar_nacimiento` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `familia` text COLLATE utf8mb4_unicode_ci,

  -- Contenido de la biografía (los campos de lista usan un elemento por línea)
  `resumen` text COLLATE utf8mb4_unicode_ci COMMENT 'Presentación / reseña biográfica',
  `formacion_academica` text COLLATE utf8mb4_unicode_ci,
  `trayectoria_profesional` text COLLATE utf8mb4_unicode_ci,
  `trayectoria_politica` text COLLATE utf8mb4_unicode_ci COMMENT 'Servicio público y cargos anteriores',
  `logros` text COLLATE utf8mb4_unicode_ci COMMENT 'Logros y reconocimientos',
  `ejes_trabajo` text COLLATE utf8mb4_unicode_ci COMMENT 'Ejes o prioridades de su gestión',
  `mensaje` text COLLATE utf8mb4_unicode_ci COMMENT 'Mensaje a la población',

  -- Control
  `publicado` tinyint(1) NOT NULL DEFAULT '0',
  `actualizado_por` int DEFAULT NULL,
  `fecha_actualizacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  KEY `fk_biografia_usuario` (`actualizado_por`),
  CONSTRAINT `chk_biografia_single_row` CHECK ((`id` = 1)),
  CONSTRAINT `fk_biografia_usuario` FOREIGN KEY (`actualizado_por`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Fila inicial vacía y sin publicar: el sitio mostrará "próximamente"
-- hasta que el administrador la complete y marque "publicado".
INSERT IGNORE INTO `biografia_alcalde` (`id`) VALUES (1);
