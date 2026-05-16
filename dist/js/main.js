function toggleMobileMenu() {
    const nav = document.querySelector('.nav-links');
    if (nav.style.display === 'flex') {
        nav.style.display = '';
    } else {
        nav.style.display = 'flex';
        nav.style.flexDirection = 'column';
        nav.style.position = 'absolute';
        nav.style.top = '64px';
        nav.style.left = '0';
        nav.style.right = '0';
        nav.style.background = 'white';
        nav.style.padding = '16px';
        nav.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,.1)';
        nav.style.borderBottom = '1px solid var(--border)';
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const cards = document.querySelectorAll('.courseware-card, .feature-card, .hero-card');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, { threshold: 0.1 });

    cards.forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = 'opacity .6s ease, transform .6s ease';
        observer.observe(card);
    });
});
