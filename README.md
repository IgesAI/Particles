# Interactive Cosmic Particle System

A stunning, interactive web-based particle system created with Three.js featuring advanced visual effects, audio reactivity, and custom shaders.

![Cosmic Particle System](https://i.imgur.com/YOUR_SCREENSHOT_ID.jpg)

## Features

- Beautifully rendered particles with custom shaders and dynamic animations
- Post-processing effects including bloom and film grain
- Audio reactivity - particles respond to microphone input
- Modern color schemes with professional palettes
- Interactive mouse controls to attract or repel particles
- Adjustable visual parameters (turbulence, bloom, speed)
- Ambient starfield environment
- Responsive design with mobile support

## Live Demo

[View Live Demo](https://your-demo-url.com) *(Replace with your actual demo URL)*

## Usage

1. Clone this repository
2. Run a local web server in the project directory:
   ```
   python -m http.server 8000
   ```
3. Open `http://localhost:8000` in your browser

## Controls

- **Mouse/Touch**: Interact with particles (attract or repel)
- **Left-click and drag**: Rotate the view
- **Right-click and drag**: Pan the view
- **Scroll wheel**: Zoom in/out
- **UI Controls**: Adjust visual parameters, color schemes, and effects

## Color Schemes

The system includes several professionally designed color schemes:
- Cosmic Aurora
- Neon Nights
- Ocean Depths
- Cyberpunk
- Sunset Gradient
- Northern Lights
- Galaxy Core
- Retro Wave

## Technical Details

This project showcases several advanced Three.js techniques:

- Custom GLSL shaders for particle rendering
- EffectComposer for post-processing
- UnrealBloomPass for glow effects
- Audio analysis using Web Audio API
- Dynamic texture generation
- Optimized particle system with buffer attributes
- Responsive sizing and mobile touch support

## Project Structure

The project requires:
- `index.html` - Main HTML with loading screen and styles
- `main.js` - Core application code with Three.js implementation
- `/js/three/three.module.js` - Three.js library
- `/js/three/examples/jsm/controls/OrbitControls.js` - Camera controls
- `/js/three/examples/jsm/postprocessing/` - Post-processing modules

## Credits

- Built with [Three.js](https://threejs.org/)
- Inspired by particle systems in creative coding and digital art

## License

MIT License - Feel free to use and modify for your projects! 