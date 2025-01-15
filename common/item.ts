export interface Item {
    type: ItemType;
    imageUrl: string;
    cost?: number;
}

export enum ItemType {
    Avatar = 'avatar',
    Theme = 'theme',
    AnswerSound = 'answerSound',
    Effect = 'effect'
}

export const AVATAR_MAX_SIZE_BYTES = 200 * 1024; // Max size of 200 KB converted to bytes
export const CHAT_IMAGE_MAX_SIZE_BYTES = 1024 * 1024; // Max size of 1 MB (1024 KB) converted to bytes
export const VALID_FILE_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];

export const NO_AVATAR_IMAGE = 'no-avatar.png';

export const DEFAULT_AVATARS: Item[] = [
    { type: ItemType.Avatar, imageUrl: 'guy1.png' },
    { type: ItemType.Avatar, imageUrl: 'guy2.png' },
    { type: ItemType.Avatar, imageUrl: 'girl1.png' },
    { type: ItemType.Avatar, imageUrl: 'girl2.png' },
];

export const SHOP_AVATARS: Item[] = [
    { type: ItemType.Avatar, imageUrl: 'nathan_drake.png', cost: 0 },
    { type: ItemType.Avatar, imageUrl: 'elena_fisher.png', cost: 0 },
    { type: ItemType.Avatar, imageUrl: 'prairie_dog.png', cost: 100 },
    { type: ItemType.Avatar, imageUrl: 'glados.png', cost: 250 },
    { type: ItemType.Avatar, imageUrl: 'joel.png', cost: 400 },
    { type: ItemType.Avatar, imageUrl: 'ellie.png', cost: 400 },
    { type: ItemType.Avatar, imageUrl: 'james_reece.png', cost: 500 },
    { type: ItemType.Avatar, imageUrl: 'prof.png', cost: 10000 },
    { type: ItemType.Avatar, imageUrl: 'hamster_rip.png', cost: 20000 },
];

export const DEFAULT_THEMES: Item[] = [
    {
        type: ItemType.Theme,
        imageUrl: 'dark-theater-stage.jpg',
    },
    {
        type: ItemType.Theme,
        imageUrl: 'bg1.jpg',
    },
];

export const SHOP_THEMES: Item[] = [
    {
        type: ItemType.Theme,
        imageUrl: 'bg2.jpg',
        cost: 0,
    },
    {
        type: ItemType.Theme,
        imageUrl: 'bg3.jpg',
        cost: 100,
    },
    {
        type: ItemType.Theme,
        imageUrl: 'bg4.jpg',
        cost: 200,
    },
    {
        type: ItemType.Theme,
        imageUrl: 'bg5.jpg',
        cost: 300,
    },
];

export const RATIO = 50;
export const ORIENTATION = -1;
export const QUALITY = 50;
