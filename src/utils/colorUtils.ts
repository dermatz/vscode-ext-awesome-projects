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
