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
        const response = await fetch(`https://zo-medica.onrender.com/vacantes`);
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

async function mostrarInstituciones() {
    if (!token || userTipo !== 'institucion') return mostrarLogin();
    mostrarSeccion('instituciones');
    document.getElementById('nombreInstitucionPanel').textContent = `Panel de ${userName}`;
    try {
        const [vacantesRes, postulacionesRes] = await Promise.all([
            fetchProtegido('https://zo-medica.onrender.com/institucion/vacantes'),
            fetchProtegido('https://zo-medica.onrender.com/institucion/postulaciones')
        ]);
        const vacantes = await vacantesRes.json();
        const postulaciones = await postulacionesRes.json();
        document.getElementById('statTotalVacantes').textContent = vacantes.length;
        document.getElementById('statTotalPostulaciones').textContent = postulaciones.length;

        const misVacantesDiv = document.getElementById('misVacantes');
        misVacantesDiv.innerHTML = '';
        if (vacantes.length > 0) {
            vacantes.forEach(v => {
                const vacanteDiv = document.createElement('div');
                vacanteDiv.className = 'vacante';
                vacanteDiv.innerHTML = `
                    <div class="vacante-header">
                        <a href="#" onclick="mostrarPipelinePorVacante(${v.id}, '${v.titulo.replace(/'/g, "\\'")}')" class="vacante-link"><h4>${v.titulo}</h4></a>
                        <div class="vacante-acciones">
                            <button class="icon-button" onclick="mostrarFormularioEditarVacante(${v.id})" title="Editar"><i class="fas fa-edit"></i></button>
                            <button class="icon-button analytics" onclick="mostrarModalAnaliticas(${v.id}, '${v.titulo.replace(/'/g, "\\'")}')" title="Analíticas"><i class="fas fa-chart-bar"></i></button>
                            <button class="icon-button delete" onclick="eliminarVacante(${v.id})" title="Eliminar"><i class="fas fa-trash-alt"></i></button>
                        </div>
                    </div>
                    <p>${(v.descripcion || '').substring(0, 80)}...</p>
                    <div class="vacante-stats"><span><i class="fas fa-eye"></i> Vistas: ${v.vistas}</span></div>`;
                misVacantesDiv.appendChild(vacanteDiv);
            });
        } else {
            misVacantesDiv.innerHTML = '<p>No has publicado ninguna vacante.</p>';
        }
    } catch (error) { if (error.message !== 'Sesión expirada') console.error("Error al cargar dashboard:", error); }
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
        const response = await fetch('https://zo-medica.onrender.com/institucion/vacantes', {
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
    const marcarTodasBtn = document.getElementById('marcarTodasLeidasBtn');
    if (!listaNotificaciones || !marcarTodasBtn) return;

    listaNotificaciones.innerHTML = 'Cargando notificaciones...';
    marcarTodasBtn.style.display = 'none'; // Ocultar el botón mientras carga

    try {
        const response = await fetch('https://zo-medica.onrender.com/notificaciones', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const notificaciones = await response.json();

        // Actualizar contador global de la barra de navegación
        actualizarContadorNotificaciones();
        
        listaNotificaciones.innerHTML = '';

        if (notificaciones.length === 0) {
            listaNotificaciones.innerHTML = '<p>No tienes notificaciones en este momento.</p>';
            return;
        }

        const hayNoLeidas = notificaciones.some(n => !n.leida);
        marcarTodasBtn.style.display = hayNoLeidas ? 'inline-block' : 'none';

        notificaciones.forEach(n => {
            const notificacionDiv = document.createElement('div');
            notificacionDiv.className = n.leida ? 'notificacion leida' : 'notificacion';
            notificacionDiv.setAttribute('onclick', `abrirNotificacion(${n.id}, this, '${n.url}')`);

            let iconClass = 'fa-bell'; // Icono por defecto
            if (n.mensaje.includes('se postuló')) {
                iconClass = 'fa-user-plus';
            } else if (n.mensaje.includes('actualizó')) {
                iconClass = 'fa-info-circle';
            }

            notificacionDiv.innerHTML = `
                <div class="notificacion-icon">
                    <i class="fas ${iconClass}"></i>
                </div>
                <div class="notificacion-contenido">
                    <p>${n.mensaje}</p>
                    <small>${new Date(n.fecha).toLocaleString()}</small>
                </div>
                ${!n.leida ? '<div class="unread-dot"></div>' : ''}
            `;
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
        await fetch(`https://zo-medica.onrender.com/notificaciones/${notificacionId}/leida`, {
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

function mostrarFavoritos() {
    if (!token || userTipo !== 'profesional') {
        alert('Debes iniciar sesión como profesional para ver tus favoritos.');
        return mostrarLogin();
    }
    mostrarSeccion('favoritos');
    cargarFavoritos();
}

// =================================================================
// SECCIÓN: FUNCIONES DE UI Y UTILIDADES
// =================================================================
async function fetchProtegido(url, options = {}) {
    // 1. Prepara las cabeceras y añade el token de autenticación
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    // 2. Realiza la petición al servidor
    const response = await fetch(url, { ...options, headers });

    // 3. ¡LA PARTE CLAVE! Revisa la respuesta del servidor.
    if (response.status === 401) {
        // Si el servidor dice "No Autorizado", activa el cierre de sesión.
        cerrarSesion('Tu sesión ha expirado. Por favor, inicia sesión de nuevo.');
        // Detiene la ejecución para evitar más errores.
        throw new Error('Sesión expirada');
    }

    // 4. Si todo está bien, devuelve la respuesta para que el resto del código continúe.
    return response;
}

function mostrarMensajeGlobal(message, type) {
    if (globalMessage) {
        globalMessage.textContent = message;
        globalMessage.className = 'message-inline ' + type;
        globalMessage.style.display = 'block';
    }
}

// REEMPLAZAR FUNCIÓN COMPLETA EN app.js

// REEMPLAZAR FUNCIÓN COMPLETA EN app.js

function actualizarNav() {
    // 1. Ocultar todos los elementos dinámicos o que dependen del estado.
    
    // Ocultar los botones de autenticación
    document.getElementById('btnRegistrarse').style.display = 'none'; // <--- CORRECCIÓN CLAVE
    document.getElementById('btnLogin').style.display = 'none';       // <--- CORRECCIÓN CLAVE
    
    // Ocultar los botones principales del rol
    const btnMisPostulaciones = document.getElementById('btnMisPostulaciones');
    if (btnMisPostulaciones) btnMisPostulaciones.style.display = 'none';
    const btnMiPanel = document.getElementById('btnMiPanel');
    if (btnMiPanel) btnMiPanel.style.display = 'none';

    // Ocultar el nuevo menú desplegable y sus ítems
    const menuPerfil = document.getElementById('menuPerfil');
    if (menuPerfil) menuPerfil.style.display = 'none';
    
    // Ocultar notificaciones y mensajes
    document.getElementById('btnNotificaciones').style.display = 'none';
    document.getElementById('btnMensajes').style.display = 'none';

    // 2. Mostrar elementos basados en el estado de autenticación
    if (token) {
        // Enlaces comunes logueados
        document.getElementById('btnNotificaciones').style.display = 'inline-block';
        document.getElementById('btnMensajes').style.display = 'inline-block';
        
        // Mostramos el menú de perfil
        if (menuPerfil) menuPerfil.style.display = 'inline-block';

        // Ocultar todos los enlaces del menú desplegable primero (seguro)
        const linksDropdown = ['linkPerfilProfesional', 'linkFavoritos', 'linkAlertas', 'linkBuscarTalentos'];
        linksDropdown.forEach(id => {
            const link = document.getElementById(id);
            if (link) link.style.display = 'none';
        });

        if (userTipo === 'profesional') {
            btnMisPostulaciones.style.display = 'inline-block'; 
            document.getElementById('linkPerfilProfesional').style.display = 'block';
            document.getElementById('linkFavoritos').style.display = 'block';
            document.getElementById('linkAlertas').style.display = 'block';
        } else if (userTipo === 'institucion') {
            btnMiPanel.style.display = 'inline-block'; 
            document.getElementById('linkBuscarTalentos').style.display = 'block';
        }
    } else {
        // Enlaces comunes no logueados: SOLO MOSTRAMOS REGISTRO Y LOGIN
        document.getElementById('btnRegistrarse').style.display = 'inline-block';
        document.getElementById('btnLogin').style.display = 'inline-block';
    }
}

async function actualizarContadorNotificaciones() {
    if (!token) return;
    const notifCountSpan = document.getElementById('notification-count');
    try {
        const response = await fetchProtegido('https://zo-medica.onrender.com/notificaciones');
        if (!response.ok) return;
        const notificaciones = await response.json();
        const notificacionesNoLeidas = notificaciones.filter(n => !n.leida).length;
        if (notificacionesNoLeidas > 0) {
            notifCountSpan.textContent = notificacionesNoLeidas;
            notifCountSpan.style.display = 'flex';
        } else {
            notifCountSpan.style.display = 'none';
        }
    } catch (error) { if (error.message !== 'Sesión expirada') console.error(error); }
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

// AÑADIR ESTO EN app.js
function toggleDropdown() {
    const dropdownContent = document.querySelector('#menuPerfil .dropdown-content');
    dropdownContent.classList.toggle('visible');
}

// Cierra el menú si se hace clic fuera de él
document.addEventListener('click', function(e) {
    const dropdownMenu = document.getElementById('menuPerfil');
    const dropdownContent = document.querySelector('#menuPerfil .dropdown-content');

    if (dropdownMenu && !dropdownMenu.contains(e.target)) {
        dropdownContent.classList.remove('visible');
    }
});
// FIN DE CÓDIGO A AÑADIR

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

async function cargarVacantes(query = '', ubicacion = '', tipoContrato = '') {
    const listaVacantes = document.getElementById('listaVacantes');
    if (!listaVacantes) return;

    mostrarSpinner('listaVacantes');
    
    try {
        const params = new URLSearchParams();
        if (query) params.append('q', query);
        if (ubicacion) params.append('ubicacion', ubicacion);
        if (tipoContrato) params.append('tipoContrato', tipoContrato);
        
        const response = await fetch(`https://zo-medica.onrender.com/vacantes?${params.toString()}`);

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

                const titulo = vacante.titulo || 'Título no disponible';
                const institucion = vacante.institucion || 'Institución no especificada';
                const descripcionCorta = (vacante.descripcion || 'Sin descripción.').substring(0, 100);
                const ubicacionHTML = vacante.ubicacion ? `<p class="vacante-ubicacion">${vacante.ubicacion}</p>` : '';

                // ESTE ES EL BLOQUE HTML CORRECTO Y COMPLETO
                vacanteDiv.innerHTML = `
                    <button class="favorite-btn" onclick="toggleFavorito(${vacante.id}, this)">
                        <i class="fas fa-star"></i>
                    </button>
                    <a href="#" onclick="mostrarVacanteDetalles(${vacante.id})"><h4>${titulo}</h4></a>
                    <p><strong>Institución:</strong> ${institucion}</p>
                    ${ubicacionHTML}
                    <p>${descripcionCorta}...</p>
                `;

                listaVacantes.appendChild(vacanteDiv);
            });
        }
    } catch (error) {
        listaVacantes.innerHTML = '<p>Ocurrió un error crítico al cargar las vacantes.</p>';
        console.error('Error definitivo al cargar vacantes:', error);
    } finally {
        ocultarSpinner();
    }
}

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

// REEMPLAZA ESTA FUNCIÓN COMPLETA EN app.js
// REEMPLAZA ESTA FUNCIÓN COMPLETA EN app.js
async function mostrarVacanteDetalles(vacanteId) {
    mostrarSeccion('vacanteDetalles');
    const vacanteInfoDiv = document.getElementById('vacanteInfo');
    vacanteInfoDiv.innerHTML = 'Cargando detalles de la vacante...';

    try {
        const fetchOptions = {};
        if (token) {
            fetchOptions.headers = { 'Authorization': `Bearer ${token}` };
        }
        const response = await fetch(`https://zo-medica.onrender.com/vacantes/${vacanteId}`, fetchOptions);
        const vacante = await response.json();

        if (vacante.error) {
            vacanteInfoDiv.innerHTML = `<p>${vacante.error}</p>`;
            return;
        }

        // Creamos la sección de requisitos primero
        let requisitosHTML = '<div class="perfil-seccion"><h3>Requisitos del Perfil</h3>';
        if (vacante.requisitos_obligatorios && vacante.requisitos_obligatorios.length > 0) {
            requisitosHTML += '<h4>✅ Requisitos Indispensables (Obligatorios)</h4><ul class="lista-requisitos">';
            vacante.requisitos_obligatorios.forEach(req => {
                requisitosHTML += `<li>${req}</li>`;
            });
            requisitosHTML += '</ul>';
        }
        if (vacante.requisitos_deseables && vacante.requisitos_deseables.length > 0) {
            requisitosHTML += '<h4 style="margin-top: 15px;">➕ Requisitos Deseables (Opcionales)</h4><ul class="lista-requisitos">';
            vacante.requisitos_deseables.forEach(req => {
                requisitosHTML += `<li>${req}</li>`;
            });
            requisitosHTML += '</ul>';
        }
        requisitosHTML += '</div>';

        const logoUrl = vacante.institucion.logoPath ? `https://zo-medica.onrender.com/${vacante.institucion.logoPath}` : 'uploads/default-avatar.png';
        const institucionLink = vacante.institucion.id ? `onclick="mostrarPerfilPublicoInstitucion(${vacante.institucion.id})"` : 'style="cursor: default; text-decoration: none;"';

        // Construimos el HTML final en el nuevo orden
        vacanteInfoDiv.innerHTML = `
            <div class="vacante-detalles-container">
                <h2>${vacante.titulo}</h2>
                <div class="institucion-info">
                    <img src="${logoUrl}" alt="Logo de ${vacante.institucion.nombre}" class="logo-institucion-vacante">
                    <p><strong>Institución:</strong> <a href="#" ${institucionLink}>${vacante.institucion.nombre}</a></p>
                </div>

                <button onclick="postularse(${vacante.id})" class="button postular-button" style="width:100%; margin: 20px 0;">Postularse a esta vacante</button>

                <div class="detalles-grid">
                    ${vacante.ubicacion ? `<div><strong><i class="fas fa-map-marker-alt"></i> Ubicación:</strong><p>${vacante.ubicacion}</p></div>` : ''}
                    ${vacante.tipoContrato ? `<div><strong><i class="fas fa-file-contract"></i> Contrato:</strong><p>${vacante.tipoContrato}</p></div>` : ''}
                    <div><strong><i class="fas fa-users"></i> Postulaciones:</strong><p>${vacante.totalPostulaciones}</p></div>
                    <div><strong><i class="fas fa-eye"></i> Vistas:</strong><p>${vacante.vistas}</p></div>
                </div>

                ${requisitosHTML}

                <div class="perfil-seccion">
                    <h3>Descripción del Puesto</h3>
                    <div class="descripcion-vacante">${vacante.descripcion}</div>
                </div>
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
            const response = await fetch('https://zo-medica.onrender.com/register', {
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
        errorLogin.innerHTML = ''; // Usamos innerHTML para poder poner un enlace

        try {
            const response = await fetch('https://zo-medica.onrender.com/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ correo, password })
            });
            const data = await response.json();

            if (data.error) {
                if (data.requiereVerificacion) {
                    // Mensaje mejorado con la opción de reenvío
                    errorLogin.innerHTML = `${data.error} <br> <a href="#" onclick="reenviarVerificacion('${correo}')">Reenviar correo de verificación</a>`;
                    errorLogin.style.display = 'block';
                } else {
                    errorLogin.textContent = data.error;
                    errorLogin.style.display = 'block';
                }
            } else {
                token = data.token;
                userName = data.user.nombre;
                userTipo = data.user.rol;
                userId = data.user.id;
                localStorage.setItem('token', token);
                localStorage.setItem('nombre', userName);
                localStorage.setItem('rol', userTipo);
                localStorage.setItem('userId', userId);

                iniciarConexionWebSocket();

                actualizarContadorNotificaciones();

                mostrarMensajeGlobal('¡Has iniciado sesión con éxito!', 'success');
                mostrarInicio();
                actualizarNav();
            }
        } catch (error) {
            errorLogin.textContent = 'Error al iniciar sesión. Inténtalo de nuevo.';
            errorLogin.style.display = 'block';
        }
    });
}


// REEMPLAZA TU FUNCIÓN handleUrlParams CON ESTA
function handleUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const verified = params.get('verified');
    const resetToken = params.get('resetToken'); // <-- LÍNEA NUEVA

    if (verified === 'true') {
        mostrarMensajeGlobal('¡Tu correo ha sido verificado con éxito! Ya puedes iniciar sesión.', 'success');
        mostrarLogin();
    } else if (verified === 'false') {
        mostrarMensajeGlobal('El enlace de verificación es inválido o ya ha sido utilizado.', 'error');
        mostrarLogin();
    } else if (verified === 'error') {
        mostrarMensajeGlobal('Ocurrió un error durante la verificación. Inténtalo de nuevo.', 'error');
        mostrarLogin();
    } else if (resetToken) { // <-- LÓGICA NUEVA
        mostrarFormularioReset(resetToken);
    }

    // Limpia la URL
    if (verified || resetToken) {
        history.replaceState(null, '', window.location.pathname);
    }
}

function mostrarMensajeGlobal(mensaje, tipo = 'info') {
    const globalMessage = document.getElementById('globalMessage');
    globalMessage.textContent = mensaje;
    globalMessage.className = `global-message ${tipo}`; // Usa clases como 'success' o 'error' de style.css
    globalMessage.style.display = 'block';
    setTimeout(() => {
        globalMessage.style.display = 'none';
    }, 5000);
}

function cerrarSesion(mensaje = 'Sesión cerrada correctamente.') {
if (socket && socket.readyState === WebSocket.OPEN) {
    socket.close(); // <-- LÍNEA NUEVA
}
    token = null;
    userName = null;
    userTipo = null;
    userId = null;
    localStorage.clear();

    // Muestra el mensaje personalizado y luego redirige al login
    mostrarMensajeGlobal(mensaje, 'info');
    mostrarLogin();
    actualizarNav();
}
// =================================================================
// SECCIÓN: LÓGICA DE POSTULACIONES (PROFESIONAL)
// =================================================================

async function postularse(vacanteId) {
    // 1. Verificación de seguridad (esto no cambia)
    if (!token || userTipo !== 'profesional') {
        return mostrarLogin();
    }

    try {
        // --- INICIO DE LA CORRECCIÓN ---
        // Usamos nuestro "guardián" para las peticiones.
        // Si la sesión expira aquí, se cerrará automáticamente.
        const vacanteRes = await fetchProtegido(`https://zo-medica.onrender.com/vacantes/${vacanteId}`);
        const vacante = await vacanteRes.json();

        const perfilRes = await fetchProtegido('https://zo-medica.onrender.com/perfil');
        const perfil = await perfilRes.json();
        // --- FIN DE LA CORRECCIÓN ---

        // 2. El resto de la lógica para comparar el perfil se mantiene exactamente igual.
        let textoCompletoDelPerfil = `${perfil.especialidad || ''} ${perfil.bio || ''} ${(perfil.habilidades || []).join(' ')} ${(perfil.experiencias || []).map(e => `${e.puesto} ${e.descripcion}`).join(' ')} ${(perfil.educacion || []).map(e => e.titulo).join(' ')} ${(perfil.certificaciones || []).map(c => c.nombre).join(' ')}`.toLowerCase();
        
        const requisitosFaltantes = (vacante.requisitos_obligatorios || []).filter(req => {
            return !textoCompletoDelPerfil.includes(req.trim().toLowerCase());
        });

        if (requisitosFaltantes.length > 0) {
            mostrarModalCompatibilidad(requisitosFaltantes, vacanteId);
        } else {
            procederConPostulacion(vacanteId);
        }

    } catch (error) {
        // Ahora, este 'catch' solo se activará por errores reales, no por sesión expirada.
        if (error.message !== 'Sesión expirada') {
            console.error("Error al verificar compatibilidad:", error);
            mostrarMensajeGlobal('No se pudo verificar la compatibilidad. Inténtalo de nuevo.', 'error');
        }
    }
}


function mostrarModalCompatibilidad(skillsFaltantes, vacanteId) {
    const modal = document.getElementById('compatibilityModal');
    const skillsList = document.getElementById('missingSkillsList');
    const btnContinue = document.getElementById('btnContinueApply');
    const btnImprove = document.getElementById('btnImproveProfile');
    
    modal.querySelector('h2').textContent = "Requisitos Indispensables Faltantes";
    modal.querySelector('p').textContent = "Hemos detectado que tu perfil no cumple con todos los requisitos obligatorios para esta vacante. Te recomendamos actualizar tu perfil antes de continuar.";
    modal.querySelector('h4').textContent = "Requisitos Indispensables que Faltan en tu Perfil:";

    skillsList.innerHTML = '';
    skillsFaltantes.forEach(skill => {
        const li = document.createElement('li');
        li.textContent = skill.charAt(0).toUpperCase() + skill.slice(1);
        skillsList.appendChild(li);
    });

    btnContinue.onclick = () => {
        ocultarModalCompatibilidad();
        procederConPostulacion(vacanteId);
    };
    btnImprove.onclick = () => {
        ocultarModalCompatibilidad();
        mostrarFormularioEditarPerfil();
    };

    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('visible'), 10);
}

function ocultarModalCompatibilidad() {
    const modal = document.getElementById('compatibilityModal');
    modal.classList.remove('visible');
    setTimeout(() => modal.style.display = 'none', 300);
}

function procederConPostulacion(vacanteId) {
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

        const postularButton = document.querySelector(`.postular-button`);
        try {
            postularButton.disabled = true;
            postularButton.textContent = 'Enviando...';
            const response = await fetch(`https://zo-medica.onrender.com/postular/${vacanteId}`, {
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

async function cargarPostulacionesProfesional(postulacionIdParaResaltar = null) {
    const listaPostulaciones = document.getElementById('listaPostulaciones');
    if (!listaPostulaciones) return;
    listaPostulaciones.innerHTML = 'Cargando postulaciones...';
    try {
        const response = await fetch('https://zo-medica.onrender.com/postulaciones', {
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
                pDiv.id = `postulacion-${postulacion.id}`;

                const estadoClase = postulacion.estado.toLowerCase().trim().replace(/\s+/g, '-');

                // DENTRO DE la función cargarPostulacionesProfesional, REEMPLAZA ESTE BLOQUE

pDiv.innerHTML = `
    <a href="#" onclick="mostrarVacanteDetalles(${postulacion.vacante_id})" class="postulacion-link">
        <div class="postulacion-info">
            <h4><i class="fas fa-briefcase"></i> ${postulacion.vacante_titulo}</h4>
            <p><i class="fas fa-building"></i> <strong>Institución:</strong> ${postulacion.vacante_institucion}</p>
            <p><i class="fas fa-calendar-alt"></i> <strong>Fecha de postulación:</strong> ${new Date(postulacion.fecha).toLocaleDateString()}</p>
        </div>
    </a>
    <div class="postulacion-acciones">
        <span class="postulacion-estado estado-${estadoClase}">${postulacion.estado}</span>
        <button class="delete" onclick="eliminarPostulacion(${postulacion.id})">
            <i class="fas fa-trash-alt"></i> Eliminar
        </button>
    </div>
`;
                listaPostulaciones.appendChild(pDiv);
            });

            if (postulacionIdParaResaltar) {
                const targetCard = document.getElementById(`postulacion-${postulacionIdParaResaltar}`);
                if (targetCard) {
                    setTimeout(() => {
                        targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        targetCard.style.transition = 'background-color 0.5s ease';
                        targetCard.style.backgroundColor = '#e3f2fd';
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
        const response = await fetch(`https://zo-medica.onrender.com/postulaciones/${id}`, {
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
// REEMPLAZA ESTA SECCIÓN COMPLETA EN app.js
if (document.getElementById('formVacante')) {
    document.getElementById('formVacante').addEventListener('submit', async (e) => {
        e.preventDefault();

        // Leemos los datos del formulario, incluyendo los nuevos campos de requisitos
        const titulo = document.getElementById('vacanteTitulo').value;
        const institucion = document.getElementById('vacanteInstitucion').value;
        const descripcion = document.getElementById('vacanteDescripcion').value;
        const requisitos_obligatorios = document.getElementById('vacanteRequisitosObligatorios').value; // <-- CAMBIO
        const requisitos_deseables = document.getElementById('vacanteRequisitosDeseables').value;   // <-- CAMBIO
        const ubicacion = document.getElementById('vacanteUbicacion').value;
        const tipoContrato = document.getElementById('vacanteTipoContrato').value;
        const salario = document.getElementById('vacanteSalario').value;

        try {
            const response = await fetch('https://zo-medica.onrender.com/vacantes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                // Nos aseguramos de enviar los nuevos campos al backend
                body: JSON.stringify({ 
                    titulo, 
                    institucion, 
                    descripcion, 
                    requisitos_obligatorios, // <-- CAMBIO
                    requisitos_deseables,    // <-- CAMBIO
                    ubicacion, 
                    tipoContrato, 
                    salario 
                })
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
        const response = await fetch('https://zo-medica.onrender.com/institucion/vacantes', {
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
        const response = await fetch(`https://zo-medica.onrender.com/vacantes/${id}`, {
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
        const response = await fetch(`https://zo-medica.onrender.com/institucion/postulaciones?${params.toString()}`, {
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
        const res = await fetch(`https://zo-medica.onrender.com/institucion/postulaciones/${postulacionId}/profesional`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || 'No se pudo cargar el perfil.');
        }

        const perfil = await res.json();

// Event listener para el formulario de edición
document.getElementById('formEditarVacante').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const vacanteId = document.getElementById('editarVacanteId').value;
    
    // Recolectamos los datos del formulario
    const datosActualizados = {
        titulo: document.getElementById('vacanteTituloEditar').value,
        institucion: document.getElementById('vacanteInstitucionEditar').value,
        ubicacion: document.getElementById('vacanteUbicacionEditar').value,
        tipoContrato: document.getElementById('vacanteTipoContratoEditar').value,
        salario: document.getElementById('vacanteSalarioEditar').value,
        descripcion: document.getElementById('vacanteDescripcionEditar').value,
        requisitos_obligatorios: document.getElementById('vacanteRequisitosObligatoriosEditar').value,
        requisitos_deseables: document.getElementById('vacanteRequisitosDeseablesEditar').value,
    };

    try {
        const response = await fetch(`https://zo-medica.onrender.com/vacantes/${vacanteId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(datosActualizados)
        });

        const data = await response.json();
        
        if (data.error) {
            alert(`Error: ${data.error}`);
        } else {
            alert(data.message);
            mostrarInstituciones(); // Volvemos al panel principal
        }
    } catch (error) {
        console.error('Error al actualizar la vacante:', error);
        alert('Ocurrió un error al guardar los cambios.');
    }
});

        // ==========================================================
        // PUNTO DE CONTROL 1: VERIFICAR LOS DATOS RECIBIDOS
        console.log("Datos del perfil recibidos del servidor:", perfil);
        // ==========================================================

        const imagenSrc = perfil.fotoPath ? `https://zo-medica.onrender.com/${perfil.fotoPath}` : 'uploads/default-avatar.png';

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
                ${perfil.cvPath ? `<p><a href="https://zo-medica.onrender.com/${perfil.cvPath}" target="_blank" class="button">Descargar CV</a></p>` : ''}
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
        const response = await fetch(`https://zo-medica.onrender.com/postulaciones/${id}/estado`, {
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
        const res = await fetch('https://zo-medica.onrender.com/perfil', {
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
                cvActualP.innerHTML = `CV actual: <a href="https://zo-medica.onrender.com/${perfil.cvPath}" target="_blank">Ver CV</a>`;
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

// REEMPLAZA TU FUNCIÓN cargarPerfilProfesional EN app.js CON ESTA VERSIÓN

async function cargarPerfilProfesional() {
    try {
        const res = await fetch('https://zo-medica.onrender.com/perfil', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

        const perfil = await res.json();
        const perfilContainer = document.getElementById('infoProfesional');
        const imagenSrc = perfil.fotoPath ? `https://zo-medica.onrender.com/${perfil.fotoPath}` : 'uploads/default-avatar.png';

        let perfilHTML = `
            <div class="perfil-header">
                <img src="${imagenSrc}" alt="Foto de Perfil" id="imagenPerfil" class="perfil-foto">
                <h3>${perfil.nombre}</h3>
                <p class="perfil-titulo-puesto">${perfil.especialidad || 'Especialidad no especificada'}</p>
            </div>

            <div class="perfil-seccion stats-bar" style="margin-top: 20px; border-top: none;">
                <div class="stat-card">
                    <h4>Postulaciones Realizadas</h4>
                    <p>${perfil.totalPostulaciones}</p>
                    <i class="fas fa-file-alt card-icon"></i>
                </div>
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
                ${perfil.cvPath ? `<div class="cv-download-container" style="margin-top: 20px;"><a href="https://zo-medica.onrender.com/${perfil.cvPath}" target="_blank" class="button">Descargar CV</a></div>` : ''}
            </div>

            <div class="perfil-seccion">
                <h4>Acerca de mí</h4>
                <p>${perfil.bio || 'Aún no has agregado una biografía.'}</p>
            </div>`;

        if (perfil.experiencias && perfil.experiencias.length > 0) {
            perfilHTML += `<div class="perfil-seccion"><h4>Experiencia Profesional</h4><ul class="lista-experiencia">`;
            perfil.experiencias.forEach(exp => {
                perfilHTML += `<li><strong>${exp.puesto}</strong> en ${exp.institucion} (${exp.periodo})<p>${exp.descripcion}</p></li>`;
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

        if (perfil.certificaciones && perfil.certificaciones.length > 0) {
            perfilHTML += `<div class="perfil-seccion"><h4>Certificaciones y Diplomados</h4><ul class="lista-educacion">`;
            perfil.certificaciones.forEach(cert => {
                perfilHTML += `<li><strong>${cert.nombre}</strong><br>${cert.institucion}<br>${cert.periodo}</li>`;
            });
            perfilHTML += `</ul></div>`;
        }

        if (perfil.habilidades) {
            const habilidadesArray = Array.isArray(perfil.habilidades) ? perfil.habilidades : perfil.habilidades.split(',').map(h => h.trim());
            perfilHTML += `<div class="perfil-seccion"><h4>Habilidades y Herramientas</h4><div class="tags-container">`;
            habilidadesArray.forEach(habilidad => {
                perfilHTML += `<span class="keyword-tag">${habilidad}</span>`;
            });
            perfilHTML += `</div></div>`;
        }

        perfilContainer.innerHTML = perfilHTML;

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
        const response = await fetch(`https://zo-medica.onrender.com/perfil/foto`, {
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
            const res = await fetch('https://zo-medica.onrender.com/perfil', {
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
        const response = await fetch('https://zo-medica.onrender.com/perfil/cv', {
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
            cvActualP.innerHTML = `CV actual: <a href="https://zo-medica.onrender.com/${data.cvPath}" target="_blank">Ver CV</a>`;
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
            const res = await fetch('https://zo-medica.onrender.com/perfil', {
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
        const res = await fetch('https://zo-medica.onrender.com/perfil', {
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
        const response = await fetch(`https://zo-medica.onrender.com/perfil/logo`, {
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
        const res = await fetch(`https://zo-medica.onrender.com/instituciones/${institucionId}`);
        const perfil = await res.json();

        if (perfil.error) {
            perfilInfoDiv.innerHTML = `<p class="error">${perfil.error}</p>`;
            return;
        }

        const logoUrl = perfil.logoPath ? `https://zo-medica.onrender.com/${perfil.logoPath}` : 'uploads/default-avatar.png';

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
        const response = await fetch(`https://zo-medica.onrender.com/institucion/buscar-profesionales?${params.toString()}`, {
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

                const imagenSrc = perfil.fotoPath ? `https://zo-medica.onrender.com/${perfil.fotoPath}` : 'uploads/default-avatar.png';
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
        const res = await fetch(`https://zo-medica.onrender.com/profesionales/${profesionalId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || 'No se pudo cargar el perfil.');
        }

        const perfil = await res.json();
        const imagenSrc = perfil.fotoPath ? `https://zo-medica.onrender.com/${perfil.fotoPath}` : 'uploads/default-avatar.png';

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
                ${perfil.cvPath ? `<p><a href="https://zo-medica.onrender.com/${perfil.cvPath}" target="_blank" class="button">Descargar CV</a></p>` : ''}
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

// Función para manejar el clic en "Marcar todas como leídas"
async function marcarTodasComoLeidas() {
    try {
        const response = await fetch('https://zo-medica.onrender.com/notificaciones/marcar-todas-leidas', {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error('El servidor no pudo completar la acción.');
        }

        // Si el servidor confirma, actualizamos la interfaz de usuario
        document.querySelectorAll('#listaNotificaciones .notificacion').forEach(elem => {
            elem.classList.add('leida');
        });
        document.querySelectorAll('.unread-dot').forEach(dot => dot.style.display = 'none');
        document.getElementById('marcarTodasLeidasBtn').style.display = 'none';
        
        // Actualizamos el contador de la barra de navegación
        const notifCountSpan = document.getElementById('notification-count');
        if (notifCountSpan) {
            notifCountSpan.style.display = 'none';
            notifCountSpan.textContent = '0';
        }

    } catch (error) {
        console.error('Error en marcarTodasComoLeidas:', error);
        alert('No se pudieron marcar las notificaciones. Inténtalo de nuevo.');
    }
}

// Asignamos el evento al botón
document.getElementById('marcarTodasLeidasBtn').addEventListener('click', marcarTodasComoLeidas);

// NAVEGACIÓN
function mostrarFormularioRecuperar() {
    mostrarSeccion('recuperarPassword');
}

function mostrarFormularioReset(token) {
    mostrarSeccion('resetPassword');
    document.getElementById('resetTokenInput').value = token;
}

// LÓGICA DE FORMULARIOS

// Formulario para solicitar el enlace
document.getElementById('formRecuperarPassword').addEventListener('submit', async (e) => {
    e.preventDefault();
    const correo = document.getElementById('correoRecuperar').value;
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Enviando...';

    try {
        const response = await fetch('https://zo-medica.onrender.com/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ correo })
        });
        const data = await response.json();
        // Siempre mostramos un mensaje de éxito para no revelar información
        mostrarMensajeGlobal(data.message, 'success');
        mostrarLogin();
    } catch (error) {
        mostrarMensajeGlobal('Ocurrió un error. Inténtalo de nuevo.', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Enviar Enlace';
    }
});

// Formulario para establecer la nueva contraseña
document.getElementById('formResetPassword').addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = document.getElementById('resetTokenInput').value;
    const password = document.getElementById('passwordReset').value;
    const passwordConfirm = document.getElementById('passwordResetConfirm').value;

    if (password !== passwordConfirm) {
        return mostrarMensajeGlobal('Las contraseñas no coinciden.', 'error');
    }
    if (password.length < 6) {
         return mostrarMensajeGlobal('La contraseña debe tener al menos 6 caracteres.', 'error');
    }

    try {
        const response = await fetch('https://zo-medica.onrender.com/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, password })
        });
        const data = await response.json();
        if (data.error) {
            mostrarMensajeGlobal(data.error, 'error');
        } else {
            mostrarMensajeGlobal(data.message, 'success');
            mostrarLogin();
        }
    } catch (error) {
        mostrarMensajeGlobal('Ocurrió un error. Inténtalo de nuevo.', 'error');
    }
});

async function cargarFavoritos() {
    const listaFavoritos = document.getElementById('listaFavoritos');
    if (!listaFavoritos) return;

    listaFavoritos.innerHTML = 'Cargando tus vacantes guardadas...';

    try {
        const response = await fetch('https://zo-medica.onrender.com/favoritos', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const vacantes = await response.json();

        listaFavoritos.innerHTML = '';
        if (vacantes.length === 0) {
            listaFavoritos.innerHTML = '<p>Aún no has guardado ninguna vacante como favorita.</p>';
        } else {
            vacantes.forEach(vacante => {
                // Reutilizamos el mismo estilo de tarjeta de vacante
                const vacanteDiv = document.createElement('div');
                vacanteDiv.className = 'vacante';
                const descripcionCorta = (vacante.descripcion || '').substring(0, 100);

                // Añadimos el botón de favorito ya marcado
                vacanteDiv.innerHTML = `
                    <button class="favorite-btn es-favorito" onclick="toggleFavorito(${vacante.id}, this)">
                        <i class="fas fa-star"></i>
                    </button>
                    <a href="#" onclick="mostrarVacanteDetalles(${vacante.id})"><h4>${vacante.titulo}</h4></a>
                    <p><strong>Institución:</strong> ${vacante.institucion}</p>
                    <p>${descripcionCorta}...</p>
                `;
                listaFavoritos.appendChild(vacanteDiv);
            });
        }
    } catch (error) {
        console.error('Error al cargar favoritos:', error);
        listaFavoritos.innerHTML = '<p>Ocurrió un error al cargar tus favoritos.</p>';
    }
}

async function toggleFavorito(vacanteId, boton) {
    if (!token || userTipo !== 'profesional') {
        mostrarMensajeGlobal('Debes iniciar sesión como profesional para guardar favoritos.', 'error');
        return;
    }

    try {
        const response = await fetch(`https://zo-medica.onrender.com/favoritos/${vacanteId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        // Actualizamos el estilo del botón al instante
        if (data.esFavorito) {
            boton.classList.add('es-favorito');
        } else {
            boton.classList.remove('es-favorito');
        }
        // Opcional: Si estamos en la vista de favoritos, podríamos quitar la tarjeta
        if (seccionActual === 'favoritos' && !data.esFavorito) {
             boton.closest('.vacante').remove();
        }

    } catch (error) {
        console.error('Error al cambiar estado de favorito:', error);
        mostrarMensajeGlobal('No se pudo actualizar el favorito.', 'error');
    }
}

// --- LÓGICA PARA ALERTAS DE EMPLEO ---

function mostrarAlertas() {
    if (!token) return mostrarLogin();
    mostrarSeccion('alertas');
    cargarAlertas();
}

async function cargarAlertas() {
    const listaAlertas = document.getElementById('listaAlertas');
    listaAlertas.innerHTML = 'Cargando tus alertas...';

    try {
        const response = await fetch('https://zo-medica.onrender.com/alertas', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const alertas = await response.json();

        listaAlertas.innerHTML = '';
        if (alertas.length === 0) {
            listaAlertas.innerHTML = '<p>No has creado ninguna alerta. Ve a la sección de vacantes, usa los filtros y haz clic en "Crear Alerta".</p>';
            return;
        }

        alertas.forEach(alerta => {
            const card = document.createElement('div');
            card.className = 'alerta-card';
            card.innerHTML = `
                <div class="alerta-info">
                    <p><strong>Palabras Clave:</strong> ${alerta.palabras_clave || 'Cualquiera'}</p>
                    <p><strong>Ubicación:</strong> ${alerta.ubicacion || 'Cualquiera'}</p>
                    <p><strong>Contrato:</strong> ${alerta.tipo_contrato || 'Cualquiera'}</p>
                </div>
                <button class="delete" onclick="eliminarAlerta(${alerta.id})">Eliminar</button>
            `;
            listaAlertas.appendChild(card);
        });
    } catch (error) {
        listaAlertas.innerHTML = '<p class="error">No se pudieron cargar tus alertas.</p>';
        console.error(error);
    }
}

async function crearAlertaDesdeFiltros() {
    if (!token) {
        mostrarMensajeGlobal('Debes iniciar sesión para crear una alerta.', 'error');
        return mostrarLogin();
    }

    const data = {
        palabras_clave: document.getElementById('searchInput').value,
        ubicacion: document.getElementById('ubicacionFilter').value,
        tipo_contrato: document.getElementById('tipoContratoFilter').value
    };

    if (!data.palabras_clave && !data.ubicacion && !data.tipo_contrato) {
        mostrarMensajeGlobal('Usa al menos un filtro para crear una alerta.', 'error');
        return;
    }

    try {
        const response = await fetch('https://zo-medica.onrender.com/alertas', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        if (response.ok) {
            mostrarMensajeGlobal('¡Alerta creada con éxito! Te avisaremos por correo.', 'success');
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        mostrarMensajeGlobal(`Error al crear la alerta: ${error.message}`, 'error');
    }
}

async function eliminarAlerta(id) {
    if (!confirm('¿Estás seguro de que quieres eliminar esta alerta?')) return;

    try {
        const response = await fetch(`https://zo-medica.onrender.com/alertas/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            mostrarMensajeGlobal('Alerta eliminada.', 'success');
            cargarAlertas(); // Recargamos la lista
        } else {
            const result = await response.json();
            throw new Error(result.error);
        }
    } catch (error) {
        mostrarMensajeGlobal(`Error al eliminar la alerta: ${error.message}`, 'error');
    }
}

// AÑADE ESTAS DOS NUEVAS FUNCIONES AL FINAL DE LA SECCIÓN "LÓGICA DEL PANEL DE INSTITUCIÓN"

async function mostrarFormularioEditarVacante(vacanteId) {
    mostrarSeccion('formularioEditarVacante');
    popularDropdownProvincias('vacanteUbicacionEditar'); // Rellenamos el selector de ubicación

    try {
        // 1. Pedimos los datos actuales de la vacante al servidor
        const response = await fetch(`https://zo-medica.onrender.com/vacantes/${vacanteId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const vacante = await response.json();

        if (vacante.error) {
            alert(vacante.error);
            return mostrarInstituciones();
        }

        // 2. Rellenamos el formulario con los datos obtenidos
        document.getElementById('editarVacanteId').value = vacante.id;
        document.getElementById('vacanteTituloEditar').value = vacante.titulo;
        document.getElementById('vacanteInstitucionEditar').value = vacante.institucion;
        document.getElementById('vacanteUbicacionEditar').value = vacante.ubicacion;
        document.getElementById('vacanteTipoContratoEditar').value = vacante.tipoContrato;
        document.getElementById('vacanteSalarioEditar').value = vacante.salario;
        document.getElementById('vacanteDescripcionEditar').value = vacante.descripcion;
        document.getElementById('vacanteRequisitosObligatoriosEditar').value = vacante.requisitos_obligatorios.join(', ');
        document.getElementById('vacanteRequisitosDeseablesEditar').value = vacante.requisitos_deseables.join(', ');

    } catch (error) {
        console.error('Error al cargar datos para editar:', error);
        alert('No se pudieron cargar los datos de la vacante.');
    }
}

// --- LÓGICA PARA MODAL DE ANALÍTICAS ---

function cerrarModalAnaliticas() {
    const modal = document.getElementById('analyticsModal');
    modal.classList.remove('visible');
    setTimeout(() => modal.style.display = 'none', 300);
}

async function mostrarModalAnaliticas(vacanteId, vacanteTitulo) {
    const modal = document.getElementById('analyticsModal');
    const tituloModal = document.getElementById('analyticsModalTitulo');
    const contenidoModal = document.getElementById('analyticsModalContenido');

    tituloModal.textContent = `Analíticas para: "${vacanteTitulo}"`;
    contenidoModal.innerHTML = '<p>Cargando datos...</p>';
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('visible'), 10);

    try {
        const response = await fetch(`https://zo-medica.onrender.com/institucion/vacantes/${vacanteId}/analiticas`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Error del servidor');
        }

        const data = await response.json();

        contenidoModal.innerHTML = `
            <div class="stat-card">
                <h4><i class="fas fa-eye"></i> Vistas Únicas</h4>
                <p>${data.vistas}</p>
            </div>
            <div class="stat-card">
                <h4><i class="fas fa-users"></i> Postulaciones</h4>
                <p>${data.postulaciones}</p>
            </div>
            <div class="stat-card">
                <h4><i class="fas fa-chart-line"></i> Tasa de Conversión</h4>
                <p>${data.tasa_conversion}%</p>
            </div>
        `;

    } catch (error) {
        contenidoModal.innerHTML = `<p class="error">No se pudieron cargar las analíticas: ${error.message}</p>`;
    }
}

// --- LÓGICA PARA EL SISTEMA DE MENSAJERÍA ---
let conversacionActivaId = null;

function mostrarMensajeria() {
    if (!token) return mostrarLogin();
    mostrarSeccion('mensajeria');
    cargarConversaciones();
    document.getElementById('chatInputArea').style.display = 'none';
    document.getElementById('chatWindow').innerHTML = `
        <div class="chat-placeholder">
            <i class="fas fa-comments"></i>
            <p>Selecciona una conversación para ver los mensajes.</p>
        </div>`;
}

async function cargarConversaciones() {
    const listaConversaciones = document.getElementById('listaConversaciones');
    listaConversaciones.innerHTML = '<p style="padding: 15px;">Cargando...</p>';
    try {
        const response = await fetch('https://zo-medica.onrender.com/conversaciones', { headers: { 'Authorization': `Bearer ${token}` } });
        const conversaciones = await response.json();
        listaConversaciones.innerHTML = '';
        if (conversaciones.length === 0) {
            listaConversaciones.innerHTML = '<p style="padding: 15px;">No tienes conversaciones activas.</p>';
            return;
        }
        conversaciones.forEach(conv => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'conversation-item';
            itemDiv.dataset.id = conv.id;
            itemDiv.onclick = () => abrirChat(conv.id);
            itemDiv.innerHTML = `
                <h6>${conv.nombre_interlocutor}</h6>
                <p>${conv.titulo_vacante}</p>
            `;
            listaConversaciones.appendChild(itemDiv);
        });
    } catch (error) {
        console.error('Error al cargar conversaciones:', error);
        listaConversaciones.innerHTML = '<p style="padding: 15px;" class="error">Error al cargar.</p>';
    }
}


async function abrirChat(conversacionId) {
    conversacionActivaId = conversacionId;
    document.querySelectorAll('.conversation-item').forEach(item => {
        item.classList.toggle('active', item.dataset.id == conversacionId);
    });

    const chatWindow = document.getElementById('chatWindow');
    const chatInputArea = document.getElementById('chatInputArea');
    chatWindow.innerHTML = 'Cargando mensajes...';
    chatInputArea.style.display = 'flex';

    try {
        // --- INICIO DE LA MODIFICACIÓN ---
        // 1. Marca los mensajes como leídos en el servidor
        await fetchProtegido(`https://zo-medica.onrender.com/conversaciones/${conversacionId}/leido`, { method: 'PUT' });

        // 2. Actualiza el contador de la burbuja roja inmediatamente
        actualizarContadorMensajes();
        // --- FIN DE LA MODIFICACIÓN ---

        // El resto de la función sigue igual
        const response = await fetchProtegido(`https://zo-medica.onrender.com/conversaciones/${conversacionId}/mensajes`);
        const mensajes = await response.json();
        chatWindow.innerHTML = '';
        mensajes.forEach(msg => {
            const bubble = document.createElement('div');
            bubble.className = 'message-bubble';
            bubble.classList.add(msg.remitente_id == userId ? 'sent' : 'received');
            bubble.textContent = msg.mensaje;
            chatWindow.appendChild(bubble);
        });
        chatWindow.scrollTop = chatWindow.scrollHeight;
    } catch (error) {
        if (error.message !== 'Sesión expirada') {
            console.error('Error al cargar mensajes:', error);
            chatWindow.innerHTML = '<p class="error">Error al cargar mensajes.</p>';
        }
    }
}

async function enviarMensaje() {
    const input = document.getElementById('mensajeInput');
    const mensaje = input.value.trim();
    if (!mensaje || !conversacionActivaId) return;

    try {
        const response = await fetch('https://zo-medica.onrender.com/mensajes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ conversacion_id: conversacionActivaId, mensaje })
        });
        const data = await response.json();
        if (data.error) {
            mostrarMensajeGlobal(data.error, 'error');
        } else {
            input.value = '';
            // Añade el nuevo mensaje visualmente al instante
            const chatWindow = document.getElementById('chatWindow');
            const bubble = document.createElement('div');
            bubble.className = 'message-bubble sent';
            bubble.textContent = mensaje;
            chatWindow.appendChild(bubble);
            chatWindow.scrollTop = chatWindow.scrollHeight;
        }
    } catch (error) {
        console.error('Error al enviar mensaje:', error);
        mostrarMensajeGlobal('Error al enviar mensaje.', 'error');
    }
}
// Asignar el evento al botón de enviar
document.getElementById('enviarMensajeBtn').addEventListener('click', enviarMensaje);
// Permitir enviar con la tecla Enter
document.getElementById('mensajeInput').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        enviarMensaje();
    }
});

async function actualizarContadorMensajes() {
    if (!token) return;
    const mensajesCountSpan = document.getElementById('mensajes-count');
    if (!mensajesCountSpan) return;

    try {
        const response = await fetchProtegido('https://zo-medica.onrender.com/mensajes/no-leidos');
        const data = await response.json();

        if (data.total > 0) {
            mensajesCountSpan.textContent = data.total;
            mensajesCountSpan.style.display = 'flex';
        } else {
            mensajesCountSpan.style.display = 'none';
        }
    } catch (error) {
        if (error.message !== 'Sesión expirada') {
            console.error('No se pudo verificar el estado de los mensajes.', error);
            mensajesCountSpan.style.display = 'none';
        }
    }
}

// --- LÓGICA DE WEBSOCKETS PARA NOTIFICACIONES EN TIEMPO REAL ---
let socket;

function iniciarConexionWebSocket() {
    if (!token) return;

    // Cierra cualquier conexión anterior para evitar duplicados
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        socket.close();
    }

 // ✅ CÓDIGO CORRECTO Y ROBUSTO
const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsHost = 'zo-medica.onrender.com'; // ¡Tu URL de Render!
socket = new WebSocket(`${wsProtocol}//${wsHost}?token=${token}`);

    socket.onopen = () => {
        console.log('Conexión WebSocket establecida.');
        // Al conectar, pide el conteo de mensajes no leídos una sola vez para empezar
        actualizarContadorMensajes(); 
    };

    // Esto se ejecuta CADA VEZ que el servidor nos envía un mensaje
    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        // Si el mensaje es de tipo 'nuevo_mensaje', actualizamos el contador visual
        if (data.type === 'nuevo_mensaje') {
            console.log('Notificación de nuevo mensaje recibida en tiempo real.');
            actualizarContadorMensajes();
        }
    };

    socket.onerror = (error) => {
        console.error('Error de WebSocket:', error);
    };

    socket.onclose = () => {
        console.log('Conexión WebSocket cerrada.');
    };
}

// Al cargar la página, si el usuario ya tenía una sesión activa, inicia la conexión
if (token) {
    iniciarConexionWebSocket();
}

async function reenviarVerificacion(correo) {
    try {
        const response = await fetch('https://zo-medica.onrender.com/resend-verification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ correo })
        });
        const data = await response.json();
        mostrarMensajeGlobal(data.message, 'success');
        document.getElementById('errorLogin').style.display = 'none';
    } catch (error) {
        mostrarMensajeGlobal('No se pudo reenviar el correo. Inténtalo de nuevo más tarde.', 'error');
    }
}