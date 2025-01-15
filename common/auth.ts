import { Language, User } from './user';

export enum ConflictType {
    Username = 'username',
    Email = 'email',
}

export interface AuthData {
    username: string;
    password: string;
    email?: string;
    avatar?: string;
    language?: Language;
}

export interface AuthResponse {
    token?: string;
    user?: User;
}

export enum AuthEvent {
    Login = 'Connexion',
    Logout = 'Déconnexion',
}

export interface AuthLog {
    userId?: string;
    timestamp: string;
    authEvent: AuthEvent;
}
