/* eslint-disable no-console */
import { GameManagerService } from '@app/services/game-manager/game-manager.service';
import { TokenService } from '@app/services/user-services/token-service/token-service.service';
import { UserManagementService } from '@app/services/user-services/user-management-service/user-management-service.service';
import { InternalErrorMessage } from '@app/type/error';
import { handleInternalError } from '@app/utils/error-utils';
import { Game, Question, QuestionType } from '@common/game';
import { Challenge } from '@common/stats';
import { Language, User } from '@common/user';
import { Request, Response, Router } from 'express';
import { StatusCodes } from 'http-status-codes';
import * as _ from 'lodash';
import { Service } from 'typedi';

@Service()
export class GameController {
    private router: Router;

    constructor(
        private readonly gameManager: GameManagerService,
        private readonly tokenService: TokenService,
        private readonly userManagementService: UserManagementService,
    ) {
        this.configureRouter();
    }

    getRouter(): Router {
        return this.router;
    }

    private configureRouter(): void {
        this.router = Router();

        this.router.get('/', async (_req: Request, res: Response) => {
            try {
                const games: Game[] = await this.gameManager.getGames();

                if (games) res.json(games);
                else res.sendStatus(StatusCodes.NOT_FOUND);
            } catch (error) {
                handleInternalError(res, error, InternalErrorMessage.GamesFetchError);
            }
        });

        this.router.get('/:id', async (req: Request, res: Response) => {
            try {
                const { fileName, gameToExport } = await this.gameManager.exportGame(req.params.id);

                if (fileName) {
                    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
                    res.json(gameToExport);
                } else res.sendStatus(StatusCodes.NOT_FOUND);
            } catch (error) {
                handleInternalError(res, error, InternalErrorMessage.GameExportError);
            }
        });

        this.router.patch('/:id', async (req: Request, res: Response) => {
            try {
                // const gameToUpdate = req.body;

                // if (typeof gameToUpdate !== 'object' || typeof gameToUpdate === null) {
                //     res.sendStatus(StatusCodes.BAD_REQUEST);
                //     return;
                // }

                const updateResponse = await this.gameManager.modifyGame(req.params.id, req.body);
                if (updateResponse === null) {
                    res.sendStatus(StatusCodes.BAD_REQUEST);
                } else if (updateResponse.result.matchedCount > 0) {
                    res.json(updateResponse.games);
                } else {
                    res.sendStatus(StatusCodes.NOT_FOUND);
                }
            } catch (error) {
                handleInternalError(res, error, InternalErrorMessage.GameModificationError);
            }
        });

        this.router.patch('/:id/visibility', async (req: Request, res: Response) => {
            try {
                const newVisibility = req.body.isVisible;
                if (typeof newVisibility !== 'boolean') {
                    res.sendStatus(StatusCodes.BAD_REQUEST);
                    return;
                }

                const { result, games } = await this.gameManager.modifyGameVisibility(req.params.id, req.body);
                if (result.matchedCount > 0) {
                    res.json(games);
                } else {
                    res.sendStatus(StatusCodes.NOT_FOUND);
                }
            } catch (error) {
                handleInternalError(res, error, InternalErrorMessage.GameVisibilityModificationError);
            }
        });

        this.router.patch('/:id/public-state', async (req: Request, res: Response) => {
            try {
                const newPublicState = req.body.isPublic;
                if (typeof newPublicState !== 'boolean') {
                    res.sendStatus(StatusCodes.BAD_REQUEST);
                    return;
                }

                const { result, games } = await this.gameManager.modifyGamePublicState(req.params.id, req.body);
                if (result.matchedCount > 0) {
                    res.json(games);
                } else {
                    res.sendStatus(StatusCodes.NOT_FOUND);
                }
            } catch (error) {
                handleInternalError(res, error, InternalErrorMessage.GamePublicStateModificationError);
            }
        });

        this.router.post('/', async (req: Request, res: Response) => {
            try {
                const gameToAdd = req.body;
                console.log(typeof gameToAdd);
                if (typeof gameToAdd !== 'object' || typeof gameToAdd === null) {
                    res.sendStatus(StatusCodes.BAD_REQUEST);
                    return;
                }

                const games = await this.gameManager.addGame(gameToAdd);
                if (games === null) {
                    res.status(StatusCodes.BAD_REQUEST).json({ message: 'JSON invalide: ' + this.gameManager.error.message });
                } else {
                    res.status(StatusCodes.CREATED).json(games);
                }
            } catch (error) {
                handleInternalError(res, error, InternalErrorMessage.GameAdditionError);
            }
        });

        this.router.delete('/:id', async (req: Request, res: Response) => {
            try {
                const result = await this.gameManager.deleteGameById(req.params.id);
                if (result.deletedCount > 0) {
                    res.sendStatus(StatusCodes.NO_CONTENT);
                } else {
                    res.sendStatus(StatusCodes.NOT_FOUND);
                }
            } catch (error) {
                handleInternalError(res, error, InternalErrorMessage.GameDeletionError);
            }
        });

        this.router.post('/hint', this.tokenService.validateToken, async (req: Request, res: Response) => {
            try {
                const { hintCost }: { hintCost: number } = req.body;

                if (typeof hintCost != 'number') {
                    res.sendStatus(StatusCodes.BAD_REQUEST);
                    return;
                }

                const userId = res.locals.id;
                const user: User = await this.userManagementService.getUserById(userId);
                if (!user) {
                    res.sendStatus(StatusCodes.NOT_FOUND);
                    return;
                }

                if (user.wallet < hintCost) {
                    res.sendStatus(StatusCodes.FORBIDDEN);
                    return;
                }

                user.wallet -= hintCost;
                await this.userManagementService.updateUser(user);
                res.json(user);
            } catch (error) {
                handleInternalError(res, error, "Erreur lors du traitement de l'indice");
            }
        });
        this.router.post('/:gameId/feedback', this.tokenService.validateToken, async (req: Request, res: Response) => {
            try {
                const gameId = req.params.gameId;
                const { userId, rating, comment } = req.body;

                console.log(`Received feedback for game ${gameId} from user ${userId}: ${rating} stars, comment: ${comment}`);

                await this.gameManager.addFeedbackToGame(gameId, { userId, rating, comment });
                res.status(StatusCodes.OK).json({ message: 'Feedback enregistré avec succès' });
            } catch (error) {
                console.error("Erreur lors de l'enregistrement du feedback:", error);
                handleInternalError(res, error, "Erreur lors de l'enregistrement du feedback.");
            }
        });
        this.router.patch('/:id/comments', async (req: Request, res: Response) => {
            try {
                const gameId = req.params.id;
                const updatedData = req.body;

                console.log(`Updating comments for game ${gameId}`);

                const updatedGame = await this.gameManager.modifyGame(gameId, updatedData);
                if (updatedGame === null) {
                    res.sendStatus(StatusCodes.NOT_FOUND);
                } else {
                    res.json(updatedGame);
                }
            } catch (error) {
                handleInternalError(res, error, InternalErrorMessage.GameModificationError);
            }
        });

        this.router.get('/:id/challenge', this.tokenService.validateToken, async (req: Request, res: Response) => {
            try {
                const frChallenges: Challenge[] = [
                    {
                        id: '1',
                        description: 'Répondre correctement à une QCM en maximum 5 secondes.',
                        questionType: QuestionType.QCM,
                        reward: 25,
                        isCompleted: false,
                    },
                    {
                        id: '2',
                        description: 'Répondre correctement à tous les QCM de la partie.',
                        questionType: QuestionType.QCM,
                        reward: 50,
                        isCompleted: false,
                    },
                    {
                        id: '3',
                        description: 'Répondre correctement (50% ou 100%) à une QRL en maximum 20 secondes.',
                        questionType: QuestionType.QRL,
                        reward: 25,
                        isCompleted: false,
                    },
                    {
                        id: '4',
                        description: 'Répondre correctement (50% ou 100%) à une QRL en utilisant au maximum 50 caractères, incluant les espaces.',
                        questionType: QuestionType.QRL,
                        reward: 50,
                        isCompleted: false,
                    },
                    { id: '5', description: "Obtenir la réponse exacte d'un QRE.", questionType: QuestionType.QRE, reward: 50, isCompleted: false },
                ];

                const enChallenges: Challenge[] = [
                    {
                        id: '1',
                        description: 'Answer a multiple-choice question (MCQ) correctly within 5 seconds.',
                        questionType: QuestionType.QCM,
                        reward: 25,
                        isCompleted: false,
                    },
                    {
                        id: '2',
                        description: 'Answer all multiple-choice questions (MCQ) in the game correctly.',
                        questionType: QuestionType.QCM,
                        reward: 50,
                        isCompleted: false,
                    },
                    {
                        id: '3',
                        description: 'Answer correctly (50% or 100%) to an open-ended question (OEQ) within 20 seconds.',
                        questionType: QuestionType.QRL,
                        reward: 25,
                        isCompleted: false,
                    },
                    {
                        id: '4',
                        description:
                            'Answer correctly (50% or 100%) to an open-ended question (OEQ) using a maximum of 50 characters, including spaces.',
                        questionType: QuestionType.QRL,
                        reward: 50,
                        isCompleted: false,
                    },
                    {
                        id: '5',
                        description: 'Provide the exact answer to an estimation question (EQ).',
                        questionType: QuestionType.QRE,
                        reward: 50,
                        isCompleted: false,
                    },
                ];

                const game: Game = await this.gameManager.getGameById(req.params.id);
                if (!game) {
                    res.sendStatus(StatusCodes.NOT_FOUND);
                    return;
                }

                const gameQuestionTypes: QuestionType[] = [];
                game.questions.forEach((question: Question) => {
                    if (!gameQuestionTypes.includes(question.type)) gameQuestionTypes.push(question.type);
                });

                const userId: string = res.locals.id;
                const user: User = await this.userManagementService.getUserById(userId);
                let language = user.settings.languagePreference;
                if (language.toString() === 'French') language = Language.French;
                else if (language.toString() === 'English') language = Language.English;
                let challenges: Challenge[];
                if (language === Language.French) challenges = frChallenges;
                else challenges = enChallenges;

                const availableGamechallenges: Challenge[] = challenges.filter((challenge: Challenge) => {
                    return gameQuestionTypes.includes(challenge.questionType);
                });

                const chosenChallenge: Challenge = _.sample(availableGamechallenges);
                res.json(chosenChallenge);
            } catch (error) {
                handleInternalError(res, error, "Erreur lors du traitement de l'indice");
            }
        });
    }
}
