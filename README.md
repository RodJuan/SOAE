# SOAE v4.2 // Sistema de Orquestación Autónoma de Emergencias
### *Autonomous Emergency Orchestration System*

An offline-first, real-time tactical dashboard and disaster management command center built in React, TypeScript, and Tailwind CSS. The system integrates predictive AI simulation (digital twin stress-testing), automatic IoT telemetry dispatcher orchestration, residual vulnerability analysis, and robust multi-mode local-first or Firebase cloud-synchronized states.

---

## 🎨 Características / Key Features

- **Dynamic Theme Selector / Selector de Temas**:
  - **Terminal Cyberpunk (Default)**: Dark tactical matrix HUD ideal for low-light command environments.
  - **Firestore Professional Light (White Theme)**: Clean, high-contrast, modern layout styled after the Google Cloud / Firebase console for daytime command operations.
- **Evaluation Sandbox Mode / Modo de Evaluación**:
  - Access the complete system instantly without requiring pre-configured passwords, databases, or Firebase permissions. Perfect for classroom demonstrations, evaluations, and mock operations.
- **Bilingual Receptive Interface / Interfaz Bilingüe**:
  - Full support for both Spanish and English commands, HUD interfaces, alerts, and real-time synthesized audio announcements.
- **Residual Vulnerability Index (IVR / RVI)**:
  - Real-time sector-by-sector risk assessments factoring in population density, localized incidents, and rescue unit dispatch travel times (ETA).
- **Digital Twin & Stochastic Stress-Testing**:
  - Predictive simulation engine to stress-test city infrastructure, roads, and emergency response capabilities under major disasters (Earthquakes, Floods, Wildfires).
- **Tactical Map (GIS Integration)**:
  - Interactive map canvas supporting hazard area routing, obstacle avoidance, automatic dispatch recommendation triggers, and manual station deployment.

---

## 🚀 Instalación y Uso Local / Installation & Local Setup

### Prerrequisitos / Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- npm (v9+)

### Pasos / Setup Steps
1. **Clonar el repositorio / Clone the repository**:
   ```bash
   git clone <your-github-repo-url>
   cd <project-folder>
   ```

2. **Instalar dependencias / Install dependencies**:
   ```bash
   npm install
   ```

3. **Iniciar servidor de desarrollo / Start development server**:
   ```bash
   npm run dev
   ```
   Abre [http://localhost:3000](http://localhost:3000) en tu navegador para ver la aplicación.

4. **Compilar para producción / Build for production**:
   ```bash
   npm run build
   ```

---

## 🗄️ Conectando a Firebase / Firebase Connection Guide

Por defecto, la aplicación incluye un **Bypass Sandbox** que permite su uso local sin base de datos. Si deseas activar la persistencia en la nube y sincronizar múltiples pantallas en tiempo real:

1. Crea un proyecto en la [Consola de Firebase](https://console.firebase.google.com/).
2. Añade una **Web App** para obtener tus credenciales.
3. Habilita los siguientes servicios en tu proyecto de Firebase:
   - **Firestore Database**: Crea la base de datos en modo producción o prueba.
   - **Authentication**: Habilita el método de inicio de sesión **Correo electrónico/contraseña** (Email/Password) y **Autenticación Anónima** (Anonymous Authentication).
4. Sube las reglas de seguridad ejecutando:
   ```bash
   # Utilizando Firebase CLI
   firebase deploy --only firestore:rules
   ```
   *(La reglas de seguridad se encuentran pre-configuradas en el archivo `firestore.rules` de la raíz del proyecto).*

---

## 📄 Licencia y Deslinde de Responsabilidad / License & Disclaimer

Este proyecto está licenciado bajo la **Licencia MIT** (ver archivo `LICENSE` para el texto completo).

### ⚠️ EXENCIÓN DE RESPONSABILIDAD PARA GOOGLE Y TERCEROS
1. **TRABAJO INDEPENDIENTE**: Este software es un proyecto educativo independiente diseñado para simulación y evaluación académica. No está asociado, patrocinado, avalado ni respaldado por Google LLC, Alphabet Inc. o sus filiales.
2. **MODO SANDBOX**: Bajo ninguna circunstancia este software debe ser implementado como un sistema de despacho real para servicios médicos o de seguridad pública. Es una herramienta puramente simulativa y de evaluación stocástica.
3. **LIBERACIÓN DE RESPONSABILIDAD**: Al descargar o utilizar este código, se exonera completamente a Google de cualquier pérdida, incidente, responsabilidad o daño que pudiera derivarse de su instalación, alojamiento, compilación o ejecución. Todo riesgo es asumido exclusivamente por el usuario final.
