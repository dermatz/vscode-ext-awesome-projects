import { Project } from '../../../extension';
import * as crypto from 'crypto';
import * as path from 'path';

/**
 * Generates a unique ID for a project based on its name and path
 * @param project The project to generate an ID for
 * @returns A URL-safe unique ID string
 */
export function generateProjectId(project: Project): string {
    // Use normalized path and name for ID generation to ensure consistency across platforms
    const normalizedPath = path.normalize(project.path);
    const input = `${project.name}-${normalizedPath}`;

    return crypto
        .createHash('md5')
        .update(input)
        .digest('base64')
        .replace(/[+/=]/g, '')  // Make URL-safe
        .substring(0, 12);      // Keep it reasonably short
}

/**
 * Gets the project ID from the projects configuration
 * If the project doesn't have an ID yet, generates one
 */
export function getProjectId(project: Project): string {
    if (project.id) {
        return project.id;
    }
    return generateProjectId(project);
}
