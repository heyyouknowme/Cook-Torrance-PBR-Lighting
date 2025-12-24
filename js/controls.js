// UI Controls Module for Cook-Torrance Demo

export const defaultParams = {
    roughness: 0.3,
    metallic: 0.5,
    albedo: '#ff6b6b',
    lightType: 0,
    lightColor: '#ffffff',
    lightIntensity: 3.0,
    lightX: 2.0,
    lightY: 2.0,
    lightZ: 2.0,
    spotAngle: 0.5,
    spotSoftness: 0.1,
    areaWidth: 1.0,
    areaHeight: 1.0,
    objectType: 'sphere',
    autoRotate: true,
    shadowEnabled: true
};

export class UIController {
    constructor(onParamChange, onObjectChange) {
        this.onParamChange = onParamChange;
        this.onObjectChange = onObjectChange;
        this.params = { ...defaultParams };
        
        this.initLightTypeSelector();
        this.initSliders();
        this.initColorPickers();
        this.initObjectSelector();
        this.initCheckboxes();
    }
    
    initLightTypeSelector() {
        const selector = document.getElementById('lightType');
        const spotControls = document.getElementById('spotControls');
        const areaControls = document.getElementById('areaControls');
        
        if (selector) {
            selector.value = this.params.lightType;
            selector.addEventListener('change', (e) => {
                this.params.lightType = parseInt(e.target.value);
                
                // Show/hide light-specific controls
                if (spotControls) spotControls.style.display = this.params.lightType === 2 ? 'block' : 'none';
                if (areaControls) areaControls.style.display = this.params.lightType === 3 ? 'block' : 'none';
                
                this.onParamChange(this.params);
            });
        }
    }
    
    initSliders() {
        const sliders = [
            { id: 'roughness', param: 'roughness', displayId: 'roughness-value' },
            { id: 'metallic', param: 'metallic', displayId: 'metallic-value' },
            { id: 'lightIntensity', param: 'lightIntensity', displayId: 'lightIntensity-value' },
            { id: 'lightX', param: 'lightX', displayId: 'lightX-value' },
            { id: 'lightY', param: 'lightY', displayId: 'lightY-value' },
            { id: 'lightZ', param: 'lightZ', displayId: 'lightZ-value' },
            { id: 'spotAngle', param: 'spotAngle', displayId: 'spotAngle-value' },
            { id: 'spotSoftness', param: 'spotSoftness', displayId: 'spotSoftness-value' },
            { id: 'areaWidth', param: 'areaWidth', displayId: 'areaWidth-value' },
            { id: 'areaHeight', param: 'areaHeight', displayId: 'areaHeight-value' }
        ];
        
        sliders.forEach(({ id, param, displayId }) => {
            const slider = document.getElementById(id);
            const display = document.getElementById(displayId);
            
            if (slider && display) {
                slider.value = this.params[param];
                display.textContent = this.params[param].toFixed(2);
                
                slider.addEventListener('input', (e) => {
                    const value = parseFloat(e.target.value);
                    this.params[param] = value;
                    display.textContent = value.toFixed(2);
                    this.onParamChange(this.params);
                });
            }
        });
    }
    
    initColorPickers() {
        const albedoPicker = document.getElementById('albedo');
        if (albedoPicker) {
            albedoPicker.value = this.params.albedo;
            albedoPicker.addEventListener('input', (e) => {
                this.params.albedo = e.target.value;
                this.onParamChange(this.params);
            });
        }
        
        const lightColorPicker = document.getElementById('lightColor');
        if (lightColorPicker) {
            lightColorPicker.value = this.params.lightColor;
            lightColorPicker.addEventListener('input', (e) => {
                this.params.lightColor = e.target.value;
                this.onParamChange(this.params);
            });
        }
    }
    
    initObjectSelector() {
        const selector = document.getElementById('objectType');
        if (selector) {
            selector.value = this.params.objectType;
            selector.addEventListener('change', (e) => {
                this.params.objectType = e.target.value;
                this.onObjectChange(this.params.objectType);
            });
        }
    }
    
    initCheckboxes() {
        const autoRotateCheckbox = document.getElementById('autoRotate');
        if (autoRotateCheckbox) {
            autoRotateCheckbox.checked = this.params.autoRotate;
            autoRotateCheckbox.addEventListener('change', (e) => {
                this.params.autoRotate = e.target.checked;
                this.onParamChange(this.params);
            });
        }
        
        const shadowCheckbox = document.getElementById('shadowEnabled');
        if (shadowCheckbox) {
            shadowCheckbox.checked = this.params.shadowEnabled;
            shadowCheckbox.addEventListener('change', (e) => {
                this.params.shadowEnabled = e.target.checked;
                this.onParamChange(this.params);
            });
        }
    }
    
    getParams() {
        return { ...this.params };
    }
}

export function hexToRgb(hex) {
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
    const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
    const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
    return [r, g, b];
}

export function rgbToHex(rgb) {
    const r = Math.round(rgb[0] * 255).toString(16).padStart(2, '0');
    const g = Math.round(rgb[1] * 255).toString(16).padStart(2, '0');
    const b = Math.round(rgb[2] * 255).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
}
