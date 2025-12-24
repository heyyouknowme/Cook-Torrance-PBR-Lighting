/**
 * WebGL Shader Module
 * 
 * Contains vertex and fragment shaders for the Cook-Torrance BRDF lighting model.
 * The implementation follows physically-based rendering (PBR) principles using:
 * - GGX/Trowbridge-Reitz normal distribution (D term)
 * - Smith's masking-shadowing function (G term)
 * - Fresnel-Schlick approximation (F term)
 */

/**
 * Vertex Shader (Shared)
 * 
 * Transforms vertices from model space to clip space and prepares data for fragment shader.
 * Supports both normal rendering and shadow projection onto a plane.
 * 
 * Inputs:
 * - aPos: Vertex position in model space
 * - aNormal: Surface normal in model space
 * - aUV: Texture coordinates
 * 
 * Outputs:
 * - vWorldPos: Position in world space (for lighting calculations)
 * - vNormal: Normal in world space (transformed by normal matrix)
 * - vUV: Texture coordinates (pass-through)
 */
export const vertexShader = `#version 300 es
precision highp float;

// Vertex attributes
layout(location = 0) in vec3 aPos;      // Position
layout(location = 1) in vec3 aNormal;   // Normal vector
layout(location = 2) in vec2 aUV;       // Texture coordinates

// Transformation matrices
uniform mat4 uModel;       // Model matrix (model → world space)
uniform mat4 uView;        // View matrix (world → camera space)
uniform mat4 uProj;        // Projection matrix (camera → clip space)
uniform mat4 uShadowMat;   // Shadow projection matrix (projects onto floor plane)
uniform bool uUseShadowMat; // Whether to apply shadow projection
uniform mat3 uNormalMat;   // Normal matrix (inverse-transpose of model matrix)

// Output to fragment shader
out vec3 vWorldPos;  // World-space position
out vec3 vNormal;    // World-space normal
out vec2 vUV;        // Texture coordinates

void main() {
    // Transform vertex to world space first
    vec4 worldPos = uModel * vec4(aPos, 1.0);
    
    // If rendering shadow, project onto floor plane
    if (uUseShadowMat) {
        worldPos = uShadowMat * worldPos;
    }
    
    vWorldPos = worldPos.xyz;
    vNormal = normalize(uNormalMat * aNormal); // Transform normal to world space
    vUV = aUV;
    
    // Final transformation to clip space
    gl_Position = uProj * uView * worldPos;
}
`;

/**
 * Fragment Shader - Cook-Torrance BRDF
 * 
 * Implements physically-based rendering using the Cook-Torrance microfacet BRDF model.
 * 
 * BRDF Formula:
 * f(l,v) = kD * (albedo / π) + kS * (D * G * F) / (4 * (n·l) * (n·v))
 * 
 * Where:
 * - kD: Diffuse coefficient (energy not reflected specularly)
 * - kS: Specular coefficient (equals Fresnel term F)
 * - D: Normal Distribution Function (microfacet distribution)
 * - G: Geometry function (shadowing and masking)
 * - F: Fresnel term (reflection at different angles)
 * - n: Surface normal, l: Light direction, v: View direction
 */
export const fragmentShader = `#version 300 es
precision highp float;

// Input from vertex shader
in vec3 vWorldPos;  // Fragment position in world space
in vec3 vNormal;    // Interpolated normal
in vec2 vUV;        // Texture coordinates

// Output color
out vec4 fragColor;

// Camera
uniform vec3 uCameraPos;  // Camera position for view direction calculation

// Material properties (PBR parameters)
uniform vec3 uAlbedo;       // Base color (diffuse reflectance)
uniform float uMetallic;    // Metalness [0=dielectric, 1=metal]
uniform float uRoughness;   // Surface roughness [0=smooth, 1=rough]

// Light properties
uniform int uLightType;         // 0=point, 1=directional, 2=spot, 3=area
uniform vec3 uLightPos;         // Light position (world space)
uniform vec3 uLightDir;         // Light direction (for directional/spot)
uniform vec3 uLightColor;       // Light color (RGB)
uniform float uLightIntensity;  // Light intensity multiplier
uniform float uSpotAngle;       // Spotlight cone angle (cosine)
uniform float uSpotSoftness;    // Spotlight edge softness
uniform vec2 uAreaSize;         // Area light dimensions
uniform float uShadowBlend;     // Shadow darkness [0=no shadow, 1=full shadow]

/**
 * Normal Distribution Function (D) - GGX / Trowbridge-Reitz
 * 
 * Describes the distribution of microfacet normals.
 * Higher values when more microfacets align with the half vector H.
 * 
 * Formula: D = α² / (π * ((n·h)² * (α² - 1) + 1)²)
 * 
 * @param NdotH - Dot product of normal and half vector
 * @param alpha - Roughness squared (α = roughness²)
 * @return Distribution value
 */
float D_GGX(float NdotH, float alpha) {
    float a2 = alpha * alpha;
    float denom = (NdotH * NdotH) * (a2 - 1.0) + 1.0;
    denom = 3.14159265 * denom * denom;
    return a2 / max(0.0001, denom); // Avoid division by zero
}

/**
 * Geometry Function (G) - Smith's method with Schlick-GGX
 * 
 * Accounts for microfacet shadowing and masking.
 * Combines view direction and light direction contributions.
 * 
 * Schlick-GGX: G₁(v) = (n·v) / ((n·v) * (1 - k) + k)
 * Smith's method: G = G₁(l) * G₁(v)
 * 
 * @param NdotV - Dot product of normal and view direction
 * @param NdotL - Dot product of normal and light direction
 * @param roughness - Surface roughness parameter
 * @return Geometry occlusion factor
 */
float G_SchlickGGX(float NdotV, float k) {
    return NdotV / (NdotV * (1.0 - k) + k);
}

float G_Smith(float NdotV, float NdotL, float roughness) {
    // Remapping for direct lighting (k = (roughness + 1)² / 8)
    float r = roughness + 1.0;
    float k = (r * r) / 8.0;
    return G_SchlickGGX(NdotV, k) * G_SchlickGGX(NdotL, k);
}

/**
 * Fresnel Equation - Schlick's Approximation
 * 
 * Describes how light reflects at different angles.
 * At grazing angles, all surfaces become more reflective.
 * 
 * Formula: F = F₀ + (1 - F₀) * (1 - cos(θ))⁵
 * 
 * @param cosTheta - Dot product of view direction and half vector
 * @param F0 - Base reflectance (at normal incidence)
 * @return Fresnel reflectance
 */
vec3 fresnelSchlick(float cosTheta, vec3 F0) {
    return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
}

/**
 * Evaluate Cook-Torrance BRDF for a single light sample
 * 
 * Combines diffuse (Lambert) and specular (Cook-Torrance) components.
 * 
 * @param N - Surface normal
 * @param V - View direction (to camera)
 * @param L - Light direction (to light)
 * @param radiance - Incoming light energy
 * @return Outgoing light energy (reflected color)
 */
vec3 evaluateBRDF(vec3 N, vec3 V, vec3 L, vec3 radiance) {
    vec3 H = normalize(V + L); // Half vector between view and light
    
    // Calculate dot products (clamped to [0,1] for lighting)
    float NdotL = clamp(dot(N, L), 0.0, 1.0);
    float NdotV = clamp(dot(N, V), 0.0, 1.0);
    float NdotH = clamp(dot(N, H), 0.0, 1.0);
    float VdotH = clamp(dot(V, H), 0.0, 1.0);

    // Calculate Cook-Torrance BRDF terms
    float alpha = max(0.001, uRoughness * uRoughness); // Squared roughness
    float D = D_GGX(NdotH, alpha);                     // Normal distribution
    float G = G_Smith(NdotV, NdotL, alpha);            // Geometry term

    // Fresnel reflectance at normal incidence (F0)
    // Dielectrics: ~0.04 (4% reflectance)
    // Metals: use albedo color as F0
    vec3 F0 = mix(vec3(0.04), uAlbedo, uMetallic);
    vec3 F = fresnelSchlick(VdotH, F0);                // Fresnel term

    // Specular component: (D * G * F) / (4 * NdotL * NdotV)
    vec3 numerator = D * G * F;
    float denom = max(0.001, 4.0 * NdotV * NdotL);
    vec3 specular = numerator / denom;

    // Energy conservation: kS + kD = 1
    vec3 kS = F;                          // Specular reflection coefficient
    vec3 kD = (vec3(1.0) - kS) * (1.0 - uMetallic); // Diffuse (metals have no diffuse)

    // Lambertian diffuse: albedo / π
    vec3 diffuse = kD * uAlbedo / 3.14159265;

    // Combine diffuse and specular, multiply by radiance and angle
    return (diffuse + specular) * radiance * NdotL;
}

/**
 * Calculate spotlight attenuation with smooth falloff
 * 
 * @param L - Light direction
 * @param dir - Spotlight direction
 * @return Attenuation factor [0, 1]
 */
float spotAttenuation(vec3 L, vec3 dir) {
    float cosTheta = dot(normalize(-dir), L);
    float edge = uSpotAngle;
    float softness = uSpotSoftness;
    // Smooth transition from full intensity to zero
    return smoothstep(edge, edge + softness, cosTheta);
}

/**
 * Build orthonormal basis from a direction vector
 * Used for area light sampling
 * 
 * @param n - Input direction (will be one basis vector)
 * @param t - Output tangent vector
 * @param b - Output bitangent vector
 */
void basisFromDir(vec3 n, out vec3 t, out vec3 b) {
    // Choose a vector not parallel to n
    vec3 up = abs(n.y) < 0.999 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    t = normalize(cross(up, n));
    b = cross(n, t);
}

/**
 * Compute lighting for all light types
 * 
 * Handles point, directional, spot, and area lights.
 * Calculates light direction, attenuation, and evaluates BRDF.
 * 
 * @param N - Surface normal
 * @param V - View direction
 * @return Lit color
 */
vec3 computeLighting(vec3 N, vec3 V) {
    vec3 result = vec3(0.0);
    vec3 L;
    float attenuation = 1.0;

    if (uLightType == 0) {
        // Point light: inverse-square falloff
        vec3 lightVec = uLightPos - vWorldPos;
        float dist = max(0.001, length(lightVec));
        L = lightVec / dist;
        attenuation = 1.0 / (dist * dist);
        result += evaluateBRDF(N, V, L, uLightColor * uLightIntensity * attenuation);
        
    } else if (uLightType == 1) {
        // Directional light: no attenuation (sun-like)
        L = normalize(-uLightDir);
        result += evaluateBRDF(N, V, L, uLightColor * uLightIntensity);
        
    } else if (uLightType == 2) {
        // Spot light: cone with smooth edges + inverse-square falloff
        vec3 lightVec = uLightPos - vWorldPos;
        float dist = max(0.001, length(lightVec));
        L = lightVec / dist;
        attenuation = spotAttenuation(L, uLightDir) * (1.0 / (dist * dist));
        result += evaluateBRDF(N, V, L, uLightColor * uLightIntensity * attenuation);
        
    } else {
        // Area light: rectangular light with very dense sampling (8x8 grid = 64 samples)
        // Every point on the rectangular surface emits light
        vec3 t, b;
        basisFromDir(normalize(-uLightDir), t, b);
        vec2 halfSize = uAreaSize * 0.5;
        
        // Sample an 8x8 grid for very smooth, continuous lighting from entire surface
        const int gridSize = 8;
        for (int ix = 0; ix < gridSize; ++ix) {
            for (int iy = 0; iy < gridSize; ++iy) {
                // Calculate normalized position on grid [-1, 1]
                // Spread samples evenly across the entire rectangle
                float u = (float(ix) / float(gridSize - 1)) * 2.0 - 1.0; // -1 to +1
                float v = (float(iy) / float(gridSize - 1)) * 2.0 - 1.0; // -1 to +1
                
                // Position on the rectangular light surface
                vec3 samplePos = uLightPos + (u * halfSize.x) * t + (v * halfSize.y) * b;
                vec3 lightVec = samplePos - vWorldPos;
                float dist = max(0.001, length(lightVec));
                L = lightVec / dist;
                
                // Weight by light direction (area lights emit in one direction)
                // Using light normal direction for proper one-sided emission
                vec3 lightNormal = normalize(-uLightDir);
                float cosTheta = dot(lightNormal, -L); // Negative L because we want light-to-surface
                
                // Only accept light from the front side of the area light
                if (cosTheta > 0.0) {
                    attenuation = cosTheta / (dist * dist);
                    result += evaluateBRDF(N, V, L, uLightColor * uLightIntensity * attenuation);
                }
            }
        }
        
        // Average all 64 samples for smooth continuous lighting
        result /= float(gridSize * gridSize);
    }

    // Add small ambient term to prevent completely black surfaces
    vec3 ambient = 0.03 * uAlbedo;
    return ambient + result;
}

void main() {
    vec3 N = normalize(vNormal);                    // Surface normal
    vec3 V = normalize(uCameraPos - vWorldPos);     // View direction
    
    // Compute lighting
    vec3 color = computeLighting(N, V);
    
    // Apply shadow darkening
    color = mix(color, color * (1.0 - uShadowBlend), uShadowBlend);
    
    fragColor = vec4(color, 1.0);
}
`;

/**
 * Fragment Shader - Emissive (Unlit)
 * Used for drawing helper geometry like the light source indicator
 */
export const emissiveFragmentShader = `#version 300 es
precision highp float;

in vec3 vWorldPos; // Unused but kept for interface compatibility
in vec3 vNormal;
in vec2 vUV;

uniform vec3 uColor; // Final color

out vec4 fragColor;

void main() {
    fragColor = vec4(uColor, 1.0);
}
`;

/**
 * Shadow Fragment Shader
 * 
 * Soft shadow shader with distance-based opacity falloff.
 * Creates realistic soft edges by calculating distance from shadow center.
 * Used with shadow projection matrix to project object silhouette onto floor.
 */
export const shadowFragmentShader = `#version 300 es
precision highp float;

in vec3 vWorldPos;  // World position of shadow pixel
in vec3 vNormal;
in vec2 vUV;

out vec4 fragColor;

uniform float uAlpha;        // Base shadow opacity
uniform vec3 uShadowCenter;  // Center of shadow in world space
uniform float uShadowRadius; // Radius for soft edge falloff

void main() {
    // Calculate distance from shadow center
    vec2 shadowPos = vWorldPos.xz;  // Use XZ plane (horizontal)
    vec2 centerPos = uShadowCenter.xz;
    float dist = length(shadowPos - centerPos);
    
    // Soft falloff using smoothstep for smooth edges
    // Inner radius: full opacity, outer radius: fade to transparent
    float innerRadius = uShadowRadius * 0.5;
    float outerRadius = uShadowRadius;
    float edgeFalloff = 1.0 - smoothstep(innerRadius, outerRadius, dist);
    
    // Apply falloff to base alpha
    float finalAlpha = uAlpha * edgeFalloff;
    
    // Output semi-transparent black with soft edges
    fragColor = vec4(0.0, 0.0, 0.0, finalAlpha);
}
`;

/**
 * Compile a shader from source code
 * 
 * @param {WebGL2RenderingContext} gl - WebGL context
 * @param {number} type - Shader type (gl.VERTEX_SHADER or gl.FRAGMENT_SHADER)
 * @param {string} source - GLSL source code
 * @returns {WebGLShader} Compiled shader
 * @throws {Error} If compilation fails
 */
export function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    
    // Check for compilation errors
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(`Shader compilation failed: ${log}`);
    }
    
    return shader;
}

/**
 * Create a shader program from vertex and fragment shader source
 * 
 * @param {WebGL2RenderingContext} gl - WebGL context
 * @param {string} vertexSource - Vertex shader GLSL source
 * @param {string} fragmentSource - Fragment shader GLSL source
 * @returns {WebGLProgram} Linked shader program
 * @throws {Error} If linking fails
 */
export function createProgram(gl, vertexSource, fragmentSource) {
    const vertexShaderObj = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragmentShaderObj = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    
    const program = gl.createProgram();
    gl.attachShader(program, vertexShaderObj);
    gl.attachShader(program, fragmentShaderObj);
    gl.linkProgram(program);
    
    // Check for linking errors
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const log = gl.getProgramInfoLog(program);
        gl.deleteProgram(program);
        throw new Error(`Program linking failed: ${log}`);
    }
    
    // Clean up shaders (they're now part of the program)
    gl.deleteShader(vertexShaderObj);
    gl.deleteShader(fragmentShaderObj);
    
    return program;
}
