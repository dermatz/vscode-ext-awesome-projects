export const gitIcons = {
    github: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
    </svg>`,
    gitlab: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M15.97 9.058l-.895-2.756L13.3.842c-.09-.276-.5-.276-.59 0L10.938 6.3H5.062L3.29.842c-.09-.276-.5-.276-.59 0L.925 6.302.03 9.058c-.082.255.015.533.237.687l7.533 5.471.2.145.2-.145 7.533-5.471c.222-.154.319-.432.237-.687z"/>
    </svg>`,
    bitbucket: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M.778 1.211c-.424-.006-.772.334-.778.758 0 .045.002.089.008.133l2.09 12.744c.055.297.334.524.668.524h10.556c.25.002.47-.155.534-.385l2.09-12.882c.073-.421-.216-.821-.637-.894-.045-.008-.09-.011-.134-.011L.778 1.211zM9.462 9.33H6.404L5.476 5.472h4.938L9.462 9.33z"/>
    </svg>`
};

// Cache for URL to service type mapping to avoid redundant parsing
const serviceTypeCache = new Map<string, 'github' | 'gitlab' | 'bitbucket' | null>();

export function getGitServiceType(url: string): 'github' | 'gitlab' | 'bitbucket' | null {
    // Check cache first
    const cached = serviceTypeCache.get(url);
    if (cached !== undefined) {
        return cached;
    }

    // Parse and determine service type
    const domain = url.toLowerCase().replace(/^(https?:\/\/|git@)/, '').split(/[/:]/, 1)[0];

    let serviceType: 'github' | 'gitlab' | 'bitbucket' | null = null;

    // Check for GitHub (usually not self-hosted)
    if (domain === 'github.com' || domain.includes('github')) {
        serviceType = 'github';
    }
    // Check for GitLab instances
    else if (domain === 'gitlab.com' || domain.includes('gitlab')) {
        serviceType = 'gitlab';
    }
    // Check for Bitbucket instances
    else if (domain === 'bitbucket.org' || domain.includes('bitbucket')) {
        serviceType = 'bitbucket';
    }

    // Cache the result for future lookups
    serviceTypeCache.set(url, serviceType);

    return serviceType;
}
