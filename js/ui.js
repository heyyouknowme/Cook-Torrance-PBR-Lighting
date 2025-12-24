/**
 * UI Controls Module
 * 
 * Manages all user interface elements and their event handlers.
 * Connects HTML controls to application state and provides callbacks.
 */

/**
 * Helper function to convert hex color string to RGB array [0-1 range]
 * @param {string} hex - Color in #RRGGBB format
 * @returns {Array<number>} RGB values [r, g, b] in range [0, 1]
 */
function hexToRgb(hex) {
    const cleaned = hex.replace('#', '');
    const r = parseInt(cleaned.slice(0, 2), 16) / 255;
    const g = parseInt(cleaned.slice(2, 4), 16) / 255;
    const b = parseInt(cleaned.slice(4, 6), 16) / 255;
    return [r, g, b];
}

/**
 * UI Manager class
 * Handles all control panel interactions and state updates
 */
export class UIManager {
    constructor() {
        // Get references to all UI elements
        this.elements = {
            // Light controls
            lightType: document.getElementById('lightType'),
            lightColor: document.getElementById('lightColor'),
            lightIntensity: document.getElementById('lightIntensity'),
            lightIntensityVal: document.getElementById('lightIntensity-value'),
            lightX: document.getElementById('lightX'),
            lightY: document.getElementById('lightY'),
            lightZ: document.getElementById('lightZ'),
            lightXVal: document.getElementById('lightX-value'),
            lightYVal: document.getElementById('lightY-value'),
            lightZVal: document.getElementById('lightZ-value'),
            
            // Spotlight controls
            spotAngle: document.getElementById('spotAngle'),
            spotAngleVal: document.getElementById('spotAngle-value'),
            spotSoftness: document.getElementById('spotSoftness'),
            spotSoftnessVal: document.getElementById('spotSoftness-value'),
            spotControls: document.getElementById('spotControls'),
            
            // Area light controls
            areaWidth: document.getElementById('areaWidth'),
            areaWidthVal: document.getElementById('areaWidth-value'),
            areaHeight: document.getElementById('areaHeight'),
            areaHeightVal: document.getElementById('areaHeight-value'),
            areaControls: document.getElementById('areaControls'),
            
            // Material controls
            roughness: document.getElementById('roughness'),
            roughnessVal: document.getElementById('roughness-value'),
            metallic: document.getElementById('metallic'),
            metallicVal: document.getElementById('metallic-value'),
            albedo: document.getElementById('albedo'),
            
            // Object controls
            objectType: document.getElementById('objectType'),
            shadowEnabled: document.getElementById('shadowEnabled'),
        };
        
        // Application state
        this.state = {
            // Material properties
            albedo: [1, 0.42, 0.42],
            roughness: 0.3,
            metallic: 0.5,
            
            // Light properties
            lightColor: [1, 1, 1],
            lightIntensity: 3,
            lightPos: [2, 2, 2],
            lightDir: [0, -1, -1],
            lightType: 0, // 0=point, 1=directional, 2=spot, 3=area
            
            // Spotlight properties
            spotAngle: 0.5,
            spotSoftness: 0.1,
            
            // Area light properties
            areaSize: [1, 1],
            
            // Other
            objectType: 'sphere',
            shadowEnabled: true,
        };
        
        // Callbacks for state changes
        this.onObjectTypeChange = null;
    }
    
    /**
     * Initialize all UI event handlers
     * Sets up sliders, color pickers, and other controls
     */
    initialize() {
        // Helper to setup a range slider with live value display
        const hookRange = (slider, valueLabel, callback, formatter = (v) => v.toFixed(2)) => {
            const update = () => {
                const value = parseFloat(slider.value);
                valueLabel.textContent = formatter(value);
                callback(value);
            };
            slider.addEventListener('input', update);
            update(); // Initialize
        };
        
        // Material property sliders
        hookRange(
            this.elements.roughness,
            this.elements.roughnessVal,
            (v) => this.state.roughness = v
        );
        
        hookRange(
            this.elements.metallic,
            this.elements.metallicVal,
            (v) => this.state.metallic = v
        );
        
        // Light intensity slider
        hookRange(
            this.elements.lightIntensity,
            this.elements.lightIntensityVal,
            (v) => this.state.lightIntensity = v,
            (v) => v.toFixed(1)
        );
        
        // Light position sliders
        hookRange(
            this.elements.lightX,
            this.elements.lightXVal,
            (v) => this.state.lightPos[0] = v,
            (v) => v.toFixed(1)
        );
        
        hookRange(
            this.elements.lightY,
            this.elements.lightYVal,
            (v) => this.state.lightPos[1] = v,
            (v) => v.toFixed(1)
        );
        
        hookRange(
            this.elements.lightZ,
            this.elements.lightZVal,
            (v) => this.state.lightPos[2] = v,
            (v) => v.toFixed(1)
        );
        
        // Spotlight controls
        hookRange(
            this.elements.spotAngle,
            this.elements.spotAngleVal,
            (v) => this.state.spotAngle = v
        );
        
        hookRange(
            this.elements.spotSoftness,
            this.elements.spotSoftnessVal,
            (v) => this.state.spotSoftness = v
        );
        
        // Area light controls
        hookRange(
            this.elements.areaWidth,
            this.elements.areaWidthVal,
            (v) => this.state.areaSize[0] = v,
            (v) => v.toFixed(1)
        );
        
        hookRange(
            this.elements.areaHeight,
            this.elements.areaHeightVal,
            (v) => this.state.areaSize[1] = v,
            (v) => v.toFixed(1)
        );
        
        // Color pickers
        this.elements.albedo.addEventListener('input', () => {
            this.state.albedo = hexToRgb(this.elements.albedo.value);
        });
        
        this.elements.lightColor.addEventListener('input', () => {
            this.state.lightColor = hexToRgb(this.elements.lightColor.value);
        });
        
        // Light type selector
        this.elements.lightType.addEventListener('change', () => {
            this.state.lightType = parseInt(this.elements.lightType.value, 10);
            
            // Show/hide light-specific controls
            this.elements.spotControls.style.display = 
                this.state.lightType === 2 ? 'block' : 'none';
            this.elements.areaControls.style.display = 
                this.state.lightType === 3 ? 'block' : 'none';
        });
        // Trigger initial update
        this.elements.lightType.dispatchEvent(new Event('change'));
        
        // Object type selector
        this.elements.objectType.addEventListener('change', () => {
            this.state.objectType = this.elements.objectType.value;
            if (this.onObjectTypeChange) {
                this.onObjectTypeChange(this.state.objectType);
            }
        });
        
        // Shadow toggle
        this.elements.shadowEnabled.addEventListener('change', () => {
            this.state.shadowEnabled = this.elements.shadowEnabled.checked;
        });
    }
    
    /**
     * Get current application state
     * @returns {Object} Current state object
     */
    getState() {
        return this.state;
    }
}

/**
 * Tooltip Manager for vector visualization
 * Shows BRDF vectors when hovering over the object
 */
export class TooltipManager {
    constructor() {
        // Get tooltip elements
        this.tooltip = document.getElementById('vectorTooltip');
        this.vecText = {
            N: document.getElementById('vecN'),
            L: document.getElementById('vecL'),
            V: document.getElementById('vecV'),
            H: document.getElementById('vecH'),
            NdotL: document.getElementById('vecNdotL'),
            NdotH: document.getElementById('vecNdotH'),
        };
    }
    
    /**
     * Update tooltip with vector information
     * @param {Object} vectors - Object containing N, L, V, H vectors and dot products
     * @param {number} x - Screen x position
     * @param {number} y - Screen y position
     */
    show(vectors, x, y) {
        // Format vector as string
        const formatVec = (v) => 
            `${v[0].toFixed(2)}, ${v[1].toFixed(2)}, ${v[2].toFixed(2)}`;
        
        // Update vector displays
        this.vecText.N.textContent = formatVec(vectors.N);
        this.vecText.L.textContent = formatVec(vectors.L);
        this.vecText.V.textContent = formatVec(vectors.V);
        this.vecText.H.textContent = formatVec(vectors.H);
        this.vecText.NdotL.textContent = vectors.NdotL.toFixed(2);
        this.vecText.NdotH.textContent = vectors.NdotH.toFixed(2);
        
        // Position tooltip near mouse
        this.tooltip.style.display = 'block';
        this.tooltip.style.left = `${x + 12}px`;
        this.tooltip.style.top = `${y + 12}px`;
    }
    
    /**
     * Hide tooltip
     */
    hide() {
        this.tooltip.style.display = 'none';
    }
}
