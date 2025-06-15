// Function to adapt the navbar based on user role
function adaptNavbarForRole(role) {
    const adminLinks = document.querySelectorAll('.nav-admin');
    const commonLinks = document.querySelectorAll('.nav-common');
    const logoutButton = document.getElementById('logout-button');

    // Select the main container for links (still useful for general reference)
    const navbarLinksContainer = document.getElementById('navbar-links');

    // Hide all links by default and manage their display based on role
    adminLinks.forEach(link => link.classList.add('hidden'));
    commonLinks.forEach(link => link.classList.add('hidden'));

    // Always show logout button for any logged-in user
    if (logoutButton) {
        logoutButton.classList.remove('hidden');
    }

    // Show links based on role
    if (role === 'admin') {
        adminLinks.forEach(link => link.classList.remove('hidden'));
        commonLinks.forEach(link => link.classList.remove('hidden'));
        console.log('Navbar adapted for Admin role.');
    } else if (role === 'user') {
        commonLinks.forEach(link => link.classList.remove('hidden'));
        console.log('Navbar adapted for User role.');
    } else {
        console.log('Navbar adapted for Guest/Unknown role.');
        if (logoutButton) logoutButton.classList.add('hidden');
    }
}

// Function to adjust body padding to prevent content from being hidden behind the fixed navbar
function adjustBodyPadding() {
    const navbar = document.querySelector('#navbar-container nav');
    if (navbar) {
        const navbarHeight = navbar.offsetHeight;
        document.body.style.paddingTop = `${navbarHeight}px`;
        console.log(`Navbar height: ${navbarHeight}px. Body padding adjusted.`);
    } else {
        console.warn('Navbar element (<nav> inside #navbar-container) not found for padding adjustment.');
    }
}
// ... rest of your code ...
window.addEventListener('resize', () => {
    adjustBodyPadding();
});

// Logout button logic (no changes here)
document.addEventListener('DOMContentLoaded', () => {
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                const response = await fetch('/api/logout', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                if (response.ok) {
                    window.location.href = '/login';
                } else {
                    alert('Error al cerrar sesión. Inténtalo de nuevo.');
                    console.error('Error al cerrar sesión:', response.statusText);
                }
            } catch (error) {
                console.error('Error de red al cerrar sesión:', error);
                alert('Hubo un problema de conexión al intentar cerrar sesión.');
            }
        });
    }
});

// We keep the resize listener here for responsiveness, especially for the body padding
window.addEventListener('resize', () => {
    adjustBodyPadding(); // Still adjust padding on resize in case navbar height changes dynamically
});