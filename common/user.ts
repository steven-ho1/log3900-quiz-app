import { Item } from './item';

export interface UserReference {
    id: string;
    username: string;
    avatar: string;
}

export interface User extends UserReference {
    wallet: number;
    ownedItems: Item[];
    settings: Settings;
    friends: UserReference[];
    blockedPlayers: UserReference[];
    blockedBy: UserReference[];
    pendingSentRequests: UserReference[];
    pendingReceivedRequests: UserReference[];
    badges: Badge[];
}

export interface Settings {
    themeUrl: string;
    effectUrl?: string;
    isEffectActive?: boolean;
    languagePreference: Language;
}

export enum Language {
    French = 'FR',
    English = 'EN',
}

export interface Badge {
    id: string;
    frDescription: string;
    enDescription: string;
    userProgress: number;
    goal: number;
    moneyReward: number;
    itemReward?: Item;
    imageUrl: string;
}

export interface Credentials {
    userId: string;
    email: string;
    password: string;
}

export interface ProfileUpdate {
    username?: string;
    avatar?: string;
}

export interface SettingUpdate {
    themeUrl?: string;
    effectUrl?: string;
    isEffectActive?: boolean;
    languagePreference?: Language;
}
