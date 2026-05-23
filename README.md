# FocusBoard (Sistema Tipo Jira Personal)

Este es un sistema de gestión de tareas Fullstack (React + Node.js + SQLite) creado con la ayuda de IA.

## Características Principales
1. **Múltiples Vistas:** Tablero Kanban (Drag & Drop), Lista, Calendario y Gráficas de Reportes.
2. **Personalización:** Soporte nativo para modo oscuro y fondos personalizados usando la API de Unsplash. Cambia el nombre de tu entorno desde los Ajustes.
3. **Inteligencia Artificial:** Usa ChatGPT (OpenAI API Key) para que la herramienta descomponga tareas grandes en subtareas por ti.
4. **Markdown y Archivos:** Crea descripciones usando Markdown para código y texto enriquecido. Sube archivos locales (`multer`) a tus tarjetas.
5. **Productividad:** Temporizador (Time Tracking) integrado en cada tarjeta para medir tu tiempo de trabajo y Registro de Actividad para ver un historial de tus movimientos.

## Cómo empezar
1. Asegúrate de tener Node.js instalado.
2. Clona este repositorio y entra en la carpeta.
3. Ejecuta `npm install`
4. Ejecuta `npm run dev` para iniciar el Backend y el Frontend al mismo tiempo.
5. Ve a `http://localhost:5173` y crea una cuenta.

*Nota: La base de datos es local (`server/database.sqlite`) y las contraseñas están encriptadas con `bcryptjs`.*
