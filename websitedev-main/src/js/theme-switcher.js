/* jshint esversion: 11, browser: true, node: false */
/* global console */
(function() {
'use strict';

class ThemeSwitcher {
    constructor() {
        this.themes = null;
        this.currentTheme = 'fallout3'; // Default theme
        this.container = null;
        this.isInitialized = false;
        this.storageKey = 'fallout-anomaly-theme';
        this.sessionKey = 'fallout-anomaly-theme-session';
        this.initializationAttempts = 0;
        this.maxInitializationAttempts = 3;
    }

    async init() {
        // Skip initialization on guide pages
        if (window.location.pathname.includes('/guide.html') || window.location.pathname.includes('/pages/guide.html')) {
            return;
        }

        this.initializationAttempts++;

        // Show loading state
        this.showLoadingState();

        try {
            // Load themes first
            this.updateLoadingMessage('Loading themes...');
            await this.loadThemes();

            // Load saved theme preference
            this.updateLoadingMessage('Loading preferences...');
            this.loadSavedTheme();

            // Set session theme if different from saved
            this.initializeSession();

            // Create UI component
            this.updateLoadingMessage('Creating interface...');
            await this.createComponent();

            // Setup event listeners
            this.updateLoadingMessage('Setting up controls...');
            this.setupEventListeners();

            // Apply the current theme
            this.updateLoadingMessage('Applying theme...');
            this.applyTheme(this.currentTheme);

            // Mark as initialized
            this.isInitialized = true;

            // Hide loading state and show success
            this.hideLoadingState();
            this.showInitializationSuccess();

            console.log(`Theme Switcher initialized successfully (attempt ${this.initializationAttempts})`);
            console.log(`Current theme: ${this.themes[this.currentTheme].name}`);

        } catch (error) {
            console.error(`Failed to initialize Theme Switcher (attempt ${this.initializationAttempts}):`, error);

            if (this.initializationAttempts < this.maxInitializationAttempts) {
                this.updateLoadingMessage(`Retrying... (${this.initializationAttempts}/${this.maxInitializationAttempts})`);
                setTimeout(() => this.init(), 1000);
            } else {
                console.error('Max initialization attempts reached, falling back to default');
                this.hideLoadingState();
                this.showInitializationError();
                this.fallbackToDefault();
            }
        }
    }

    showLoadingState() {
        // Create temporary loading indicator
        this.loadingIndicator = document.createElement('div');
        this.loadingIndicator.className = 'theme-switcher-loading';
        this.loadingIndicator.innerHTML = `
            <div class="loading-content">
                <i class="fas fa-spinner fa-spin icon"></i>
                <span class="loading-message">Initializing themes...</span>
            </div>
        `;

        // Add to nav container if it exists
        const navContainer = document.querySelector('.nav-fx-toggle') || document.body;
        navContainer.appendChild(this.loadingIndicator);
    }

    updateLoadingMessage(message) {
        if (this.loadingIndicator) {
            const messageElement = this.loadingIndicator.querySelector('.loading-message');
            if (messageElement) {
                messageElement.textContent = message;
            }
        }
    }

    hideLoadingState() {
        if (this.loadingIndicator) {
            this.loadingIndicator.remove();
            this.loadingIndicator = null;
        }
    }

    showInitializationSuccess() {
        // Brief success indicator
        const successIndicator = document.createElement('div');
        successIndicator.className = 'theme-switcher-success';
        successIndicator.innerHTML = '<i class="fas fa-check icon"></i>';

        if (this.container) {
            this.container.appendChild(successIndicator);
            setTimeout(() => {
                successIndicator.remove();
            }, 1000);
        }
    }

    showInitializationError() {
        // Show error state
        const errorIndicator = document.createElement('div');
        errorIndicator.className = 'theme-switcher-error';
        errorIndicator.innerHTML = `
            <i class="fas fa-exclamation-triangle icon"></i>
            <span>Theme system unavailable</span>
        `;

        const navContainer = document.querySelector('.nav-fx-toggle') || document.body;
        navContainer.appendChild(errorIndicator);

        // Auto-hide after 5 seconds
        setTimeout(() => {
            errorIndicator.remove();
        }, 5000);
    }

    initializeSession() {
        try {
            // Store the current theme for this session
            sessionStorage.setItem(this.sessionKey, this.currentTheme);

            // Check if we need to restore from session (e.g., page refresh)
            const sessionTheme = sessionStorage.getItem(this.sessionKey);
            if (sessionTheme && this.themes && this.themes[sessionTheme]) {
                // Session theme takes precedence over saved theme for this session
                if (sessionTheme !== this.currentTheme) {
                    console.log(`Restoring session theme: ${this.themes[sessionTheme].name}`);
                    this.currentTheme = sessionTheme;
                }
            }
        } catch (error) {
            console.warn('Session storage not available:', error);
        }
    }

    async loadThemes() {
        try {
            const path = window.location.pathname;
            const isPagesDir = path.includes('/pages/');
            const themesPath = isPagesDir ? '../src/data/themes.json' : 'src/data/themes.json';

            const response = await fetch(themesPath);
            if (!response.ok) {
                throw new Error(`Failed to load themes: ${response.status} ${response.statusText}`);
            }

            this.themes = await response.json();
            this.validateThemes();
        } catch (error) {
            console.error('Error loading themes:', error);
            throw error;
        }
    }

    validateThemes() {
        if (!this.themes || typeof this.themes !== 'object') {
            throw new Error('Invalid themes data structure');
        }

        const requiredProperties = ['id', 'name', 'icon', 'colors', 'fonts'];
        const requiredColors = ['primary', 'secondary', 'background', 'border'];
        const requiredFonts = ['terminal', 'body', 'title'];

        let validThemeCount = 0;
        const validationErrors = [];

        for (const [themeId, theme] of Object.entries(this.themes)) {
            const themeErrors = [];

            // Validate theme ID matches key
            if (theme.id !== themeId) {
                themeErrors.push(`Theme ID mismatch: key '${themeId}' vs id '${theme.id}'`);
            }

            // Check required top-level properties
            for (const prop of requiredProperties) {
                if (!theme[prop]) {
                    themeErrors.push(`Missing required property: ${prop}`);
                } else if (typeof theme[prop] !== 'string' && prop !== 'colors' && prop !== 'fonts') {
                    themeErrors.push(`Property '${prop}' must be a string`);
                }
            }

            // Validate colors object
            if (theme.colors && typeof theme.colors === 'object') {
                for (const colorProp of requiredColors) {
                    if (!theme.colors[colorProp]) {
                        themeErrors.push(`Missing required color: ${colorProp}`);
                    } else if (!this.isValidColor(theme.colors[colorProp])) {
                        themeErrors.push(`Invalid color format for '${colorProp}': ${theme.colors[colorProp]}`);
                    }
                }
            } else {
                themeErrors.push('Colors object is missing or invalid');
            }

            // Validate fonts object
            if (theme.fonts && typeof theme.fonts === 'object') {
                for (const fontProp of requiredFonts) {
                    if (!theme.fonts[fontProp]) {
                        themeErrors.push(`Missing required font: ${fontProp}`);
                    }
                }
            } else {
                themeErrors.push('Fonts object is missing or invalid');
            }

            // Validate icon format
            if (theme.icon && !theme.icon.includes('fa-')) {
                themeErrors.push(`Icon should be a FontAwesome class: ${theme.icon}`);
            }

            // Log theme-specific errors
            if (themeErrors.length > 0) {
                console.warn(`Theme '${themeId}' validation errors:`, themeErrors);
                validationErrors.push({ themeId, errors: themeErrors });
            } else {
                validThemeCount++;
            }
        }

        // Ensure we have at least one valid theme
        if (validThemeCount === 0) {
            throw new Error('No valid themes found');
        }

        // Ensure default theme exists and is valid
        if (!this.themes.fallout4 || validationErrors.some(e => e.themeId === 'fallout4')) {
            console.warn('Default theme (fallout4) is invalid, attempting to use first valid theme');
            const firstValidTheme = Object.keys(this.themes).find(id =>
                !validationErrors.some(e => e.themeId === id)
            );
            if (firstValidTheme) {
                console.log(`Using '${firstValidTheme}' as fallback default theme`);
                // We'll handle this in the calling code
            }
        }

        console.log(`Theme validation complete: ${validThemeCount} valid themes, ${validationErrors.length} with errors`);
        return { validCount: validThemeCount, errors: validationErrors };
    }

    isValidColor(color) {
        if (!color || typeof color !== 'string') return false;

        // Check for hex colors
        if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color)) return true;

        // Check for rgb/rgba colors
        if (/^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*[\d.]+)?\s*\)$/.test(color)) return true;

        // Check for named colors (basic validation)
        const namedColors = ['red', 'green', 'blue', 'white', 'black', 'yellow', 'orange', 'purple', 'pink', 'brown', 'gray', 'grey'];
        if (namedColors.includes(color.toLowerCase())) return true;

        return false;
    }

    sanitizeTheme(theme) {
        // Create a sanitized copy of the theme with fallback values
        const sanitized = {
            id: theme.id || 'unknown',
            name: theme.name || 'Unknown Theme',
            icon: theme.icon || 'fas fa-palette',
            colors: {
                primary: this.isValidColor(theme.colors?.primary) ? theme.colors.primary : '#00BFFF',
                secondary: this.isValidColor(theme.colors?.secondary) ? theme.colors.secondary : '#0099CC',
                background: this.isValidColor(theme.colors?.background) ? theme.colors.background : '#0a0f1a',
                border: this.isValidColor(theme.colors?.border) ? theme.colors.border : '#0099CC',
                ...theme.colors // Include other color properties
            },
            fonts: {
                terminal: theme.fonts?.terminal || "'VT323', monospace",
                body: theme.fonts?.body || "'Inconsolata', monospace",
                title: theme.fonts?.title || "'Courier Prime', 'Courier New', monospace",
                ...theme.fonts // Include other font properties
            },
            effects: theme.effects || {
                scanlines: true,
                glow: true,
                flicker: false,
                crtIntensity: 0.8
            }
        };

        return sanitized;
    }

    applyTheme(themeId) {
        try {
            // Validate theme exists
            if (!this.themes || !this.themes[themeId]) {
                console.warn(`Theme ${themeId} not found`);
                return this.handleThemeError(themeId, new Error('Theme not found'));
            }

            let theme = this.themes[themeId];

            // Sanitize theme data to ensure all required properties exist
            theme = this.sanitizeTheme(theme);

            const root = document.documentElement;

            // Apply color variables with error handling
            try {
                if (theme.colors) {
                    const colorMappings = {
                        '--terminal-text': theme.colors.primary,
                        '--terminal-text-muted': theme.colors.muted || theme.colors.secondary,
                        '--terminal-highlight': theme.colors.highlight || theme.colors.primary,
                        '--terminal-hover': theme.colors.hover || theme.colors.highlight || theme.colors.primary,
                        '--terminal-bg': theme.colors.background,
                        '--terminal-border': theme.colors.border,
                        '--terminal-shadow-color': theme.colors.shadow || `rgba(${this.hexToRgb(theme.colors.primary)}, 0.2)`,
                        '--terminal-glow': theme.colors.glow || `0 0 3px rgba(${this.hexToRgb(theme.colors.primary)}, 0.6)`
                    };

                    for (const [property, value] of Object.entries(colorMappings)) {
                        if (value) {
                            root.style.setProperty(property, value);
                        }
                    }

                    // Update RGB values for rgba() usage
                    root.style.setProperty('--terminal-text-rgb', this.hexToRgb(theme.colors.primary));
                    root.style.setProperty('--terminal-bg-rgb', this.hexToRgb(theme.colors.background));
                    root.style.setProperty('--card-bg-rgb', this.hexToRgb(theme.colors.cardBg || theme.colors.background));
                    root.style.setProperty('--card-border-rgb', this.hexToRgb(theme.colors.border));

                    // Background gradient colors
                    if (theme.colors.backgroundGlowCenter) {
                        root.style.setProperty('--background-glow-center-rgb', theme.colors.backgroundGlowCenter);
                        root.style.setProperty('--background-glow-mid-rgb', theme.colors.backgroundGlowMid || theme.colors.backgroundGlowCenter);
                        root.style.setProperty('--background-edge-rgb', theme.colors.backgroundEdge || '20, 20, 20');
                    }
                }
            } catch (colorError) {
                console.error('Error applying theme colors:', colorError);
                throw colorError;
            }

            // Apply font variables with error handling
            try {
                if (theme.fonts) {
                    root.style.setProperty('--font-terminal', theme.fonts.terminal);
                    root.style.setProperty('--font-body', theme.fonts.body);
                    root.style.setProperty('--font-title', theme.fonts.title);
                }
            } catch (fontError) {
                console.warn('Error applying theme fonts:', fontError);
                // Fonts are less critical, continue without throwing
            }

            // Update current theme and UI
            this.currentTheme = themeId;
            this.updateUI();

            console.log(`Successfully applied theme: ${theme.name}`);
            return true;

        } catch (error) {
            console.error(`Critical error applying theme ${themeId}:`, error);
            return this.handleThemeError(themeId, error);
        }
    }

    hexToRgb(hex) {
        // Remove # if present
        hex = hex.replace('#', '');

        // Parse hex values
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);

        return `${r}, ${g}, ${b}`;
    }

    saveTheme(themeId) {
        try {
            // Validate theme exists before saving
            if (!this.themes || !this.themes[themeId]) {
                console.warn(`Cannot save invalid theme: ${themeId}`);
                return false;
            }

            localStorage.setItem(this.storageKey, themeId);
            console.log(`Theme preference saved: ${this.themes[themeId].name}`);
            return true;
        } catch (error) {
            console.warn('Failed to save theme preference:', error);

            // Check if storage is full
            if (error.name === 'QuotaExceededError') {
                console.warn('Local storage quota exceeded. Theme preference not saved.');
                // Could implement fallback storage or cleanup here
            }

            return false;
        }
    }

    loadSavedTheme() {
        try {
            const savedTheme = localStorage.getItem(this.storageKey);
            if (savedTheme) {
                // Validate that the saved theme exists
                if (this.themes && this.themes[savedTheme]) {
                    this.currentTheme = savedTheme;
                    console.log(`Loaded saved theme: ${this.themes[savedTheme].name}`);
                } else {
                    console.warn(`Saved theme '${savedTheme}' not found, using default`);
                    // Clear invalid saved theme
                    localStorage.removeItem(this.storageKey);
                }
            } else {
                console.log('No saved theme found, using default');
            }
        } catch (error) {
            console.warn('Failed to load saved theme:', error);
            // Clear potentially corrupted storage
            try {
                localStorage.removeItem(this.storageKey);
            } catch (clearError) {
                console.warn('Failed to clear corrupted theme storage:', clearError);
            }
        }
    }

    async createComponent() {
        try {
            const path = window.location.pathname;
            const isPagesDir = path.includes('/pages/');
            const componentPath = isPagesDir ? '../src/components/theme-switcher.html' : 'src/components/theme-switcher.html';

            const response = await fetch(componentPath);
            if (!response.ok) {
                throw new Error(`Failed to load theme switcher component: ${response.status}`);
            }

            const html = await response.text();
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            this.container = tempDiv.firstElementChild;

            // Update the component with current theme data
            this.updateComponentData();

        } catch (error) {
            console.error('Error creating theme switcher component:', error);
            // Fallback to creating basic component
            this.createFallbackComponent();
        }
    }

    createFallbackComponent() {
        this.container = document.createElement('div');
        this.container.className = 'theme-switcher-container';
        this.container.innerHTML = `
            <button class="theme-switcher-button" aria-haspopup="true" aria-expanded="false">
                <i class="fas fa-palette icon"></i>
                <span class="theme-name">Theme</span>
                <i class="fas fa-chevron-down dropdown-icon"></i>
            </button>
            <div class="theme-dropdown hidden">
                <div class="theme-option" data-theme="fallout4">
                    <i class="fas fa-cog theme-icon"></i>
                    <span class="theme-label">Fallout 4</span>
                </div>
            </div>
        `;
    }

    updateComponentData() {
        if (!this.container || !this.themes) return;

        const dropdown = this.container.querySelector('.theme-dropdown');
        if (!dropdown) return;

        // Clear existing options
        dropdown.innerHTML = '';

        // Create options for each theme
        Object.values(this.themes).forEach(theme => {
            const option = document.createElement('div');
            option.className = 'theme-option';
            option.setAttribute('data-theme', theme.id);
            option.setAttribute('role', 'menuitem');
            option.setAttribute('tabindex', '0');
            option.setAttribute('aria-label', `Switch to ${theme.name} theme`);

            if (theme.id === this.currentTheme) {
                option.classList.add('active');
                option.setAttribute('aria-label', `Switch to ${theme.name} theme (currently active)`);
            }

            option.innerHTML = `
                <i class="${theme.icon} theme-icon"></i>
                <span class="theme-label">${theme.name}</span>
                <div class="theme-preview" style="background-color: ${theme.colors.primary};"></div>
            `;

            dropdown.appendChild(option);
        });
    }

    setupEventListeners() {
        if (!this.container) return;

        const button = this.container.querySelector('.theme-switcher-button');
        const dropdown = this.container.querySelector('.theme-dropdown');

        if (!button || !dropdown) return;

        // Button click handler
        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggleDropdown();
        });

        // Keyboard navigation for button
        button.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.toggleDropdown();
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.openDropdown();
                this.focusFirstOption();
            }
        });

        // Theme option handlers
        const options = this.container.querySelectorAll('.theme-option');
        options.forEach((option, index) => {
            // Click handler
            option.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const themeId = option.getAttribute('data-theme');
                if (themeId) {
                    this.switchTheme(themeId);
                    this.closeDropdown();
                }
            });

            // Keyboard navigation for options
            option.addEventListener('keydown', (e) => {
                switch (e.key) {
                    case 'Enter':
                    case ' ':
                        e.preventDefault();
                        const themeId = option.getAttribute('data-theme');
                        if (themeId) {
                            this.switchTheme(themeId);
                            this.closeDropdown();
                            button.focus();
                        }
                        break;
                    case 'ArrowDown':
                        e.preventDefault();
                        this.focusNextOption(index);
                        break;
                    case 'ArrowUp':
                        e.preventDefault();
                        this.focusPreviousOption(index);
                        break;
                    case 'Escape':
                        e.preventDefault();
                        this.closeDropdown();
                        button.focus();
                        break;
                    case 'Tab':
                        if (!e.shiftKey && index === options.length - 1) {
                            this.closeDropdown();
                        } else if (e.shiftKey && index === 0) {
                            this.closeDropdown();
                        }
                        break;
                }
            });

            // Hover effects
            option.addEventListener('mouseenter', () => {
                this.clearOptionFocus();
                option.focus();
            });
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.container.contains(e.target)) {
                this.closeDropdown();
            }
        });

        // Close dropdown on escape key globally
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isDropdownOpen()) {
                this.closeDropdown();
                button.focus();
            }
        });
    }

    toggleDropdown() {
        if (this.isDropdownOpen()) {
            this.closeDropdown();
        } else {
            this.openDropdown();
        }
    }

    openDropdown() {
        const button = this.container.querySelector('.theme-switcher-button');
        const dropdown = this.container.querySelector('.theme-dropdown');

        if (!button || !dropdown) return;

        dropdown.classList.remove('hidden');
        button.setAttribute('aria-expanded', 'true');

        // Add visual feedback
        this.container.classList.add('dropdown-open');
    }

    closeDropdown() {
        const button = this.container.querySelector('.theme-switcher-button');
        const dropdown = this.container.querySelector('.theme-dropdown');

        if (!button || !dropdown) return;

        dropdown.classList.add('hidden');
        button.setAttribute('aria-expanded', 'false');

        // Remove visual feedback
        this.container.classList.remove('dropdown-open');

        // Clear any focused options
        this.clearOptionFocus();
    }

    isDropdownOpen() {
        const dropdown = this.container.querySelector('.theme-dropdown');
        return dropdown && !dropdown.classList.contains('hidden');
    }

    focusFirstOption() {
        const options = this.container.querySelectorAll('.theme-option');
        if (options.length > 0) {
            options[0].focus();
        }
    }

    focusNextOption(currentIndex) {
        const options = this.container.querySelectorAll('.theme-option');
        const nextIndex = (currentIndex + 1) % options.length;
        options[nextIndex].focus();
    }

    focusPreviousOption(currentIndex) {
        const options = this.container.querySelectorAll('.theme-option');
        const prevIndex = currentIndex === 0 ? options.length - 1 : currentIndex - 1;
        options[prevIndex].focus();
    }

    clearOptionFocus() {
        const options = this.container.querySelectorAll('.theme-option');
        options.forEach(option => option.blur());
    }

    updateUI() {
        if (!this.container || !this.themes || !this.themes[this.currentTheme]) return;

        const theme = this.themes[this.currentTheme];

        // Update button text
        const themeName = this.container.querySelector('.theme-name');
        if (themeName) {
            themeName.textContent = theme.name;
        }

        // Update active option
        const options = this.container.querySelectorAll('.theme-option');
        options.forEach(option => {
            const themeId = option.getAttribute('data-theme');
            if (themeId === this.currentTheme) {
                option.classList.add('active');
                option.setAttribute('aria-label', `Switch to ${theme.name} theme (currently active)`);
            } else {
                option.classList.remove('active');
                const optionTheme = this.themes[themeId];
                if (optionTheme) {
                    option.setAttribute('aria-label', `Switch to ${optionTheme.name} theme`);
                }
            }
        });
    }

    fallbackToDefault() {
        console.warn('Falling back to emergency default theme');

        // Create emergency fallback theme
        const emergencyTheme = {
            id: 'emergency',
            name: 'Emergency Fallback',
            icon: 'fas fa-exclamation-triangle',
            colors: {
                primary: '#00BFFF',
                secondary: '#0099CC',
                muted: '#007ACC',
                highlight: '#1E90FF',
                hover: '#4169E1',
                background: '#0a0f1a',
                cardBg: '#1a1f2a',
                border: '#0099CC',
                shadow: 'rgba(0, 191, 255, 0.2)',
                glow: '0 0 3px rgba(0, 191, 255, 0.6), 0 0 8px rgba(0, 191, 255, 0.4), 0 0 15px rgba(0, 191, 255, 0.2)'
            },
            fonts: {
                terminal: "'VT323', monospace",
                body: "'Inconsolata', monospace",
                title: "'Courier Prime', 'Courier New', monospace"
            }
        };

        // Apply emergency theme
        this.currentTheme = 'emergency';
        this.themes = { emergency: emergencyTheme };

        try {
            this.applyTheme('emergency');
            console.log('Emergency fallback theme applied successfully');
        } catch (error) {
            console.error('Failed to apply emergency theme:', error);
            // Last resort: apply basic CSS directly
            this.applyEmergencyStyles();
        }
    }

    applyEmergencyStyles() {
        console.warn('Applying emergency CSS styles directly');
        const root = document.documentElement;

        const emergencyStyles = {
            '--terminal-text': '#00BFFF',
            '--terminal-text-muted': '#007ACC',
            '--terminal-highlight': '#1E90FF',
            '--terminal-hover': '#4169E1',
            '--terminal-bg': '#0a0f1a',
            '--terminal-border': '#0099CC',
            '--terminal-shadow-color': 'rgba(0, 191, 255, 0.2)',
            '--terminal-glow': '0 0 3px rgba(0, 191, 255, 0.6), 0 0 8px rgba(0, 191, 255, 0.4), 0 0 15px rgba(0, 191, 255, 0.2)',
            '--terminal-text-rgb': '0, 191, 255',
            '--terminal-bg-rgb': '10, 15, 26',
            '--card-bg-rgb': '26, 31, 42',
            '--card-border-rgb': '0, 153, 204'
        };

        for (const [property, value] of Object.entries(emergencyStyles)) {
            root.style.setProperty(property, value);
        }
    }

    handleThemeError(themeId, error) {
        console.error(`Error with theme '${themeId}':`, error);

        // Try to recover by switching to a known good theme
        const fallbackOrder = ['fallout4', 'fallout3', 'fallout-nv', 'fallout76'];

        for (const fallbackId of fallbackOrder) {
            if (fallbackId !== themeId && this.themes && this.themes[fallbackId]) {
                console.log(`Attempting recovery with theme: ${fallbackId}`);
                try {
                    this.applyTheme(fallbackId);
                    return true;
                } catch (recoveryError) {
                    console.warn(`Recovery attempt with ${fallbackId} failed:`, recoveryError);
                }
            }
        }

        // If all recovery attempts fail, use emergency fallback
        console.warn('All recovery attempts failed, using emergency fallback');
        this.fallbackToDefault();
        return false;
    }

    // Public method to switch themes
    switchTheme(themeId) {
        if (!this.isInitialized) {
            console.warn('Theme switcher not initialized');
            return false;
        }

        if (!this.themes || !this.themes[themeId]) {
            console.warn(`Theme '${themeId}' not found`);
            return false;
        }

        // Apply the theme
        this.applyTheme(themeId);

        // Save to localStorage for persistence
        this.saveTheme(themeId);

        // Update session storage
        try {
            sessionStorage.setItem(this.sessionKey, themeId);
        } catch (error) {
            console.warn('Failed to update session theme:', error);
        }

        // Provide user feedback
        this.showThemeChangeNotification(this.themes[themeId].name);

        return true;
    }

    showThemeChangeNotification(themeName) {
        // Add visual feedback class temporarily
        if (this.container) {
            this.container.classList.add('theme-switching');

            // Create notification element
            const notification = document.createElement('div');
            notification.className = 'theme-change-notification';
            notification.innerHTML = `
                <i class="fas fa-palette icon"></i>
                <span>Switched to ${themeName}</span>
            `;

            // Position notification
            this.container.appendChild(notification);

            // Animate in
            requestAnimationFrame(() => {
                notification.classList.add('visible');
            });

            // Remove after animation
            setTimeout(() => {
                notification.classList.remove('visible');
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.remove();
                    }
                    this.container.classList.remove('theme-switching');
                }, 300);
            }, 2000);
        }

        console.log(`Theme switched to: ${themeName}`);
    }

    showThemeLoadingState(themeName) {
        if (!this.container) return;

        // Disable button during loading
        const button = this.container.querySelector('.theme-switcher-button');
        if (button) {
            button.disabled = true;
            button.classList.add('loading');

            // Add loading spinner to button
            const originalContent = button.innerHTML;
            button.innerHTML = `
                <i class="fas fa-spinner fa-spin icon"></i>
                <span class="theme-name">Loading...</span>
                <i class="fas fa-chevron-down dropdown-icon"></i>
            `;

            // Store original content for restoration
            button.dataset.originalContent = originalContent;
        }

        // Close dropdown during loading
        this.closeDropdown();
    }

    hideThemeLoadingState() {
        if (!this.container) return;

        const button = this.container.querySelector('.theme-switcher-button');
        if (button) {
            button.disabled = false;
            button.classList.remove('loading');

            // Restore original content if it was stored
            if (button.dataset.originalContent) {
                button.innerHTML = button.dataset.originalContent;
                delete button.dataset.originalContent;
            }
        }
    }

    showThemeError(message) {
        if (!this.container) return;

        // Create error notification
        const errorNotification = document.createElement('div');
        errorNotification.className = 'theme-error-notification';
        errorNotification.innerHTML = `
            <i class="fas fa-exclamation-triangle icon"></i>
            <span>${message}</span>
        `;

        this.container.appendChild(errorNotification);

        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (errorNotification.parentNode) {
                errorNotification.remove();
            }
        }, 3000);
    }

    // Method to reset theme to default
    resetToDefault() {
        try {
            localStorage.removeItem(this.storageKey);
            sessionStorage.removeItem(this.sessionKey);
            this.switchTheme('fallout4');
            console.log('Theme reset to default');
        } catch (error) {
            console.warn('Failed to reset theme:', error);
        }
    }

    // Method to check if theme switching is available
    isAvailable() {
        return this.isInitialized && this.themes && Object.keys(this.themes).length > 0;
    }

    // Get current theme info
    getCurrentTheme() {
        return this.themes ? this.themes[this.currentTheme] : null;
    }

    // Get all available themes
    getAvailableThemes() {
        return this.themes ? Object.values(this.themes) : [];
    }
}

// Global instance
window.themeSwitcher = new ThemeSwitcher();
})();