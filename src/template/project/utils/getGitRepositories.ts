import { Project } from '../../../extension';
import * as path from 'path';
import * as fs from 'fs';
import { gitIcons, getGitServiceType } from './gitIcons';

// Cache for git config data with file modification time tracking
interface GitCacheEntry {
    content: string;
    mtime: number;
    url?: string;
    serviceType?: 'github' | 'gitlab' | 'bitbucket' | null;
}

interface SubmoduleCacheEntry {
    submodules: {name: string, url: string}[];
    mtime: number;
}

const gitConfigCache = new Map<string, GitCacheEntry>();
const submoduleCache = new Map<string, SubmoduleCacheEntry>();

function convertGitUrlToHttps(gitUrl: string): string {
    gitUrl = gitUrl.trim().replace(/\.git$/, '');

    // Handle SSH URLs
    if (gitUrl.startsWith('git@')) {
        const match = gitUrl.match(/git@([^:]+):(.+)/);
        if (match) {
            const [, host, path] = match;
            return `https://${host}/${path}`;
        }
    }

    // Handle git:// protocol
    if (gitUrl.startsWith('git://')) {
        return gitUrl.replace(/^git:\/\//, 'https://');
    }

    // Handle HTTPS URLs - already in correct format
    if (gitUrl.startsWith('https://')) {
        return gitUrl;
    }

    return gitUrl;
}

async function getCachedGitConfig(gitConfigPath: string): Promise<GitCacheEntry | null> {
    try {
        const stat = await fs.promises.stat(gitConfigPath);
        const cached = gitConfigCache.get(gitConfigPath);

        // Return cached version if file hasn't changed
        if (cached && cached.mtime === stat.mtimeMs) {
            return cached;
        }

        // Read and cache new content
        const content = await fs.promises.readFile(gitConfigPath, 'utf8');
        const urlMatch = content.match(/url = (.*)/);

        const entry: GitCacheEntry = {
            content,
            mtime: stat.mtimeMs
        };

        if (urlMatch && urlMatch[1]) {
            const httpsUrl = convertGitUrlToHttps(urlMatch[1].trim());
            entry.url = httpsUrl;
            entry.serviceType = getGitServiceType(httpsUrl);
        }

        gitConfigCache.set(gitConfigPath, entry);
        return entry;
    } catch (error) {
        return null;
    }
}

async function getCachedSubmodules(projectPath: string): Promise<{name: string, url: string}[]> {
    const gitmodulesPath = path.join(projectPath, '.gitmodules');

    try {
        const stat = await fs.promises.stat(gitmodulesPath);
        const cached = submoduleCache.get(gitmodulesPath);

        // Return cached version if file hasn't changed
        if (cached && cached.mtime === stat.mtimeMs) {
            return cached.submodules;
        }

        // Read and parse new content
        const content = await fs.promises.readFile(gitmodulesPath, 'utf8');
        const submoduleMatches = content.matchAll(/\[submodule "([^"]+)"\][^[]*url = ([^\n]+)/g);

        const submodules: {name: string, url: string}[] = [];
        for (const match of submoduleMatches) {
            const name = match[1];
            const url = convertGitUrlToHttps(match[2].trim());
            submodules.push({ name, url });
        }

        // Cache the result
        submoduleCache.set(gitmodulesPath, {
            submodules,
            mtime: stat.mtimeMs
        });

        return submodules;
    } catch (error) {
        return [];
    }
}

export async function getGitRepositoriesHtml(project: Project): Promise<string> {
    let gitContent = '<span class="info-item-value">No Git repository found</span>';
    let submodulesHtml = '';

    const gitConfigPath = path.join(project.path, '.git', 'config');

    // Use cached git config
    const gitConfig = await getCachedGitConfig(gitConfigPath);

    if (gitConfig && gitConfig.url) {
        const serviceType = gitConfig.serviceType;
        const icon = serviceType ? gitIcons[serviceType] : '';
        gitContent = `
            <span class="repository-link">
                ${icon}
                <a class="info-item-value" href="${gitConfig.url}" target="_blank">${gitConfig.url}</a>
            </span>`;

        // Add submodules section if any exist
        const submodules = await getCachedSubmodules(project.path);
        if (submodules.length > 0) {
            const submodulesList = submodules
                .map((sub: {name: string, url: string}) => {
                    const serviceType = getGitServiceType(sub.url);
                    const icon = serviceType ? gitIcons[serviceType] : '';
                    return `
                        <li class="repository-link">
                            ${icon}
                            <a class="info-item-value" href="${sub.url}" target="_blank" title="${sub.url}">${sub.name}</a>
                        </li>`;
                })
                .join('\n');

            submodulesHtml = `
                <div class="info-section">
                    <div class="info-label">Git Submodules</div>
                    <ul class="submodules">
                        ${submodulesList}
                    </ul>
                </div>`;
        }
    } else if (gitConfig === null) {
        gitContent = '<span class="info-item-value">Error reading Git configuration</span>';
    }

    return `
    <div class="info-section">
        <div class="info-label">Git Repository</div>
        <div class="info-content">
            <div class="info-item">
                ${gitContent}
            </div>
        </div>
    </div>
    ${submodulesHtml}`;
}
