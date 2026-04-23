/** Escapes a value for use inside an HTML attribute (double-quoted). */
export function escAttr(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/** Escapes a value for use as HTML text content. */
export function escHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Escapes a value for use as a single-quoted JS string argument inside an
 * HTML attribute, e.g. onclick="fn('VALUE')".
 * Applies JS-string escaping first, then HTML-attribute escaping.
 */
export function escOnclickArg(value: string): string {
    const jsEscaped = value
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\r/g, '\\r')
        .replace(/\n/g, '\\n');
    return escAttr(jsEscaped);
}

/**
 * Sanitizes a CSS color value for safe use in a style attribute.
 * Only allows hex colors (#rgb / #rrggbb / #rgba / #rrggbbaa) and
 * VS Code CSS variable references with an optional hex-color or keyword fallback.
 * Returns 'transparent' for any value that does not match, preventing
 * CSS injection via user-supplied project color settings.
 */
export function sanitizeCssColor(color: string): string {
    const trimmed = color.trim();
    if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed)) {
        return trimmed;
    }
    // Allow var(--name) with an optional fallback that is itself a safe color or keyword
    if (/^var\(--[a-zA-Z0-9_-]+(?:,\s*(?:#[0-9a-fA-F]{3,8}|[a-zA-Z]+))?\)$/.test(trimmed)) {
        return trimmed;
    }
    return 'transparent';
}

/**
 * Validates that a URL uses http or https and escapes it for an HTML attribute.
 * Returns '#' for invalid or non-http(s) URLs to prevent javascript: injection.
 */
export function safeUrl(url: string): string {
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return '#';
        }
        return escAttr(url);
    } catch {
        return '#';
    }
}
