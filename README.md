# Single Admin API

API NestJS de solo lectura para las colecciones MongoDB de Single.

1. Copia `.env.example` a `.env` y completa los valores.
2. Instala dependencias con `npm install`.
3. Inicia con `npm run start:dev`.

Swagger queda disponible en `http://localhost:3100/api/docs`. La cuenta MongoDB
de la aplicación debe tener exclusivamente permisos de lectura. Este proyecto
no contiene migraciones, creación de índices ni operaciones de escritura.

La “última interacción” se calcula de forma estimada y en tiempo de consulta a
partir de eventos ya existentes. El dashboard conserva el resumen en memoria
durante cinco minutos para limitar la carga de lectura sobre MongoDB.
