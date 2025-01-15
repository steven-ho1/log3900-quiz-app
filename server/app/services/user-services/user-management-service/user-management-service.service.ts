/* eslint-disable no-console */
import { transporter } from '@app/config/email-transporter';
import redisClient from '@app/config/redis-client';
import { DatabaseService } from '@app/services/database/database.service';
import { StatsService } from '@app/services/user-services/stats-service/stats-service.service';
import { generateResetCode, generateResetEmailMessage, generateUserID, RESET_CODE_DURATION, SALT_LENGTH } from '@app/utils/user-utils';
import { AuthData, ConflictType } from '@common/auth';
import { DEFAULT_AVATARS, DEFAULT_THEMES, Item, ItemType } from '@common/item';
import { Badge, Credentials, Language, Settings, User, UserReference } from '@common/user';
import { hash } from 'bcryptjs';
import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { Service } from 'typedi';

@Service()
export class UserManagementService {
    constructor(
        private database: DatabaseService,
        private statsService: StatsService,
    ) {}

    async getUsers(): Promise<User[]> {
        const users = await this.getUserCollection().find().toArray();
        return users as unknown as User[];
    }

    async getUserById(userId: string): Promise<User | null> {
        const user = await this.getUserCollection().findOne({ id: userId });

        if (user) return user as unknown as User;
        return null;
    }

    async getLanguageByUserId(userId: string): Promise<Language | null> {
        const user = await this.getUserCollection().findOne({ id: userId });

        if (user) return (user as unknown as User).settings.languagePreference;
        return null;
    }

    async createUser(authData: AuthData): Promise<User> {
        const { user, credentials }: { user: User; credentials: Credentials } = await this.populateNewUser(authData);
        const playerStats = this.statsService.initializePlayerStats(user.id);

        await this.getUserCollection().insertOne(user);
        await this.getCredentialsCollection().insertOne(credentials);
        await this.statsService.insertPlayerStats(playerStats);

        console.log('New user : ', user);
        return user;
    }

    async updateUser(updatedUser: User): Promise<void> {
        await this.getUserCollection().replaceOne({ id: updatedUser.id }, updatedUser);
    }

    async getAllCredentials(): Promise<Credentials[]> {
        const allCredentials = await this.getCredentialsCollection().find().toArray();
        return allCredentials as unknown as Credentials[];
    }

    async getCredentialsById(userId: string): Promise<Credentials | null> {
        const credentials = await this.getCredentialsCollection().findOne({ userId });

        if (credentials) return credentials as unknown as Credentials;
        return null;
    }

    async updateCredentials(updatedCredentials: Credentials): Promise<void> {
        await this.getCredentialsCollection().replaceOne({ email: updatedCredentials.email }, updatedCredentials);
    }

    async getCredentialsByEmail(email: string): Promise<Credentials | null> {
        const credentials = await this.getCredentialsCollection().findOne({ email });

        if (credentials) return credentials as unknown as Credentials;
        return null;
    }
    async searchRegisterConflicts(username: string, email: string) {
        const conflicts: { username: string; email: string } = { username: null, email: null };

        const users = await this.getUsers();
        const userFound = users.find((user) => user.username.toLowerCase() === username);
        if (userFound) conflicts.username = ConflictType.Username;

        const allCredentials = await this.getAllCredentials();
        const emailExists = allCredentials.some((credentials) => credentials.email.toLowerCase() === email);
        if (emailExists) conflicts.email = ConflictType.Email;

        return conflicts;
    }

    validateUserId = (req: Request, res: Response, next: NextFunction) => {
        const idFromToken = res.locals.id;
        const routeParamId = req.params.id;

        if (idFromToken !== routeParamId) {
            res.sendStatus(StatusCodes.FORBIDDEN);
            return;
        }
        next();
    };

    async updateEmailById(userId: string, email: string) {
        await this.getCredentialsCollection().updateOne(
            { userId },
            {
                $set: {
                    email,
                },
            },
        );
    }

    async sendResetEmail(email: string, language: string) {
        const resetCode = generateResetCode();

        // Options de l'e-mail
        const mailOptions = {
            from: process.env.TRANSPORTER_EMAIL,
            to: email,
            subject: language === Language.French ? 'Réinitialisation de mot de passe' : 'Password reset',
            html: generateResetEmailMessage(resetCode, language),
        };

        // Envoyer l'e-mail
        await transporter.sendMail(mailOptions);
        await this.saveResetCode(email, resetCode);
    }

    async saveResetCode(email: string, resetCode: string) {
        await redisClient.setEx(`code_${email}`, RESET_CODE_DURATION, resetCode);
    }

    async getResetCode(email: string) {
        return await redisClient.get(`code_${email}`);
    }

    async deleteResetCode(email: string) {
        return await redisClient.del(`code_${email}`);
    }

    private getUserCollection() {
        return this.database.getCollection('Users');
    }

    private getCredentialsCollection() {
        return this.database.getCollection('Credentials');
    }

    private async populateNewUser(authData: AuthData) {
        const passwordHash: string = await hash(authData.password, SALT_LENGTH);

        const id: string = generateUserID(authData.username);
        const username: string = authData.username;
        const avatar: string = authData.avatar;
        const wallet = 0;
        const ownedItems: Item[] = [...DEFAULT_AVATARS, ...DEFAULT_THEMES, { type: ItemType.Effect, imageUrl: 'confettiGris.png', cost: 0 }];
        const settings: Settings = {
            themeUrl: DEFAULT_THEMES[0].imageUrl,
            effectUrl: 'confettiGris.png',
            isEffectActive: false,
            languagePreference: authData.language,
        };
        const friends: UserReference[] = [];
        const blockedPlayers: UserReference[] = [];
        const blockedBy: UserReference[] = [];
        const pendingSentRequests: UserReference[] = [];
        const pendingReceivedRequests: UserReference[] = [];
        const badges: Badge[] = [
            {
                id: 'game-create',
                frDescription: 'Créer votre première partie',
                enDescription: 'Create your first game',
                userProgress: 0,
                goal: 1,
                moneyReward: 50,
                imageUrl: './assets/badges/game-create.png',
            },
            {
                id: 'game-add',
                frDescription: 'Créer votre premier jeu',
                enDescription: 'Create your first quiz',
                userProgress: 0,
                goal: 1,
                moneyReward: 100,
                imageUrl: './assets/badges/game-add.png',
            },
            {
                id: 'game-import',
                frDescription: 'Importer votre premier jeu',
                enDescription: 'Import your first quiz',
                userProgress: 0,
                goal: 1,
                moneyReward: 50,
                imageUrl: './assets/badges/game-import.png',
            },
            {
                id: 'channel-create',
                frDescription: 'Créer votre premier canal dans le chat',
                enDescription: 'Create your first channel in the chat',
                userProgress: 0,
                goal: 1,
                moneyReward: 50,
                imageUrl: './assets/badges/channel-create.png',
            },
            {
                id: 'game-won',
                frDescription: 'Gagner votre première partie',
                enDescription: 'Win your first game',
                userProgress: 0,
                goal: 1,
                moneyReward: 100,
                imageUrl: './assets/badges/1st.png',
            },
            {
                id: 'game-king',
                frDescription: 'Gagner 10 parties',
                enDescription: 'Win 10 games',
                userProgress: 0,
                goal: 10,
                moneyReward: 1000,
                imageUrl: './assets/badges/game-king.png',
            },
        ];

        const newUser: User = {
            id,
            username,
            avatar,
            wallet,
            ownedItems,
            settings,
            friends,
            blockedPlayers,
            blockedBy,
            pendingSentRequests,
            pendingReceivedRequests,
            badges,
        };
        const newUserCredentials: Credentials = { userId: id, email: authData.email, password: passwordHash };
        return { user: newUser, credentials: newUserCredentials };
    }
}
