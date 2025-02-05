import { Project } from '../extension';
import * as crypto from 'crypto';

/**
 * Generates a unique ID for a project based on its path and name
 * @param project The project to generate an ID for
 * @returns A URL-safe unique ID string
 */
export function generateProjectId(project: Project): string {
    const input = `${project.path}-${project.name}`;
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
