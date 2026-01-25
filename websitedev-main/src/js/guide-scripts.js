/* jshint esversion: 11, browser: true, node: false */
/* global console */
/**
 * Fallout Anomaly Guide Scripts
 * Enhanced functionality for the modernized guide interface
 */

// ==================================================
// ============ UTILITY FUNCTIONS ==================
// ==================================================

/**
 * Escape special regex characters
 */
function escapeRegExp(string) {
   return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Debounce function to limit function calls
 */
function debounce(func, wait) {
   let timeout;
   return function executedFunction(...args) {
      const later = () => {
         clearTimeout(timeout);
         func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
   };
}

/**
 * Throttle function to limit function calls
 */
function throttle(func, limit) {
   let inThrottle;
   return function() {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
         func.apply(context, args);
         inThrottle = true;
         setTimeout(() => inThrottle = false, limit);
      }
   };
}

// ==================================================
// ============ TAB NAVIGATION ======================
// ==================================================

/**
 * Initialize tab navigation system
 */
function initializeTabNavigation() {
   const tabButtons = document.querySelectorAll('.tab-button[data-section]');
   const navLinks = document.querySelectorAll('.nav-link[href^="#"]');
   
   // Tab button click handlers
   tabButtons.forEach(button => {
      button.addEventListener('click', () => {
         const sectionId = button.getAttribute('data-section');
         switchToTab(sectionId);
         
         // Update URL hash
         history.pushState(null, null, `#${sectionId}`);
         
         // Update active nav link
         updateActiveNavLink(sectionId);
      });
   });
   
   // Nav link click handlers
   navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
         e.preventDefault();
         const sectionId = link.getAttribute('href').substring(1);
         switchToTab(sectionId);
         
         // Update URL hash
         history.pushState(null, null, `#${sectionId}`);
         
         // Update active nav link
         updateActiveNavLink(sectionId);
      });
   });
   
   // Handle browser back/forward
   window.addEventListener('popstate', () => {
      const hash = window.location.hash.substring(1);
      if (hash && document.getElementById(hash)) {
         switchToTab(hash);
         updateActiveNavLink(hash);
      }
   });
   
   // Handle initial hash on page load
   const initialHash = window.location.hash.substring(1);
   if (initialHash && document.getElementById(initialHash)) {
      switchToTab(initialHash);
      updateActiveNavLink(initialHash);
   }
}

/**
 * Switch to a specific tab
 */
function switchToTab(sectionId) {
   console.log('Switching to tab:', sectionId);
   
   // Hide all tab contents
   const tabContents = document.querySelectorAll('.tab-content');
   tabContents.forEach(content => {
      content.classList.remove('active');
      content.style.display = 'none'; // Explicit fallback for CSS issues
   });
   
   // Remove active class from all tab buttons and update ARIA attributes
   const tabButtons = document.querySelectorAll('.tab-button');
   tabButtons.forEach(button => {
      button.classList.remove('active');
      button.setAttribute('aria-selected', 'false');
   });
   
   // Show the target tab content
   const targetTabContent = document.getElementById(sectionId);
   if (targetTabContent) {
      targetTabContent.classList.add('active');
      targetTabContent.style.display = 'block'; // Explicit fallback for CSS issues
      console.log('Tab activated:', sectionId);
   } else {
      console.error('Tab content not found:', sectionId);
   }
   
   // Activate the target tab button and update ARIA
   const targetTabButton = document.querySelector(`[data-section="${sectionId}"]`);
   if (targetTabButton) {
      targetTabButton.classList.add('active');
      targetTabButton.setAttribute('aria-selected', 'true');
   } else {
      console.warn('Tab button not found for:', sectionId);
   }
   
   /* 
   // Scroll to top of content - REMOVED TO PREVENT JUMPING
   const mainContent = document.querySelector('.main-content');
   if (mainContent) {
      mainContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
   }
   */
}

/**
 * Update active navigation link
 */
function updateActiveNavLink(sectionId) {
   const navLinks = document.querySelectorAll('.nav-link');
   navLinks.forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href') === `#${sectionId}`) {
         link.classList.add('active');
      }
   });
}

// ==================================================
// ============ COLLAPSIBLE SECTIONS ===============
// ==================================================

/**
 * Initialize collapsible sections
 */
function initializeCollapsibleSections() {
   // Main collapsible sections
   const collapsibleHeaders = document.querySelectorAll('.collapsible-header');
   
   collapsibleHeaders.forEach(header => {
      // Add ARIA attributes
      header.setAttribute('role', 'button');
      header.setAttribute('aria-expanded', 'false');
      header.setAttribute('tabindex', '0');
      
      // Add click listener
      header.addEventListener('click', () => {
         toggleCollapsible(header);
      });
      
      // Add keyboard listener for Enter/Space
      header.addEventListener('keydown', (e) => {
         if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleCollapsible(header);
         }
      });
   });
   
   // Sub-collapsible sections
   const subCollapsibleHeaders = document.querySelectorAll('.sub-collapsible-header');
   subCollapsibleHeaders.forEach(header => {
      // Add ARIA attributes
      header.setAttribute('role', 'button');
      header.setAttribute('aria-expanded', 'false');
      header.setAttribute('tabindex', '0');
      
      // Add click listener
      header.addEventListener('click', () => {
         toggleSubCollapsible(header);
      });
      
      // Add keyboard listener for Enter/Space
      header.addEventListener('keydown', (e) => {
         if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleSubCollapsible(header);
         }
      });
   });
   
   // FAQ sections
   const faqQuestions = document.querySelectorAll('.faq-question');
   faqQuestions.forEach(question => {
      question.addEventListener('click', () => {
         toggleFAQItem(question);
      });
   });
   
   // Initialize all sections as closed
   initializeCollapsibleState();
}

/**
 * Toggle main collapsible section
 */
function toggleCollapsible(header) {
   const content = header.nextElementSibling;
   const icon = header.querySelector('.collapsible-icon i');
   
   if (!content) return;
   
   const isOpen = content.style.display === 'block' || content.classList.contains('open');
   
   if (isOpen) {
      // Close section
      content.style.display = 'none';
      content.classList.remove('open');
      icon.classList.remove('fa-chevron-up');
      icon.classList.add('fa-chevron-down');
      header.setAttribute('aria-expanded', 'false');
   } else {
      // Open section
      content.style.display = 'block';
      content.classList.add('open');
      icon.classList.remove('fa-chevron-down');
      icon.classList.add('fa-chevron-up');
      header.setAttribute('aria-expanded', 'true');
   }
}

/**
 * Toggle sub-collapsible section
 */
function toggleSubCollapsible(header) {
   const content = header.nextElementSibling;
   const icon = header.querySelector('.sub-collapsible-icon i');
   
   if (!content) return;
   
   const isOpen = content.style.display === 'block' || content.classList.contains('open');
   
   if (isOpen) {
      // Close section
      content.style.display = 'none';
      content.classList.remove('open');
      icon.classList.remove('fa-chevron-up');
      icon.classList.add('fa-chevron-down');
      header.setAttribute('aria-expanded', 'false');
   } else {
      // Open section
      content.style.display = 'block';
      content.classList.add('open');
      icon.classList.remove('fa-chevron-down');
      icon.classList.add('fa-chevron-up');
      header.setAttribute('aria-expanded', 'true');
   }
}

/**
 * Scroll to top of page smoothly
 */
      function scrollToTop() {
         window.scrollTo({
            top: 0,
            behavior: 'smooth'
         });
      }
      
/**
 * Toggle FAQ item
 */
function toggleFAQItem(question) {
   const answer = question.nextElementSibling;
   const faqItem = question.parentElement;
   
   if (!answer) return;
   
   const isOpen = faqItem.classList.contains('open');
   
   // Close all other FAQ items
   const allFAQItems = document.querySelectorAll('.faq-item');
   allFAQItems.forEach(item => {
      if (item !== faqItem) {
         item.classList.remove('open');
         const otherAnswer = item.querySelector('.faq-answer');
         if (otherAnswer) {
            otherAnswer.style.display = 'none';
         }
      }
   });
   
   if (isOpen) {
      // Close this FAQ item
      faqItem.classList.remove('open');
      answer.style.display = 'none';
   } else {
      // Open this FAQ item
      faqItem.classList.add('open');
      answer.style.display = 'block';
   }
}

/**
 * Initialize collapsible sections state
 */
function initializeCollapsibleState() {
   // Close all collapsible content by default
   const collapsibleContents = document.querySelectorAll('.collapsible-content');
   collapsibleContents.forEach(content => {
      content.style.display = 'none';
   });
   
   const subCollapsibleContents = document.querySelectorAll('.sub-collapsible-content');
   subCollapsibleContents.forEach(content => {
      content.style.display = 'none';
   });
   
   const faqAnswers = document.querySelectorAll('.faq-answer');
   faqAnswers.forEach(answer => {
      answer.style.display = 'none';
   });
}

// ==================================================
// ============ SEARCH FUNCTIONALITY ===============
// ==================================================

/**
 * Initialize search functionality
 */
function initializeSearch() {
   const searchInput = document.getElementById('global-search');
   const resultsContainer = document.getElementById('search-results');
   const clearBtn = document.getElementById('clear-search');

   if (!searchInput || !resultsContainer || !clearBtn) return;

   const debouncedSearch = debounce(handleSearch, 300);

   searchInput.addEventListener('input', () => {
       const query = searchInput.value.trim();
       if (query.length > 0) {
           clearBtn.style.display = 'block';
           if (query.length > 2) {
               debouncedSearch();
           }
       } else {
           clearBtn.style.display = 'none';
           resultsContainer.style.display = 'none';
       }
   });

   clearBtn.addEventListener('click', () => {
       searchInput.value = '';
       clearBtn.style.display = 'none';
       resultsContainer.style.display = 'none';
       searchInput.focus();
   });

   document.addEventListener('click', (e) => {
       if (!e.target.closest('.search-container')) {
           resultsContainer.style.display = 'none';
       }
   });
}

function handleSearch() {
    const query = document.getElementById('global-search').value.toLowerCase();
    const resultsContainer = document.getElementById('search-results');
    if (query.length < 3) {
        resultsContainer.style.display = 'none';
        return;
    }

    const results = [];
    const searchableElements = document.querySelectorAll('.collapsible-section, .sub-collapsible');

    searchableElements.forEach(element => {
        const headerEl = element.querySelector('.collapsible-header, .sub-collapsible-header');
        const contentEl = element.querySelector('.collapsible-content, .sub-collapsible-content');

        if (headerEl && contentEl) {
            const headerText = headerEl.innerText;
            const contentText = contentEl.innerText;
            
            if (contentText.toLowerCase().includes(query) || headerText.toLowerCase().includes(query)) {
                const parentSection = element.closest('.collapsible-section');
                // Ensure parent header exists before trying to read innerText
                const parentHeader = parentSection ? parentSection.querySelector('.collapsible-header') : null;
                const parentTitle = parentHeader ? parentHeader.innerText : 'Guide';
                
                // Create a snippet
                const textToSearch = contentText.toLowerCase();
                const queryIndex = textToSearch.indexOf(query);
                const snippetStart = Math.max(0, queryIndex - 70);
                const snippetEnd = Math.min(textToSearch.length, queryIndex + query.length + 70);
                let snippet = contentText.substring(snippetStart, snippetEnd);
                
                if(snippetStart > 0) snippet = "..." + snippet;
                if(snippetEnd < textToSearch.length) snippet = snippet + "...";

                results.push({
                    title: headerText,
                    section: parentTitle,
                    text: snippet,
                    element: element
                });
            }
        }
    });

    displayResults(results, query);
}

function displayResults(results, query) {
    const resultsContainer = document.getElementById('search-results');
    resultsContainer.innerHTML = '';

    if (results.length === 0) {
        resultsContainer.innerHTML = '<div class="result-item"><p>No results found.</p></div>';
        resultsContainer.style.display = 'block';
        return;
    }

    results.forEach(result => {
        const item = document.createElement('div');
        item.className = 'result-item';

        // Escape regex special characters to safely highlight query
        const escapedQuery = escapeRegExp(query);
        const highlightedText = result.text.replace(new RegExp(escapedQuery, 'gi'), (match) => `<mark>${match}</mark>`);
        
        let context = result.title;
        // Avoid redundant titles like "Gameplay Guide -> Gameplay Guide"
        if (result.section && result.section.trim().toLowerCase() !== result.title.trim().toLowerCase()) {
             context = `${result.section} &rarr; ${result.title}`;
        }

        item.innerHTML = `
            <h4>${context}</h4>
            <p>${highlightedText}</p>
        `;

        item.addEventListener('click', () => {
            navigateToResult(result);
        });
        resultsContainer.appendChild(item);
    });

    resultsContainer.style.display = 'block';
}

function navigateToResult(result) {
    const targetElement = result.element;
    const resultsContainer = document.getElementById('search-results');

    // 1. Switch to the correct tab
    const parentTabContent = targetElement.closest('.tab-content');
    if (parentTabContent) {
        const tabId = parentTabContent.id;
        switchToTab(tabId);
    }

    // 2. Open all parent collapsible sections
    let parent = targetElement.parentElement.closest('.collapsible-section, .sub-collapsible');
    while(parent) {
        const header = parent.querySelector('.collapsible-header, .sub-collapsible-header');
        const content = parent.querySelector('.collapsible-content, .sub-collapsible-content');
        if (header && content && content.style.display === 'none') {
            header.click();
        }
        parent = parent.parentElement.closest('.collapsible-section, .sub-collapsible');
    }

    // 3. Open the target element itself if it's a collapsible
    const targetHeader = targetElement.querySelector('.collapsible-header, .sub-collapsible-header');
    const targetContent = targetElement.querySelector('.collapsible-content, .sub-collapsible-content');
    if (targetHeader && targetContent && targetContent.style.display === 'none') {
         targetHeader.click();
    }
    
    // 4. Scroll to the element and highlight
    setTimeout(() => {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetElement.classList.add('search-highlight');
        setTimeout(() => {
            targetElement.classList.remove('search-highlight');
        }, 2500);
    }, 300);

    // 5. Clear search
    resultsContainer.style.display = 'none';
    document.getElementById('global-search').value = '';
    document.getElementById('clear-search').style.display = 'none';
}


// ==================================================
// ============ AI ASSISTANT FUNCTIONALITY ==========
// ==================================================

/**
 * Initialize AI assistant functionality
 */
function initializeAIAssistant() {
         const buildBtn = document.getElementById('generate-build-btn');
         const backstoryBtn = document.getElementById('generate-backstory-btn');
         const buildPrompt = document.getElementById('build-prompt');
         const backstoryPrompt = document.getElementById('backstory-prompt');
         const buildResult = document.getElementById('build-result');
         const backstoryResult = document.getElementById('backstory-result');
         
         // Early return if AI elements don't exist (e.g., removed or on different page)
         if (!buildBtn || !backstoryBtn) {
            console.warn('AI Assistant elements not found - skipping initialization');
            return;
         }
         
         if (buildBtn && buildPrompt && buildResult) {
      buildBtn.addEventListener('click', () => {
               generateCharacterBuild();
            });
         }
         
         if (backstoryBtn && backstoryPrompt && backstoryResult) {
      backstoryBtn.addEventListener('click', () => {
               generateCharacterBackstory();
            });
         }
}
      
/**
 * Generate character build
 */
      function generateCharacterBuild() {
         const prompt = document.getElementById('build-prompt').value.trim();
         const resultBox = document.getElementById('build-result');
         const button = document.getElementById('generate-build-btn');
         
         if (!prompt) {
            resultBox.textContent = "Please enter a playstyle description first.";
            return;
         }
         
         // Show loading state
         button.disabled = true;
         button.innerHTML = '<span class="ai-loading"></span>Generating...';
         resultBox.textContent = "Analyzing your playstyle preferences...";
         
         // Simulate AI generation with realistic delay
         setTimeout(() => {
            const build = generateBuildFromPrompt(prompt);
            resultBox.textContent = build;
            button.disabled = false;
            button.textContent = 'Generate Build';
         }, 2000 + Math.random() * 2000); // 2-4 second delay
      }
      
/**
 * Generate character backstory
 */
      function generateCharacterBackstory() {
         const prompt = document.getElementById('backstory-prompt').value.trim();
         const resultBox = document.getElementById('backstory-result');
         const button = document.getElementById('generate-backstory-btn');
         
         if (!prompt) {
            resultBox.textContent = "Please enter some character keywords first.";
            return;
         }
         
         // Show loading state
         button.disabled = true;
         button.innerHTML = '<span class="ai-loading"></span>Generating...';
         resultBox.textContent = "Crafting your character's story...";
         
         // Simulate AI generation with realistic delay
         setTimeout(() => {
            const backstory = generateBackstoryFromPrompt(prompt);
            resultBox.textContent = backstory;
            button.disabled = false;
            button.textContent = 'Generate Backstory';
         }, 2000 + Math.random() * 2000); // 2-4 second delay
      }
      
/**
 * Generate build from prompt (existing logic)
 */
      function generateBuildFromPrompt(prompt) {
         const builds = {
            sniper: `🎯 SNIPER SPECIALIST BUILD
                     
SPECIAL Distribution (7 points total):
• Perception: 3 (Essential for VATS accuracy and rifle damage)
• Agility: 2 (AP for VATS and stealth)
• Intelligence: 1 (Mod crafting and energy weapons)
• Strength: 0 (Minimal carry weight)
• Endurance: 1 (Survival basics)
• Charisma: 0 (Lone wanderer)
• Luck: 0 (Critical hits and better loot)

Key Perks:
• Rifleman (Perception) - Core damage perk
• Sniper (Perception) - VATS accuracy and range
• Sneak (Agility) - Essential for stealth
• Ninja (Agility) - Massive sneak attack damage
• Concentrated Fire (Perception) - VATS targeting
• Better Criticals (Luck) - Enhanced critical damage

Recommended Weapons:
• Hunting Rifle (early game)
• Gauss Rifle (end game)
• .50 Cal Sniper Rifle
• Plasma Rifle (energy option)

Playstyle Tips:
• Use high ground for better sight lines
• Invest in stealth boys for difficult encounters
• Focus on headshots for maximum damage
• Keep distance from enemies
• Use VATS for guaranteed hits on moving targets`,

            melee: `⚔️ MELEE BRUTE BUILD
                    
SPECIAL Distribution (7 points total):
• Strength: 3 (Maximum melee damage and carry weight)
• Endurance: 2 (Survival and damage resistance)
• Agility: 1 (AP for power attacks and movement)
• Intelligence: 0 (Minimal crafting)
• Perception: 0 (Basic awareness)
• Charisma: 0 (Lone wanderer)
• Luck: 1 (Critical hits and loot)

Key Perks:
• Big Leagues (Strength) - Core melee damage
• Rooted (Strength) - Damage bonus when standing still
• Pain Train (Strength) - Power armor charge attacks
• Iron Fist (Strength) - Unarmed damage (alternative)
• Toughness (Endurance) - Damage resistance
• Life Giver (Endurance) - Extra health

Recommended Weapons:
• Super Sledge (highest damage)
• Baseball Bat (early game)
• Power Fist (unarmed option)
• Deathclaw Gauntlet (unique unarmed)

Playstyle Tips:
• Charge into combat aggressively
• Use power armor for protection
• Focus on strength and endurance
• Use chems for damage boosts
• Target multiple enemies with sweeping attacks`,

            leader: `👑 CHARISMATIC LEADER BUILD
                     
SPECIAL Distribution (7 points total):
• Charisma: 3 (Maximum companion benefits and settlement)
• Intelligence: 2 (Settlement building and crafting)
• Endurance: 1 (Survival basics)
• Agility: 1 (Basic combat)
• Strength: 0 (Carry weight for settlement materials)
• Perception: 0 (Basic awareness)
• Luck: 0 (Minimal investment)

Key Perks:
• Local Leader (Charisma) - Settlement supply lines
• Cap Collector (Charisma) - Better vendor prices
• Inspirational (Charisma) - Companion damage boost
• Party Boy/Girl (Charisma) - Alcohol benefits
• Gun Nut (Intelligence) - Weapon crafting
• Science! (Intelligence) - Advanced crafting

Recommended Weapons:
• Combat Rifle (versatile)
• Laser Rifle (energy option)
• Automatic weapons for companions

Playstyle Tips:
• Focus on settlement building
• Use companions effectively
• Invest in charisma-based dialogue
• Build supply lines between settlements
• Use alcohol for temporary charisma boosts`,

            stealth: `🥷 STEALTH ASSASSIN BUILD
                      
SPECIAL Distribution (7 points total):
• Agility: 3 (Maximum stealth and AP)
• Perception: 2 (Detection and VATS)
• Intelligence: 1 (Crafting and energy weapons)
• Endurance: 1 (Basic survival)
• Strength: 0 (Minimal carry weight)
• Charisma: 0 (Lone wanderer)
• Luck: 0 (Critical hits)

Key Perks:
• Sneak (Agility) - Core stealth ability
• Ninja (Agility) - Massive sneak attack damage
• Mister Sandman (Agility) - Sleeping enemy damage
• Pickpocket (Agility) - Theft and sabotage
• Demolition Expert (Perception) - Explosive traps
• Action Boy/Girl (Agility) - More AP

Recommended Weapons:
• Combat Knife (silent melee)
• Deliverer (silent pistol)
• Suppressed weapons
• Throwing knives
• Explosives for traps

Playstyle Tips:
• Stay hidden at all times
• Use shadows and cover
• Set up traps before combat
• Pickpocket enemies for sabotage
• Focus on one-shot kills`,

            default: `⚖️ BALANCED SURVIVOR BUILD
                      
SPECIAL Distribution (7 points total):
• Strength: 1 (Moderate carry weight)
• Perception: 1 (Good awareness)
• Endurance: 1 (Decent survival)
• Charisma: 1 (Basic social skills)
• Intelligence: 1 (Good crafting)
• Agility: 1 (Moderate stealth and AP)
• Luck: 1 (Balanced loot and crits)

Key Perks:
• Gun Nut (Intelligence) - Weapon crafting
• Armorer (Intelligence) - Armor crafting
• Local Leader (Charisma) - Settlement building
• Lone Wanderer (Charisma) - Solo survival
• Scrapper (Intelligence) - Better materials
• Scrounger (Luck) - More ammo

Recommended Weapons:
• Combat Rifle (versatile)
• Shotgun (close combat)
• Laser weapons (energy option)

Playstyle Tips:
• Adapt to different situations
• Focus on crafting and settlement building
• Use companions when needed
• Balance stealth and direct combat
• Invest in multiple weapon types`
         };
         
         // Analyze prompt and select appropriate build
         const lowerPrompt = prompt.toLowerCase();
         
         if (lowerPrompt.includes('sniper') || lowerPrompt.includes('rifle') || lowerPrompt.includes('long range')) {
            return builds.sniper;
         } else if (lowerPrompt.includes('melee') || lowerPrompt.includes('close') || lowerPrompt.includes('brute') || lowerPrompt.includes('sledge')) {
            return builds.melee;
         } else if (lowerPrompt.includes('charismatic') || lowerPrompt.includes('leader') || lowerPrompt.includes('settlement') || lowerPrompt.includes('build')) {
            return builds.leader;
         } else if (lowerPrompt.includes('stealth') || lowerPrompt.includes('sneak') || lowerPrompt.includes('assassin') || lowerPrompt.includes('silent')) {
            return builds.stealth;
         } else {
            return builds.default;
         }
      }
      
/**
 * Generate backstory from prompt (existing logic)
 */
      function generateBackstoryFromPrompt(prompt) {
         // Create a seed based on prompt + current time for uniqueness
         /* jshint bitwise: false */
         const seed = prompt.toLowerCase().split('').reduce((a, b) => {
            a = ((a << 5) - a) + b.charCodeAt(0);
            return a & a;
         }, Date.now());
         /* jshint bitwise: true */
         
         // Simple seeded random number generator
         function seededRandom(seed) {
            const x = Math.sin(seed) * 10000;
            return x - Math.floor(x);
         }
         
         // Get random element from array using seed
         function getRandomElement(array, seed) {
            const index = Math.floor(seededRandom(seed) * array.length);
            return array[index];
         }
         
         // Character name generators
         const firstNames = ['Alex', 'Jordan', 'Casey', 'Riley', 'Morgan', 'Taylor', 'Avery', 'Quinn', 'Blake', 'Sage', 'River', 'Phoenix', 'Skyler', 'Dakota', 'Cameron'];
         const lastNames = ['Stone', 'Rivers', 'Winters', 'Storm', 'Black', 'Gray', 'Fox', 'Wolf', 'Hawk', 'Reed', 'Banks', 'Cross', 'Frost', 'Moon', 'Star'];
         
         // Background elements
         const preWarJobs = ['engineer', 'teacher', 'soldier', 'nurse', 'mechanic', 'scientist', 'business owner', 'artist', 'musician', 'chef', 'lawyer', 'pilot'];
         const locations = ['Boston', 'Cambridge', 'Lexington', 'Concord', 'Salem', 'Gloucester', 'Marblehead', 'Quincy', 'Newton', 'Brookline'];
         const turningPoints = [
            'witnessed the death of a loved one',
            'discovered a hidden truth about your past',
            'found an old family heirloom',
            'met someone who changed your perspective',
            'survived a near-death experience',
            'made a choice that haunted you',
            'discovered you had a hidden talent',
            'learned something that shattered your worldview'
         ];
         
         const motivations = [
            'seeking redemption for past mistakes',
            'protecting those who cannot protect themselves',
            'finding your place in the world',
            'uncovering the truth about your origins',
            'building something better than what was lost',
            'proving your worth to yourself and others',
            'making amends for a terrible choice',
            'discovering what it means to be human'
         ];
         
         const skills = [
            'expert marksmanship with pistols',
            'exceptional hand-to-hand combat',
            'brilliant tactical mind',
            'natural leadership abilities',
            'incredible survival instincts',
            'masterful lockpicking skills',
            'superior hacking abilities',
            'exceptional charisma and persuasion',
            'advanced medical knowledge',
            'expertise with explosives',
            'superior stealth and infiltration',
            'masterful bartering and negotiation'
         ];
         
         const personalityTraits = [
            'fiercely loyal to those you trust',
            'haunted by past decisions',
            'driven by an unshakeable moral code',
            'struggling with inner demons',
            'possessing an unquenchable thirst for knowledge',
            'burdened by survivor\'s guilt',
            'motivated by a desire to protect the innocent',
            'seeking to prove your worth',
            'driven by a need for justice',
            'possessing an iron will and determination',
            'struggling with trust issues',
            'motivated by a quest for truth'
         ];
         
         const currentGoals = [
            'establishing a safe haven for survivors',
            'hunting down those who wronged you',
            'discovering the fate of your family',
            'building a new community from the ashes',
            'uncovering the secrets of the old world',
            'protecting a specific group of people',
            'seeking revenge against your enemies',
            'finding a cure for radiation sickness',
            'restoring hope to the wasteland',
            'proving that humanity can be better'
         ];
         
         // Generate character details
         const firstName = getRandomElement(firstNames, seed + 1);
         const lastName = getRandomElement(lastNames, seed + 2);
         const preWarJob = getRandomElement(preWarJobs, seed + 3);
         const location = getRandomElement(locations, seed + 4);
         const turningPoint = getRandomElement(turningPoints, seed + 5);
         const motivation = getRandomElement(motivations, seed + 6);
         const skill = getRandomElement(skills, seed + 7);
         const personality = getRandomElement(personalityTraits, seed + 8);
         const goal = getRandomElement(currentGoals, seed + 9);
         
         // Determine character type based on prompt
         const lowerPrompt = prompt.toLowerCase();
         let characterType = 'survivor';
         let emoji = '🌟';
         
         if (lowerPrompt.includes('raider') || lowerPrompt.includes('ex-raider') || lowerPrompt.includes('regretful') || lowerPrompt.includes('redemption') || lowerPrompt.includes('guilt')) {
            characterType = 'redeemed raider';
            emoji = '🔥';
         } else if (lowerPrompt.includes('scientist') || lowerPrompt.includes('smart') || lowerPrompt.includes('scared') || lowerPrompt.includes('avoids') || lowerPrompt.includes('research') || lowerPrompt.includes('intelligent') || lowerPrompt.includes('nerd')) {
            characterType = 'fearful scientist';
            emoji = '🧪';
         } else if (lowerPrompt.includes('vault') || lowerPrompt.includes('dweller') || lowerPrompt.includes('outcast') || lowerPrompt.includes('vault-tec') || lowerPrompt.includes('underground')) {
            characterType = 'vault outcast';
            emoji = '🏠';
         } else if (lowerPrompt.includes('mercenary') || lowerPrompt.includes('hired') || lowerPrompt.includes('professional') || lowerPrompt.includes('contractor') || lowerPrompt.includes('soldier') || lowerPrompt.includes('military')) {
            characterType = 'professional mercenary';
            emoji = '💰';
         }
         
         // Generate unique backstory
         const backstory = `${emoji} THE ${characterType.toUpperCase()}
                      
Before the bombs fell, you were ${firstName} ${lastName}, a ${preWarJob} living in ${location}. Your life was ordinary until the day everything changed. You ${turningPoint}, and that moment has defined everything you've become.

Now, you wander the wasteland ${motivation}. Your ${skill} has kept you alive when others have fallen, but it's your ${personality} that drives you forward through the chaos.

The wasteland has taught you that survival requires more than just strength - it requires purpose. You're currently focused on ${goal}, and every decision you make brings you closer to that goal.

Your past in ${location} feels like a distant dream, but the lessons you learned there still guide you. The person you were before the war is gone, but the core of who you are remains - ${personality}.

The Commonwealth is your home now, and you're determined to make it a better place, one choice at a time.`;

         return backstory;
      }
      
// ==================================================
// ============ SMOOTH SCROLLING ====================
// ==================================================

/**
 * Initialize smooth scrolling for anchor links
 */
function initializeSmoothScrolling() {
   // Handle all anchor links
   document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href^="#"]');
      if (!link) return;
      
      const href = link.getAttribute('href');
      if (href === '#' || href === '#top') {
         e.preventDefault();
         scrollToTop();
                  return;
               }
               
      const targetId = href.substring(1);
      const targetElement = document.getElementById(targetId);
      
      if (targetElement) {
         e.preventDefault();
         targetElement.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
         });
               }
            });
         }

// ==================================================
// ============ KEYBOARD NAVIGATION =================
// ==================================================

/**
 * Initialize keyboard navigation
 */
function initializeKeyboardNavigation() {
   document.addEventListener('keydown', (e) => {
      // Tab navigation with arrow keys
      if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
         e.preventDefault();
         const tabButtons = Array.from(document.querySelectorAll('.tab-button'));
         const activeIndex = tabButtons.findIndex(btn => btn.classList.contains('active'));
         
         if (e.key === 'ArrowLeft' && activeIndex > 0) {
            tabButtons[activeIndex - 1].click();
         } else if (e.key === 'ArrowRight' && activeIndex < tabButtons.length - 1) {
            tabButtons[activeIndex + 1].click();
         }
      }
      
      // Quick search with Ctrl+F
      if (e.ctrlKey && e.key === 'f') {
         e.preventDefault();
         const searchInput = document.getElementById('global-search');
         if (searchInput) {
            searchInput.focus();
         }
      }
      
      // Escape to close search results
      if (e.key === 'Escape') {
         const searchResults = document.getElementById('search-results');
         if (searchResults) searchResults.style.display = 'none';
      }
   });
}

// ==================================================
// ============ PERFORMANCE OPTIMIZATIONS ===========
// ==================================================

/**
 * Initialize performance optimizations
 */
function initializePerformanceOptimizations() {
   // Lazy load images
   if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries, observer) => {
         entries.forEach(entry => {
            if (entry.isIntersecting) {
               const img = entry.target;
               if (img.dataset.src) {
                  img.src = img.dataset.src;
                  img.removeAttribute('data-src');
                  observer.unobserve(img);
               }
            }
         });
      });
      
      document.querySelectorAll('img[data-src]').forEach(img => {
         imageObserver.observe(img);
      });
   }
   
   // Preload critical resources
   const criticalResources = [
      '../src/css/style.css',
      '../src/css/themes.css',
      '../src/css/guide-styles.css'
   ];
   
   criticalResources.forEach(resource => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = resource;
      link.as = 'style';
      document.head.appendChild(link);
   });
}

// ==================================================
// ============ INITIALIZATION ======================
// ==================================================

/**
 * Initialize all guide functionality
 */
function initializeGuide() {
   // Core functionality
   initializeTabNavigation();
   initializeCollapsibleSections();
   initializeSearch();
   initializeSmoothScrolling();
   initializeKeyboardNavigation();
   
   // AI Assistant
   initializeAIAssistant();
   
   // Performance optimizations
   initializePerformanceOptimizations();
   
   // Activate default tab if no hash present
   if (!window.location.hash || window.location.hash === '#') {
      console.log('No hash found, activating default tab: getting-started');
      switchToTab('getting-started');
         } else {
      const hash = window.location.hash.substring(1);
      console.log('Hash found, activating tab:', hash);
      switchToTab(hash);
   }
   
   // Show loading complete
   console.log('Fallout Anomaly Guide initialized successfully');
}

// ==================================================
// ============ DOM CONTENT LOADED ==================
// ==================================================

/**
 * Initialize when DOM is ready
 */
document.addEventListener('DOMContentLoaded', initializeGuide);

// Make functions globally accessible
window.toggleCollapsible = toggleCollapsible;
window.toggleSubCollapsible = toggleSubCollapsible;
window.scrollToTop = scrollToTop;