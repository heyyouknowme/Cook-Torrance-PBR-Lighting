# Cook-Torrance PBR Lighting Demo

A WebGL 2.0 implementation of the Cook-Torrance BRDF (Bidirectional Reflectance Distribution Function) for physically-based rendering with real-time shadows.

## Features

- **Cook-Torrance BRDF Model**: Physically-based rendering with:
  - GGX/Trowbridge-Reitz normal distribution
  - Schlick-Fresnel approximation
  - Smith's geometry function
- **Multiple Light Types**: Point, Directional, Spot, and Area lights
- **Real-time Shadow Mapping**: PCF soft shadows with adjustable bias
- **Material Parameters**:
  - Roughness (α): Surface roughness control
  - Metallic: Dielectric to metal transition
  - Base Color: Albedo/diffuse color
- **Interactive Controls**: Real-time parameter adjustment
- **3D Preview**: Visualize light position in separate viewport
- **Auto-rotation**: Animated object rotation

## Live Demo

Open `index.html` in a modern web browser that supports WebGL 2.0.

Or run a local server:
```bash
python -m http.server 8080
```
Then visit `http://localhost:8080`

## Project Structure

```
Lighting_Web/
├── index.html          # Main HTML structure
├── css/
│   └── styles.css      # UI styling (compact left panel)
├── js/
│   ├── main.js         # Main application logic
│   ├── shaders.js      # GLSL shaders (extensively commented)
│   ├── controls.js     # UI controller
│   ├── geometry.js     # 3D geometry generation (sphere, cube, torus, plane)
│   ├── matrix.js       # Matrix math utilities
│   └── webgl-utils.js  # WebGL helper functions
└── ĐỒ ÁN.pdf          # Project documentation (Vietnamese)
```

## Controls

### Material Properties
- **Roughness (α)**: 0.0 (smooth/glossy) to 1.0 (rough/matte)
- **Metallic**: 0.0 (dielectric) to 1.0 (metal)
- **Base Color**: RGB color picker

### Light Properties
- **Light Type**: Point, Directional, Spot, Area
- **Color**: RGB color picker
- **Intensity**: Light strength multiplier
- **Position**: X, Y, Z coordinates

### Object Options
- **Object Type**: Sphere, Cube, Torus
- **Auto Rotate**: Enable/disable automatic rotation
- **Shadows**: Enable/disable shadow mapping

### Interactive Features
- **Mouse Drag**: Rotate object manually
- **Hover Tooltip**: Shows L, N, V, H vectors and dot products when hovering over surface

## Technical Details

### Cook-Torrance BRDF

The rendering equation implemented:

```
Lo = ∫ (kd * albedo/π + ks * DFG/(4(N·V)(N·L))) * Li * (N·L) dω
```

Where:
- **D**: GGX Normal Distribution Function
- **F**: Fresnel-Schlick approximation
- **G**: Smith's Geometry function with Schlick-GGX
- **kd**: Diffuse coefficient (1 - F) * (1 - metallic)
- **ks**: Specular coefficient (equals F)

### Shadow Mapping
- 2048x2048 depth texture
- Orthographic projection from light's perspective
- 5x5 PCF (Percentage Closer Filtering) for soft shadows
- Adaptive bias based on surface angle

### Light Types
1. **Point Light**: Inverse square falloff (1/d²)
2. **Directional Light**: Parallel rays, no attenuation
3. **Spot Light**: Cone with smooth edge transition
4. **Area Light**: Extended source with area-based attenuation

## Browser Requirements

- WebGL 2.0 support
- Modern browser (Chrome 56+, Firefox 51+, Edge 79+, Safari 15+)

## References

- [Cook-Torrance BRDF](https://en.wikipedia.org/wiki/Specular_highlight#Cook%E2%80%93Torrance_model)
- [PBR Theory (learnopengl.com)](https://learnopengl.com/PBR/Theory)
- [Real Shading in Unreal Engine 4](https://blog.selfshadow.com/publications/s2013-shading-course/karis/s2013_pbr_epic_notes_v2.pdf)

## License

Educational project for Computer Graphics coursework.

## Author

Project created for Computer Graphics course assignment.
