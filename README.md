# EduTrack – Guía de uso y despliegue

## 📁 Estructura del proyecto

```
edutrack/
├── index.html          # Estructura principal de la app
├── styles.css          # Estilos (modo claro/oscuro, responsive)
├── app.js              # Lógica completa (IndexedDB, navegación, módulos)
├── manifest.json       # Configuración PWA
├── service-worker.js   # Cache offline y estrategia de red
├── icons/
│   ├── icon-72.png
│   ├── icon-96.png
│   ├── icon-128.png
│   ├── icon-144.png
│   ├── icon-152.png
│   ├── icon-192.png
│   ├── icon-384.png
│   └── icon-512.png
└── README.md
```

---

## 🚀 Despliegue en GitHub Pages

### Paso 1 – Crear repositorio en GitHub
1. Entrá a [github.com](https://github.com) e iniciá sesión.
2. Hacé clic en **"New repository"**.
3. Poné un nombre, ej: `edutrack`.
4. Dejá el repositorio **Public** y hacé clic en **"Create repository"**.

### Paso 2 – Subir los archivos
Tenés dos opciones:

**Opción A – Desde el navegador (más sencillo):**
1. En el repositorio recién creado, hacé clic en **"uploading an existing file"**.
2. Arrastrá TODOS los archivos del proyecto (incluyendo la carpeta `icons/`).
3. Hacé clic en **"Commit changes"**.

**Opción B – Usando Git (terminal):**
```bash
cd carpeta-del-proyecto
git init
git add .
git commit -m "Initial commit: EduTrack PWA"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/edutrack.git
git push -u origin main
```

### Paso 3 – Activar GitHub Pages
1. En el repositorio, andá a **Settings → Pages**.
2. En "Source", seleccioná **"Deploy from a branch"**.
3. En "Branch", elegí **`main`** y la carpeta **`/ (root)`**.
4. Hacé clic en **"Save"**.
5. Esperá 1-2 minutos y la app estará disponible en:
   `https://TU_USUARIO.github.io/edutrack/`

---

## 📱 Instalar en el celular (como app)

### Android (Chrome):
1. Abrí la URL de GitHub Pages en Chrome.
2. Aparecerá un banner **"Añadir a pantalla de inicio"** – tocalo.
3. O usá el menú (⋮) → **"Instalar aplicación"**.

### iPhone/iPad (Safari):
1. Abrí la URL en Safari.
2. Tocá el ícono de compartir (□↑).
3. Seleccioná **"Añadir a pantalla de inicio"**.
4. Confirmá el nombre y tocá **"Añadir"**.

### Computadora (Chrome/Edge):
1. Abrí la URL en Chrome o Edge.
2. En la barra de direcciones aparece un ícono de instalación (⊕).
3. Hacé clic en él y luego en **"Instalar"**.

---

## 🧩 Módulos y funcionamiento

### 🏠 Panel principal (Home)
- Lista ordenada alfabéticamente de todos los estudiantes.
- **Buscador** en tiempo real por nombre o email.
- **Chips de estadísticas**: total de estudiantes, asistencia media, fichas médicas y clases dictadas.
- Botón **FAB (+)** para agregar nuevos estudiantes.
- **Menú (⋮)**: exportar/importar JSON, borrar datos.

### 📅 Módulo de Asistencia
- Genera automáticamente las fechas desde el **17 de marzo** en adelante, únicamente **martes y jueves**.
- Permite marcar **presente (✓)** o **ausente (✗)** por fecha.
- Tocar el mismo estado lo **desmarca** (queda sin marcar).
- Barra visual con porcentaje de asistencia calculado sobre los días marcados.
- Soporte para carga retroactiva de cualquier fecha pasada.

### 📝 Módulo de Notas
- Registro diferenciado entre **prácticas** y **teóricas**.
- Notas con descripción y valor numérico (0–10, decimales soportados).
- **Promedio automático** visible al pie de cada sección.
- Eliminación individual de notas con un clic.

### 💬 Módulo de Observaciones
- Texto libre por estudiante, guardado con **fecha y hora automática**.
- Visualización en **timeline** (más reciente primero).
- Posibilidad de **editar** y **eliminar** cada observación.
- Diseño limpio tipo tarjeta con línea lateral verde.

### 🏥 Módulo Médico
- Toggle on/off para indicar si el estudiante entregó la **ficha médica**.
- Campo de texto libre para registrar condiciones de salud, alergias, discapacidades o indicaciones especiales.
- Guardado con botón y confirmación visual.

### 💾 Persistencia de datos
- Datos guardados en **IndexedDB** (persistente entre sesiones).
- Fallback a `localStorage` si IndexedDB no está disponible.
- **Exportar**: descarga un archivo `.json` con todos los datos.
- **Importar**: carga un backup `.json` (reemplaza datos actuales).

### 🎨 Temas claro/oscuro
- Detección automática del tema del sistema.
- Cambio manual con el ícono 🌙/☀️ en el encabezado.
- Preferencia guardada en `localStorage`.

---

## ⚡ Funciona offline
Una vez que la app fue abierta al menos una vez con conexión, **funciona sin internet** gracias al service worker. Los datos siempre se guardan localmente en el dispositivo.

---

## 🛠 Personalización rápida

Para cambiar la fecha de inicio de clases, editá en `app.js`:
```javascript
START_DATE: new Date(2025, 2, 17), // año, mes (0=enero), día
```

Para cambiar los días de clase (0=Dom, 1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sáb):
```javascript
CLASS_DAYS: [2, 4], // 2=Martes, 4=Jueves
```
