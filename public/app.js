// =================================================================
// # --- ESTADO GLOBAL E INICIALIZACIÓN ---
// =================================================================

let token = localStorage.getItem('token');
let userName = localStorage.getItem('nombre');
let userTipo = localStorage.getItem('rol');
let userId = localStorage.getItem('userId');
let seccionActual = 'inicio';
let seccionAnterior = 'inicio';
let filtrosCargados = false;
let conversacionActivaId = null;
let socket;

const API_URL = 'https://zomedica.onrender.com';
const WS_URL = 'wss://zomedica.onrender.com';

const globalMessage = document.getElementById('globalMessage');
const spinner = document.getElementById('loadingSpinner');

document.addEventListener('DOMContentLoaded', () => {
    handleUrlParams();
    window.addEventListener('hashchange', handleUrlParams); 
    actualizarNav();
    if (token) {
        actualizarContadorNotificaciones();
        iniciarConexionWebSocket();
    }
    mostrarInicio();
});

// =================================================================
// # --- MANEJO DE NAVEGACIÓN Y VISTAS ---
// =================================================================

function mostrarSeccion(id) {
    if (id !== seccionActual) {
        seccionAnterior = seccionActual;
    }
    document.querySelectorAll('section').forEach(sec => sec.style.display = 'none');
    const seccion = document.getElementById(id);
    if (seccion) {
        seccion.style.display = 'block';
        seccionActual = id;
    }
    if (globalMessage) {
        globalMessage.style.display = 'none';
    }
}

function goBack() {
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
            mostrarInicio(); // Opción segura
            break;
    }
}

async function mostrarInicio() {
    mostrarSeccion('inicio');
    const saludoUsuario = document.getElementById('saludoUsuario');
    const listaVacantesInicio = document.getElementById('listaVacantesInicio');
    const btnEncontrar = document.getElementById('btnEncontrarEmpleo');
    const btnPublicar = document.getElementById('btnPublicarVacante');

    if (token) {
        if (userTipo === 'profesional') {
            btnEncontrar.style.display = 'inline-block';
            btnPublicar.style.display = 'none';
        } else if (userTipo === 'institucion') {
            btnEncontrar.style.display = 'none';
            btnPublicar.style.display = 'inline-block';
            btnPublicar.onclick = mostrarFormularioVacante;
        }
    } else {
        btnEncontrar.style.display = 'inline-block';
        btnPublicar.style.display = 'inline-block';
        btnPublicar.onclick = mostrarRegistro;
    }

    if (!saludoUsuario || !listaVacantesInicio) return;

    saludoUsuario.innerHTML = '';
    saludoUsuario.style.display = 'none';
    listaVacantesInicio.innerHTML = 'Cargando vacantes recientes...';

    if (userName) {
        saludoUsuario.textContent = `¡Hola de nuevo, ${userName}!`;
        saludoUsuario.style.display = 'block';
    }

    try {
        const response = await fetch(`${API_URL}/vacantes`);
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
                    <div class="vacante-contenido">
                        <a href="#" onclick="mostrarVacanteDetalles(${vacante.id})">
                            <h4 class="vacante-titulo">${vacante.titulo}</h4>
                        </a>
                        <p class="vacante-institucion">${vacante.institucion}</p>
                        <div class="vacante-detalles-iconos">
                            ${vacante.ubicacion ? `
                                <div class="detalle-icono">
                                    <i class="fas fa-map-marker-alt"></i>
                                    <span>${vacante.ubicacion}</span>
                                </div>` : ''}
                        </div>
                        <p>${descripcionCorta}...</p>
                    </div>
                    <div class="vacante-footer">
                        <div class="keywords-container">${keywordsHTML}</div>
                    </div>
                `;
                listaVacantesInicio.appendChild(vacanteDiv);
            });
        }
    } catch (error) {
        listaVacantesInicio.innerHTML = '<p>No se pudieron cargar las vacantes.</p>';
        console.error('Error al cargar vacantes de inicio:', error);
    }
}

function mostrarRegistro() {
    mostrarSeccion('registro');
}

function mostrarLogin() {
    mostrarSeccion('login');
}

function mostrarProfesionales(postulacionIdParaResaltar = null) {
    if (!token || userTipo !== 'profesional') {
        alert('Acceso denegado.');
        return mostrarLogin();
    }
    mostrarSeccion('profesionales');
    cargarPostulacionesProfesional(postulacionIdParaResaltar);
}

async function mostrarInstituciones() {
    if (!token || userTipo !== 'institucion') {
        return mostrarLogin();
    }
    mostrarSeccion('instituciones');
document.getElementById('nombreInstitucionPanel').textContent = userName;
    try {
        const [vacantesRes, postulacionesRes] = await Promise.all([
            fetchProtegido(`${API_URL}/institucion/vacantes`),
            fetchProtegido(`${API_URL}/institucion/postulaciones`)
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
    } catch (error) {
        if (error.message !== 'Sesión expirada') {
            console.error("Error al cargar dashboard:", error);
        }
    }
}

function mostrarPipelinePorVacante(vacanteId, tituloVacante) {
    const tituloPipeline = document.getElementById('pipelineTituloVacante');
    if (tituloPipeline) {
        tituloPipeline.textContent = `Pipeline para: ${tituloVacante}`;
    }
    mostrarSeccion('pipelineVacante');
    cargarPostulacionesInstitucion(vacanteId, true);
}

function mostrarNotificaciones() {
    if (!token) {
        alert('Debes iniciar sesión para ver tus notificaciones.');
        return mostrarLogin();
    }
    mostrarSeccion('notificaciones');
    cargarNotificaciones();
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

function mostrarAlertas() {
    if (!token) {
        return mostrarLogin();
    }
    mostrarSeccion('alertas');
    cargarAlertas();
}

function mostrarBusquedaTalentos() {
    if (!token || userTipo !== 'institucion') {
        alert('Acceso denegado.');
        return mostrarLogin();
    }
    mostrarSeccion('busquedaTalentos');
    document.getElementById('resultadosBusquedaTalentos').innerHTML = '<p>Usa los filtros para encontrar profesionales.</p>';
}

function mostrarFormularioRecuperar() {
    mostrarSeccion('recuperarPassword');
}

function mostrarFormularioReset(token) {
    mostrarSeccion('resetPassword');
    document.getElementById('resetTokenInput').value = token;
}

function mostrarMensajeria() {
    if (!token) {
        return mostrarLogin();
    }
    mostrarSeccion('mensajeria');
    cargarConversaciones();
    document.getElementById('chatInputArea').style.display = 'none';
    document.getElementById('chatWindow').innerHTML = `
        <div class="chat-placeholder">
            <i class="fas fa-comments"></i>
            <p>Selecciona una conversación para ver los mensajes.</p>
        </div>`;
}

async function resendVerification(correo) {
    try {
        const response = await fetch(`${API_URL}/resend-verification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ correo })
        });
        const data = await response.json();
        mostrarMensajeGlobal(data.message, 'success');
    } catch (error) {
        mostrarMensajeGlobal('No se pudo reenviar el correo. Inténtalo de nuevo.', 'error');
    }
}

// =================================================================
// # --- MANEJO DE EVENTOS (EVENT LISTENERS) ---
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
            const response = await fetch(`${API_URL}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    nombre,
                    correo,
                    password,
                    rol
                })
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

// app.js

if (document.getElementById('formLogin')) {
    document.getElementById('formLogin').addEventListener('submit', async (e) => {
        e.preventDefault();
        const correo = document.getElementById('correoLogin').value;
        const password = document.getElementById('passwordLogin').value;
        const errorLogin = document.getElementById('errorLogin');
        errorLogin.textContent = '';

        try {
            const response = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ correo, password })
            });
            const data = await response.json();

            if (data.requiereVerificacion) { // <-- ¡NUEVA LÓGICA!
                errorLogin.innerHTML = `${data.error} <a href="#" onclick="resendVerification('${correo}')">Reenviar correo</a>`;
                return;
            }

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

                iniciarConexionWebSocket();
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
            educacion: Array.from(document.querySelectorAll('#educacionContainer .campo-dinamico')).map(div => ({
                titulo: div.querySelector('.campo-titulo').value,
                institucion: div.querySelector('.campo-institucion').value,
                periodo: div.querySelector('.campo-periodo').value
            })),
            certificaciones: Array.from(document.querySelectorAll('#certificacionContainer .campo-dinamico')).map(div => ({
                nombre: div.querySelector('.campo-nombre-cert').value,
                institucion: div.querySelector('.campo-institucion-cert').value,
                periodo: div.querySelector('.campo-periodo-cert').value
            }))
        };

        const errorEditarPerfil = document.getElementById('errorEditarPerfil');
        errorEditarPerfil.textContent = '';

        try {
            const res = await fetch(`${API_URL}/perfil`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
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
...(truncated 71340 characters)...keyword);
    }

    try {
        const response = await fetchProtegido(`${API_URL}/institucion/buscar-profesionales?${params.toString()}`, {
            cache: 'no-store'
        });
        const perfiles = await response.json();
        resultadosDiv.innerHTML = '';

        if (perfiles.length === 0) {
            resultadosDiv.innerHTML = '<p>No se encontraron perfiles con esos criterios.</p>';
        } else {
            perfiles.forEach(perfil => {
                const perfilDiv = document.createElement('div');
                perfilDiv.className = 'vacante';
                const imagenSrc = perfil.fotoPath ? `${API_URL}/${perfil.fotoPath}` : 'uploads/default-avatar.png';
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

async function verPerfilCompletoProfesional(profesionalId) {
    mostrarSeccion('perfilPostulante');
    const perfilContainer = document.getElementById('infoPostulante');
    perfilContainer.innerHTML = '<p>Cargando perfil del candidato...</p>';
    try {
        const res = await fetchProtegido(`${API_URL}/profesionales/${profesionalId}`);
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || 'No se pudo cargar el perfil.');
        }
        const perfil = await res.json();
        const imagenSrc = perfil.fotoPath ? `${API_URL}/${perfil.fotoPath}` : 'uploads/default-avatar.png';

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
                ${perfil.cvPath ? `<p><a href="${API_URL}/${perfil.cvPath}" target="_blank" class="button">Descargar CV</a></p>` : ''}
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
            perfil.habilidades.forEach(h => {
                perfilHTML += `<span class="keyword-tag">${h}</span>`;
            });
            perfilHTML += `</div></div>`;
        }
        perfilContainer.innerHTML = perfilHTML;
    } catch (err) {
        console.error('Error al ver perfil del profesional:', err);
        perfilContainer.innerHTML = `<p class="error">Error: ${err.message}</p>`;
    }
}

// =================================================================
// # --- DRAG AND DROP (PIPELINE) ---
// =================================================================

function activarDragAndDrop() {
    const tarjetas = document.querySelectorAll('.candidate-card');
    const columnas = document.querySelectorAll('.pipeline-column .candidate-cards');
    let tarjetaArrastrada = null;

    tarjetas.forEach(tarjeta => {
        tarjeta.addEventListener('dragstart', () => {
            tarjetaArrastrada = tarjeta;
            setTimeout(() => tarjeta.classList.add('dragging'), 0);
        });

        tarjeta.addEventListener('dragend', () => {
            tarjeta.classList.remove('dragging');
            tarjetaArrastrada = null;
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

                if (nuevoEstado === estadoActual) {
                    return;
                }

                columna.appendChild(tarjetaArrastrada);
                tarjetaArrastrada.dataset.estado = nuevoEstado;
                cambiarEstadoPostulacion(id, nuevoEstado);
            }
        });
    });
}

// =================================================================
// # --- NOTIFICACIONES ---
// =================================================================

async function cargarNotificaciones() {
    const listaNotificaciones = document.getElementById('listaNotificaciones');
    const marcarTodasBtn = document.getElementById('marcarTodasLeidasBtn');
    if (!listaNotificaciones || !marcarTodasBtn) {
        return;
    }
    listaNotificaciones.innerHTML = 'Cargando notificaciones...';
    marcarTodasBtn.style.display = 'none';

    try {
        const response = await fetchProtegido(`${API_URL}/notificaciones`);
        const notificaciones = await response.json();
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
            let iconClass = 'fa-bell';
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
    if (!elemento.classList.contains('leida')) {
        await marcarNotificacionComoLeida(notificacionId, elemento);
    }
    if (!url) {
        return;
    }

    if (url.startsWith('pipeline/')) {
        const parts = url.split('/');
        const vacanteId = parseInt(parts[1]);
        const tituloVacante = decodeURIComponent(parts[2]);
        if (!isNaN(vacanteId) && tituloVacante) {
            mostrarPipelinePorVacante(vacanteId, tituloVacante);
        }
    } else if (url.startsWith('postulacion/')) {
        const parts = url.split('/');
        const postulacionId = parseInt(parts[1]);
        if (!isNaN(postulacionId)) {
            mostrarProfesionales(postulacionId);
        }
    } else if (url.startsWith('vacante/')) {
        const parts = url.split('/');
        const vacanteId = parseInt(parts[1]);
        if (!isNaN(vacanteId)) {
            mostrarVacanteDetalles(vacanteId);
        }
    }
}

async function marcarNotificacionComoLeida(notificacionId, elemento) {
    if (elemento.classList.contains('leida')) {
        return;
    }
    elemento.classList.add('leida');
    try {
        await fetchProtegido(`${API_URL}/notificaciones/${notificacionId}/leida`, {
            method: 'PUT'
        });
        const notifCountSpan = document.getElementById('notification-count');
        let count = parseInt(notifCountSpan.textContent) - 1;

        if (count > 0) {
            notifCountSpan.textContent = count;
        } else {
            notifCountSpan.style.display = 'none';
        }
    } catch (error) {
        console.error('Error al marcar notificación como leída:', error);
        elemento.classList.remove('leida');
    }
}

async function marcarTodasComoLeidas() {
    try {
        const response = await fetchProtegido(`${API_URL}/notificaciones/marcar-todas-leidas`, {
            method: 'PUT'
        });
        if (!response.ok) {
            throw new Error('El servidor no pudo completar la acción.');
        }

        document.querySelectorAll('#listaNotificaciones .notificacion').forEach(elem => {
            elem.classList.add('leida');
        });
        document.querySelectorAll('.unread-dot').forEach(dot => dot.style.display = 'none');
        document.getElementById('marcarTodasLeidasBtn').style.display = 'none';

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

// =================================================================
// # --- MENSAJERÍA Y WEBSOCKETS ---
// =================================================================

async function cargarConversaciones() {
    const listaConversaciones = document.getElementById('listaConversaciones');
    listaConversaciones.innerHTML = '<p style="padding: 15px;">Cargando...</p>';
    try {
        const response = await fetchProtegido(`${API_URL}/conversaciones`);
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
        await fetchProtegido(`${API_URL}/conversaciones/${conversacionId}/leido`, {
            method: 'PUT'
        });
        actualizarContadorMensajes();

        const response = await fetchProtegido(`${API_URL}/conversaciones/${conversacionId}/mensajes`);
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
    if (!mensaje || !conversacionActivaId) {
        return;
    }
    try {
        const response = await fetch(`${API_URL}/mensajes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                conversacion_id: conversacionActivaId,
                mensaje
            })
        });
        const data = await response.json();
        if (data.error) {
            mostrarMensajeGlobal(data.error, 'error');
        } else {
            input.value = '';
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

async function actualizarContadorMensajes() {
    if (!token) {
        return;
    }
    const mensajesCountSpan = document.getElementById('mensajes-count');
    if (!mensajesCountSpan) {
        return;
    }
    try {
        const response = await fetchProtegido(`${API_URL}/mensajes/no-leidos`);
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

function iniciarConexionWebSocket() {
    if (!token) {
        return;
    }
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        socket.close();
    }
    socket = new WebSocket(`${WS_URL}?token=${token}`);

    socket.onopen = () => {
        console.log('Conexión WebSocket establecida.');
        actualizarContadorMensajes();
    };

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
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