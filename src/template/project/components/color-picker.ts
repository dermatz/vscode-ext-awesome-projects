import * as vscode from "vscode";
import { getColorHandlingScript } from '../utils/colorHandling';

export interface ColorPickerProps {
    projectPath: string;
    currentColor: string | null;
    defaultColor: string;
}

/**
 * Generates a darker gradient color based on the base color.
 * @param {string | null} baseColor - The base color in hex format.
 * @returns {string} - The generated gradient color in rgb format.
 */
export const generateGradient = (baseColor: string | null): string => {
    const defaultColor = 'var(--vscode-list-activeSelectionBackground)';
    if (!baseColor) {
        return defaultColor;
    }
    const hex = baseColor.replace('#', '');
    const [r, g, b] = [0, 2, 4].map(offset => parseInt(hex.substring(offset, offset + 2), 16));

    const darkerR = Math.max(0, r - 40);
    const darkerG = Math.max(0, g - 40);
    const darkerB = Math.max(0, b - 40);

    return `rgb(${darkerR}, ${darkerG}, ${darkerB})`;
};

/**
 * Gets a contrasting color (black or white) based on the luminance of the input color.
 * @param {string | null} hexColor - The input color in hex format.
 * @returns {string} - The contrasting color in hex format.
 */
export const getContrastColor = (hexColor: string | null): string => {
    const defaultContrastColor = '#ffffff';
    if (!hexColor) {
        return defaultContrastColor;
    }
    const color = hexColor.replace('#', '');
    const [r, g, b] = [0, 2, 4].map(offset => parseInt(color.substring(offset, offset + 2), 16));

    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#ffffff';
};

export function getColorPickerHtml(props: ColorPickerProps): string {
    const { projectPath, currentColor, defaultColor } = props;
    const escapedPath = projectPath.replace(/'/g, "\\'");

    return `
        <label>Background:</label>
        <div class="color-container">
            <input type="color"
                class="project-color-input"
                value="${currentColor || defaultColor}"
                data-uses-theme-color="${!currentColor}"
                oninput="handleColorChange(event, '${escapedPath}')"
                onchange="handleColorChange(event, '${escapedPath}')">
            <button class="button small secondary random-color" onclick="setRandomColor(event, '${escapedPath}')" style="display:flex; align-items:center; gap:4px;">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" pointer-events="none">
                    <path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M18 4l3 3l-3 3" /><path d="M18 20l3 -3l-3 -3" /><path d="M3 7h3a5 5 0 0 1 5 5a5 5 0 0 0 5 5h5" /><path d="M21 7h-5a4.978 4.978 0 0 0 -3 1m-4 8a4.984 4.984 0 0 1 -3 1h-3" />
                </svg>
                <span style="pointer-events: none">Randomize</span>
            </button>
            <button class="button small secondary" onclick="resetColor(event, '${escapedPath}')">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M9 14l-4 -4l4 -4" /><path d="M5 10h11a4 4 0 1 1 0 8h-1" />
                </svg>
                Reset
            </button>
        </div>
        <script>
            ${getColorHandlingScript()}

            function resetColor(event, projectPath) {
                event.preventDefault();
                const colorInput = event.target.closest('.color-container').querySelector('input[type="color"]');
                const themeColor = getComputedStyle(document.documentElement)
                    .getPropertyValue('--vscode-list-activeSelectionBackground')
                    .trim();

                let hexColor = themeColor;
                if (themeColor.startsWith('rgb')) {
                    const rgb = themeColor.match(/\\d+/g);
                    if (rgb && rgb.length === 3) {
                        hexColor = '#' + rgb.map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
                    }
                }

                colorInput.value = hexColor;
                colorInput.setAttribute('data-uses-theme-color', 'true');

                if (!pendingChanges[projectPath]) {
                    pendingChanges[projectPath] = {};
                }
                pendingChanges[projectPath]['color'] = null;

                const projectItem = event.target.closest('.project-item-wrapper').querySelector('.project-item');
                projectItem.style.setProperty('--bg-color', 'var(--vscode-list-activeSelectionBackground)');
                projectItem.style.setProperty('--bg-gradient', 'var(--vscode-list-activeSelectionBackground)');

                showSaveButton(projectPath);
            }

            function showSaveButton(projectPath) {
                const saveButton = document.getElementById('save-' + projectPath.replace(/[^a-zA-Z0-9]/g, '-'));
                if (saveButton) {
                    saveButton.classList.add('show');
                }
            }
        </script>
    `;
}
