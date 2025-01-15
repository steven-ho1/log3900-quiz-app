/* eslint-disable max-lines */
/* eslint-disable no-prototype-builtins */
/* eslint-disable max-params */
/* eslint-disable no-console */
import { ChatManager } from '@app/services/chat-manager/chat-manager';
import { SessionManagementService } from '@app/services/user-services/session-management-service.service.ts/session-management-service.service';
import { StatsService } from '@app/services/user-services/stats-service/stats-service.service';
import { TokenService } from '@app/services/user-services/token-service/token-service.service';
import { UserManagementService } from '@app/services/user-services/user-management-service/user-management-service.service';
import { getMontrealDateTime } from '@app/utils/date';
import { handleInternalError } from '@app/utils/error-utils';
import { completedGameSchema } from '@app/utils/schemas';
import { AuthLog } from '@common/auth';
import { Channel } from '@common/channel';
import { Item } from '@common/item';
import { Challenge, CompletedGame, PlayerStats } from '@common/stats';
import { Credentials, ProfileUpdate, SettingUpdate } from '@common/user';
import { Request, Response, Router } from 'express';
import { StatusCodes } from 'http-status-codes';
import { Service } from 'typedi';

@Service()
export class UserController {
    private router: Router;

    constructor(
        private readonly tokenService: TokenService,
        private readonly userManagementService: UserManagementService,
        private readonly statsService: StatsService,
        private readonly sessionManagementService: SessionManagementService,
        private readonly chatManager: ChatManager,
    ) {
        this.configureRouter();
    }

    getRouter(): Router {
        return this.router;
    }

    private configureRouter(): void {
        this.router = Router();

        this.router.patch(
            '/:id/profile/avatar',
            this.tokenService.validateToken,
            this.userManagementService.validateUserId,
            async (req: Request, res: Response) => {
                try {
                    const profileUpdate: ProfileUpdate = req.body;
                    const avatar = profileUpdate.avatar;

                    if (typeof avatar !== 'string') {
                        res.sendStatus(StatusCodes.BAD_REQUEST);
                        return;
                    }

                    const userId = res.locals.id;
                    const userToUpdate = await this.userManagementService.getUserById(userId);
                    if (!userToUpdate) {
                        res.sendStatus(StatusCodes.NOT_FOUND);
                        return;
                    }

                    userToUpdate.avatar = avatar;
                    await this.userManagementService.updateUser(userToUpdate);

                    res.json(userToUpdate);
                    console.log('Avatar updated');
                } catch (error) {
                    handleInternalError(res, error, 'Unexpected error when updating avatar.');
                }
            },
        );
        this.router.patch(
            '/:id/profile/username',
            this.tokenService.validateToken,
            this.userManagementService.validateUserId,
            async (req: Request, res: Response) => {
                try {
                    const profileUpdate: ProfileUpdate = req.body;
                    const username = profileUpdate.username?.trim().toLowerCase();

                    if (typeof username !== 'string') {
                        res.sendStatus(StatusCodes.BAD_REQUEST);
                        return;
                    }

                    const userId = res.locals.id;
                    const users = await this.userManagementService.getUsers();
                    const usernameExists = users.some((user) => user.username.toLowerCase() === username);
                    if (usernameExists) {
                        res.sendStatus(StatusCodes.CONFLICT);
                        return;
                    }

                    const userToUpdate = users.find((user) => user.id === userId);
                    if (!userToUpdate) {
                        res.sendStatus(StatusCodes.NOT_FOUND);
                        return;
                    }

                    const oldUsername = userToUpdate.username;

                    userToUpdate.username = username;
                    await this.userManagementService.updateUser(userToUpdate);

                    const channels: Channel[] = await this.chatManager.getAllChannels();

                    channels.forEach(async (channel: Channel) => {
                        if (channel.membersList.includes(oldUsername)) {
                            await this.chatManager.removeFromMembersList(channel.channelId, oldUsername);
                            await this.chatManager.addToMembersList(channel.channelId, username);
                        }

                        if (channel.members.includes(oldUsername)) {
                            await this.chatManager.leaveChannel(channel.channelId, userId, oldUsername);
                            await this.chatManager.joinChannel(channel.channelId, username);
                        }
                    });

                    res.json(userToUpdate);
                    console.log('Username updated');
                } catch (error) {
                    handleInternalError(res, error, 'Unexpected error when updating username.');
                }
            },
        );
        this.router.get(
            '/:id/stats',
            this.tokenService.validateToken,
            this.userManagementService.validateUserId,
            async (req: Request, res: Response) => {
                try {
                    const userId = req.params.id;
                    let playerStats: PlayerStats = await this.statsService.getPlayerStats(userId);
                    if (!playerStats) {
                        playerStats = await this.statsService.initializePlayerStats(userId);
                        await this.statsService.insertPlayerStats(playerStats);
                    }

                    res.json(playerStats);
                } catch (error) {
                    handleInternalError(res, error, 'Unexpected error when getting stats.');
                }
            },
        );
        this.router.get('/leaderboard', this.tokenService.validateToken, async (req: Request, res: Response) => {
            try {
                const leaderboard = await this.statsService.getLeaderboard();
                res.status(StatusCodes.OK).json(leaderboard);
            } catch (error) {
                console.error('Error fetching leaderboard:', error);
                res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'Unexpected error occurred while fetching leaderboard.' });
            }
        });

        this.router.post(
            '/:id/stats',
            this.tokenService.validateToken,
            this.userManagementService.validateUserId,
            async (req: Request, res: Response) => {
                try {
                    const userId = req.params.id;
                    const completedGame: CompletedGame = req.body;
                    const { error } = completedGameSchema.validate(completedGame);
                    if (error) {
                        console.log(error);
                        res.sendStatus(StatusCodes.BAD_REQUEST);
                        return;
                    }

                    completedGame.completionDate = getMontrealDateTime();
                    await this.statsService.updateCompletionPlayerStats(userId, completedGame);

                    res.sendStatus(StatusCodes.NO_CONTENT);
                } catch (error) {
                    handleInternalError(res, error, 'Unexpected error when updating stats.');
                }
            },
        );
        this.router.get(
            '/:id/auth-logs',
            this.tokenService.validateToken,
            this.userManagementService.validateUserId,
            async (req: Request, res: Response) => {
                try {
                    const userId = req.params.id;
                    const authLogs: AuthLog[] = await this.sessionManagementService.getAuthLogsById(userId);
                    if (!authLogs) {
                        res.sendStatus(StatusCodes.NOT_FOUND);
                        return;
                    }
                    res.json(authLogs);
                } catch (error) {
                    handleInternalError(res, error, 'Unexpected error when getting auth logs.');
                }
            },
        );
        this.router.post(
            '/:id/purchase',
            this.tokenService.validateToken,
            this.userManagementService.validateUserId,
            async (req: Request, res: Response) => {
                try {
                    const item: Item = req.body;

                    const userId = req.params.id;
                    const user = await this.userManagementService.getUserById(userId);
                    if (!user) {
                        res.sendStatus(StatusCodes.NOT_FOUND);
                        return;
                    }
                    console.log('Old wallet : ', user.wallet);

                    // Je fais pas de vérification rigoureuse vu que c'est juste un petit projet
                    if (typeof item !== 'object' || typeof item.cost !== 'number') {
                        res.sendStatus(StatusCodes.BAD_REQUEST);
                        return;
                    }

                    const hasEnoughMoney = user.wallet >= item.cost;
                    if (!hasEnoughMoney) {
                        res.sendStatus(StatusCodes.FORBIDDEN);
                        return;
                    }

                    user.wallet -= item.cost;
                    user.ownedItems.push(item);

                    await this.userManagementService.updateUser(user);
                    console.log('New wallet : ', user.wallet);

                    res.json(user);
                } catch (error) {
                    handleInternalError(res, error, 'Unexpected error when processing transaction.');
                }
            },
        );

        this.router.post(
            '/:id/reward',
            this.tokenService.validateToken,
            this.userManagementService.validateUserId,
            async (req: Request, res: Response) => {
                try {
                    const reward: number = req.body.reward;

                    const userId = req.params.id;
                    const user = await this.userManagementService.getUserById(userId);
                    if (!user) {
                        res.sendStatus(StatusCodes.NOT_FOUND);
                        return;
                    }
                    console.log('Old wallet : ', user.wallet);

                    if (typeof reward !== 'number') {
                        res.sendStatus(StatusCodes.BAD_REQUEST);
                        return;
                    }

                    user.wallet += reward;

                    await this.userManagementService.updateUser(user);
                    console.log('New wallet : ', user.wallet);
                    await this.statsService.addMoneyToUserStats(userId, reward);

                    res.json(user);
                } catch (error) {
                    handleInternalError(res, error, 'Unexpected error when processing reward.');
                }
            },
        );

        this.router.patch(
            '/:id/settings',
            this.tokenService.validateToken,
            this.userManagementService.validateUserId,
            async (req: Request, res: Response) => {
                try {
                    const settingUpdate: SettingUpdate = req.body;

                    const userId = req.params.id;
                    const user = await this.userManagementService.getUserById(userId);
                    if (!user) {
                        res.sendStatus(StatusCodes.NOT_FOUND);
                        return;
                    }

                    if (typeof settingUpdate !== 'object') {
                        res.sendStatus(StatusCodes.BAD_REQUEST);
                        return;
                    }

                    console.log('Old settings : ', user.settings);
                    console.log('New settings : ', settingUpdate);

                    if (settingUpdate.themeUrl) user.settings.themeUrl = settingUpdate.themeUrl;
                    if (settingUpdate.effectUrl) user.settings.effectUrl = settingUpdate.effectUrl;
                    if (settingUpdate.hasOwnProperty('isEffectActive')) {
                        user.settings.isEffectActive = settingUpdate.isEffectActive;
                    }
                    if (settingUpdate.languagePreference) user.settings.languagePreference = settingUpdate.languagePreference;

                    console.log('New settings : ', user.settings);

                    await this.userManagementService.updateUser(user);

                    res.json(user);
                } catch (error) {
                    handleInternalError(res, error, 'Unexpected error when changing settings.');
                }
            },
        );
        this.router.post(
            '/:id/stats/challenges',
            this.tokenService.validateToken,
            this.userManagementService.validateUserId,
            async (req: Request, res: Response) => {
                try {
                    const challenge: Challenge = req.body;

                    const userId = req.params.id;
                    const user = await this.userManagementService.getUserById(userId);
                    if (!user) {
                        res.sendStatus(StatusCodes.NOT_FOUND);
                        return;
                    }

                    if (typeof challenge !== 'object') {
                        res.sendStatus(StatusCodes.BAD_REQUEST);
                        return;
                    }

                    await this.statsService.updateChallengePlayerStats(userId);

                    user.wallet += challenge.reward;
                    await this.userManagementService.updateUser(user);
                    await this.statsService.addMoneyToUserStats(userId, challenge.reward);

                    res.json(user);
                } catch (error) {
                    handleInternalError(res, error, 'Unexpected error when updating challenge stats.');
                }
            },
        );
        this.router.patch(
            '/:id/badges/:badgeId',
            this.tokenService.validateToken,
            this.userManagementService.validateUserId,
            async (req: Request, res: Response) => {
                try {
                    const userId = req.params.id;
                    const badgeId = req.params.badgeId;
                    const { userProgress } = req.body;
                    // console.log(`Attempting to update badge progress for user ${userId} and badge ${badgeId} to progress: ${userProgress}`);
                    const user = await this.userManagementService.getUserById(userId);
                    const badge = user.badges.find((b) => b.id === badgeId);
                    //    console.log(`before : ${badge.userProgress}`)

                    badge.userProgress = userProgress;
                    if (badge.userProgress >= badge.goal) {
                        user.wallet += badge.moneyReward;

                        await this.statsService.addMoneyToUserStats(userId, badge.moneyReward);
                    }
                    // console.log('User object before update:', JSON.stringify(user));
                    await this.userManagementService.updateUser(user);
                    // console.log(`Badge ${badgeId} for user ${userId} updated to progress: ${userProgress}`);
                    // console.log(`after : ${badge.userProgress}`)
                    res.status(StatusCodes.OK).json(user);
                } catch (error) {
                    console.error('Unexpected error when updating badge progress:', error);
                    handleInternalError(res, error, 'Unexpected error when updating badge progress.');
                }
            },
        );

        this.router.get(
            '/:id/settings/email',
            this.tokenService.validateToken,
            this.userManagementService.validateUserId,
            async (req: Request, res: Response) => {
                try {
                    const userId = req.params.id;
                    const credentials: Credentials = await this.userManagementService.getCredentialsById(userId);
                    if (!credentials) {
                        res.sendStatus(StatusCodes.NOT_FOUND);
                        return;
                    }
                    res.json({ email: credentials.email });
                } catch (error) {
                    handleInternalError(res, error, 'Unexpected error when getting stats.');
                }
            },
        );

        this.router.patch(
            '/:id/settings/email',
            this.tokenService.validateToken,
            this.userManagementService.validateUserId,
            async (req: Request, res: Response) => {
                try {
                    const userId = req.params.id;
                    let email: string = req.body.email;
                    console.log(req.body);

                    if (typeof email !== 'string') {
                        res.sendStatus(StatusCodes.BAD_REQUEST);
                        return;
                    }
                    email = email.trim().toLowerCase();

                    const allCredentials: Credentials[] = await this.userManagementService.getAllCredentials();
                    const emailExists = allCredentials.some((credentials: Credentials) => credentials.email === email);
                    if (emailExists) {
                        res.sendStatus(StatusCodes.CONFLICT);
                        return;
                    }

                    await this.userManagementService.updateEmailById(userId, email);

                    res.json({ email });
                } catch (error) {
                    handleInternalError(res, error, 'Unexpected error when getting stats.');
                }
            },
        );
    }
}
