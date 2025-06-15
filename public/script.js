document.addEventListener('DOMContentLoaded', () => {
    console.log("script.js cargado. Verificando estado de autenticación y rol del usuario.");

    // Función para actualizar la navegación según el rol
    async function updateNavigation() {
        try {
            const response = await fetch('/api/user-role');
            if (!response.ok) {
                // Si la sesión no es válida o no hay rol, asume no autenticado
                console.warn('No se pudo obtener el rol del usuario o sesión no válida. Asumiendo no autenticado.');
                renderNavigation('guest'); // Renderizar menú para invitado/no logueado
                return;
            }
            const data = await response.json();
            const userRole = data.userRole;
            console.log(`Rol del usuario obtenido: ${userRole}`);
            renderNavigation(userRole); // Renderizar menú según el rol

        } catch (error) {
            console.error('Error al obtener el rol del usuario:', error);
            renderNavigation('guest'); // En caso de error, muestra menú de invitado
        }
    }

    // Función para renderizar el menú de navegación
    function renderNavigation(role) {
        const navbarPlaceholder = document.getElementById('navbar-placeholder');
        if (!navbarPlaceholder) {
            console.error('Elemento #navbar-placeholder no encontrado en el DOM.');
            return;
        }

        let navContent = `
            <nav class="navbar">
                <a href="/preguntas">Inicio</a>
                ${role === 'admin' || role === 'super-user' ? '<a href="/nuevaPregunta">Gestión de Preguntas</a>' : ''}
                ${role === 'admin' || role === 'super-user' ? '<a href="/charts">Análisis</a>' : ''}
                <a href="/mapa">Mapa</a>
                ${role !== 'guest' ? '<button id="logoutButton">Cerrar Sesión</button>' : ''}
            </nav>
        `;
        navbarPlaceholder.innerHTML = navContent;

        // Añadir evento al botón de cerrar sesión si existe
        const logoutButton = document.getElementById('logoutButton');
        if (logoutButton) {
            logoutButton.addEventListener('click', handleLogout);
        }
    }

    // Función para manejar el cierre de sesión
    async function handleLogout() {
        try {
            const response = await fetch('/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            const data = await response.json();
            if (response.ok) {
                console.log(data.message);
                window.location.href = data.redirectURL; // Redirigir a la página de login
            } else {
                console.error('Error al cerrar sesión:', data.message);
                alert('No se pudo cerrar sesión. Inténtalo de nuevo.');
            }
        } catch (error) {
            console.error('Error de red al cerrar sesión:', error);
            alert('Error de conexión al intentar cerrar sesión.');
        }
    }

    // Cargar la navegación al inicio
    updateNavigation();

    // Puedes añadir aquí lógica que sea común a todas las páginas,
    // como manejo de mensajes de alerta, popups, etc.
});