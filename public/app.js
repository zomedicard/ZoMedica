// =================================================================
// SECCIÓN: ESTADO GLOBAL E INICIALIZACIÓN
// =================================================================
let token = localStorage.getItem('token');
let userName = localStorage.getItem('nombre');
let userTipo = localStorage.getItem('rol');
let userId = localStorage.getItem('userId');
let seccionActual = 'inicio';   // CORRECCIÓN 1: VARIABLE AÑADIDA
let seccionAnterior = 'inicio';
const globalMessage = document.getElementById('globalMessage');

document.addEventListener('DOMContentLoaded', () => {
    handleUrlParams();
    actualizarNav();
      if (token) {
        actualizarContadorNotificaciones();
    }
    mostrarInicio();
}); 


// =================================================================
// SECCIÓN: MANEJO DE NAVEGACIÓN (VISTAS)
// =================================================================

// REEMPLAZA TU FUNCIÓN mostrarSeccion CON ESTA VERSIÓN MÁS ROBUSTA

function mostrarSeccion(id) {
    // 1. Antes de hacer nada, si la nueva sección es diferente a la actual,
    // guardamos la actual como la "anterior".
    if (id !== seccionActual) {
        seccionAnterior = seccionActual;
    }

    // 2. Ocultamos todas las secciones como siempre.
    document.querySelectorAll('section').forEach(sec => sec.style.display = 'none');

    // 3. Mostramos la sección que se nos pidió.
    const seccion = document.getElementById(id);
    if (seccion) {
        seccion.style.display = 'block';
        // 4. Finalmente, actualizamos nuestra variable para que sepa cuál es la sección visible ahora.
        seccionActual = id;
    }

    // El resto de la función se mantiene igual.
    if (globalMessage) {
        globalMessage.style.display = 'none';
    }
}

function goBack() {
    // Usamos la variable 'seccionAnterior' para decidir a dónde volver,
    // y llamamos a la función específica para recargar los datos.
    switch (seccionAnterior) {
        case 'inicio':
            mostrarInicio();
            break;
        case 'vacantes':
            mostrarVacantes();
            break;
        case 'instituciones':
            mostrarInstituciones();
            break;
        case 'profesionales':
            mostrarProfesionales();
            break;
        default:
            mostrarInicio(); // Opción segura si algo falla
            break;
    }
}

// REEMPLAZA TU FUNCIÓN mostrarInicio() CON ESTA VERSIÓN MEJORADA

async function mostrarInicio() {
    mostrarSeccion('inicio');
    const saludoUsuario = document.getElementById('saludoUsuario');
    const listaVacantesInicio = document.getElementById('listaVacantesInicio');
    
    const btnEncontrar = document.getElementById('btnEncontrarEmpleo');
    const btnPublicar = document.getElementById('btnPublicarVacante');

    if (token) { // Si el usuario ha iniciado sesión
        if (userTipo === 'profesional') {
            btnEncontrar.style.display = 'inline-block'; 
            btnPublicar.style.display = 'none';          
        } else if (userTipo === 'institucion') {
            btnEncontrar.style.display = 'none';         
            btnPublicar.style.display = 'inline-block';
            // --- ¡AQUÍ ESTÁ LA MAGIA! ---
            // Cambiamos la función del botón para que lleve al formulario de vacantes.
            btnPublicar.onclick = mostrarFormularioVacante; 
        }
    } else { // Si no ha iniciado sesión, muestra ambos y los dirige al registro
        btnEncontrar.style.display = 'inline-block';
        btnPublicar.style.display = 'inline-block';
        // Se asegura de que el botón lleve al registro para usuarios no logueados
        btnPublicar.onclick = mostrarRegistro; 
    }

    // El resto de la función se mantiene igual
    if (!saludoUsuario || !listaVacantesInicio) return;

    saludoUsuario.innerHTML = '';
    saludoUsuario.style.display = 'none';
    listaVacantesInicio.innerHTML = 'Cargando vacantes recientes...';

    if (userName) {
        saludoUsuario.textContent = `¡Hola de nuevo, ${userName}!`;
        saludoUsuario.style.display = 'block';
    }

    try {
        const response = await fetch(`http://localhost:3000/vacantes`);
        const vacantes = await response.json();
        const vacantesRecientes = vacantes.sort((a, b) => b.id - a.id).slice(0, 3);
        
        listaVacantesInicio.innerHTML = '';
        if (vacantesRecientes.length === 0) {
            listaVacantesInicio.innerHTML = '<p>No se encontraron vacantes recientes.</p>';
        } else {
            vacantesRecientes.forEach(vacante => {
                const vacanteDiv = document.createElement('div');
                vacanteDiv.className = 'vacante';
                const descripcionCorta = (vacante.descripcion || '').substring(0, 100);
                const keywordsHTML = (vacante.keywords || []).map(kw => `<span class="keyword-tag">${kw}</span>`).join('');

                vacanteDiv.innerHTML = `
                    <a href="#" onclick="mostrarVacanteDetalles(${vacante.id})"><h4>${vacante.titulo}</h4></a>
                    <p><strong>Institución:</strong> ${vacante.institucion}</p>
                    ${vacante.ubicacion ? `<p class="vacante-ubicacion">${vacante.ubicacion}</p>` : ''}
                    <p>${descripcionCorta}...</p>
                    <div class="keywords-container">${keywordsHTML}</div>
                `;
                listaVacantesInicio.appendChild(vacanteDiv);
            });
        }
    } catch (error) {
        listaVacantesInicio.innerHTML = '<p>Error al cargar las vacantes.</p>';
        console.error('Error al cargar vacantes de inicio:', error);
    }
}

function mostrarRegistro() {
    mostrarSeccion('registro');
}

function mostrarLogin() {
    mostrarSeccion('login');
}

function mostrarProfesionales(postulacionIdParaResaltar = null) { // ✨ Acepta un parámetro opcional
    if (!token || userTipo !== 'profesional') {
        alert('Acceso denegado.');
        return mostrarLogin();
    }
    mostrarSeccion('profesionales');
    cargarPostulacionesProfesional(postulacionIdParaResaltar); // ✨ Pasa el ID a la función de carga
}

// BORRA TU FUNCIÓN ANTERIOR Y PEGA ESTA EN SU LUGAR

async function mostrarInstituciones() {
    // 1. Verificación de seguridad (esto se mantiene igual)
    if (!token || userTipo !== 'institucion') {
        alert('Acceso denegado.');
        return mostrarLogin();
    }
    mostrarSeccion('instituciones');

    // 2. Personaliza el saludo y muestra "Cargando..."
    document.getElementById('nombreInstitucionPanel').textContent = `Panel de ${userName}`;
    document.getElementById('misVacantes').innerHTML = 'Cargando...';
    document.getElementById('postulacionesRecibidas').innerHTML = 'Cargando...';

    try {
        // 3. Pide al servidor los datos de vacantes y postulaciones al mismo tiempo
        const [vacantesRes, postulacionesRes] = await Promise.all([
            fetch('http://localhost:3000/institucion/vacantes', { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch('http://localhost:3000/institucion/postulaciones', { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        const vacantes = await vacantesRes.json();
        const postulaciones = await postulacionesRes.json();

        // 4. Actualiza las tarjetas de estadísticas con los números reales
        document.getElementById('statTotalVacantes').textContent = vacantes.length;
        document.getElementById('statTotalPostulaciones').textContent = postulaciones.length;
        
        // 5. Dibuja la lista de vacantes publicadas
        const misVacantesDiv = document.getElementById('misVacantes');
        misVacantesDiv.innerHTML = '';
        if (vacantes.length === 0) {
            misVacantesDiv.innerHTML = '<p>No has publicado ninguna vacante.</p>';
        } else {
            vacantes.forEach(v => {
                const vacanteDiv = document.createElement('div');
                vacanteDiv.className = 'vacante';
                vacanteDiv.innerHTML = `
                    <a href="#" onclick="mostrarPipelinePorVacante(${v.id}, '${v.titulo}')" class="vacante-link">
                        <h4>${v.titulo}</h4>
                        <p>${v.descripcion.substring(0, 80)}...</p>
                    </a>
                    <button class="delete" onclick="eliminarVacante(${v.id})"><i class="fas fa-trash-alt"></i></button>
                `;
                misVacantesDiv.appendChild(vacanteDiv);
            });
        }

        // 6. Dibuja la lista de las últimas postulaciones
        const postulacionesDiv = document.getElementById('postulacionesRecibidas');
        postulacionesDiv.innerHTML = '';
        if (postulaciones.length === 0) {
            postulacionesDiv.innerHTML = '<p>No has recibido postulaciones.</p>';
        } else {
            postulaciones.slice(0, 5).forEach(p => {
                const pDiv = document.createElement('div');
                pDiv.className = 'postulacion-institucion';
                pDiv.innerHTML = `<p><strong>${p.profesional_nombre}</strong> se postuló a <strong>${p.vacante_titulo}</strong></p>`;
                postulacionesDiv.appendChild(pDiv);
            });
        }

    } catch (error) {
        console.error("Error al cargar el dashboard:", error);
        document.getElementById('misVacantes').innerHTML = '<p class="error">Error al cargar datos.</p>';
        document.getElementById('postulacionesRecibidas').innerHTML = '<p class="error">Error al cargar datos.</p>';
    }
}


function mostrarPipelinePorVacante(vacanteId, tituloVacante) {
    // La corrección está aquí:
    // Buscamos el h2 con id="pipelineTituloVacante" que está en la sección del pipeline.
    const tituloPipeline = document.getElementById('pipelineTituloVacante');

    if (tituloPipeline) {
        tituloPipeline.textContent = `Pipeline para: ${tituloVacante}`;
    }

    // Mostramos la sección correcta
    mostrarSeccion('pipelineVacante');

    // Le decimos a la función que cargue los postulantes para esa vacante en modo pipeline
    cargarPostulacionesInstitucion(vacanteId, true);
}

// Versión actualizada para el pipeline
async function cargarFiltroDeVacantes() {
    // Esta función ahora también servirá para el filtro del pipeline
    const filtroVacantePipeline = document.getElementById('filtroVacantePipeline');
    if (!filtroVacantePipeline) return;

    while (filtroVacantePipeline.options.length > 1) {
        filtroVacantePipeline.remove(1);
    }

    try {
        const response = await fetch('http://localhost:3000/institucion/vacantes', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const vacantes = await response.json();

        vacantes.forEach(v => {
            const option = document.createElement('option');
            option.value = v.id;
            option.textContent = v.titulo;
            filtroVacantePipeline.appendChild(option);
        });
    } catch (error) {
        console.error('Error al cargar el filtro de vacantes:', error);
    }
}

function mostrarNotificaciones() {
    if (!token) {
        alert('Debes iniciar sesión para ver tus notificaciones.');
        return mostrarLogin();
    }
    mostrarSeccion('notificaciones');
    cargarNotificaciones();
}

async function cargarNotificaciones() {
    const listaNotificaciones = document.getElementById('listaNotificaciones');
    if (!listaNotificaciones) return; // Si no encuentra el div, no hace nada.

    listaNotificaciones.innerHTML = 'Cargando notificaciones...';

    try {
        const response = await fetch('http://localhost:3000/notificaciones', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error('La respuesta del servidor no fue exitosa.');
        }

        const notificaciones = await response.json();

        // --- INICIO: Lógica para el contador que hicimos antes ---
        const notificacionesNoLeidas = notificaciones.filter(n => !n.leida).length;
        const notifCountSpan = document.getElementById('notification-count');
        if (notifCountSpan) {
            if (notificacionesNoLeidas > 0) {
                notifCountSpan.textContent = notificacionesNoLeidas;
                notifCountSpan.style.display = 'flex';
            } else {
                notifCountSpan.style.display = 'none';
            }
        }
        // --- FIN: Lógica para el contador ---

        listaNotificaciones.innerHTML = ''; // Limpiamos el mensaje "Cargando..."

        if (notificaciones.length === 0) {
            listaNotificaciones.innerHTML = '<p>No tienes notificaciones en este momento.</p>';
            return;
        }

        notificaciones.forEach(n => {
            const notificacionDiv = document.createElement('div');

            // Asigna la clase correcta si está leída o no
            notificacionDiv.className = n.leida ? 'notificacion leida' : 'notificacion';

            // Asigna la función de clic para marcar como leída
            notificacionDiv.setAttribute('onclick', `abrirNotificacion(${n.id}, this, '${n.url}')`);

            // Crea el contenido HTML de la notificación
            notificacionDiv.innerHTML = `
                <p>${n.mensaje}</p>
                <small>${new Date(n.fecha).toLocaleString()}</small>
            `;

            // Añade la notificación a la lista en la página
            listaNotificaciones.appendChild(notificacionDiv);
        });

    } catch (error) {
        console.error('Error al cargar las notificaciones:', error);
        listaNotificaciones.innerHTML = '<p>Ocurrió un error al cargar tus notificaciones.</p>';
    }
}

async function abrirNotificacion(notificacionId, elemento, url) {
    // Primero, la marca como leída si no lo está ya.
    if (!elemento.classList.contains('leida')) {
        await marcarNotificacionComoLeida(notificacionId, elemento);
    }

    if (!url) return;

    // Lógica para navegar a la sección correcta según la URL.
    if (url.startsWith('pipeline/')) {
        const parts = url.split('/');
        const vacanteId = parseInt(parts[1]);
        const tituloVacante = decodeURIComponent(parts[2]);
        if (!isNaN(vacanteId) && tituloVacante) {
            mostrarPipelinePorVacante(vacanteId, tituloVacante);
        }
    } else if (url.startsWith('postulacion/')) { // ✨ NUEVA LÓGICA
        const parts = url.split('/');
        const postulacionId = parseInt(parts[1]);
        if (!isNaN(postulacionId)) {
            // Llama a la vista de postulaciones y le pasa el ID para resaltarlo
            mostrarProfesionales(postulacionId);
        }
    } else if (url.startsWith('vacante/')) { // Mantenemos la lógica anterior por si acaso
        const parts = url.split('/');
        const vacanteId = parseInt(parts[1]);
        if (!isNaN(vacanteId)) {
            mostrarVacanteDetalles(vacanteId);
        }
    }
}

async function marcarNotificacionComoLeida(notificacionId, elemento) {
    // 1. Si la notificación ya está leída, no hacemos nada.
    if (elemento.classList.contains('leida')) {
        return; 
    }

    // 2. Cambia el estilo INMEDIATAMENTE para que el usuario vea el cambio.
    elemento.classList.add('leida');

    // 3. Llama a la API para guardar el cambio en la base de datos.
    try {
        await fetch(`http://localhost:3000/notificaciones/${notificacionId}/leida`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        // 4. Actualiza el contador de la barra de navegación.
        const notifCountSpan = document.getElementById('notification-count');
        let count = parseInt(notifCountSpan.textContent) - 1;

        if (count > 0) {
            notifCountSpan.textContent = count;
        } else {
            notifCountSpan.style.display = 'none';
        }

    } catch (error) {
        console.error('Error al marcar notificación como leída:', error);
        // Si algo falla, revierte el cambio visual para no confundir al usuario.
        elemento.classList.remove('leida');
    }
}

function mostrarPerfilProfesional() {
    if (!token || userTipo !== 'profesional') {
        alert('Acceso denegado.');
        return mostrarLogin();
    }
    mostrarSeccion('perfilProfesional');
    cargarPerfilProfesional();
}

function mostrarFormularioEditarPerfil() {
    mostrarSeccion('editarPerfil');
    cargarDatosPerfilProfesional();
}

function mostrarFormularioEditarInstitucion() {
    mostrarSeccion('editarPerfilInstitucion');
    cargarDatosPerfilInstitucion();
}

function mostrarFormularioVacante() {
    mostrarSeccion('formularioVacante');
    // Llamamos a la nueva función para rellenar el menú desplegable del formulario
    popularDropdownProvincias('vacanteUbicacion');
}

function mostrarPerfilPublicoInstitucion(institucionId) {
    mostrarSeccion('perfilPublicoInstitucion');
    cargarPerfilPublicoInstitucion(institucionId);
}

// =================================================================
// SECCIÓN: FUNCIONES DE UI Y UTILIDADES
// =================================================================
function mostrarMensajeGlobal(message, type) {
    if (globalMessage) {
        globalMessage.textContent = message;
        globalMessage.className = 'message-inline ' + type;
        globalMessage.style.display = 'block';
    }
}
function actualizarNav() {
    const navLinks = {
        btnProfesionales: document.getElementById('btnProfesionales'),
        btnNotificaciones: document.getElementById('btnNotificaciones'),
        btnPanelInstitucion: document.getElementById('btnPanelInstitucion'),
        btnRegistrarse: document.getElementById('btnRegistrarse'),
        btnLogin: document.getElementById('btnLogin'),
        btnLogout: document.getElementById('btnLogout'),
        btnBuscarTalentos: document.getElementById('btnBuscarTalentos'),
        btnPerfilProfesional: document.getElementById('btnPerfilProfesional')
    };

    Object.values(navLinks).forEach(btn => {
        if (btn) btn.style.display = 'none';
    });

    if (token) {
        navLinks.btnRegistrarse.style.display = 'none';
        navLinks.btnLogin.style.display = 'none';
        navLinks.btnLogout.style.display = 'inline-block';

        if (userTipo === 'profesional') {
            navLinks.btnProfesionales.style.display = 'inline-block';
            navLinks.btnPerfilProfesional.style.display = 'inline-block';
            navLinks.btnNotificaciones.style.display = 'inline-block';
        } else if (userTipo === 'institucion') {
            navLinks.btnPanelInstitucion.style.display = 'inline-block';
            navLinks.btnBuscarTalentos.style.display = 'inline-block';
            navLinks.btnNotificaciones.style.display = 'inline-block';
        }
    } else {
        navLinks.btnRegistrarse.style.display = 'inline-block';
        navLinks.btnLogin.style.display = 'inline-block';
        navLinks.btnLogout.style.display = 'none';
    }
}
// AÑADE ESTA NUEVA FUNCIÓN EN LA SECCIÓN DE "FUNCIONES DE UI Y UTILIDADES" DE app.js

async function actualizarContadorNotificaciones() {
    // Si no hay token, no hace nada.
    if (!token) return;

    const notifCountSpan = document.getElementById('notification-count');
    if (!notifCountSpan) return;

    try {
        const response = await fetch('http://localhost:3000/notificaciones', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
           console.error('No se pudo verificar el estado de las notificaciones.');
           return;
        }

        const notificaciones = await response.json();
        const notificacionesNoLeidas = notificaciones.filter(n => !n.leida).length;

        if (notificacionesNoLeidas > 0) {
            notifCountSpan.textContent = notificacionesNoLeidas;
            notifCountSpan.style.display = 'flex';
        } else {
            notifCountSpan.style.display = 'none';
        }

    } catch (error) {
        console.error('Error al actualizar el contador de notificaciones:', error);
        // Oculta el contador en caso de error para no mostrar un número incorrecto.
        notifCountSpan.style.display = 'none';
    }
}

function agregarCampo(tipo, datos = {}) {
    const container = document.getElementById(`${tipo}Container`);
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'campo-dinamico';

    if (tipo === 'experiencia') {
        div.innerHTML = `
            <div class="campo-encabezado">
                <input type="text" class="campo-puesto" placeholder="Puesto" value="${datos.puesto || ''}">
                <button type="button" class="eliminar-campo-btn" onclick="eliminarCampo(this)">×</button>
            </div>
            <input type="text" class="campo-institucion" placeholder="Institución" value="${datos.institucion || ''}">
            <input type="text" class="campo-periodo" placeholder="Periodo (Ej: Enero 2020 - Diciembre 2022)" value="${datos.periodo || ''}">
            <textarea class="campo-descripcion" placeholder="Descripción de la experiencia..." rows="3">${datos.descripcion || ''}</textarea>
        `;
    } else if (tipo === 'educacion') {
        div.innerHTML = `
            <div class="campo-encabezado">
                <input type="text" class="campo-titulo" placeholder="Título" value="${datos.titulo || ''}">
                <button type="button" class="eliminar-campo-btn" onclick="eliminarCampo(this)">×</button>
            </div>
            <input type="text" class="campo-institucion" placeholder="Institución Educativa" value="${datos.institucion || ''}">
            <input type="text" class="campo-periodo" placeholder="Periodo (Ej: 2015 - 2020)" value="${datos.periodo || ''}">
        `;
    } else if (tipo === 'certificacion') {
        div.innerHTML = `
            <div class="campo-encabezado">
                <input type="text" class="campo-nombre-cert" placeholder="Nombre de la Certificación" value="${datos.nombre || ''}">
                <button type="button" class="eliminar-campo-btn" onclick="eliminarCampo(this)">×</button>
            </div>
            <input type="text" class="campo-institucion-cert" placeholder="Institución Emisora" value="${datos.institucion || ''}">
            <input type="text" class="campo-periodo-cert" placeholder="Fecha de Emisión (Ej: Marzo 2023)" value="${datos.periodo || ''}">
        `;
    }
    container.appendChild(div);
}

function eliminarCampo(btn) {
    btn.closest('.campo-dinamico').remove();
}
const spinner = document.getElementById('loadingSpinner');

function mostrarSpinner(contenedorId) {
    const contenedor = document.getElementById(contenedorId);
    if (contenedor) {
        contenedor.innerHTML = ''; // Limpiamos el contenido anterior
        spinner.style.display = 'flex'; // Mostramos el spinner
        contenedor.appendChild(spinner); // Lo movemos dentro del contenedor
    }
}

function ocultarSpinner() {
    if (spinner) {
        spinner.style.display = 'none'; // Ocultamos el spinner
    }
}

// =================================================================
// SECCIÓN: LÓGICA DE VACANTES (VISTA PÚBLICA)
// =================================================================
let filtrosCargados = false;

// REEMPLAZA TU FUNCIÓN ACTUAL CON ESTA
async function cargarFiltrosDeUbicacion() {
    // Esta bandera evita que la lista se cargue más de una vez
    if (filtrosCargados) return; 
    popularDropdownProvincias('ubicacionFilter');
    filtrosCargados = true;

    const ubicacionFilter = document.getElementById('ubicacionFilter');
    if (!ubicacionFilter) return;

    // Lista completa de provincias de la República Dominicana
    const provinciasRD = [
        "Azua", "Bahoruco", "Barahona", "Dajabón", "Distrito Nacional",
        "Duarte", "El Seibo", "Elías Piña", "Espaillat", "Hato Mayor",
        "Hermanas Mirabal", "Independencia", "La Altagracia", "La Romana",
        "La Vega", "María Trinidad Sánchez", "Monseñor Nouel", "Monte Cristi",
        "Monte Plata", "Pedernales", "Peravia", "Puerto Plata", "Samaná",
        "San Cristóbal", "San José de Ocoa", "San Juan", "San Pedro de Macorís",
        "Sánchez Ramírez", "Santiago", "Santiago Rodríguez", "Santo Domingo", "Valverde"
    ];

    // Ordenamos las provincias alfabéticamente
    provinciasRD.sort();

    // Creamos y añadimos cada provincia como una opción en el menú desplegable
    provinciasRD.forEach(provincia => {
        const option = document.createElement('option');
        option.value = provincia;
        option.textContent = provincia;
        ubicacionFilter.appendChild(option);
    });

    // Marcamos los filtros como cargados
    filtrosCargados = true;
}
// AÑADE ESTA NUEVA FUNCIÓN REUTILIZABLE EN app.js

function popularDropdownProvincias(selectElementId) {
    const selectElement = document.getElementById(selectElementId);
    if (!selectElement || selectElement.options.length > 1) return; // Si no existe o ya está lleno, no hace nada

    const provinciasRD = [
        "Azua", "Bahoruco", "Barahona", "Dajabón", "Distrito Nacional",
        "Duarte", "El Seibo", "Elías Piña", "Espaillat", "Hato Mayor",
        "Hermanas Mirabal", "Independencia", "La Altagracia", "La Romana",
        "La Vega", "María Trinidad Sánchez", "Monseñor Nouel", "Monte Cristi",
        "Monte Plata", "Pedernales", "Peravia", "Puerto Plata", "Samaná",
        "San Cristóbal", "San José de Ocoa", "San Juan", "San Pedro de Macorís",
        "Sánchez Ramírez", "Santiago", "Santiago Rodríguez", "Santo Domingo", "Valverde"
    ];
    provinciasRD.sort();

    provinciasRD.forEach(provincia => {
        const option = document.createElement('option');
        option.value = provincia;
        option.textContent = provincia;
        selectElement.appendChild(option);
    });
}

function mostrarVacantes() {
    mostrarSeccion('vacantes');
    cargarFiltrosDeUbicacion();
    cargarVacantes();
}

function aplicarFiltros() {
    const searchInput = document.getElementById('searchInput').value;
    const ubicacionFilter = document.getElementById('ubicacionFilter').value;
    const tipoContratoFilter = document.getElementById('tipoContratoFilter').value;
    cargarVacantes(searchInput, ubicacionFilter, tipoContratoFilter);
}

// ASEGÚRATE DE QUE TU FUNCIÓN cargarVacantes SEA IGUAL A ESTA

// REEMPLAZA TU FUNCIÓN cargarVacantes CON ESTA VERSIÓN FINAL Y ROBUSTA

async function cargarVacantes(query = '', ubicacion = '', tipoContrato = '') {
    const listaVacantes = document.getElementById('listaVacantes');
    if (!listaVacantes) return;

    mostrarSpinner('listaVacantes');
    
    try {
        const params = new URLSearchParams();
        if (query) params.append('q', query);
        if (ubicacion) params.append('ubicacion', ubicacion);
        if (tipoContrato) params.append('tipoContrato', tipoContrato);
        
        const response = await fetch(`http://localhost:3000/vacantes?${params.toString()}`);

        if (!response.ok) {
            throw new Error(`Error del servidor: ${response.status}`);
        }

        const vacantes = await response.json();
        
        listaVacantes.innerHTML = '';
        
        if (!vacantes || vacantes.length === 0) {
            listaVacantes.innerHTML = '<p>No se encontraron vacantes con esos criterios.</p>';
        } else {
            vacantes.forEach(vacante => {
                const vacanteDiv = document.createElement('div');
                vacanteDiv.className = 'vacante';

                // --- INICIO DE LA CORRECCIÓN CLAVE ---
                // Nos aseguramos de que cada dato exista antes de intentar mostrarlo.
                const titulo = vacante.titulo || 'Título no disponible';
                const institucion = vacante.institucion || 'Institución no especificada';
                const descripcionCorta = (vacante.descripcion || 'Sin descripción.').substring(0, 100);
                const keywordsHTML = (vacante.keywords || []).map(kw => `<span class="keyword-tag">${kw}</span>`).join('');
                const ubicacionHTML = vacante.ubicacion ? `<p class="vacante-ubicacion">${vacante.ubicacion}</p>` : '';
                // --- FIN DE LA CORRECCIÓN CLAVE ---

                vacanteDiv.innerHTML = `
                    <a href="#" onclick="mostrarVacanteDetalles(${vacante.id})"><h4>${titulo}</h4></a>
                    <p><strong>Institución:</strong> ${institucion}</p>
                    ${ubicacionHTML}
                    <p class="descripcion-corta">${descripcionCorta}...</p>
                    <div class="keywords-container">
                       ${keywordsHTML}
                    </div>
                `;
                listaVacantes.appendChild(vacanteDiv);
            });
        }
    } catch (error) {
        listaVacantes.innerHTML = '<p>Ocurrió un error crítico al cargar las vacantes. Revisa la consola para más detalles.</p>';
        console.error('Error definitivo al cargar vacantes:', error);
    } finally {
        ocultarSpinner();
    }
}

// AÑADE ESTA NUEVA FUNCIÓN COMPLETA EN app.js
function verPerfilPublicoInstitucion() {
    if (!userId) {
        // Si por alguna razón no se encuentra el ID, muestra un error en la consola
        console.error("No se pudo encontrar el ID de la institución.");
        return;
    }
    // Llama a la función que ya tenías para mostrar perfiles,
    // pero ahora le pasa el ID del propio usuario.
    mostrarPerfilPublicoInstitucion(userId);
}

function manejarClicEncontrarEmpleo() {
    // Si no hay un token (el usuario no ha iniciado sesión)
    if (!token) {
        // Muestra la sección de registro
        mostrarRegistro();
    } else {
        // Si ya inició sesión, muéstrale las vacantes
        mostrarVacantes();
    }
}

function calcularMatchScore(habilidadesProfesional, keywordsVacante) {
    if (!Array.isArray(habilidadesProfesional) || !Array.isArray(keywordsVacante) || keywordsVacante.length === 0) {
        return 0;
    }
    const skills = habilidadesProfesional.map(s => s.trim().toLowerCase());
    const keywords = keywordsVacante.map(k => k.trim().toLowerCase());
    let coincidencias = 0;
    keywords.forEach(keyword => {
        if (skills.includes(keyword)) {
            coincidencias++;
        }
    });
    const score = (coincidencias / keywords.length) * 100;
    return Math.round(score);
}

async function mostrarVacanteDetalles(vacanteId) {
    mostrarSeccion('vacanteDetalles');
    const vacanteInfoDiv = document.getElementById('vacanteInfo');
    vacanteInfoDiv.innerHTML = 'Cargando detalles de la vacante...';

    try {
        const response = await fetch(`http://localhost:3000/vacantes/${vacanteId}`);
        const vacante = await response.json();
        if (vacante.error) {
            vacanteInfoDiv.innerHTML = `<p>${vacante.error}</p>`;
            return;
        }

        let matchScoreHTML = '';
        if (token && userTipo === 'profesional') {
            try {
                const perfilRes = await fetch('http://localhost:3000/perfil', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const perfil = await perfilRes.json();
                let habilidadesDelPerfil = [];
                if (perfil.habilidades) {
                    habilidadesDelPerfil = Array.isArray(perfil.habilidades) ? perfil.habilidades : perfil.habilidades.split(',').map(h => h.trim());
                }
                const score = calcularMatchScore(habilidadesDelPerfil, vacante.keywords || []);
                matchScoreHTML = `
                    <div class="match-score">
                        <strong>Compatibilidad:</strong>
                        <div class="score-percentage">${score}%</div>
                    </div>
                `;
            } catch (error) {
                console.error("Error al calcular el match score:", error);
            }
        }

        const keywordsHTML = (vacante.keywords || []).map(kw => `<span class="keyword-tag">${kw}</span>`).join('');
        const logoUrl = vacante.institucion.logoPath ? `http://localhost:3000/${vacante.institucion.logoPath}` : 'uploads/default-avatar.png';
        const institucionLink = vacante.institucion.id ? `onclick="mostrarPerfilPublicoInstitucion(${vacante.institucion.id})"` : 'style="cursor: default; text-decoration: none;"';

        vacanteInfoDiv.innerHTML = `
            <div class="vacante-detalles-container">
                ${matchScoreHTML}
                <h2>${vacante.titulo}</h2>
                <div class="institucion-info">
                    <img src="${logoUrl}" alt="Logo de ${vacante.institucion.nombre}" class="logo-institucion-vacante">
                    <p><strong>Institución:</strong> <a href="#" ${institucionLink}>${vacante.institucion.nombre}</a></p>
                </div>
                <div class="detalles-grid">
                    ${vacante.ubicacion ? `<div><strong><i class="icon-location"></i> Ubicación:</strong><p>${vacante.ubicacion}</p></div>` : ''}
                    ${vacante.tipoContrato ? `<div><strong><i class="icon-file-text"></i> Contrato:</strong><p>${vacante.tipoContrato}</p></div>` : ''}
                    ${vacante.salario ? `<div><strong><i class="icon-dollar-sign"></i> Salario:</strong><p>${vacante.salario}</p></div>` : ''}
                </div>
                <p><strong>Descripción:</strong></p>
                <div class="descripcion-vacante">${vacante.descripcion}</div>
                <p><strong>Palabras clave:</strong> ${keywordsHTML}</p>
                <button onclick="postularse(${vacante.id})" class="postular-button">Postularse a esta vacante</button>
            </div>
        `;
    } catch (error) {
        vacanteInfoDiv.innerHTML = '<p>Error al cargar los detalles de la vacante.</p>';
        console.error('Error al cargar detalles de la vacante:', error);
    }
}

// =================================================================
// SECCIÓN: LÓGICA DE AUTENTICACIÓN
// =================================================================
if (document.getElementById('formRegistro')) {
    document.getElementById('formRegistro').addEventListener('submit', async (e) => {
        e.preventDefault();
        const nombre = document.getElementById('nombre').value;
        const correo = document.getElementById('correoRegistro').value;
        const password = document.getElementById('passwordRegistro').value;
        const rol = document.getElementById('rol').value;
        const errorRegistro = document.getElementById('errorRegistro');
        errorRegistro.textContent = '';
        try {
            const response = await fetch('http://localhost:3000/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre, correo, password, rol })
            });
            const data = await response.json();
            if (data.error) {
                errorRegistro.textContent = data.error;
            } else {
                mostrarMensajeGlobal(data.message, 'success');
                mostrarLogin();
            }
        } catch (error) {
            errorRegistro.textContent = 'Error al registrarse. Inténtalo de nuevo.';
        }
    });
}

if (document.getElementById('formLogin')) {
    document.getElementById('formLogin').addEventListener('submit', async (e) => {
        e.preventDefault();
        const correo = document.getElementById('correoLogin').value;
        const password = document.getElementById('passwordLogin').value;
        const errorLogin = document.getElementById('errorLogin');
        errorLogin.textContent = '';
        try {
            const response = await fetch('http://localhost:3000/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ correo, password })
            });
            const data = await response.json();
            if (data.error) {
                errorLogin.textContent = data.error;
            } else {
                token = data.token;
                userName = data.user.nombre;
                userTipo = data.user.rol;
                userId = data.user.id;
                localStorage.setItem('token', token);
                localStorage.setItem('nombre', userName);
                localStorage.setItem('rol', userTipo);
                localStorage.setItem('userId', userId); 

                actualizarContadorNotificaciones();

                mostrarMensajeGlobal('¡Has iniciado sesión con éxito!', 'success');
                mostrarInicio();
                actualizarNav();
            }
        } catch (error) {
            errorLogin.textContent = 'Error al iniciar sesión. Inténtalo de nuevo.';
        }
    });
}

// app.js (Modificar la función handleLogin)

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        
        if (response.ok) {
            // ... (Tu código de éxito: guardar token, actualizar nav, mostrar dashboard)
        } else {
            // LÓGICA DE VERIFICACIÓN DE EMAIL AQUÍ
            if (data.requiereVerificacion) {
                mostrarMensajeGlobal(data.error + ' Por favor, revise su bandeja de entrada.', 'error');
                // Opcional: Mostrar un botón de Reenviar Email de Verificación
            } else {
                mostrarMensajeGlobal(data.error || 'Credenciales inválidas.', 'error');
            }
        }
    } catch (error) {
        // ... (Tu código de manejo de errores)
    }
}

// app.js (Modificar la función handleRegister)

async function handleRegister(e) {
    e.preventDefault();
    // ... (Tu código para obtener los valores del formulario)
    
    try {
        const response = await fetch('/register', {
            // ... (Tu fetch call)
        });

        const data = await response.json();

        if (response.ok) {
            // Mostrar mensaje de éxito incluyendo el aviso de verificación
            mostrarMensajeGlobal(data.message, 'success'); 
            // Limpiar el formulario y mostrar el login para que intente iniciar sesión
            document.getElementById('formRegistro').reset();
            mostrarLogin();
        } else {
            // ... (Tu código de manejo de errores)
        }
    } catch (error) {
        // ... (Tu código de manejo de errores)
    }
}

// Función para manejar los parámetros de la URL al cargar la página
function handleUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const verified = params.get('verified');

    if (verified === 'true') {
        mostrarMensajeGlobal('¡Tu correo ha sido verificado con éxito! Ya puedes iniciar sesión.', 'success');
        mostrarLogin();
    } else if (verified === 'false') {
        mostrarMensajeGlobal('El enlace de verificación es inválido o ya ha sido utilizado.', 'error');
        mostrarLogin();
    } else if (verified === 'error') {
        mostrarMensajeGlobal('Ocurrió un error durante la verificación. Inténtalo de nuevo.', 'error');
        mostrarLogin();
    }

    // Limpia la URL para que el mensaje no reaparezca si el usuario refresca la página
    if (verified) {
        history.replaceState(null, '', window.location.pathname);
    }
}

// NOTA: Si no tienes la función `mostrarMensajeGlobal` en app.js, 
// puedes añadirla como una utilidad simple:
function mostrarMensajeGlobal(mensaje, tipo = 'info') {
    const globalMessage = document.getElementById('globalMessage');
    globalMessage.textContent = mensaje;
    globalMessage.className = `global-message ${tipo}`; // Usa clases como 'success' o 'error' de style.css
    globalMessage.style.display = 'block';
    setTimeout(() => {
        globalMessage.style.display = 'none';
    }, 5000);
}

function cerrarSesion() {
    token = null;
    userName = null;
    userTipo = null;
    userId = null;
    localStorage.clear();
    mostrarMensajeGlobal('Sesión cerrada correctamente.', 'success');
    mostrarInicio();
    actualizarNav();
}

// =================================================================
// SECCIÓN: LÓGICA DE POSTULACIONES (PROFESIONAL)
// =================================================================
async function postularse(vacanteId) {
    if (userTipo !== 'profesional') {
        return mostrarMensajeGlobal('Debes iniciar sesión como profesional para postularte.', 'error');
    }
    const postularButton = document.querySelector(`#vacanteInfo button[onclick="postularse(${vacanteId})"]`);
    const cvInput = document.createElement('input');
    cvInput.type = 'file';
    cvInput.accept = '.pdf';
    cvInput.style.display = 'none';
    document.body.appendChild(cvInput);

    cvInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) {
            return document.body.removeChild(cvInput);
        }
        const formData = new FormData();
        formData.append('cv', file);

        try {
            postularButton.disabled = true;
            postularButton.textContent = 'Enviando...';
            const response = await fetch(`http://localhost:3000/postular/${vacanteId}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            const data = await response.json();
            if (data.error) {
                mostrarMensajeGlobal(data.error, 'error');
                postularButton.disabled = false;
                postularButton.textContent = 'Postularse a esta vacante';
            } else {
                mostrarMensajeGlobal('¡Postulación enviada con éxito!', 'success');
                postularButton.textContent = 'Ya te postulaste';
                postularButton.classList.add('postulado');
            }
        } catch (error) {
            mostrarMensajeGlobal('Error al postularse. Inténtalo de nuevo.', 'error');
            console.error('Error al postularse:', error);
            postularButton.disabled = false;
            postularButton.textContent = 'Postularse a esta vacante';
        } finally {
            document.body.removeChild(cvInput);
        }
    });
    cvInput.click();
}

// =================================================================
// SECCIÓN: LÓGICA DE POSTULACIONES (PROFESIONAL)
// =================================================================
// ... (código anterior de postularse y eliminarPostulacion se mantiene igual)

async function cargarPostulacionesProfesional(postulacionIdParaResaltar = null) {
    const listaPostulaciones = document.getElementById('listaPostulaciones');
    if (!listaPostulaciones) return;
    listaPostulaciones.innerHTML = 'Cargando postulaciones...';
    try {
        const response = await fetch('http://localhost:3000/postulaciones', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const postulaciones = await response.json();

        if (postulaciones.error || !Array.isArray(postulaciones)) {
            console.error('Error recibido del servidor:', postulaciones.error || 'La respuesta no es un array');
            listaPostulaciones.innerHTML = '<p>No se pudieron cargar las postulaciones.</p>';
            return;
        }

        listaPostulaciones.innerHTML = '';
        if (postulaciones.length === 0) {
            listaPostulaciones.innerHTML = '<p>Aún no te has postulado a ninguna vacante.</p>';
        } else {
            postulaciones.forEach(postulacion => {
                const pDiv = document.createElement('div');
                pDiv.className = 'postulacion-card';
                pDiv.id = `postulacion-${postulacion.id}`; // ✨ AÑADIMOS UN ID ÚNICO A CADA TARJETA

                const estadoClase = postulacion.estado.toLowerCase().trim().replace(/\s+/g, '-');

                pDiv.innerHTML = `
                    <div class="postulacion-info">
                        <h4><i class="fas fa-briefcase"></i> ${postulacion.vacante_titulo}</h4>
                        <p><i class="fas fa-building"></i> <strong>Institución:</strong> ${postulacion.vacante_institucion}</p>
                        <p><i class="fas fa-calendar-alt"></i> <strong>Fecha de postulación:</strong> ${new Date(postulacion.fecha).toLocaleDateString()}</p>
                    </div>
                    
                    <div class="postulacion-acciones">
                        <span class="postulacion-estado estado-${estadoClase}">${postulacion.estado}</span>
                        <button class="delete" onclick="eliminarPostulacion(${postulacion.id})">
                            <i class="fas fa-trash-alt"></i> Eliminar
                        </button>
                    </div>
                `;
                listaPostulaciones.appendChild(pDiv);
            });

            // --- ✨ LÓGICA PARA RESALTAR Y ENFOCAR LA TARJETA ---
            if (postulacionIdParaResaltar) {
                const targetCard = document.getElementById(`postulacion-${postulacionIdParaResaltar}`);
                if (targetCard) {
                    // Usamos un pequeño retraso para asegurar que el navegador haya dibujado todo
                    setTimeout(() => {
                        targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        targetCard.style.transition = 'background-color 0.5s ease';
                        targetCard.style.backgroundColor = '#e3f2fd'; // Un color de resaltado azul claro
                        // Quitar el resaltado después de unos segundos
                        setTimeout(() => {
                            targetCard.style.backgroundColor = '';
                        }, 2500);
                    }, 100);
                }
            }
        }
    } catch (error) {
        listaPostulaciones.innerHTML = '<p>Error al cargar las postulaciones.</p>';
        console.error('Error al cargar postulaciones:', error);
    }
}

async function eliminarPostulacion(id) {
    if (!confirm('¿Estás seguro de que quieres eliminar esta postulación?')) return;
    try {
        const response = await fetch(`http://localhost:3000/postulaciones/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.error) {
            alert(data.error);
        } else {
            alert(data.message);
            cargarPostulacionesProfesional();
        }
    } catch (error) {
        console.error('Error al eliminar postulación:', error);
        alert('Error al eliminar postulación.');
    }
}

// =================================================================
// SECCIÓN: LÓGICA DEL PANEL DE INSTITUCIÓN
// =================================================================
if (document.getElementById('formVacante')) {
    document.getElementById('formVacante').addEventListener('submit', async (e) => {
        e.preventDefault();
        const titulo = document.getElementById('vacanteTitulo').value;
        const institucion = document.getElementById('vacanteInstitucion').value;
        const descripcion = document.getElementById('vacanteDescripcion').value;
        const keywords = document.getElementById('vacanteKeywords').value.split(',').map(k => k.trim());
        const ubicacion = document.getElementById('vacanteUbicacion').value;
        const tipoContrato = document.getElementById('vacanteTipoContrato').value;
        const salario = document.getElementById('vacanteSalario').value;

        try {
            const response = await fetch('http://localhost:3000/vacantes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ titulo, institucion, descripcion, keywords, ubicacion, tipoContrato, salario })
            });
            const data = await response.json();
            if (data.error) {
                alert(data.error);
            } else {
                alert(data.message);
                document.getElementById('formVacante').reset();
                mostrarInstituciones();
            }
        } catch (error) {
            alert('Error al publicar vacante.');
            console.error('Error al publicar vacante:', error);
        }
    });
}

async function cargarVacantesInstitucion() {
    const misVacantesDiv = document.getElementById('misVacantes');
    if(!misVacantesDiv) return;
    misVacantesDiv.innerHTML = 'Cargando vacantes...';
    try {
        const response = await fetch('http://localhost:3000/institucion/vacantes', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const vacantes = await response.json();
        misVacantesDiv.innerHTML = '';
        if (vacantes.length === 0) {
            misVacantesDiv.innerHTML = '<p>No has publicado ninguna vacante.</p>';
        } else {
            vacantes.forEach(v => {
                const vacanteDiv = document.createElement('div');
                vacanteDiv.className = 'vacante';
                vacanteDiv.innerHTML = `
    <a href="#" onclick="mostrarPipelinePorVacante(${v.id}, '${v.titulo}')" class="vacante-link">
        <h4>${v.titulo}</h4>
        <p>${v.descripcion.substring(0, 100)}...</p>
    </a>
    <button class="delete" onclick="eliminarVacante(${v.id})">Eliminar</button>
`;
                misVacantesDiv.appendChild(vacanteDiv);
            });
        }
    } catch (error) {
        misVacantesDiv.innerHTML = '<p>Error al cargar tus vacantes.</p>';
        console.error('Error al cargar vacantes de institución:', error);
    }
}

async function eliminarVacante(id) {
    if (!confirm('¿Estás seguro de que quieres eliminar esta vacante?')) return;
    try {
        const response = await fetch(`http://localhost:3000/vacantes/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.error) {
            alert(data.error);
        } else {
            alert(data.message);
            cargarVacantesInstitucion();
            cargarPostulacionesInstitucion();
        }
    } catch (error) {
        console.error('Error al eliminar vacante:', error);
        alert('Error al eliminar la vacante.');
    }
}

// Versión completamente nueva para dibujar el pipeline

async function cargarPostulacionesInstitucion(vacanteId = null, esVistaPipeline = false) {
    const params = new URLSearchParams();
    if (vacanteId) {
        params.append('vacanteId', vacanteId);
    }

    try {
        const response = await fetch(`http://localhost:3000/institucion/postulaciones?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${token}` },
            cache: 'no-store'
        });
        const postulaciones = await response.json();

        if (esVistaPipeline) {
            // Dibuja el Pipeline Visual
            const board = document.getElementById('pipelineBoard');
            board.innerHTML = '';
            const columnas = { 'Enviada': [], 'En Revisión': [], 'Entrevistado': [], 'Aceptado': [], 'Rechazado': [] };
            postulaciones.forEach(p => { if (columnas[p.estado]) columnas[p.estado].push(p); });

            for (const nombreColumna in columnas) {
                const columnaDiv = document.createElement('div');
                columnaDiv.className = 'pipeline-column';
                const tarjetasHTML = columnas[nombreColumna].map(p => `
                    <div class="candidate-card" draggable="true" data-id="${p.id}" data-estado="${p.estado}">
                        <div class="card-header">
                            <h6>${p.profesional_nombre}</h6>
                           <a href="#" onclick="verPerfilPostulante(${p.id})" class="view-profile-icon" title="Ver Perfil"><i class="fas fa-eye"></i></a>
                        </div>
                        <p>Aplicó el: ${new Date(p.fecha).toLocaleDateString()}</p>
                    </div>
                `).join('');
                columnaDiv.innerHTML = `
                    <div class="pipeline-column-header"><h5>${nombreColumna}</h5><div class="candidate-count">${columnas[nombreColumna].length}</div></div>
                    <div class="candidate-cards">${tarjetasHTML}</div>
                `;
                board.appendChild(columnaDiv);
            }
            activarDragAndDrop();
        } else {
            // Dibuja la lista simple en el panel principal
            const postulacionesDiv = document.getElementById('postulacionesRecibidas');
            postulacionesDiv.innerHTML = '';
            if (postulaciones.length === 0) {
                postulacionesDiv.innerHTML = '<p>Aún no se han recibido postulaciones.</p>';
            } else {
                // Muestra solo las 5 más recientes
                postulaciones.slice(0, 5).forEach(p => {
                    const pDiv = document.createElement('div');
                    pDiv.className = 'postulacion-institucion'; // Reutilizamos un estilo que ya tienes
                    pDiv.innerHTML = `<p><strong>${p.profesional_nombre}</strong> se postuló a <strong>${p.vacante_titulo}</strong></p>`;
                    postulacionesDiv.appendChild(pDiv);
                });
            }
        }
    } catch (error) {
        console.error('Error al cargar postulaciones:', error);
    }
}

async function verPerfilPostulante(postulacionId) {
    // 1. Muestra la sección y un mensaje de carga
    mostrarSeccion('perfilPostulante');
    const perfilContainer = document.getElementById('infoPostulante');
    perfilContainer.innerHTML = '<p>Cargando perfil del candidato...</p>';

    try {
        // 2. Llama a la nueva ruta segura del backend
        const res = await fetch(`http://localhost:3000/institucion/postulaciones/${postulacionId}/profesional`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || 'No se pudo cargar el perfil.');
        }

        const perfil = await res.json();

        // ==========================================================
        // PUNTO DE CONTROL 1: VERIFICAR LOS DATOS RECIBIDOS
        console.log("Datos del perfil recibidos del servidor:", perfil);
        // ==========================================================

        const imagenSrc = perfil.fotoPath ? `http://localhost:3000/${perfil.fotoPath}` : 'uploads/default-avatar.png';

        let perfilHTML = `
            <div class="perfil-header">
                <img src="${imagenSrc}" alt="Foto de Perfil" class="perfil-foto">
                <h3>${perfil.nombre}</h3>
                <p class="perfil-titulo-puesto">${perfil.especialidad || 'Especialidad no especificada'}</p>
            </div>
            <div class="perfil-seccion">
                <h4>Información de Contacto</h4>
                <p><strong>Correo:</strong> ${perfil.correo}</p>
                <p><strong>Teléfono:</strong> ${perfil.telefono || 'No especificado'}</p>
                ${perfil.linkedinURL ? `<p><strong>LinkedIn:</strong> <a href="${perfil.linkedinURL}" target="_blank">Ver Perfil</a></p>` : ''}
                ${perfil.cvPath ? `<p><a href="http://localhost:3000/${perfil.cvPath}" target="_blank" class="button">Descargar CV</a></p>` : ''}
            </div>
            <div class="perfil-seccion">
                <h4>Acerca del Profesional</h4>
                <p>${perfil.bio || 'Sin biografía.'}</p>
            </div>`;

        if (perfil.experiencias && perfil.experiencias.length > 0) {
            perfilHTML += `<div class="perfil-seccion"><h4>Experiencia Profesional</h4><ul class="lista-experiencia">`;
            perfil.experiencias.forEach(exp => {
                perfilHTML += `<li><strong>${exp.puesto}</strong> en ${exp.institucion} (${exp.periodo})<p>${exp.descripcion || ''}</p></li>`;
            });
            perfilHTML += `</ul></div>`;
        }

        if (perfil.educacion && perfil.educacion.length > 0) {
            perfilHTML += `<div class="perfil-seccion"><h4>Educación</h4><ul class="lista-educacion">`;
            perfil.educacion.forEach(edu => {
                perfilHTML += `<li><strong>${edu.titulo}</strong> en ${edu.institucion} (${edu.periodo})</li>`;
            });
            perfilHTML += `</ul></div>`;
        }

        if (perfil.habilidades && perfil.habilidades.length > 0) {
            perfilHTML += `<div class="perfil-seccion"><h4>Habilidades</h4><div class="tags-container">`;
            perfil.habilidades.forEach(h => { perfilHTML += `<span class="keyword-tag">${h}</span>`; });
            perfilHTML += `</div></div>`;
        }

        // ==========================================================
        // PUNTO DE CONTROL 2: VERIFICAR EL HTML ANTES DE MOSTRARLO
        console.log("HTML final que se va a mostrar:", perfilHTML);
        // ==========================================================

        // 4. Muestra el HTML en el contenedor
        perfilContainer.innerHTML = perfilHTML;

    } catch (err) {
        console.error('Error al ver perfil del postulante:', err);
        perfilContainer.innerHTML = `<p class="error">Error: ${err.message}</p>`;
    }
}

async function cambiarEstadoPostulacion(id, estado) {
    try {
        const response = await fetch(`http://localhost:3000/postulaciones/${id}/estado`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ estado })
        });
        const data = await response.json();
        if (data.error) {
            alert(data.error);
            // Si hay un error, recargamos el pipeline para revertir el cambio visual
            const tituloH2 = document.getElementById('pipelineTituloVacante');
            if (tituloH2 && tituloH2.textContent.includes('Pipeline para:')) {
                // Extraemos el ID y título para recargar
                // Esta parte es compleja, por ahora solo recargamos sin ID específico
                mostrarInstituciones(); // Vuelve al panel principal como medida de seguridad
            }
        } else {
            // No mostramos la alerta de éxito para que sea más fluido
            console.log(data.message);
            // No es necesario recargar toda la lista, el cambio visual ya se hizo con drag-and-drop.
            // Podríamos actualizar el contador de la columna si quisiéramos.
        }
    } catch (error) {
        alert('Error al actualizar el estado.');
        console.error('Error al cambiar estado:', error);
    }
}

// =================================================================
// SECCIÓN: LÓGICA DE PERFIL (VISTA Y EDICIÓN)
// =================================================================
async function cargarDatosPerfilProfesional() {
    try {
        const res = await fetch('http://localhost:3000/perfil', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const perfil = await res.json();
        document.getElementById('nombreEditar').value = perfil.nombre || '';
        document.getElementById('especialidadEditar').value = perfil.especialidad || '';
        document.getElementById('bioEditar').value = perfil.bio || '';
        document.getElementById('telefonoEditar').value = perfil.telefono || '';
        document.getElementById('linkedinURLEditar').value = perfil.linkedinURL || '';
        document.getElementById('cedulaEditar').value = perfil.cedula || '';
        document.getElementById('fechaNacimientoEditar').value = perfil.fechaNacimiento || '';
        
        const cvActualP = document.getElementById('cvActual');
        if (cvActualP) {
            if (perfil.cvPath) {
                cvActualP.innerHTML = `CV actual: <a href="http://localhost:3000/${perfil.cvPath}" target="_blank">Ver CV</a>`;
            } else {
                cvActualP.innerHTML = 'No hay CV subido.';
            }
        }
        document.getElementById('habilidadesEditar').value = Array.isArray(perfil.habilidades) ? perfil.habilidades.join(', ') : '';
        
        document.getElementById('experienciaContainer').innerHTML = '';
        (perfil.experiencias || []).forEach(exp => agregarCampo('experiencia', exp));
        
        document.getElementById('educacionContainer').innerHTML = '';
        (perfil.educacion || []).forEach(edu => agregarCampo('educacion', edu));
        
        // ✨ CORRECCIÓN APLICADA AQUÍ (Y LIMPIEZA DE LÍNEA DUPLICADA) ✨
        document.getElementById('certificacionContainer').innerHTML = ''; 
        (perfil.certificaciones || []).forEach(cert => agregarCampo('certificacion', cert));

    } catch (error) {
        console.error('Error al cargar los datos del perfil:', error);
    }
}

      // Dentro de app.js

async function cargarPerfilProfesional() {
    try {
        const res = await fetch('http://localhost:3000/perfil', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        
        const perfil = await res.json();
        const perfilContainer = document.getElementById('infoProfesional');
        const imagenSrc = perfil.fotoPath ? `http://localhost:3000/${perfil.fotoPath}` : 'uploads/default-avatar.png';

        // --- INICIO DE LA NUEVA ESTRUCTURA HTML ---
        let perfilHTML = `
            <div class="perfil-header">
                <img src="${imagenSrc}" alt="Foto de Perfil" id="imagenPerfil" class="perfil-foto">
                <h3>${perfil.nombre}</h3>
                <p class="perfil-titulo-puesto">${perfil.especialidad || 'Especialidad no especificada'}</p>
            </div>
            
            <div class="perfil-seccion">
                <h4>Información Personal y Contacto</h4>
                <div class="info-personal-grid">
                    <div><strong>Correo:</strong> <p>${perfil.correo}</p></div>
                    <div><strong>Teléfono:</strong> <p>${perfil.telefono || 'No especificado'}</p></div>
                    <div><strong>Cédula:</strong> <p>${perfil.cedula || 'No especificado'}</p></div>
                    <div><strong>Fecha de Nacimiento:</strong> <p>${perfil.fechaNacimiento || 'No especificado'}</p></div>
                    ${perfil.linkedinURL ? `<div><strong>LinkedIn:</strong> <p><a href="${perfil.linkedinURL}" target="_blank">Ver Perfil</a></p></div>` : ''}
                </div>
                ${perfil.cvPath ? `<div class="cv-download-container" style="margin-top: 20px;"><a href="http://localhost:3000/${perfil.cvPath}" target="_blank" class="button">Descargar CV</a></div>` : ''}
            </div>
            
            <div class="perfil-seccion">
                <h4>Acerca de mí</h4>
                <p>${perfil.bio || 'Aún no has agregado una biografía.'}</p>
            </div>`;
        // --- FIN DE LA INFORMACIÓN PERSONAL ---

        // Experiencia Profesional
        if (perfil.experiencias && perfil.experiencias.length > 0) {
            perfilHTML += `<div class="perfil-seccion"><h4>Experiencia Profesional</h4><ul class="lista-experiencia">`;
            perfil.experiencias.forEach(exp => {
                perfilHTML += `<li><strong>${exp.puesto}</strong><br>${exp.institucion}<br>${exp.periodo}<p>${exp.descripcion}</p></li>`;
            });
            perfilHTML += `</ul></div>`;
        }

        // Educación
        if (perfil.educacion && perfil.educacion.length > 0) {
            perfilHTML += `<div class="perfil-seccion"><h4>Educación</h4><ul class="lista-educacion">`;
            perfil.educacion.forEach(edu => {
                perfilHTML += `<li><strong>${edu.titulo}</strong><br>${edu.institucion}<br>${edu.periodo}</li>`;
            });
            perfilHTML += `</ul></div>`;
        }

        // Certificaciones
        if (perfil.certificaciones && perfil.certificaciones.length > 0) {
            perfilHTML += `<div class="perfil-seccion"><h4>Certificaciones y Diplomados</h4><ul class="lista-educacion">`; // Reutilizamos lista-educacion para estilo
            perfil.certificaciones.forEach(cert => {
                perfilHTML += `<li><strong>${cert.nombre}</strong><br>${cert.institucion}<br>${cert.periodo}</li>`;
            });
            perfilHTML += `</ul></div>`;
        }

        // Habilidades
        if (perfil.habilidades) {
            const habilidadesArray = Array.isArray(perfil.habilidades) ? perfil.habilidades : perfil.habilidades.split(',').map(h => h.trim());
            perfilHTML += `<div class="perfil-seccion"><h4>Habilidades y Herramientas</h4><div class="tags-container">`;
            habilidadesArray.forEach(habilidad => {
                perfilHTML += `<span class="keyword-tag">${habilidad}</span>`;
            });
            perfilHTML += `</div></div>`;
        }
        
        perfilContainer.innerHTML = perfilHTML;
        // La función termina como estaba
        
    } catch (err) {
        console.error('Error al cargar perfil:', err);
        document.getElementById('infoProfesional').innerHTML = '<p>Error al cargar el perfil.</p>';
    }
}


async function subirFotoDePerfil() {
    const fotoInput = document.getElementById('fotoEditar');
    const file = fotoInput.files[0];
    if (!file) return alert('Por favor, selecciona un archivo de imagen.');
    const formData = new FormData();
    formData.append('foto', file);
    try {
        const response = await fetch(`http://localhost:3000/perfil/foto`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        const data = await response.json();
        if (data.error) {
            alert(data.error);
        } else {
            alert(data.message);
            mostrarPerfilProfesional();
        }
    } catch (error) {
        console.error('Error al subir la foto:', error);
        alert('Ocurrió un error al subir la foto. Inténtalo de nuevo.');
    }
}

if (document.getElementById('formEditarPerfil')) {
    document.getElementById('formEditarPerfil').addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = document.querySelector('#formEditarPerfil button[type="submit"]');
        const originalButtonText = submitButton.textContent;
        submitButton.disabled = true;
        submitButton.textContent = 'Guardando...';
        
        const dataToSend = {
    nombre: document.getElementById('nombreEditar').value,
    especialidad: document.getElementById('especialidadEditar').value,
    bio: document.getElementById('bioEditar').value,
    telefono: document.getElementById('telefonoEditar').value,
    linkedinURL: document.getElementById('linkedinURLEditar').value,
    cedula: document.getElementById('cedulaEditar').value,
    fechaNacimiento: document.getElementById('fechaNacimientoEditar').value,
    habilidades: document.getElementById('habilidadesEditar').value.split(',').map(h => h.trim()),
    
    experiencias: Array.from(document.querySelectorAll('#experienciaContainer .campo-dinamico')).map(div => ({
        puesto: div.querySelector('.campo-puesto').value,
        institucion: div.querySelector('.campo-institucion').value,
        periodo: div.querySelector('.campo-periodo').value,
        descripcion: div.querySelector('.campo-descripcion').value
    })),
    
    // ✨ CORREGIDO: Línea de educación ya no está duplicada
    educacion: Array.from(document.querySelectorAll('#educacionContainer .campo-dinamico')).map(div => ({
        titulo: div.querySelector('.campo-titulo').value,
        institucion: div.querySelector('.campo-institucion').value,
        periodo: div.querySelector('.campo-periodo').value
    })),
    
    // ✨ CORREGIDO: Ahora busca 'certificacionContainer' en singular
    certificaciones: Array.from(document.querySelectorAll('#certificacionContainer .campo-dinamico')).map(div => ({
        nombre: div.querySelector('.campo-nombre-cert').value,
        institucion: div.querySelector('.campo-institucion-cert').value,
        periodo: div.querySelector('.campo-periodo-cert').value
    }))
};
        
        const errorEditarPerfil = document.getElementById('errorEditarPerfil');
        errorEditarPerfil.textContent = '';

        try {
            const res = await fetch('http://localhost:3000/perfil', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(dataToSend)
            });
            const data = await res.json();
            if (data.error) {
                errorEditarPerfil.textContent = data.error;
            } else {
                alert('Perfil actualizado con éxito.');
                localStorage.setItem('nombre', dataToSend.nombre);
                userName = dataToSend.nombre;
                mostrarPerfilProfesional();
            }
        } catch (err) {
            errorEditarPerfil.textContent = 'Error al actualizar el perfil.';
            console.error('Error:', err);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;
        }
    });
}

async function subirCV() {
    const cvInput = document.getElementById('cvEditar');
    const file = cvInput.files[0];
    if (!file) {
        return alert('Por favor, selecciona un archivo PDF para tu CV.');
    }
    const formData = new FormData();
    formData.append('cv', file);
    const cvActualP = document.getElementById('cvActual');
    cvActualP.textContent = 'Subiendo CV...';

    try {
        const response = await fetch('http://localhost:3000/perfil/cv', {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        const data = await response.json();
        if (data.error) {
            alert(data.error);
            cvActualP.textContent = 'Error al subir.';
        } else {
            alert(data.message);
            cvActualP.innerHTML = `CV actual: <a href="http://localhost:3000/${data.cvPath}" target="_blank">Ver CV</a>`;
        }
    } catch (error) {
        console.error('Error al subir el CV:', error);
        alert('Ocurrió un error al subir el CV.');
        cvActualP.textContent = 'Error al subir.';
    }
}

if (document.getElementById('formEditarPerfilInstitucion')) {
    document.getElementById('formEditarPerfilInstitucion').addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = document.querySelector('#formEditarPerfilInstitucion button[type="submit"]');
        const originalButtonText = submitButton.textContent;
        submitButton.disabled = true;
        submitButton.textContent = 'Guardando...';

        // Lee los datos de TODOS los campos, incluyendo los nuevos
        const nombre = document.getElementById('nombreInstitucionEditar').value;
        const direccion = document.getElementById('direccionEditar').value;
        const telefono = document.getElementById('telefonoInstitucionEditar').value;
        const sitioWeb = document.getElementById('sitioWebEditar').value; // <-- NUEVO
        const bio = document.getElementById('bioInstitucionEditar').value;       // <-- NUEVO

        const errorEditarPerfilInstitucion = document.getElementById('errorEditarPerfilInstitucion');
        errorEditarPerfilInstitucion.textContent = '';

        try {
            const res = await fetch('http://localhost:3000/perfil', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                // Envía los campos nuevos al servidor
                body: JSON.stringify({ nombre, direccion, telefono, sitioWeb, bio })
            });
            const data = await res.json();
            if (data.error) {
                errorEditarPerfilInstitucion.textContent = data.error;
            } else {
                alert('Perfil actualizado con éxito.');
                localStorage.setItem('nombre', nombre);
                userName = nombre;
                mostrarInstituciones();
            }
        } catch (err) {
            errorEditarPerfilInstitucion.textContent = 'Error al actualizar el perfil.';
            console.error('Error:', err);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;
        }
    });
}

async function cargarDatosPerfilInstitucion() {
    try {
        const res = await fetch('http://localhost:3000/perfil', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const perfil = await res.json();
        document.getElementById('nombreInstitucionEditar').value = perfil.nombre || '';
        document.getElementById('direccionEditar').value = perfil.direccion || '';
        document.getElementById('telefonoInstitucionEditar').value = perfil.telefono || '';
        document.getElementById('sitioWebEditar').value = perfil.sitioWeb || ''; // <-- LÍNEA NUEVA
        document.getElementById('bioInstitucionEditar').value = perfil.bio || '';       // <-- LÍNEA NUEVA
    } catch (err) {
        console.error('Error al cargar datos de la institución:', err);
    }
}
async function subirLogoInstitucion() {
    const logoInput = document.getElementById('logoEditar');
    const file = logoInput.files[0];
    if (!file) return alert('Por favor, selecciona un archivo de imagen.');

    const formData = new FormData();
    formData.append('logo', file);

    try {
        const response = await fetch(`http://localhost:3000/perfil/logo`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        const data = await response.json();
        if (data.error) {
            alert(data.error);
        } else {
            alert(data.message);
            // Opcional: Recargar la vista o mostrar el nuevo logo.
        }
    } catch (error) {
        console.error('Error al subir el logo:', error);
        alert('Ocurrió un error al subir el logo. Inténtalo de nuevo.');
    }
}

// REEMPLAZA TU FUNCIÓN ACTUAL CON ESTA VERSIÓN

async function cargarPerfilPublicoInstitucion(institucionId) {
    const perfilContainer = document.getElementById('perfilPublicoInstitucion');
    const perfilInfoDiv = perfilContainer.querySelector('#perfilInfo');
    if (!perfilInfoDiv) return;

    perfilInfoDiv.innerHTML = 'Cargando perfil...';

    try {
        const res = await fetch(`http://localhost:3000/instituciones/${institucionId}`);
        const perfil = await res.json();

        if (perfil.error) {
            perfilInfoDiv.innerHTML = `<p class="error">${perfil.error}</p>`;
            return;
        }

        const logoUrl = perfil.logoPath ? `http://localhost:3000/${perfil.logoPath}` : 'uploads/default-avatar.png';

        let sitioWebHTML = '';
        if (perfil.sitioWeb) {
            let url = perfil.sitioWeb;
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                url = `https://${url}`;
            }
            // --- ¡AQUÍ ESTÁ LA MODIFICACIÓN! ---
            // Añadimos la clase "texto-largo" al enlace <a>
            sitioWebHTML = `<div><strong><i class="fas fa-globe"></i> Sitio Web:</strong> <p><a href="${url}" class="texto-largo" target="_blank" rel="noopener noreferrer">${perfil.sitioWeb}</a></p></div>`;
        }

        let perfilHTML = `
            <div class="perfil-header">
                <img src="${logoUrl}" alt="Logo de ${perfil.nombre}" class="perfil-foto">
                <h2>${perfil.nombre}</h2>
            </div>
            <div class="perfil-seccion">
                <h4>Sobre Nosotros</h4>
                <p>${perfil.bio || 'La institución aún no ha añadido una descripción.'}</p>
            </div>
            <div class="perfil-seccion">
                <h4>Información de Contacto</h4>
                <div class="info-personal-grid">
                    <div><strong><i class="fas fa-map-marker-alt"></i> Dirección:</strong> <p>${perfil.direccion || 'No especificada'}</p></div>
                    <div><strong><i class="fas fa-phone"></i> Teléfono:</strong> <p>${perfil.telefono || 'No especificado'}</p></div>
                    ${sitioWebHTML}
                </div>
            </div>
            <div class="perfil-seccion">
                <h3>Vacantes Activas</h3>
                <div id="vacantesInstitucionPublicas" class="vacante-grid"></div>
            </div>
        `;

        perfilInfoDiv.innerHTML = perfilHTML;

        // El resto de la función para cargar vacantes se mantiene igual...
        const vacantesDiv = document.getElementById('vacantesInstitucionPublicas');
        if (perfil.vacantes && perfil.vacantes.length > 0) {
            perfil.vacantes.forEach(vacante => {
                const vacanteDiv = document.createElement('div');
                vacanteDiv.className = 'vacante';
                vacanteDiv.innerHTML = `
                    <a href="#" onclick="mostrarVacanteDetalles(${vacante.id})"><h4>${vacante.titulo}</h4></a>
                    ${vacante.ubicacion ? `<p class="vacante-ubicacion">${vacante.ubicacion}</p>` : ''}
                    <p>${(vacante.descripcion || '').substring(0, 100)}...</p>
                `;
                vacantesDiv.appendChild(vacanteDiv);
            });
        } else {
            vacantesDiv.innerHTML = '<p>Esta institución no tiene vacantes publicadas en este momento.</p>';
        }
    } catch (err) {
        perfilInfoDiv.innerHTML = '<p class="error">Ocurrió un error al cargar el perfil de la institución.</p>';
        console.error('Error al cargar perfil público de institución:', err);
    }
}

// =================================================================
// SECCIÓN: LÓGICA DEL BUSCADOR DE TALENTOS
// =================================================================

// Función para mostrar la sección de búsqueda
function mostrarBusquedaTalentos() {
    if (!token || userTipo !== 'institucion') {
        alert('Acceso denegado.');
        return mostrarLogin();
    }
    mostrarSeccion('busquedaTalentos');
    document.getElementById('resultadosBusquedaTalentos').innerHTML = '<p>Usa los filtros para encontrar profesionales.</p>';
}

// Función que se ejecuta al presionar el botón "Buscar"
async function ejecutarBusquedaTalentos() {
    const resultadosDiv = document.getElementById('resultadosBusquedaTalentos');
    resultadosDiv.innerHTML = '<p>Buscando perfiles...</p>';

    // Leer los valores de los filtros
    const especialidad = document.getElementById('filtroEspecialidad').value;
    const habilidades = document.getElementById('filtroHabilidades').value;
    const keyword = document.getElementById('filtroKeyword').value;

    // Construir la URL para el servidor
    const params = new URLSearchParams();
    if (especialidad) params.append('especialidad', especialidad);
    if (habilidades) params.append('habilidades', habilidades);
    if (keyword) params.append('keyword', keyword);

    try {
        const response = await fetch(`http://localhost:3000/institucion/buscar-profesionales?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${token}` },
            cache: 'no-store'
        });

        const perfiles = await response.json();
        resultadosDiv.innerHTML = '';

        if (perfiles.length === 0) {
            resultadosDiv.innerHTML = '<p>No se encontraron perfiles con esos criterios.</p>';
        } else {
            perfiles.forEach(perfil => {
                const perfilDiv = document.createElement('div');
                perfilDiv.className = 'vacante'; // Reutilizamos el estilo de las tarjetas de vacante

                const imagenSrc = perfil.fotoPath ? `http://localhost:3000/${perfil.fotoPath}` : 'uploads/default-avatar.png';
                const habilidadesHTML = (perfil.habilidades || []).map(h => `<span class="keyword-tag">${h}</span>`).join(' ');

                perfilDiv.innerHTML = `
                    <div style="display: flex; align-items: center; margin-bottom: 15px;">
                        <img src="${imagenSrc}" alt="Foto de ${perfil.nombre}" style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover; margin-right: 15px;">
                        <div>
                            <h4 style="margin-bottom: 5px;">${perfil.nombre}</h4>
                            <p style="color: var(--medium-grey); margin: 0;">${perfil.especialidad || 'Sin especialidad'}</p>
                        </div>
                    </div>
                    <p>${(perfil.bio || 'Sin biografía').substring(0, 100)}...</p>
                    <div class="keywords-container">${habilidadesHTML}</div>
                    <button onclick="verPerfilCompletoProfesional(${perfil.id})" class="button" style="width: 100%; margin-top: 15px;">Ver Perfil Completo</button>
                `;
                resultadosDiv.appendChild(perfilDiv);
            });
        }
    } catch (error) {
        resultadosDiv.innerHTML = '<p>Error al realizar la búsqueda.</p>';
        console.error('Error en búsqueda de talentos:', error);
    }
}

// Función para ver el perfil completo (similar a la que ya teníamos)
async function verPerfilCompletoProfesional(profesionalId) {
    mostrarSeccion('perfilPostulante'); // Reutilizamos la misma sección de vista de perfil
    const perfilContainer = document.getElementById('infoPostulante');
    perfilContainer.innerHTML = '<p>Cargando perfil del candidato...</p>';

    try {
        const res = await fetch(`http://localhost:3000/profesionales/${profesionalId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || 'No se pudo cargar el perfil.');
        }

        const perfil = await res.json();
        const imagenSrc = perfil.fotoPath ? `http://localhost:3000/${perfil.fotoPath}` : 'uploads/default-avatar.png';

        // CONSTRUIMOS EL HTML COMPLETO DEL PERFIL
        let perfilHTML = `
            <div class="perfil-header">
                <img src="${imagenSrc}" alt="Foto de Perfil" class="perfil-foto">
                <h3>${perfil.nombre}</h3>
                <p class="perfil-titulo-puesto">${perfil.especialidad || 'Especialidad no especificada'}</p>
            </div>
            <div class="perfil-seccion">
                <h4>Información de Contacto</h4>
                <p><strong>Correo:</strong> ${perfil.correo}</p>
                <p><strong>Teléfono:</strong> ${perfil.telefono || 'No especificado'}</p>
                ${perfil.linkedinURL ? `<p><strong>LinkedIn:</strong> <a href="${perfil.linkedinURL}" target="_blank">Ver Perfil</a></p>` : ''}
                ${perfil.cvPath ? `<p><a href="http://localhost:3000/${perfil.cvPath}" target="_blank" class="button">Descargar CV</a></p>` : ''}
            </div>
            <div class="perfil-seccion">
                <h4>Acerca del Profesional</h4>
                <p>${perfil.bio || 'Sin biografía.'}</p>
            </div>`;

        if (perfil.experiencias && perfil.experiencias.length > 0) {
            perfilHTML += `<div class="perfil-seccion"><h4>Experiencia Profesional</h4><ul class="lista-experiencia">`;
            perfil.experiencias.forEach(exp => {
                perfilHTML += `<li><strong>${exp.puesto}</strong> en ${exp.institucion} (${exp.periodo})<p>${exp.descripcion || ''}</p></li>`;
            });
            perfilHTML += `</ul></div>`;
        }

        if (perfil.educacion && perfil.educacion.length > 0) {
            perfilHTML += `<div class="perfil-seccion"><h4>Educación</h4><ul class="lista-educacion">`;
            perfil.educacion.forEach(edu => {
                perfilHTML += `<li><strong>${edu.titulo}</strong> en ${edu.institucion} (${edu.periodo})</li>`;
            });
            perfilHTML += `</ul></div>`;
        }

        if (perfil.habilidades && perfil.habilidades.length > 0) {
            perfilHTML += `<div class="perfil-seccion"><h4>Habilidades</h4><div class="tags-container">`;
            perfil.habilidades.forEach(h => { perfilHTML += `<span class="keyword-tag">${h}</span>`; });
            perfilHTML += `</div></div>`;
        }

        perfilContainer.innerHTML = perfilHTML;

    } catch (err) {
        console.error('Error al ver perfil del profesional:', err);
        perfilContainer.innerHTML = `<p class="error">Error: ${err.message}</p>`;
    }
}

function activarDragAndDrop() {
    const tarjetas = document.querySelectorAll('.candidate-card');
    const columnas = document.querySelectorAll('.pipeline-column .candidate-cards');
    let tarjetaArrastrada = null;
    let columnaOrigen = null; // Variable para saber de dónde viene la tarjeta

    tarjetas.forEach(tarjeta => {
        tarjeta.addEventListener('dragstart', () => {
            tarjetaArrastrada = tarjeta;
            columnaOrigen = tarjeta.closest('.candidate-cards'); // Guardamos la columna de origen
            setTimeout(() => tarjeta.classList.add('dragging'), 0);
        });

        tarjeta.addEventListener('dragend', () => {
            tarjeta.classList.remove('dragging');
            tarjetaArrastrada = null;
            columnaOrigen = null;
        });
    });

    columnas.forEach(columna => {
        columna.addEventListener('dragover', e => {
            e.preventDefault();
            columna.classList.add('drag-over');
        });

        columna.addEventListener('dragleave', () => {
            columna.classList.remove('drag-over');
        });

        columna.addEventListener('drop', e => {
            e.preventDefault();
            columna.classList.remove('drag-over');

            if (tarjetaArrastrada) {
                const id = tarjetaArrastrada.dataset.id;
                const nuevoEstado = columna.parentElement.querySelector('h5').textContent;
                const estadoActual = tarjetaArrastrada.dataset.estado;
                
                // Si el estado no cambia, no hacemos nada
                if (nuevoEstado === estadoActual) {
                    return;
                }
                
                // 1. Mover la tarjeta visualmente al instante y actualizar su data-estado
                columna.appendChild(tarjetaArrastrada);
                tarjetaArrastrada.dataset.estado = nuevoEstado;
                
                // 2. Cambiar la clase para el color del borde
                tarjetaArrastrada.className = 'candidate-card'; // Reseteamos las clases
                // Obtenemos la clase CSS del estado (Ej: estado-enviada)
                const estadoClase = nuevoEstado.toLowerCase().trim().replace(/\s+/g, '-');
                tarjetaArrastrada.classList.add(`candidate-card`);
                tarjetaArrastrada.setAttribute('data-estado', nuevoEstado);
                
                // 3. La parte crucial: Llamar a la API
                cambiarEstadoPostulacion(id, nuevoEstado);
                
                // La función cambiarEstadoPostulacion se encargará de llamar a actualizarContadoresPipeline()
                // en caso de éxito.
            }
        });
    });
}