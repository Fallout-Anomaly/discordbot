/* jshint esversion: 11, browser: true, node: false */
/* global YT, Promise, console, Set */
(function() {
'use strict';

// Video Carousel functionality
let currentSlideIndex = 0;
const totalSlides = 5;
let youtubePlayers = [];
let isVideoPlaying = false;
let videoAutoAdvanceInterval = null;

// Image Carousel functionality
let currentImageSlideIndex = 0;
const totalImageSlides = 21;

function showSlide(index) {
    const slides = document.querySelectorAll('.carousel-slide');
    const dots = document.querySelectorAll('.dot');
    
    // Pause all videos before switching
    pauseAllVideos();
    
    // Remove active class from all slides and dots
    slides.forEach(slide => slide.classList.remove('active'));
    dots.forEach(dot => dot.classList.remove('active'));
    
    // Add active class to current slide and dot
    if (slides[index]) {
        slides[index].classList.add('active');
    }
    if (dots[index]) {
        dots[index].classList.add('active');
    }
}

function pauseAllVideos() {
    // Stop all YouTube API players
    youtubePlayers.forEach(player => {
        if (player && typeof player.stopVideo === 'function') {
            player.stopVideo();
        }
    });
}

function changeSlide(direction) {
    currentSlideIndex += direction;
    
    // Loop around if we go past the boundaries
    if (currentSlideIndex >= totalSlides) {
        currentSlideIndex = 0;
    } else if (currentSlideIndex < 0) {
        currentSlideIndex = totalSlides - 1;
    }
    
    showSlide(currentSlideIndex);
}

function currentSlide(index) {
    currentSlideIndex = index - 1; // Convert to 0-based index
    showSlide(currentSlideIndex);
}

// Image carousel functions
function showImageSlide(index) {
    const slides = document.querySelectorAll('.image-slide');
    const dots = document.querySelectorAll('.image-dot');
    
    // Remove active class from all slides and dots
    slides.forEach(slide => slide.classList.remove('active'));
    dots.forEach(dot => dot.classList.remove('active'));
    
    // Add active class to current slide and dot
    if (slides[index]) {
        slides[index].classList.add('active');
    }
    if (dots[index]) {
        dots[index].classList.add('active');
    }
}

function changeImageSlide(direction) {
    currentImageSlideIndex += direction;
    
    // Loop around if we go past the boundaries
    if (currentImageSlideIndex >= totalImageSlides) {
        currentImageSlideIndex = 0;
    } else if (currentImageSlideIndex < 0) {
        currentImageSlideIndex = totalImageSlides - 1;
    }
    
    showImageSlide(currentImageSlideIndex);
}

function currentImageSlide(index) {
    currentImageSlideIndex = index - 1; // Convert to 0-based index
    showImageSlide(currentImageSlideIndex);
}

// Auto-advance image carousel every 5 seconds
function autoAdvanceImages() {
    changeImageSlide(1);
}

// Media tab switching functionality
function switchMediaTab(tabName) {
    // Remove active class from all tabs and sections
    document.querySelectorAll('.media-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.media-section').forEach(section => section.classList.remove('active'));
    
    // Add active class to selected tab and section
    document.querySelector(`[onclick="switchMediaTab('${tabName}')"]`).classList.add('active');
    document.getElementById(`${tabName}-section`).classList.add('active');
    
    // Update heading and description based on active tab
    const heading = document.getElementById('media-heading');
    const description = document.getElementById('media-description');
    
    if (tabName === 'images') {
        heading.innerHTML = '<i class="fas fa-images icon"></i> Gallery Showcase';
        description.textContent = 'Explore the wasteland through these stunning screenshots from Fallout Anomaly. Each image captures the enhanced visuals, atmospheric lighting, and immersive environments that make this mod experience truly exceptional.';
    } else if (tabName === 'videos') {
        heading.innerHTML = '<i class="fas fa-play-circle icon"></i> Video Showcase';
        description.textContent = 'Discover Fallout Anomaly through the eyes of our talented community creators and renowned content creators. These videos showcase the mod\'s incredible features, gameplay mechanics, and the immersive experience that awaits you in the wasteland.';
    }
}

// Auto-advance carousel every 10 seconds (only when no video is playing)
function autoAdvance() {
    if (!isVideoPlaying) {
        changeSlide(1);
    }
}

// YouTube API callback
function onYouTubeIframeAPIReady() {
    const iframes = document.querySelectorAll('.carousel-slide iframe');
    iframes.forEach((iframe, index) => {
        const player = new YT.Player(iframe, {
            events: {
                'onReady': function(event) {
                    youtubePlayers[index] = event.target;
                },
                'onStateChange': function(event) {
                    // Track video playing state
                    if (event.data === YT.PlayerState.PLAYING) {
                        isVideoPlaying = true;
                    } else if (event.data === YT.PlayerState.PAUSED || 
                              event.data === YT.PlayerState.ENDED || 
                              event.data === YT.PlayerState.CUED) {
                        isVideoPlaying = false;
                    }
                }
            }
        });
    });
}

// Initialize carousel when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Only initialize if we're on the index page
    if (document.querySelector('.image-carousel')) {
        showImageSlide(0); // Show first image slide
        
        // Auto-advance images every 5 seconds
        setInterval(autoAdvanceImages, 5000);
    }
    
    if (document.querySelector('.video-carousel')) {
        showSlide(0); // Show first video slide
        
        // Auto-advance videos every 10 seconds (only when not playing)
        videoAutoAdvanceInterval = setInterval(autoAdvance, 10000);
    }
});

const bootMessages = {
	index: [
		"VAULT-TEC UNIFIED OPERATING SYSTEM",
		"COPYRIGHT 2077 VAULT-TEC INDUSTRIES",
		"ROBCO INDUSTRIES UNIFIED OPERATING SYSTEM (VER 1.3.8)",
		"PIP-OS v7.1.0.8 INITIALIZING...",
		"LOADING CORE MODULES...",
		"VAULT NETWORK CONNECTION: ESTABLISHED",
		"RADIATION LEVELS: NOMINAL",
		"WARNING: CHECK HOLOTAPE DRIVE",
		"SYSTEM READY. PLEASE STAND BY..."
	],
	about: [
		"ACCESSING VAULT HISTORICAL ARCHIVES...",
		"DECRYPTING OVERSEER LOG ENTRY #42...",
		"DATA CORRUPTION SCAN INITIATED...",
		"SCAN COMPLETE. MINOR CORRUPTION DETECTED.",
		"INFOSEC DIRECTIVE 115 ACTIVE.",
		"LOADING VAULT INFORMATION DATABASE...",
		"DISPLAYING HISTORICAL RECORDS...",
		"WELCOME TO ARCHIVE TERMINAL 3B."
	],
	apply: [
		"INITIATING VAULT DWELLER APPLICATION PROTOCOL...",
		"ACCESSING CITIZENSHIP REGISTRY...",
		"SECURITY CLEARANCE CHECK: LEVEL OMEGA...",
		"WARNING: BIOMETRIC SCAN REQUIRED (BYPASSED)",
		"APPLICANT ASSESSMENT MODULE ONLINE.",
		"PREPARING G.O.A.T. INTERFACE...",
		"STANDBY FOR SKILL ASSESSMENT...",
		"AWAITING APPLICANT INPUT..."
	],
	donate: [
		"ACCESSING VAULT RESOURCE MANAGEMENT...",
		"CONNECTING TO CENTRAL TREASURY TERMINAL...",
		"VERIFYING VAULT-TEC SECURE TRANSACTION PROTOCOL...",
		"ENCRYPTION LAYER: ACTIVE (LVL 5)",
		"RESOURCE TRANSFER INTERFACE READY.",
		"YOUR CONTRIBUTION SUPPORTS VAULT SECURITY.",
		"REMEMBER: VAULT-TEC VALUES YOUR GENEROSITY!",
		"AWAITING TRANSACTION..."
	],
	guide: [
		"LOADING PIP-BOY USER MANUAL MK IV...",
		"ACCESSING VAULT SURVIVAL PROTOCOLS...",
		"CROSS-REFERENCING TECHNICAL SCHEMATICS...",
		"WARNING: HAZARD PROTOCOLS ENGAGED.",
		"STANDARD OPERATING PROCEDURES LOADED.",
		"PROCEDURAL GUIDE ACTIVE.",
		"SYSTEM READY. FOLLOW INSTRUCTIONS CAREFULLY, DWELLER."
	],
	guidetest: [
		"LOADING PIP-BOY USER MANUAL MK IV...",
		"ACCESSING VAULT SURVIVAL PROTOCOLS...",
		"CROSS-REFERENCING TECHNICAL SCHEMATICS...",
		"WARNING: HAZARD PROTOCOLS ENGAGED.",
		"STANDARD OPERATING PROCEDURES LOADED.",
		"PROCEDURAL GUIDE ACTIVE.",
		"SYSTEM READY. FOLLOW INSTRUCTIONS CAREFULLY, DWELLER."
	],
	staff: [
		"QUERYING VAULT PERSONNEL ROSTER...",
		"VERIFYING SECURITY CLEARANCE: USER LEVEL GAMMA",
		"LOADING PERSONNEL FILES: [CLASSIFIED]...",
		"WARNING: UNAUTHORIZED ACCESS WILL BE LOGGED.",
		"SORTING BY SECURITY RANK & ASSIGNMENT...",
		"VAULT STAFF DIRECTORY INITIALIZED.",
		"DISPLAYING AUTHORIZED PERSONNEL DATA..."
	]
};

// --- Utility Functions ---
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getPageIdentifier() {
	const path = window.location.pathname;
	const filename = path.substring(path.lastIndexOf('/') + 1);
	if (filename === '' || /index\.html?$/.test(filename)) {
		return 'index';
	}
	const pageName = filename.replace(/\.html?$/, '');
	if (bootMessages.hasOwnProperty(pageName)) {
		return pageName;
	}
	console.warn(`No specific boot message key found for page: ${pageName}. Falling back to index.`);
	return 'index';
}


// --- Boot Sequence Functions ---

function displayAllBootMessagesInstantly(pageKey) {
	const pipOsBoot = document.querySelector('.pip-os-boot');
	if (!pipOsBoot) return;

	pipOsBoot.innerHTML = '';
	const messages = bootMessages[pageKey] || bootMessages.index;
	if (!messages) {
		const line = document.createElement('div');
		line.className = 'pip-os-line visible';
		line.textContent = 'INITIALIZING SYSTEM...';
		pipOsBoot.appendChild(line);
		return;
	}

	messages.forEach(message => {
		const line = document.createElement('div');
		line.className = 'pip-os-line visible'; // Instantly visible
		line.textContent = message;
		pipOsBoot.appendChild(line);
	});
}

async function initializeBootMessagesWithTypewriter(pageKey, controller) {
	const pipOsBoot = document.querySelector('.pip-os-boot');
	if (!pipOsBoot) {
		if (!controller.skipped) controller.resolve();
		return;
	}
	pipOsBoot.innerHTML = '';

	const messages = bootMessages[pageKey] || bootMessages.index;
	if (!messages) {
		const line = document.createElement('div');
		line.className = 'pip-os-line visible';
		line.textContent = 'INITIALIZING SYSTEM...';
		pipOsBoot.appendChild(line);
		if (!controller.skipped) controller.resolve();
		return;
	}

	const charDelay = 10;
	const lineDelay = 75;

	try {
		for (const message of messages) {
			if (controller.skipped) return;
			const line = document.createElement('div');
			line.className = 'pip-os-line';
			pipOsBoot.appendChild(line);
			let currentText = '';

			for (let i = 0; i < message.length; i++) {
				if (controller.skipped) return;
				currentText += message[i];
				line.textContent = currentText;
				await delay(charDelay);
				if (controller.skipped) return;
			}
			line.classList.add('visible');
			await delay(lineDelay);
			if (controller.skipped) return;
		}

		if (!controller.skipped) {
			controller.resolve(); // Resolve only if not skipped
		}
	} catch (error) {
		console.error("Error during boot message typing:", error);
		if (!controller.skipped) {
			controller.resolve(); // Resolve even on error
		}
	}
}

// --- Main Initialization Flow ---

document.addEventListener('DOMContentLoaded', async () => {
	const pageIdentifier = getPageIdentifier();
	const loadingScreen = document.querySelector('.loading-screen');
	const continuePrompt = document.querySelector('.continue-prompt'); // Get prompt element

	// Controller for boot sequence promise
	const bootController = {
		skipped: false,
		promise: null,
		resolve: null,
		reject: null
	};
	bootController.promise = new Promise((res, rej) => {
		bootController.resolve = res;
		bootController.reject = rej;
	});

	let skipHandler = null;

	// Setup skip functionality for the typewriter effect
	if (loadingScreen) {
		skipHandler = (event) => {
			if (bootController.skipped) return;
			const isSkipEvent = event.type === 'click' || (event.type === 'keydown' && ['Enter', ' ', 'Escape'].includes(event.key));
			if (isSkipEvent) {
				event.preventDefault(); // Prevent default actions
				bootController.skipped = true;
				displayAllBootMessagesInstantly(pageIdentifier);
				bootController.resolve(); // Resolve the boot promise immediately

				// Clean up this specific skip handler
				loadingScreen.removeEventListener('click', skipHandler);
				document.removeEventListener('keydown', skipHandler);
                skipHandler = null; // Ensure it's cleared
			}
		};
		loadingScreen.addEventListener('click', skipHandler);
		document.addEventListener('keydown', skipHandler);
	}

	// Start the typewriter
	initializeBootMessagesWithTypewriter(pageIdentifier, bootController);

	// Initialize non-visual elements early
	initializeFXToggleIfNeeded();
	initializeThemeSwitcherIfNeeded();
	// Removed call to initializeTerminalColorSwitcher()

	// --- Stage 1: Wait for Boot Messages to Display ---
	try {
		await bootController.promise;
	} catch (error) {
		console.error("Boot sequence promise rejected:", error);
		// Ensure instant display if typewriter failed but wasn't skipped
        if (!bootController.skipped) {
            displayAllBootMessagesInstantly(pageIdentifier);
        }
	}

    // Boot messages are now fully displayed (typed or skipped)
    // Clean up the initial skip listener if it's still attached
    if (skipHandler && loadingScreen) {
		loadingScreen.removeEventListener('click', skipHandler);
		document.removeEventListener('keydown', skipHandler);
	}

	// --- Stage 2: Wait for User "Continue" Action ---
	if (continuePrompt) {
		continuePrompt.classList.remove('hidden'); // Show the prompt

		// Create a new promise that resolves on user interaction
		const continuePromise = new Promise((resolveContinue) => {
			const continueHandler = (event) => {
                // Prevent trigger if clicking on interactive elements inside loading screen
                if (event.target && event.target.closest('a, button') && event.target !== loadingScreen) return;

				event.preventDefault();
				continuePrompt.classList.add('hidden'); // Hide prompt
				// Remove listeners immediately
				document.removeEventListener('keydown', continueHandler);
				loadingScreen?.removeEventListener('click', continueHandler);
				resolveContinue(); // Resolve the promise to proceed
			};

			// Add listeners for the continue action
			document.addEventListener('keydown', continueHandler);
			loadingScreen?.addEventListener('click', continueHandler); // Use optional chaining
		});

		await continuePromise; // Wait here until the user interacts

	} else {
        console.warn("'.continue-prompt' element not found. Proceeding automatically after a short delay.");
        await delay(500); // Fallback delay if prompt is missing
    }

	// --- Stage 3: Initialize Site ---
	// User has chosen to continue (or fallback delay passed)
	try {
		await initializeSite(); // No promise needed here anymore
	} catch(error) {
		console.error("Failed to initialize site after continue signal:", error);
        // Attempt basic recovery
        const mainContent = document.querySelector('.main-content');
        if (loadingScreen && !loadingScreen.classList.contains('hidden')) {
            loadingScreen.classList.add('hidden'); // Force hide
        }
        if (mainContent && !mainContent.classList.contains('visible')) {
            mainContent.classList.add('visible'); // Force show
        }
	}

	// Load page-specific data AFTER main site initialization is complete
	if (pageIdentifier === 'staff') {
		loadStaffData();
	}
});

// InitializeSite now assumes the wait is over.
async function initializeSite() {
	const loadingScreen = document.querySelector('.loading-screen');
	const mainContent = document.querySelector('.main-content');

	if (!mainContent) {
		console.error('Critical Error: .main-content element not found! Site cannot display.');
		if (loadingScreen) loadingScreen.innerHTML = '<div class="pip-os-boot"><div class="pip-os-line">FATAL ERROR: Main content missing.</div></div>';
		return;
	}

    // Hide loading screen smoothly
	if (loadingScreen) {
		if (!loadingScreen.classList.contains('hidden')) {
            // Use CSS transition for fade-out
            loadingScreen.style.opacity = '0';
            // Wait for transition to finish before setting visibility: hidden or display: none
            await delay(700); // Match transition duration in CSS (0.7s)
            loadingScreen.classList.add('hidden'); // Use 'hidden' class which should set display:none or visibility:hidden
            loadingScreen.style.opacity = ''; // Reset inline style
		}
	}

	// Show main content smoothly
	requestAnimationFrame(() => {
		if (!mainContent.classList.contains('visible')) {
			mainContent.classList.add('visible');
		}
	});

    // Allow a moment for visibility transition to start if any
	await delay(50);

	// Initialize components that depend on main content being visible
	loadFooter();
	initializeCardObserver();
	initializeTabs();
	initializeAccordions();
	initializeButtonHoverEffects();
}


// --- Component Initializers & Data Loaders ---

function initializeFXToggleIfNeeded() {
    if (!document.querySelector('.fx-toggle-button')) {
        initializeFXToggle();
    }
}

function initializeThemeSwitcherIfNeeded() {
    if (!document.querySelector('.theme-switcher-container') && window.themeSwitcher) {
        initializeThemeSwitcher();
    }
}

async function loadFooter() {
	// Skip footer loading on guide pages
	if (window.location.pathname.includes('/guide.html') || window.location.pathname.includes('/pages/guide.html')) {
		return;
	}
	
	if (document.querySelector('.fallout-footer') || document.body.classList.contains('footer-loading')) {
		return;
	}
	document.body.classList.add('footer-loading');
	try {
		const path = window.location.pathname;
		const isPagesDir = path.includes('/pages/');
		const footerPath = isPagesDir ? '../src/components/footer.html' : 'src/components/footer.html';

		const response = await fetch(footerPath);
		if (!response.ok) throw new Error(`Failed to load footer: ${response.status} ${response.statusText} from ${footerPath}`);
		const footerHtml = await response.text();
		const footerContainer = document.createElement('div');
		footerContainer.innerHTML = footerHtml;
		const footerElement = footerContainer.querySelector('.fallout-footer');
		if (footerElement && !document.querySelector('.fallout-footer')) {
			document.body.appendChild(footerElement);
		} else if (!footerElement) {
			console.error('Footer HTML file seems empty or invalid (missing .fallout-footer).');
		}
	} catch (error) {
		console.error('Error loading footer:', error);
		if (!document.querySelector('.fallout-footer')) {
			const errorFooter = document.createElement('footer');
			errorFooter.className = 'fallout-footer error-footer';
			errorFooter.innerHTML = '<p>Error loading footer content.</p>';
			document.body.appendChild(errorFooter);
		}
	} finally {
		document.body.classList.remove('footer-loading');
	}
}

async function loadStaffData() {
	const staffSectionsContainer = document.getElementById('staff-sections-container');
	if (!staffSectionsContainer) return;

	staffSectionsContainer.innerHTML = '<div class="fallout-card error-card"><p class="terminal-text error-message"><i class="fas fa-spinner fa-spin icon"></i> Loading staff roster...</p></div>';

	// Helper function to determine social icon class
	const getSocialIconClass = (link) => {
		const lowerLink = link.toLowerCase();

		// Major Platforms & Brands
		if (lowerLink.includes('github.com')) return 'fab fa-github';
		if (lowerLink.includes('twitter.com') || lowerLink.includes('x.com')) return 'fab fa-x-twitter'; // Assumes FA v6+ for X icon
		if (lowerLink.includes('linkedin.com')) return 'fab fa-linkedin';
		if (lowerLink.includes('facebook.com')) return 'fab fa-facebook';
		if (lowerLink.includes('instagram.com')) return 'fab fa-instagram'; // Added/Confirmed
		if (lowerLink.includes('discord.com') || lowerLink.includes('discord.gg')) return 'fab fa-discord';
		if (lowerLink.includes('twitch.tv')) return 'fab fa-twitch';
		if (lowerLink.includes('youtube.com') || lowerLink.includes('youtu.be')) return 'fab fa-youtube';
		if (lowerLink.includes('tiktok.com')) return 'fab fa-tiktok';
		if (lowerLink.includes('reddit.com')) return 'fab fa-reddit-alien';
		if (lowerLink.includes('pinterest.com')) return 'fab fa-pinterest';
		if (lowerLink.includes('tumblr.com')) return 'fab fa-tumblr';
		if (lowerLink.includes('snapchat.com')) return 'fab fa-snapchat';
		if (lowerLink.includes('whatsapp.com') || lowerLink.includes('wa.me')) return 'fab fa-whatsapp';
		if (lowerLink.includes('telegram.me') || lowerLink.includes('t.me')) return 'fab fa-telegram';
		if (lowerLink.includes('skype.com') || lowerLink.startsWith('skype:')) return 'fab fa-skype';
		if (lowerLink.includes('spotify.com')) return 'fab fa-spotify';
		if (lowerLink.includes('soundcloud.com')) return 'fab fa-soundcloud';
		if (lowerLink.includes('steamcommunity.com')) return 'fab fa-steam';
		if (lowerLink.includes('bsky.app')) return 'fa-brands fa-bluesky';
		
		// Gaming & Modding Specific
		if (lowerLink.includes('nexusmods.com')) return 'fas fa-tools';

		// Portfolio & Creative
		if (lowerLink.includes('behance.net')) return 'fab fa-behance';
		if (lowerLink.includes('dribbble.com')) return 'fab fa-dribbble';
		if (lowerLink.includes('artstation.com')) return 'fab fa-artstation';
		if (lowerLink.includes('deviantart.com')) return 'fab fa-deviantart';
		if (lowerLink.includes('codepen.io')) return 'fab fa-codepen';
		if (lowerLink.includes('medium.com')) return 'fab fa-medium';
		if (lowerLink.includes('vimeo.com')) return 'fab fa-vimeo-v';
		if (lowerLink.includes('flickr.com')) return 'fab fa-flickr';

		// Support & Funding
		if (lowerLink.includes('patreon.com')) return 'fab fa-patreon';
		if (lowerLink.includes('ko-fi.com')) return 'fas fa-mug-saucer';
		if (lowerLink.includes('paypal.me') || lowerLink.includes('paypal.com')) return 'fab fa-paypal';
		if (lowerLink.includes('buymeacoffee.com')) return 'fas fa-coffee';

		// Communication & General
		if (lowerLink.startsWith('mailto:')) return 'fas fa-envelope';
        if (lowerLink.startsWith('tel:')) return 'fas fa-phone';

		// Add more specific domains as needed above this line

		// Fallback for general websites/links
        // You might want to check for common TLDs if it's not a known brand
        if (lowerLink.match(/\.(com|net|org|io|dev|me|uk|co|app|xyz|tech|site|online|store|blog)\b/)) {
             return 'fas fa-globe'; // Generic website icon
        }

		return 'fas fa-link'; // Ultimate fallback
	};

	try {
		const response = await fetch('../src/data/staff.json');
		if (!response.ok) {
			throw new Error(`HTTP error fetching staff.json: ${response.status} ${response.statusText}`);
		}
		// The JSON is now an object, not an array.
		const groupedStaff = await response.json();
		staffSectionsContainer.innerHTML = ''; // Clear loading message

		if (typeof groupedStaff !== 'object' || groupedStaff === null || Object.keys(groupedStaff).length === 0) {
			staffSectionsContainer.innerHTML = '<div class="fallout-card error-card"><p class="terminal-text error-message"><i class="fas fa-exclamation-triangle icon"></i> No staff members found or data is invalid.</p></div>';
			return;
		}

		const rankOrder = ["Lead Developer", "Head Admin", "Assistant Lead Developer", "Senior Developer", "Developer","Website Dev", "Community Manager", "Moderator", "Media Team", "Developer (On Leave)", "Retired"];
		const processedRanks = new Set();

		const createStaffCard = (staff) => {
			const card = document.createElement('div');
			card.className = 'fallout-card staff-card';

			const image = document.createElement('img');
			image.className = 'staff-image';
			image.src = staff.image || '';
			image.alt = staff.name ? `${staff.name}'s profile picture` : 'Staff member profile picture';
			image.loading = 'lazy';

			// --- MODIFIED SECTION START ---
			image.onerror = function() {
				// Determine path based on current page location
				const path = window.location.pathname;
    			const isPagesDir = path.includes('/pages/');
    			this.src = isPagesDir ? '../src/img/vaultboy.png' : 'src/img/vaultboy.png';
				
				// Keep styles for consistent fallback appearance
				this.style.filter = 'none'; 
				this.style.objectFit = 'contain';
			};
			// --- MODIFIED SECTION END ---

			card.appendChild(image);

			const infoDiv = document.createElement('div');
			infoDiv.className = 'staff-info';

			const nameH3 = document.createElement('h3');
			nameH3.className = 'staff-name';
			nameH3.textContent = staff.name || 'Unnamed Staff';
			infoDiv.appendChild(nameH3);

			const rankP = document.createElement('p');
			rankP.className = 'staff-rank';
			rankP.textContent = staff.rank || 'No Rank';
			infoDiv.appendChild(rankP);

			// Add Tagline
			if (staff.tagline) {
				const taglineP = document.createElement('p');
				taglineP.className = 'staff-tagline';
				taglineP.textContent = staff.tagline;
				infoDiv.appendChild(taglineP);
			}

			// Add Social Links
			if (staff.social && typeof staff.social === 'string') {
				const socialLinks = staff.social.split(',')
					.map(s => s.trim())
					.filter(Boolean);

				if (socialLinks.length > 0) {
					const socialContainer = document.createElement('div');
					socialContainer.className = 'staff-social-links';

					socialLinks.forEach(link => {
						const linkA = document.createElement('a');
						const url = (link.startsWith('http://') || link.startsWith('https://') || link.startsWith('mailto:')) ?
							link : `https://${link}`;
						linkA.href = url;
						linkA.target = '_blank';
						linkA.rel = 'noopener noreferrer';
						linkA.title = `Visit ${link}`;

						const icon = document.createElement('i');
						icon.className = `icon ${getSocialIconClass(link)}`;
						linkA.appendChild(icon);
						socialContainer.appendChild(linkA);
					});
					infoDiv.appendChild(socialContainer);
				}
			}

			const rolesContainer = document.createElement('div');
			rolesContainer.className = 'staff-roles-container';
			let roles = [];
			if (typeof staff.role === 'string') {
				roles = staff.role.split(',').map(role => role.trim()).filter(Boolean);
			} else if (Array.isArray(staff.role)) {
				roles = staff.role.filter(role => typeof role === 'string' && role.trim());
			}

			if (roles.length > 0) {
				roles.forEach(roleText => {
					const roleTag = document.createElement('span');
					roleTag.className = 'staff-role-tag';
					roleTag.textContent = roleText;
					rolesContainer.appendChild(roleTag);
				});
			}
			
			if (roles.length > 0) {
				infoDiv.appendChild(rolesContainer);
			}

			card.appendChild(infoDiv);
			return card;
		};

		const createRankSection = (rank, staffMembers) => {
			const sectionDiv = document.createElement('div');
			sectionDiv.className = 'rank-section';

			const headerDiv = document.createElement('div');
			headerDiv.className = 'rank-header';
			const headerCard = document.createElement('div');
			headerCard.className = 'fallout-card-header';
			const headerIcon = document.createElement('i');
			headerIcon.className = `fas ${getIconForRank(rank)} icon`;
			const headerTitle = document.createElement('h2');
			headerTitle.textContent = rank;
			headerCard.appendChild(headerIcon);
			headerCard.appendChild(headerTitle);
			headerDiv.appendChild(headerCard);
			sectionDiv.appendChild(headerDiv);

			const membersGrid = document.createElement('div');
			membersGrid.className = 'rank-members staff-grid';
			staffMembers.forEach(staff => {
				membersGrid.appendChild(createStaffCard(staff));
			});
			sectionDiv.appendChild(membersGrid);
			return sectionDiv;
		};

		rankOrder.forEach(rank => {
			if (groupedStaff[rank] && groupedStaff[rank].length > 0) {
				staffSectionsContainer.appendChild(createRankSection(rank, groupedStaff[rank]));
				processedRanks.add(rank);
			}
		});

		Object.keys(groupedStaff).sort().forEach(rank => {
			if (!processedRanks.has(rank) && groupedStaff[rank] && groupedStaff[rank].length > 0) {
				staffSectionsContainer.appendChild(createRankSection(rank, groupedStaff[rank]));
			}
		});

		initializeCardObserver();

	} catch (error) {
		console.error('Failed to load or process staff data:', error);
		staffSectionsContainer.innerHTML = '<div class="fallout-card error-card"><p class="terminal-text error-message"><i class="fas fa-exclamation-triangle icon"></i> Error loading staff roster. Details in console.</p></div>';
	}
}


function getIconForRank(rank) {
	const lowerRank = rank?.toLowerCase() || '';
	if (lowerRank.includes('lead') || lowerRank.includes('head')) return 'fa-crown';
	if (lowerRank.includes('senior')) return 'fa-user-shield';
	if (lowerRank.includes('developer') || lowerRank.includes('website') || lowerRank.includes('dev')) return 'fa-code';
	if (lowerRank.includes('admin')) return 'fa-user-cog';
	if (lowerRank.includes('manager')) return 'fa-comments';
	if (lowerRank.includes('media')) return 'fa-camera-retro';
	if (lowerRank.includes('leave')) return 'fa-user-clock';
    if (lowerRank.includes('retired')) return 'fa-user-slash';
	return 'fa-user';
}

function initializeTabs() {
	// Skip tab initialization on guide pages, as they have a custom system
	if (window.location.pathname.includes('/guide.html') || window.location.pathname.includes('/pages/guide.html')) {
		return;
	}
	const tabContainers = document.querySelectorAll('.tab-container');
	if (tabContainers.length === 0) return;

	tabContainers.forEach(container => {
		const tabButtons = container.querySelectorAll('.tab-button');
		const tabContents = container.querySelectorAll(':scope > .tab-content');

		if (tabButtons.length > 0 && tabContents.length > 0) {
			const switchTab = (tabId) => {
                if (!tabId) return;

				const targetContent = container.querySelector(`#${tabId}`);
				const targetButton = container.querySelector(`.tab-button[data-tab="${tabId}"]`);

				tabContents.forEach(content => content.classList.remove('active'));
				tabButtons.forEach(button => button.classList.remove('active'));

				if (targetContent) {
					targetContent.classList.add('active');
				} else {
					console.warn(`Tab content with id "${tabId}" not found in container`, container);
				}
				if (targetButton) {
					targetButton.classList.add('active');
				} else {
					console.warn(`Tab button with data-tab "${tabId}" not found in container`, container);
				}
			};

			tabButtons.forEach(button => {
				button.addEventListener('click', (event) => {
					const tabId = event.currentTarget.getAttribute('data-tab');
					if (tabId) {
                        const currentHash = window.location.hash.substring(1);
                        if (tabId !== currentHash) {
                            if (history.pushState) {
                               history.pushState({tab: tabId}, null, `#${tabId}`);
                            } else {
                               location.hash = `#${tabId}`;
                            }
                        }
						switchTab(tabId);
					} else {
						console.warn('Tab button missing data-tab attribute:', button);
					}
				});
			});

			const handleHashChange = () => {
				const hash = window.location.hash.substring(1);
				const buttonForHash = container.querySelector(`.tab-button[data-tab="${hash}"]`);
				if (hash && buttonForHash) {
					switchTab(hash);
				} else {
                    const currentlyActiveButton = container.querySelector('.tab-button.active');
                    if (!currentlyActiveButton && tabButtons.length > 0) {
                        const firstTabId = tabButtons[0].getAttribute('data-tab');
                        switchTab(firstTabId);
                    }
				}
			};

            // Initial load handling
			handleHashChange();

            // Listen for hash changes
			window.addEventListener('hashchange', handleHashChange, false);
            window.addEventListener('popstate', (event) => {
                if (event.state && event.state.tab) {
                    switchTab(event.state.tab);
                } else {
                    handleHashChange();
                }
            });
		}
	});
}

function initializeAccordions() {
	// Only initialize accordions if we're NOT on the guide page
	// The guide page uses its own collapsible system via guide-scripts.js
	if (window.location.pathname.includes('/guide.html') || window.location.pathname.includes('/pages/guide.html')) {
		return; // Skip accordion initialization on guide pages
	}
	
	const accordionHeaders = document.querySelectorAll('.accordion-header');
	
	accordionHeaders.forEach(header => {
		header.addEventListener('click', function() {
			const accordionItem = this.closest('.accordion-item');
			const accordionContent = accordionItem.querySelector('.accordion-content');
			const toggleIcon = this.querySelector('.toggle-icon i');
			
			// Toggle the active state
			const isActive = accordionItem.classList.contains('active');
			
			if (isActive) {
				// Close the accordion
				accordionItem.classList.remove('active');
				accordionContent.style.display = 'none';
				if (toggleIcon) {
					toggleIcon.classList.remove('fa-minus');
					toggleIcon.classList.add('fa-plus');
				}
			} else {
				// Open the accordion
				accordionItem.classList.add('active');
				accordionContent.style.display = 'block';
				if (toggleIcon) {
					toggleIcon.classList.remove('fa-plus');
					toggleIcon.classList.add('fa-minus');
				}
			}
		});
	});
}

function initializeButtonHoverEffects() {} // Keep structure, CSS handles hover

let cardObserverInstance = null;
function initializeCardObserver() {
	if (cardObserverInstance) {
		cardObserverInstance.disconnect();
	}
	const cards = document.querySelectorAll(
		'.fallout-card:not(.visible), .feature-card:not(.visible), .application-card:not(.visible), .staff-card:not(.visible), .donation-card:not(.visible)'
	);
	if (cards.length === 0) return;

	if ('IntersectionObserver' in window && !document.body.classList.contains('no-fx')) {
		const observerCallback = (entries, observer) => {
			entries.forEach(entry => {
				if (entry.isIntersecting) {
					entry.target.classList.add('visible');
					observer.unobserve(entry.target);
				}
			});
		};
		cardObserverInstance = new IntersectionObserver(observerCallback, {
			root: null, rootMargin: '0px 0px -50px 0px', threshold: 0.1
		});
		cards.forEach(card => cardObserverInstance.observe(card));
	} else {
		if (!('IntersectionObserver' in window)) { console.warn('IntersectionObserver not supported...'); }
		cards.forEach(card => card.classList.add('visible'));
		cardObserverInstance = null;
	}
}

// Removed the initializeTerminalColorSwitcher function entirely

function initializeFXToggle() {
	if (document.querySelector('.fx-toggle-button')) return;
	
	// Create or get existing container
	let fxToggleContainer = document.querySelector('.nav-fx-toggle');
	if (!fxToggleContainer) {
		fxToggleContainer = document.createElement('div');
		fxToggleContainer.className = 'nav-fx-toggle';
		document.body.appendChild(fxToggleContainer);
	}
	
	const toggleButton = document.createElement('button');
	toggleButton.className = 'fx-toggle-button';
	fxToggleContainer.appendChild(toggleButton);
	
	const body = document.body;
	const updateButton = () => {
		const fxDisabled = body.classList.contains('no-fx');
		if (fxDisabled) {
			toggleButton.innerHTML = '<i class="fas fa-eye icon"></i> Enable FX';
			toggleButton.setAttribute('aria-pressed', 'false');
			toggleButton.title = "Enable visual effects (scanlines, animations)";
		} else {
			toggleButton.innerHTML = '<i class="fas fa-eye-slash icon"></i> Disable FX';
			toggleButton.setAttribute('aria-pressed', 'true');
			toggleButton.title = "Disable visual effects for performance or preference";
		}
	};
	
	if (localStorage.getItem('fxDisabled') === 'true') {
		body.classList.add('no-fx');
	} else {
		body.classList.remove('no-fx');
	}
	updateButton();
	
	toggleButton.addEventListener('click', () => {
		body.classList.toggle('no-fx');
		const fxDisabled = body.classList.contains('no-fx');
		localStorage.setItem('fxDisabled', fxDisabled ? 'true' : 'false');
		updateButton();
		initializeCardObserver();
		console.log(`Visual FX ${fxDisabled ? 'Disabled' : 'Enabled'}`);
	});
}

async function initializeThemeSwitcher() {
	if (document.querySelector('.theme-switcher-container') || !window.themeSwitcher) return;
	
	try {
		// Initialize the theme switcher
		await window.themeSwitcher.init();
		
		// Create or get existing container
		let fxToggleContainer = document.querySelector('.nav-fx-toggle');
		if (!fxToggleContainer) {
			fxToggleContainer = document.createElement('div');
			fxToggleContainer.className = 'nav-fx-toggle';
			document.body.appendChild(fxToggleContainer);
		}
		
		// Add the theme switcher component to the container
		if (window.themeSwitcher.container) {
			fxToggleContainer.appendChild(window.themeSwitcher.container);
		}
		
		console.log('Theme Switcher added to navigation');
	} catch (error) {
		console.error('Failed to initialize theme switcher:', error);
	}
}
})();