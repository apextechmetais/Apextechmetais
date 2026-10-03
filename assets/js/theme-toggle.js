// Immediately set theme to prevent flash of wrong theme
(function() {
    const currentTheme = localStorage.getItem('apex_theme') || 'dark';
    if (currentTheme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
    }
})();

document.addEventListener('DOMContentLoaded', () => {
    const currentTheme = localStorage.getItem('apex_theme') || 'dark';

    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'global-theme-toggle';
    toggleBtn.title = 'Alternar Tema Claro/Escuro';
    toggleBtn.innerHTML = currentTheme === 'light' ? '<i class="fa-solid fa-moon"></i>' : '<i class="fa-solid fa-sun"></i>';
    
    // Style the button
    Object.assign(toggleBtn.style, {
        position: 'fixed',
        bottom: '20px',
        left: '20px',
        zIndex: '9999',
        width: '45px',
        height: '45px',
        borderRadius: '50%',
        backgroundColor: 'var(--cor-verde)',
        color: '#fff',
        border: 'none',
        cursor: 'pointer',
        boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '20px',
        transition: 'transform 0.2s, background-color 0.2s'
    });

    toggleBtn.addEventListener('mouseenter', () => toggleBtn.style.transform = 'scale(1.1)');
    toggleBtn.addEventListener('mouseleave', () => toggleBtn.style.transform = 'scale(1)');

    toggleBtn.addEventListener('click', () => {
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        const newTheme = isLight ? 'dark' : 'light';
        
        if (newTheme === 'light') {
            document.documentElement.setAttribute('data-theme', 'light');
            toggleBtn.innerHTML = '<i class="fa-solid fa-moon"></i>';
            localStorage.setItem('apex_theme', 'light');
        } else {
            document.documentElement.removeAttribute('data-theme');
            toggleBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
            localStorage.setItem('apex_theme', 'dark');
        }
    });

    document.body.appendChild(toggleBtn);
});
