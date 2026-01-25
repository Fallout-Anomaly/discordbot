/* jshint esversion: 11, browser: true, node: false */
(function() {
'use strict';

function getBasePath() {
    const hostname = window.location.hostname;
    const pathname = window.location.pathname; 

    if (hostname.endsWith('github.io')) {

        const pathSegments = pathname.split('/').filter(Boolean); 

        if (pathSegments.length > 0) {
            const potentialRepoName = pathSegments[0];

            return `/${potentialRepoName}/`; 
        } else {

             return '/';
        }
    } else {

        return '/';
    }
}

function loadNavLinks(basePath) { 
    const navLinksContainer = document.getElementById('nav-links-container');
    if (!navLinksContainer) return;

    const navLinks = document.createElement('ul');
    navLinks.className = 'nav-links';
    navLinks.setAttribute('role', 'navigation');
    navLinks.setAttribute('aria-label', 'Main navigation');

    const links = [
        { href: 'index.html', text: 'HOME' },
        { href: 'pages/about.html', text: 'ABOUT' },
        { href: 'pages/guide.html', text: 'GUIDE' },
        { href: 'pages/staff.html', text: 'STAFF' },
        { href: 'pages/apply.html', text: 'APPLY' },
        { href: 'pages/donate.html', text: 'DONATE' }
    ];

    links.forEach(link => {
        const li = document.createElement('li');
        const a = document.createElement('a');

        a.href = basePath + link.href;
        a.textContent = link.text;
        a.className = 'nav-link';
        a.setAttribute('role', 'menuitem');

        const fullLinkPath = new URL(a.href, window.location.origin).pathname;
        const currentPath = window.location.pathname;

        const isCurrentIndex = currentPath === basePath || currentPath === basePath + 'index.html';
        const isLinkIndex = fullLinkPath === basePath || fullLinkPath === basePath + 'index.html';

        if ((isCurrentIndex && isLinkIndex) || (!isCurrentIndex && !isLinkIndex && currentPath === fullLinkPath)) {
             a.classList.add('active');
             a.setAttribute('aria-current', 'page');
        }

        li.appendChild(a);
        navLinks.appendChild(li);
    });

    navLinksContainer.appendChild(navLinks);
}

function fixLogoLink(basePath) {
    const logoLink = document.querySelector('.nav-logo');
    if (logoLink) {

        logoLink.href = basePath + 'index.html';
    }
}

function initializeFxToggle() {
    const fxToggle = document.createElement('div');
    fxToggle.className = 'nav-fx-toggle';
    const toggleButton = document.createElement('button');
    toggleButton.className = 'fx-toggle-button';
    toggleButton.innerHTML = '<i class="fas fa-eye"></i> Disable Effects';
    toggleButton.title = 'Toggle Visual Effects';
    fxToggle.appendChild(toggleButton);
    if (!document.querySelector('.nav-fx-toggle')) {
      document.body.appendChild(fxToggle);
    }

    const fxDisabled = localStorage.getItem('fxDisabled') === 'true';
    if (fxDisabled) {
        document.body.classList.add('no-fx');
        toggleButton.innerHTML = '<i class="fas fa-eye"></i> Enable Effects';
    } else {
        toggleButton.innerHTML = '<i class="fas fa-eye-slash"></i> Disable Effects';
    }

    toggleButton.addEventListener('click', () => {
        const isDisabled = document.body.classList.toggle('no-fx');
        localStorage.setItem('fxDisabled', isDisabled);
        toggleButton.innerHTML = isDisabled ?
            '<i class="fas fa-eye"></i> Enable Effects' :
            '<i class="fas fa-eye-slash"></i> Disable Effects';

        if (!isDisabled) {
             document.body.style.animation = 'none';
             void document.body.offsetWidth; 
             document.body.style.animation = '';
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const basePath = getBasePath();
    fixLogoLink(basePath);
    loadNavLinks(basePath);

    // Only initialize FX toggle if not on the guide page
    if (!document.querySelector('.fx-toggle-button') && !(window.location.pathname.includes('/guide.html') || window.location.pathname.includes('/pages/guide.html'))) { 
        initializeFxToggle();
    }
});
})();