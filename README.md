# 🤖 CP Club Bot 

Bot oficial para la gestión automatizada de asistencias, seguimiento de progreso académico, evaluaciones técnicas y rankings de **CPC** y **HUB**.

---

## 🛠️ Guía Rápida para Administradores y Mentores

Todos los comandos administrativos requieren el permiso de **Gestionar Servidor (`Manage Server`)** en Discord.

| Comando | Descripción | Ejemplo de Uso |
| :--- | :--- | :--- |
| `/iniciar-sesion` | Genera un código OTP de 6 caracteres con tiempo límite para check-in. | `/iniciar-sesion sesion_id:1 minutos:15` |
| `/resumen-sesion` | Muestra en tiempo real la lista de presentes, ausentes y el porcentaje de quórum. | `/resumen-sesion sesion_id:1` |
| `/importar-standings` | Abre un modal para pegar el texto de la tabla de posiciones de Codeforces (Mashup o Grupo) y calificar en lote. | `/importar-standings sesion_id:1 puntos_por_problema:20` |
| `/sincronizar-codeforces` | Consulta la API pública de Codeforces para calificar problemas específicos o concursos del Gym. | `/sincronizar-codeforces sesion_id:1 contest_id:106540 puntos_por_problema:10` |
| `/calificar-mock` | Asigna puntaje numérico (0-100) y retroalimentación técnica de una Mock Interview. | `/calificar-mock correo:alumno@uady.mx sesion_id:2 puntaje:85 feedback:Buen manejo de DP` |
| `/calificar-concurso` | Registra manualmente una calificación individual extemporánea. | `/calificar-concurso correo:alumno@uady.mx sesion_id:1 puntaje:60` |
| `/justificar-falta` | Registra una ausencia justificada para que compute a favor del porcentaje de asistencia. | `/justificar-falta correo:alumno@uady.mx sesion_id:1 motivo:Cruce de horario académico` |

### 📋 Flujo de Trabajo Semanal Recomendado

1. **Al iniciar la clase/taller:** Ejecuta `/iniciar-sesion sesion_id:X minutos:15`. Comparte el código generado con los asistentes.
2. **Durante la clase:** Monitorea los check-ins con `/resumen-sesion sesion_id:X`.
3. **Al finalizar un contest en Grupo Privado:** Abre la tabla de *Standings* en Codeforces, copia las filas (`Ctrl + C`), ejecuta `/importar-standings sesion_id:X` y pega el contenido en la ventana emergente.

---

## 🎓 Guía para Alumnos y Participantes

Comandos públicos disponibles para todos los miembros registrados en el club.

| Comando | Descripción | Cuándo Usarlo |
| :--- | :--- | :--- |
| `/vincular` | Enlaza tu cuenta de Discord con tu correo institucional y tu handle de Codeforces. | **Paso obligatorio inicial** antes de usar cualquier otra función del bot. |
| `/asistencia` | Registra tu asistencia a la clase activa introduciendo el código OTP de 6 caracteres. | Durante los primeros minutos de cada sesión cuando el mentor proyecte el código. |
| `/mi-progreso` | Muestra tu porcentaje de asistencia en CPC y HUB, puntos acumulados, feedback de mentores y estatus de elegibilidad para la **Industry Mock**. | En cualquier momento para auditar tu rendimiento. |
| `/leaderboard` | Despliega la tabla de clasificación Top 10 general o filtrada por track (`CPC` o `HUB`). | Para consultar el ranking competitivo semanal. |

---

## ⚙️ Arquitectura Técnica y Configuración

### Requisitos Previos
* **Node.js** v18 o superior.
* Base de datos PostgreSQL en **Supabase**.
* Aplicación y Bot configurados en el **Discord Developer Portal**.

## Inicialización y Despliegue

# 1. Instalar dependencias
`npm install`

# 2. Desplegar / Actualizar Slash Commands en Discord
`node deploy-commands.js`

# 3. Iniciar el bot en producción
`node index.js`

### Plan de Prueba Inmediato en Discord

Ejecuta estas pruebas en orden para validar el sistema:

1. **Prueba de Vinculación:**  
   Escribe `/vincular correo:tu_correo@institucion.edu codeforces:Maricharmen`.  
   *Debe responderte con un mensaje efímero confirmando tu vinculación.*

2. **Prueba de Asistencia OTP:**  
   * Ejecuta `/iniciar-sesion sesion_id:1 minutos:15`.  
   * Copia el código de 6 caracteres recibido y escribe `/asistencia codigo:CODIGO`.

3. **Prueba de Calificación por Modal:**  
   * Ejecuta `/importar-standings sesion_id:1 puntos_por_problema:20`.  
   * En el modal pega `Maricharmen 2` o `1  Maricharmen  2  0  +  +` y envía.

4. **Prueba de Auditoría y Ranking:**  
   * Escribe `/mi-progreso` para verificar que tus 40 puntos y asistencia aparezcan reflejados.  
   * Escribe `/leaderboard programa:CPC` para confirmar tu posición en el Top 10.