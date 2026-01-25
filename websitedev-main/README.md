# Fallout Anomaly Website

A modern, responsive website for the Fallout Anomaly project, featuring a retro-futuristic terminal-style interface with CRT effects and dynamic content loading.

## Features

- **Terminal-Style Interface**: Retro-futuristic design inspired by Fallout's Pip-Boy interface
- **Dynamic Content Loading**: Smooth transitions and dynamic content updates
- **Responsive Design**: Works on desktop and mobile devices
- **Visual Effects**: 
  - CRT screen effect
  - Scan lines
  - Terminal text animations
  - Dynamic boot messages
- **FX Toggle**: Option to disable visual effects for better performance
- **Modular Structure**: Easy to maintain and extend

## Project Structure

```
websitedev/
├── src/
│   ├── components/
│   ├── css/
│   ├── data/
│   ├── img/
│   └── js/
├── pages/
│   ├── about.html
│   ├── apply.html
│   ├── donate.html
│   ├── guide.html
│   └── staff.html
├── images/
├── index.html
├── README.md
├── .gitignore
└── .nojekyll
```

### Key Files and Directories

- `src/components/`: Reusable HTML components
- `src/css/`: Stylesheets
- `src/data/`: Data files and resources
- `src/img/`: Image files used by components
- `src/js/`: JavaScript files
- `pages/`: Individual page content
  - `about.html`: Project information and features
  - `apply.html`: Team application process
  - `donate.html`: Support options
  - `guide.html`: Installation and setup guide
  - `staff.html`: Team information
- `images/`: Additional image resources and screenshots
- `index.html`: Main landing page
- `.gitignore`: Git ignore file for version control
- `.nojekyll`: Jekyll configuration for GitHub Pages

## Getting Started

1. Clone the repository
2. Open `index.html` in a web browser
3. Navigate through the site using the terminal-style interface

## Browser Support

- Chrome (recommended)
- Firefox
- Edge
- Safari

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## Customization

The website can be customized by modifying the CSS variables in `src/css/style.css`:

```css
:root {
  --terminal-bg: #0a0a0a;
  --terminal-text: #00ff00;
  --terminal-highlight: #00ff00;
  --terminal-border: #00ff00;
  /* ... other variables ... */
}
```

## Quick Start

1. Clone the repository
2. Open any HTML file in your browser
3. That's it! No build process required

## Making Changes

### Global Components

The website uses modular components for consistent navigation and footer across all pages. To modify these components:
1. Edit the respective file in the `components` folder
2. Changes will automatically apply to all pages

### Customizing Styles

The main stylesheet (`src/css/style.css`) uses CSS variables for easy customization. Key sections to modify:

1. **Colors**: Edit the `:root` section variables
2. **Fonts**: Change fonts by updating the font variables
3. **Spacing**: Adjust spacing variables for consistent layout

### Adding New Pages

1. Create a new HTML file in the `pages` folder
2. Copy the basic structure from an existing page
3. Include the necessary components and scripts

### Responsive Design

The website is responsive with breakpoints at:
- 1024px (Tablets)
- 768px (Mobile)
- 480px (Small mobile)

To modify responsive behavior, edit the media queries in `style.css`.

## Best Practices

1. **Testing Changes**
   - Use browser developer tools to test changes
   - Check all breakpoints for responsive design
   - Test in multiple browsers

2. **Maintaining Consistency**
   - Use CSS variables for colors and spacing
   - Follow the existing component structure
   - Keep the terminal theme consistent

3. **Performance**
   - Optimize images before adding them
   - Minimize custom JavaScript
   - Use the existing CSS classes

## Troubleshooting

Common issues and solutions:

1. **Navigation/Footer Not Loading**
   - Check file paths in the fetch calls
   - Ensure you're using a local server (some browsers block file:// protocol)

2. **Styles Not Applying**
   - Verify CSS variable names
   - Check for typos in class names
   - Clear browser cache

3. **Responsive Issues**
   - Check media query breakpoints
   - Verify viewport meta tag
   - Test in different browsers

## Support

For additional help or questions:
- Check the CSS comments for detailed explanations
- Review the component structure
- Contact the development team

## Credits

- **PatrickJr** - Project creator and lead developer
  - Website design and implementation
  - Terminal theme development
  - Component architecture
