// ============================================================
// COOK-TORRANCE BRDF VERTEX SHADER
// ============================================================
// Transforms vertices from model space to clip space and
// prepares data for the fragment shader
export const vertexShaderSource = `#version 300 es

// Vertex attributes (per-vertex data)
in vec3 aPosition;  // Vertex position in model space
in vec3 aNormal;    // Vertex normal in model space

// Transformation matrices
uniform mat4 uModelMatrix;       // Model → World space
uniform mat4 uViewMatrix;        // World → Camera space
uniform mat4 uProjectionMatrix;  // Camera → Clip space (perspective)
uniform mat3 uNormalMatrix;      // Normal transformation (inverse-transpose of model)
uniform mat4 uLightSpaceMatrix;  // World → Light space (for shadow mapping)

// Outputs to fragment shader
out vec3 vWorldPosition;  // Position in world space
out vec3 vNormal;         // Normal in world space (interpolated)
out vec4 vLightSpacePos;  // Position in light space (for shadows)

void main() {
    // Transform position to world space
    vec4 worldPosition = uModelMatrix * vec4(aPosition, 1.0);
    vWorldPosition = worldPosition.xyz;
    
    // Transform normal to world space using normal matrix
    // (Normal matrix is needed to handle non-uniform scaling correctly)
    vNormal = normalize(uNormalMatrix * aNormal);
    
    // Transform position to light space for shadow mapping
    vLightSpacePos = uLightSpaceMatrix * worldPosition;
    
    // Final transformation: World → Camera → Clip space
    gl_Position = uProjectionMatrix * uViewMatrix * worldPosition;
}
`;

export const fragmentShaderSource = `#version 300 es
precision highp float;

const float PI = 3.14159265359;

// Inputs from vertex shader
in vec3 vWorldPosition;  // World-space position of fragment
in vec3 vNormal;         // World-space normal vector
in vec4 vLightSpacePos;  // Position in light space for shadow mapping

// Material properties
uniform vec3 uAlbedo;       // Base color (diffuse albedo)
uniform float uRoughness;   // Surface roughness (α): 0 = smooth, 1 = rough
uniform float uMetallic;    // Metallic factor: 0 = dielectric, 1 = metal

// Light properties
uniform int uLightType;          // 0=point, 1=directional, 2=spot, 3=area
uniform vec3 uLightPosition;     // Position of light source
uniform vec3 uLightDirection;    // Direction for directional/spot lights
uniform vec3 uLightColor;        // Color of light
uniform float uLightIntensity;   // Light intensity multiplier
uniform float uSpotAngle;        // Spot light cone angle
uniform float uSpotSoftness;     // Spot light edge softness
uniform vec2 uAreaSize;          // Area light dimensions

uniform vec3 uCameraPosition;    // Camera/eye position

// Shadow mapping
uniform sampler2D uShadowMap;    // Shadow depth map
uniform int uShadowEnabled;      // Enable/disable shadows
uniform float uShadowBias;       // Shadow bias to prevent shadow acne

out vec4 fragColor;

/**
 * Fresnel-Schlick Approximation (F)
 * Computes the Fresnel term - how much light is reflected vs refracted
 * 
 * Step: Calculate reflectance at normal incidence (F0) and
 *       interpolate based on view angle using Schlick's approximation
 * 
 * @param cosTheta - cos(angle between view and half vector) = V·H
 * @param F0 - Reflectance at normal incidence (base reflectivity)
 * @return Fresnel reflectance value (0-1 for each RGB channel)
 */
vec3 fresnelSchlick(float cosTheta, vec3 F0) {
    // Schlick's approximation: F(θ) = F0 + (1 - F0)(1 - cos(θ))^5
    return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

/**
 * GGX/Trowbridge-Reitz Normal Distribution Function (D)
 * Describes distribution of microfacet normals (surface roughness)
 * 
 * Step: Calculate how many microfacets are aligned with half vector H
 *       Higher value = sharper specular highlight
 * 
 * @param N - Surface normal
 * @param H - Half vector between view and light
 * @param roughness - Surface roughness parameter (α)
 * @return Distribution term D(h) - concentration of microfacets
 */
float distributionGGX(vec3 N, vec3 H, float roughness) {
    float a = roughness * roughness;    // α = roughness²
    float a2 = a * a;                    // α²
    float NdotH = max(dot(N, H), 0.0);  // N·H
    float NdotH2 = NdotH * NdotH;       // (N·H)²
    
    // GGX formula: D(h) = α² / (π((N·H)²(α² - 1) + 1)²)
    float denom = (NdotH2 * (a2 - 1.0) + 1.0);
    denom = PI * denom * denom;
    
    return a2 / max(denom, 0.0001);  // Prevent division by zero
}

/**
 * Schlick-GGX Geometry Function (single direction)
 * Approximates microfacet self-shadowing for one direction
 * 
 * @param NdotV - cos(angle between normal and direction) = N·V or N·L
 * @param roughness - Surface roughness
 * @return Geometry attenuation for one direction
 */
float geometrySchlickGGX(float NdotV, float roughness) {
    float r = roughness + 1.0;
    float k = (r * r) / 8.0;  // Remapping for direct lighting
    
    // Schlick-GGX: G1(v) = (N·V) / ((N·V)(1-k) + k)
    return NdotV / (NdotV * (1.0 - k) + k);
}

/**
 * Smith's Geometry Function (G)
 * Combines self-shadowing for both view and light directions
 * 
 * Step: Calculate microfacet shadowing-masking term
 *       Accounts for geometry occlusion from both V and L directions
 * 
 * @param N - Surface normal
 * @param V - View direction
 * @param L - Light direction
 * @param roughness - Surface roughness
 * @return Combined geometry term G(l,v,h)
 */
float geometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {
    float NdotV = max(dot(N, V), 0.0);  // N·V
    float NdotL = max(dot(N, L), 0.0);  // N·L
    
    // Smith's method: G(l,v,h) = G1(v) * G1(l)
    return geometrySchlickGGX(NdotV, roughness) * geometrySchlickGGX(NdotL, roughness);
}

/**
 * Calculate Light Direction and Attenuation
 * Handles different light types: point, directional, spot, and area lights
 * 
 * @param L (out) - Normalized light direction vector
 * @param attenuation (out) - Light attenuation factor based on distance/type
 */
void calculateLight(out vec3 L, out float attenuation) {
    if (uLightType == 0) {
        // Point Light: Radiates equally in all directions from a point
        vec3 lightVec = uLightPosition - vWorldPosition;
        float dist = length(lightVec);
        L = normalize(lightVec);
        attenuation = 1.0 / (dist * dist);  // Inverse square law
    } else if (uLightType == 1) {
        // Directional Light: Parallel rays (like sun)
        L = normalize(-uLightDirection);
        attenuation = 1.0;  // No attenuation - infinite distance
    } else if (uLightType == 2) {
        // Spot Light: Cone of light with soft edges
        vec3 lightVec = uLightPosition - vWorldPosition;
        float dist = length(lightVec);
        L = normalize(lightVec);
        
        // Calculate angle between light direction and surface
        float theta = dot(L, normalize(-uLightDirection));
        float innerCone = cos(uSpotAngle * 0.5);
        float outerCone = cos(uSpotAngle * 0.5 + uSpotSoftness);
        
        // Smooth transition at cone edges
        float spotEffect = smoothstep(outerCone, innerCone, theta);
        attenuation = spotEffect / (dist * dist);
    } else {
        // Area Light: Extended light source (simplified)
        vec3 lightVec = uLightPosition - vWorldPosition;
        float dist = length(lightVec);
        L = normalize(lightVec);
        
        // Modified attenuation accounting for area size
        float area = uAreaSize.x * uAreaSize.y;
        attenuation = area / (dist * dist + area);
    }
}

/**
 * Shadow Mapping with PCF (Percentage Closer Filtering)
 * Determines if fragment is in shadow by comparing depth values
 * 
 * @param lightSpacePos - Fragment position in light's coordinate space
 * @param N - Surface normal
 * @param L - Light direction
 * @return Shadow factor: 1.0 = fully lit, 0.0 = fully shadowed
 */
float calculateShadow(vec4 lightSpacePos, vec3 N, vec3 L) {
    if (uShadowEnabled == 0) return 1.0;  // Shadows disabled
    
    // Step 1: Convert to NDC (Normalized Device Coordinates)
    vec3 projCoords = lightSpacePos.xyz / lightSpacePos.w;  // Perspective divide
    projCoords = projCoords * 0.5 + 0.5;  // Transform from [-1,1] to [0,1]
    
    // Step 2: Check if fragment is outside shadow map bounds
    if (projCoords.z > 1.0 || projCoords.x < 0.0 || projCoords.x > 1.0 || 
        projCoords.y < 0.0 || projCoords.y > 1.0) {
        return 1.0;  // Outside shadow map = no shadow
    }
    
    float currentDepth = projCoords.z;
    
    // Step 3: Apply bias to prevent "shadow acne"
    // Bias varies with surface angle relative to light
    float bias = max(uShadowBias * (1.0 - dot(N, L)), uShadowBias * 0.1);
    
    // Step 4: PCF - Sample multiple texels for soft shadows
    float shadow = 0.0;
    vec2 texelSize = 1.0 / vec2(textureSize(uShadowMap, 0));
    
    // 5x5 kernel sampling
    for (int x = -2; x <= 2; ++x) {
        for (int y = -2; y <= 2; ++y) {
            float pcfDepth = texture(uShadowMap, projCoords.xy + vec2(x, y) * texelSize).r;
            shadow += currentDepth - bias > pcfDepth ? 0.0 : 1.0;
        }
    }
    
    return shadow / 25.0;  // Average of 25 samples
}

/**
 * MAIN FRAGMENT SHADER - Cook-Torrance BRDF Implementation
 * 
 * Physically-Based Rendering using the Cook-Torrance microfacet model:
 * 
 * Rendering Equation:
 * Lo = ∫ (kd * albedo/π + ks * DFG/(4(N·V)(N·L))) * Li * (N·L) dω
 * 
 * Where:
 * - kd = diffuse coefficient (1 - ks) * (1 - metallic)
 * - ks = specular coefficient (Fresnel F)
 * - D = Normal Distribution Function (GGX)
 * - F = Fresnel term (Schlick approximation)
 * - G = Geometry function (Smith's method)
 * - Li = Incoming light radiance
 * - N·L = Lambert's cosine law
 */
void main() {
    // ==================== STEP 1: Setup Vectors ====================
    // Calculate essential vectors for lighting
    vec3 N = normalize(vNormal);                          // Surface normal (N)
    vec3 V = normalize(uCameraPosition - vWorldPosition); // View direction (V)
    
    // Get light direction and attenuation from light source
    vec3 L;              // Light direction (L)
    float attenuation;   // Light attenuation factor
    calculateLight(L, attenuation);
    
    // Calculate half-vector (H) - halfway between V and L
    // Used for specular reflection calculations
    vec3 H = normalize(V + L);  // H = normalize(V + L)
    
    // Calculate incoming radiance (Li)
    vec3 radiance = uLightColor * uLightIntensity * attenuation;
    
    // ==================== STEP 2: Calculate F0 ====================
    // F0 = Surface reflectance at normal incidence (0° angle)
    // Dielectrics (non-metals): ~0.04 (4% reflectance)
    // Metals: Use albedo color as F0
    vec3 F0 = vec3(0.04);                      // Base reflectance for dielectrics
    F0 = mix(F0, uAlbedo, uMetallic);          // Interpolate based on metallic
    
    // ==================== STEP 3: Cook-Torrance BRDF Terms ====================
    // Calculate the three core BRDF functions:
    
    // D - Normal Distribution Function (GGX/Trowbridge-Reitz)
    // Controls the size and shape of specular highlights
    float D = distributionGGX(N, H, uRoughness);
    
    // G - Geometry Function (Smith's method with Schlick-GGX)
    // Accounts for microfacet shadowing and masking
    float G = geometrySmith(N, V, L, uRoughness);
    
    // F - Fresnel Term (Schlick's approximation)
    // Determines reflection vs refraction based on view angle
    vec3 F = fresnelSchlick(max(dot(H, V), 0.0), F0);
    
    // ==================== STEP 4: Calculate Dot Products ====================
    float NdotV = max(dot(N, V), 0.0);  // N·V - View angle
    float NdotL = max(dot(N, L), 0.0);  // N·L - Lambert's cosine law
    
    // ==================== STEP 5: Cook-Torrance Specular BRDF ====================
    // Specular BRDF = (D * F * G) / (4 * (N·V) * (N·L))
    vec3 specular = (D * G * F) / (4.0 * NdotV * NdotL + 0.0001);
    
    // ==================== STEP 6: Energy Conservation ====================
    // kS = Specular reflection (equals Fresnel F)
    vec3 kS = F;
    
    // kD = Diffuse reflection (what's left after specular)
    // For metals, kD = 0 (no diffuse reflection)
    vec3 kD = (vec3(1.0) - kS) * (1.0 - uMetallic);
    
    // ==================== STEP 7: Lambert Diffuse BRDF ====================
    // Diffuse BRDF = albedo / π (Lambertian reflectance)
    vec3 diffuse = kD * uAlbedo / PI;
    
    // ==================== STEP 8: Apply Shadows ====================
    // Calculate shadow factor (0 = full shadow, 1 = no shadow)
    float shadow = calculateShadow(vLightSpacePos, N, L);
    
    // ==================== STEP 9: Combine BRDF Components ====================
    // Outgoing radiance: Lo = (diffuse + specular) * Li * (N·L) * shadow
    vec3 Lo = (diffuse + specular) * radiance * NdotL * shadow;
    
    // ==================== STEP 10: Ambient Lighting ====================
    // Add ambient term to prevent completely black shadows
    vec3 ambient = vec3(0.03) * uAlbedo;  // Base ambient (3%)
    
    // Enhanced ambient for metallic surfaces (simulates environment reflection)
    vec3 envReflect = F0 * 0.15 * (1.0 - uRoughness);
    ambient += envReflect * uMetallic;
    
    // ==================== STEP 11: Final Color ====================
    // Combine direct lighting and ambient
    vec3 color = ambient + Lo;
    
    // ==================== STEP 12: Tone Mapping ====================
    // Reinhard tone mapping: maps HDR to LDR [0,1]
    color = color / (color + vec3(1.0));
    
    // ==================== STEP 13: Gamma Correction ====================
    // Convert from linear to sRGB color space (γ = 2.2)
    color = pow(color, vec3(1.0 / 2.2));
    
    fragColor = vec4(color, 1.0);
}
`;

// ============================================================
// SHADOW MAP DEPTH SHADER
// ============================================================
// Renders the scene from the light's perspective to generate
// a depth map used for shadow mapping

// Shadow Map Vertex Shader
// Transforms vertices to light space and outputs depth
export const shadowVertexShader = `#version 300 es
in vec3 aPosition;  // Vertex position in model space

// Transformation matrices
uniform mat4 uModelMatrix;       // Model → World space
uniform mat4 uLightSpaceMatrix;  // World → Light space (orthographic or perspective)

void main() {
    // Transform vertex directly to light's clip space
    // Depth is automatically written to the depth buffer
    gl_Position = uLightSpaceMatrix * uModelMatrix * vec4(aPosition, 1.0);
}
`;

// Shadow Map Fragment Shader
// Minimal fragment shader - depth is written automatically
export const shadowFragmentShader = `#version 300 es
precision highp float;

out vec4 fragColor;

void main() {
    // Fragment depth is automatically written to GL_DEPTH_ATTACHMENT
    // This dummy output is required but not used
    fragColor = vec4(1.0);
}
`;

// ============================================================
// LIGHT PREVIEW SHADERS
// ============================================================
// Simple shaders for rendering the light position visualization
// in the preview window (top-right corner)

// Preview Vertex Shader
export const previewVertexShader = `#version 300 es
in vec3 aPosition;  // Vertex position
in vec3 aNormal;    // Vertex normal

uniform mat4 uModelMatrix;       // Model transformation
uniform mat4 uViewMatrix;        // View transformation
uniform mat4 uProjectionMatrix;  // Projection transformation

out vec3 vNormal;  // Pass normal to fragment shader

void main() {
    vNormal = aNormal;
    gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aPosition, 1.0);
}
`;

// Preview Fragment Shader
// Simple lighting for preview spheres (object and light)
export const previewFragmentShader = `#version 300 es
precision highp float;

in vec3 vNormal;          // Interpolated normal
uniform vec3 uColor;      // Base color
uniform float uEmissive;  // Emissive factor (1.0 for light, 0.0 for object)

out vec4 fragColor;

void main() {
    // Simple diffuse lighting
    vec3 N = normalize(vNormal);
    vec3 L = normalize(vec3(1.0, 1.0, 1.0));  // Fixed light direction
    float diff = max(dot(N, L), 0.0) * 0.5 + 0.5;  // Half-Lambert
    
    // Mix between lit and emissive based on uEmissive
    vec3 color = uColor * mix(diff, 1.0, uEmissive);
    fragColor = vec4(color, 1.0);
}
`;

export function getUniformNames() {
    return [
        'uModelMatrix',
        'uViewMatrix',
        'uProjectionMatrix',
        'uNormalMatrix',
        'uAlbedo',
        'uRoughness',
        'uMetallic',
        'uLightType',
        'uLightPosition',
        'uLightDirection',
        'uLightColor',
        'uLightIntensity',
        'uSpotAngle',
        'uSpotSoftness',
        'uAreaSize',
        'uCameraPosition'
    ];
}

export function getAttributeNames() {
    return ['aPosition', 'aNormal'];
}

