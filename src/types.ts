export interface Project {
    id?: string;  // Add optional id field
    path: string;
    name: string;
    color?: string;
    icon?: string;
    remoteUrl?: string;
    productionUrl?: string;
    devUrl?: string;
    stagingUrl?: string;
    managementUrl?: string;
    group?: string;
}
