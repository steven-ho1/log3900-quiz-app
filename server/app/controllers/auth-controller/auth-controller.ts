/* eslint-disable no-console */
import redisClient from '@app/config/redis-client';
import { SocketManager } from '@app/services/socket-manager/socket-manager.service';
import { TokenService } from '@app/services/user-services/token-service/token-service.service';
import { UserManagementService } from '@app/services/user-services/user-management-service/user-management-service.service';
import { InternalErrorMessage } from '@app/type/error';
import { handleInternalError } from '@app/utils/error-utils';
import { SALT_LENGTH } from '@app/utils/user-utils';
import { AuthData, AuthResponse } from '@common/auth';
import { Credentials, Language, User } from '@common/user';
import { compare, hash } from 'bcryptjs';
import { Request, Response, Router } from 'express';
import { StatusCodes } from 'http-status-codes';
import { Service } from 'typedi';

@Service()
export class AuthController {
    private router: Router;

    constructor(
        private readonly tokenService: TokenService,
        private readonly userManagementService: UserManagementService,
        private readonly socketManager: SocketManager,
    ) {
        this.configureRouter();
    }

    getRouter(): Router {
        return this.router;
    }

    private configureRouter(): void {
        this.router = Router();

        this.router.get('/session-loading', this.tokenService.validateToken, async (_req: Request, res: Response) => {
            try {
                const userId = res.locals.id;

                const isUserActive = await redisClient.get(`session_${userId}`);
                if (isUserActive) {
                    res.sendStatus(StatusCodes.CONFLICT);
                    return;
                }

                const userFound = await this.userManagementService.getUserById(userId);
                if (!userFound) {
                    res.sendStatus(StatusCodes.NOT_FOUND);
                    return;
                }

                const newToken = this.tokenService.generateToken(userId);
                const payload: AuthResponse = { user: userFound, token: newToken };
                res.json(payload);
                console.log('Session loaded');
            } catch (error) {
                handleInternalError(res, error, InternalErrorMessage.SessionLoading);
            }
        });

        this.router.get('/detached-chat-loading', this.tokenService.validateToken, async (_req: Request, res: Response) => {
            try {
                const userId = res.locals.id;

                const userFound = await this.userManagementService.getUserById(userId);
                const payload: AuthResponse = { user: userFound };
                res.json(payload);
            } catch (error) {
                handleInternalError(res, error, InternalErrorMessage.SessionLoading);
            }
        });

        this.router.post('/login', async (req: Request, res: Response) => {
            try {
                const authData: AuthData = req.body;
                const username = authData.username?.trim().toLowerCase();
                const password = authData.password;

                if (typeof username !== 'string' || typeof password !== 'string') {
                    res.sendStatus(StatusCodes.BAD_REQUEST);
                    return;
                }

                const users: User[] = await this.userManagementService.getUsers();
                const userFound = users.find((user) => user.username.toLowerCase() === username);
                if (!userFound) {
                    res.sendStatus(StatusCodes.UNAUTHORIZED);
                    return;
                }

                const userId = userFound.id;
                const userCredentials = await this.userManagementService.getCredentialsById(userId);
                const isPasswordValid = await compare(password, userCredentials.password);
                if (!isPasswordValid) {
                    res.sendStatus(StatusCodes.UNAUTHORIZED);
                    return;
                }

                const isUserActive = await redisClient.get(`session_${userId}`);
                if (isUserActive) {
                    res.sendStatus(StatusCodes.CONFLICT);
                    return;
                }

                const token = this.tokenService.generateToken(userId);
                const payload: AuthResponse = { user: userFound, token };
                console.log('Login succeeded');
                res.json(payload);
            } catch (error) {
                handleInternalError(res, error, InternalErrorMessage.LoginError);
            }
        });

        this.router.post('/register', async (req: Request, res: Response) => {
            try {
                const authData: AuthData = req.body;
                const username = authData.username?.trim().toLowerCase();
                const email = authData.email?.trim().toLowerCase();
                const password = authData.password;
                const avatar = authData.avatar;
                let language = authData.language;

                // Vérification non exhaustive comme toutes les autres routes
                if (typeof username !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
                    res.sendStatus(StatusCodes.BAD_REQUEST);
                    return;
                }

                const conflicts = await this.userManagementService.searchRegisterConflicts(username, email);
                if (conflicts.username !== null || conflicts.email !== null) {
                    res.status(StatusCodes.CONFLICT).json({ errors: conflicts });
                    return;
                }

                if (!language) language = Language.French;

                const newUser: User = await this.userManagementService.createUser({ username, email, password, avatar, language });
                this.socketManager.emitEvent('userCreated', newUser);
                const token: string = this.tokenService.generateToken(newUser.id);
                const payload: AuthResponse = { user: newUser, token };
                res.json(payload);
                console.log('Sign-up succeeded');
            } catch (error) {
                handleInternalError(res, error, InternalErrorMessage.RegistrationError);
            }
        });

        this.router.post('/password-reset', async (req: Request, res: Response) => {
            try {
                const email = req.body.email?.trim().toLowerCase();
                let language = req.body.language?.trim().toUpperCase();

                // On envoie que 204 à des fins de sécurité
                if (typeof email !== 'string' || typeof language !== 'string') {
                    console.log('Email not a string');
                    res.sendStatus(StatusCodes.NO_CONTENT);
                    return;
                }

                const allCredentials: Credentials[] = await this.userManagementService.getAllCredentials();
                if (!allCredentials.find((credentials: Credentials) => credentials.email.toLowerCase() === email)) {
                    console.log('Credentials not found');
                    res.sendStatus(StatusCodes.NO_CONTENT);
                    return;
                }

                if (!language) language = Language.French;

                await this.userManagementService.sendResetEmail(email, language);

                console.log('Email sent');

                res.sendStatus(StatusCodes.NO_CONTENT);
            } catch (error) {
                handleInternalError(res, error, "Erreur inattendue lors de l'envoi du courriel de réinitialisation de mot de passe.");
            }
        });

        this.router.post('/password-reset/code-verification', async (req: Request, res: Response) => {
            try {
                const email = req.body.email?.trim().toLowerCase();
                const code = req.body.code?.trim();

                if (typeof email !== 'string' || typeof code !== 'string') {
                    res.sendStatus(StatusCodes.BAD_REQUEST);
                    return;
                }

                const resetCode = await this.userManagementService.getResetCode(email);
                if (code !== resetCode) {
                    res.sendStatus(StatusCodes.UNAUTHORIZED);
                    return;
                }

                res.sendStatus(StatusCodes.NO_CONTENT);
            } catch (error) {
                handleInternalError(res, error, 'Erreur inattendue lors de la vérification du code de réinitialisation.');
            }
        });

        this.router.post('/password-reset/new-password', async (req: Request, res: Response) => {
            try {
                const email = req.body.email?.trim().toLowerCase();
                const newPassword = req.body.newPassword?.trim();

                if (typeof email !== 'string' || typeof newPassword !== 'string') {
                    res.sendStatus(StatusCodes.BAD_REQUEST);
                    return;
                }

                const credentials: Credentials = await this.userManagementService.getCredentialsByEmail(email);
                if (!credentials) {
                    res.sendStatus(StatusCodes.NOT_FOUND);
                    return;
                }

                credentials.password = await hash(newPassword, SALT_LENGTH);
                await this.userManagementService.updateCredentials(credentials);
                await this.userManagementService.deleteResetCode(email);

                res.sendStatus(StatusCodes.NO_CONTENT);
                console.log('Password updated');
            } catch (error) {
                handleInternalError(res, error, 'Erreur inattendue lors de la vérification du code de réinitialisation.');
            }
        });
    }
}
