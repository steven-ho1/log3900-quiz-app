/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable complexity */
/* eslint-disable max-params */
/* eslint-disable no-console */
/* eslint-disable max-lines */
import { ChatManager } from '@app/services/chat-manager/chat-manager';
import { DatabaseService } from '@app/services/database/database.service';
import { SessionManagementService } from '@app/services/user-services/session-management-service.service.ts/session-management-service.service';
import { UserManagementService } from '@app/services/user-services/user-management-service/user-management-service.service';
import { getMontrealDateTime } from '@app/utils/date';
import { Channel, IN_GAME_CHANNEL } from '@common/channel';
import { Game, GameInfo, QuestionType } from '@common/game';
import { GameMode } from '@common/game-mode';
import {
    ACTIVE_PLAYERS_TEXT,
    Answer,
    INACTIVE_PLAYERS_TEXT,
    LobbyDetails,
    Pin,
    Player,
    PlayerColor,
    QcmAnswer,
    QreAnswer,
    REQUIRED_PIN_LENGTH,
    SocketId,
} from '@common/lobby';
import { Message } from '@common/message';
import { TimerConfiguration } from '@common/timer';
import { Language, UserReference } from '@common/user';
import * as http from 'http';
import { ObjectId } from 'mongodb';
import * as io from 'socket.io';
import { Service } from 'typedi';

const MAX_LOBBY_QUANTITY = 10000;
const DEFAULT_COUNTDOWN_PERIOD = 1000;
const PANIC_COUNTDOWN_PERIOD = 250;
const ORGANIZER = 'Organisateur';
const SUBMITTER1_SORTED_BEFORE = -1;
const SUBMITTER1_SORTED_AFTER = 1;
const ORIGINAL_ORDER = 0;
const GLOBAL_CHAT_ID = 'Global';

@Service() // Marque la classe comme objet qu'on peut injecter dans le constructeur, comme dans Angular. On utilise alors la même instance partout.
export class SocketManager {
    private sio: io.Server;
    private lobbies: Map<Pin, LobbyDetails> = new Map<Pin, LobbyDetails>();
    private endGameLobbies: Map<Pin, LobbyDetails> = new Map<Pin, LobbyDetails>();
    private gameChannels: Map<Pin, { channelData: Channel; messages: Message[] }> = new Map();
    private server: http.Server;
    private socketUserMap: Map<string, string> = new Map<string, string>();
    private userSocketMap: Map<string, string> = new Map<string, string>();

    constructor(
        private readonly databaseService: DatabaseService,
        private readonly sessionManagementService: SessionManagementService,
        private readonly chatManager: ChatManager,
        private readonly userManagementService: UserManagementService,
    ) {}

    setHttpServer(server: http.Server) {
        this.server = server;
    }

    initializeSocketServer() {
        this.sio = new io.Server(this.server, { cors: { origin: '*', methods: ['GET', 'POST'] }, maxHttpBufferSize: 1e10 });
    }

    emitEvent<T>(event: string, data: T): void {
        if (this.sio) {
            this.sio.emit(event, data);
        }
    }

    getUserIdFromSocket(socketId: string): string | undefined {
        return this.socketUserMap.get(socketId);
    }
    getSocketIdFromUser(userId: string): string | undefined {
        return this.userSocketMap.get(userId);
    }

    handleSockets(): void {
        // Événement reçu à chaque connexion OU reconnexion (ex: perte temporaire d'internet) au serveur socket
        this.sio.on('connection', async (socket) => {
            let pin: Pin = '';
            // const currentChannelId = '';
            let nbPlayers = 0;
            let startDate = '';
            let isOrganizer = false;
            let counter: NodeJS.Timer;

            this.socketUserMap.set(socket.id, socket.handshake.auth.userId);
            console.log('adding to map : ', socket.handshake.auth.userId);
            this.userSocketMap.set(socket.handshake.auth.userId, socket.id);

            const sendLatestPlayers = () => {
                const endGameLobby = this.endGameLobbies.get(pin);
                if (endGameLobby) {
                    this.sio.to(pin).emit('latestPlayerList', endGameLobby);
                    return;
                }

                const lobbyDetails = this.lobbies.get(pin);
                this.sio.to(pin).emit('latestPlayerList', lobbyDetails);
            };

            const leaveLobby = () => {
                if (pin) {
                    const currentLobby = this.lobbies.get(pin);
                    const endGameLobby = this.endGameLobbies.get(pin);
                    const gameChannel = this.gameChannels.get(pin);

                    socket.emit('channelDeleted', gameChannel.channelData.channelId);
                    socket.leave(gameChannel.channelData.channelId);

                    if (currentLobby) {
                        // Si l'organisateur quitte, on force la sortie de tous les joueurs

                        if (isOrganizer)
                            socket.broadcast.to(pin).emit('lobbyClosed', 'NO HOST', 'Aucun organisateur | No host'); // Message à traduire côté client
                        else {
                            // Retire le joueur du nombre de joueurs en train d'écrire
                            currentLobby.players.forEach((player: Player) => {
                                if (player.socketId === socket.id && player.isTyping) setInputActivity(player, false);
                            });
                        }

                        currentLobby.players = currentLobby.players.filter((player) => player.socketId !== socket.id);
                        const remainingPlayers = currentLobby.players.filter((player) => player.role !== 'observer');

                        if (remainingPlayers.length === 0) {
                            // Si le lobby est vide, on le supprime
                            this.lobbies.delete(pin);
                            const lobbiesList: LobbyDetails[] = Array.from(this.lobbies.values());
                            socket.broadcast.emit('lobbyList', lobbiesList);

                            this.gameChannels.delete(pin);
                        } else {
                            // Sinon, mettre à jour la liste des joueurs et mettre fin à la question si le joueur est le dernier à soumettre
                            const lobbiesList: LobbyDetails[] = Array.from(this.lobbies.values());
                            socket.broadcast.emit('lobbyList', lobbiesList);

                            sendLatestPlayers();
                            checkQuestionEnd(currentLobby, { submitter: '', questionType: currentLobby.currentQuestionType, grade: null });
                        }

                        if (remainingPlayers.length === 1 && remainingPlayers[0].name === ORGANIZER) {
                            // Si l'organisateur est seul dans le lobby, on l'avertit
                            if (currentLobby.started) {
                                this.lobbies.delete(pin);
                                const lobbiesList: LobbyDetails[] = Array.from(this.lobbies.values());
                                socket.broadcast.emit('lobbyList', lobbiesList);
                            }

                            const organizerSocketId = remainingPlayers[0].socketId;
                            this.sio.to(organizerSocketId).emit('noPlayers');
                        }
                    } else if (endGameLobby) {
                        endGameLobby.players = endGameLobby.players.filter((player) => player.socketId !== socket.id);
                        if (endGameLobby.players.length === 0) {
                            this.endGameLobbies.delete(pin);
                            this.gameChannels.delete(pin);
                        }
                    }
                }
                if (pin !== socket.id) socket.leave(pin);
                pin = '';
                isOrganizer = false;
            };

            const generateRandomPin = () => {
                const pinLength = REQUIRED_PIN_LENGTH;
                return Math.floor(Math.random() * MAX_LOBBY_QUANTITY)
                    .toString()
                    .padStart(pinLength, '0');
            };
            // eslint-disable-next-line @typescript-eslint/no-shadow
            const updateObserverAndPlayerCounts = (pin: string) => {
                const lobby = this.lobbies.get(pin);
                if (lobby) {
                    const observerCount = lobby.players.filter((player) => player.role === 'observer').length;
                    this.sio.to(pin).emit('updateCounts', { observerCount });
                }
            };

            const generateUniquePin = () => {
                let newPin = '';
                do {
                    newPin = generateRandomPin();
                } while (this.lobbies.has(newPin));
                return newPin;
            };
            const updateHistogram = (updateData: { [key: string]: number }) => {
                const currentLobby = this.lobbies.get(pin);
                if (currentLobby) {
                    for (const key in updateData) {
                        if (Object.prototype.hasOwnProperty.call(updateData, key)) {
                            if (!currentLobby.histogram) currentLobby.histogram = {};
                            if (!currentLobby.histogram[key]) currentLobby.histogram[key] = 0;
                            currentLobby.histogram[key] += updateData[key];
                        }
                    }
                    this.sio.to(pin).emit('updateHistogram', currentLobby.histogram);
                }
            };

            const qrlUpdateHistogram = (updateData: { [key: string]: number }) => {
                const currentLobby = this.lobbies.get(pin);
                currentLobby.histogram = updateData;
                this.sio.to(pin).emit('qrlUpdateHistogram', currentLobby.histogram);
            };

            const startCountdown = (initialCount: number, configuration: TimerConfiguration): void => {
                let countdownPeriod = DEFAULT_COUNTDOWN_PERIOD;
                if (configuration.isPanicModeEnabled) countdownPeriod = PANIC_COUNTDOWN_PERIOD;

                if (!configuration.isInputInactivityCountdown) this.sio.to(pin).emit('countdown', initialCount);
                counter = setInterval(() => {
                    initialCount--;

                    if (!configuration.isInputInactivityCountdown) {
                        if (initialCount > 0) this.sio.to(pin).emit('countdown', initialCount);
                        else {
                            this.sio.to(pin).emit('countdown', initialCount);
                            this.sio.to(pin).emit('countdownEnd');
                            clearInterval(counter);
                        }
                    } else if (initialCount === 0) {
                        const currentLobby = this.lobbies.get(pin);
                        if (currentLobby) {
                            currentLobby.players.forEach((player: Player) => {
                                if (player.socketId === socket.id) setInputActivity(player, false);
                            });
                        }
                        clearInterval(counter);
                    }
                }, countdownPeriod);
            };

            const setInputActivity = (player: Player, isTyping: boolean) => {
                player.isTyping = isTyping;
                const incrementation = 1;
                const valueChange: number = isTyping ? incrementation : -incrementation;
                updateHistogram({ [ACTIVE_PLAYERS_TEXT]: valueChange });
                updateHistogram({ [INACTIVE_PLAYERS_TEXT]: -valueChange });
            };

            const checkQuestionEnd = (currentLobby: LobbyDetails, answer: Answer) => {
                const activePlayers = currentLobby.players.filter((player) => player.role !== 'observer');
                const areAllSubmitted = !activePlayers.some((player) => !player.answerSubmitted);
                if (areAllSubmitted) {
                    if (!currentLobby.currentQuestionType) return;

                    if (answer.questionType === QuestionType.QCM) this.sio.to(pin).emit('qcmEnd', currentLobby.bonusRecipient);
                    else if (answer.questionType === QuestionType.QRE) this.sio.to(pin).emit('qreEnd', currentLobby.bonusRecipient);
                    else {
                        const sortedAnswers = currentLobby.qrlAnswers.sort((answer1: Answer, answer2: Answer) => {
                            const submitter1 = answer1.submitter.toUpperCase();
                            const submitter2 = answer2.submitter.toUpperCase();
                            if (submitter1 < submitter2) return SUBMITTER1_SORTED_BEFORE;
                            if (submitter1 > submitter2) return SUBMITTER1_SORTED_AFTER;
                            return ORIGINAL_ORDER;
                        });
                        this.sio.to(pin).emit('qrlEnd', sortedAnswers);
                        currentLobby.players.forEach((player: Player) => {
                            if (player.isTyping) setInputActivity(player, false);
                        });
                    }

                    currentLobby.players.forEach((player) => {
                        if (player.name !== ORGANIZER) player.answerSubmitted = false;
                    });
                    currentLobby.qrlAnswers = [];
                    currentLobby.qreAnswers = [];
                    currentLobby.qcmAnswers = [];
                    currentLobby.bonusRecipient = '';
                    currentLobby.currentQuestionType = undefined;
                }
            };

            socket.on('validatePin', async (data) => {
                const { username, avatar, pinToJoin } = data;

                if (this.lobbies.has(pinToJoin)) {
                    const lobbyToJoin = this.lobbies.get(pinToJoin);
                    if (lobbyToJoin.isLocked) {
                        const language: Language = await this.userManagementService.getLanguageByUserId(socket.handshake.auth.userId);
                        socket.emit(
                            'invalidPin',
                            language === Language.French
                                ? `La partie de PIN ${pinToJoin} a été verrouillée par l'organisateur.`
                                : `The game of PIN ${pinToJoin} has been locked by the organizer.`,
                        );
                    } else {
                        if (lobbyToJoin.bannedNames.find((bannedName) => bannedName.toLowerCase() === username)) {
                            const language: Language = await this.userManagementService.getLanguageByUserId(socket.handshake.auth.userId);
                            socket.emit('invalidPin', language === Language.French ? 'Vous êtes banni' : 'You have been banned');
                        } else {
                            try {
                                const userId = socket.handshake.auth.userId;
                                const user = await this.userManagementService.getUserById(userId);

                                if (user.wallet < lobbyToJoin.entryFee) {
                                    socket.emit('Not enough cash, stranger!');
                                    return;
                                }
                                // Vérification si la partie est uniquement pour les amis
                                if (lobbyToJoin.friendOnly) {
                                    const organizerSocketId = lobbyToJoin.players[0].socketId;
                                    const organizerUserId = this.getUserIdFromSocket(organizerSocketId);
                                    const organizer = await this.userManagementService.getUserById(organizerUserId);

                                    const isFriend = organizer.friends.some((friend) => friend.id === userId);
                                    if (!isFriend) {
                                        const language: Language = await this.userManagementService.getLanguageByUserId(socket.handshake.auth.userId);
                                        socket.emit(
                                            'invalidPin',
                                            language === Language.French
                                                ? "Partie réservée aux amis de l'organisateur."
                                                : "Game reserved for the organizer's friends.",
                                        );
                                        return;
                                    }
                                }

                                // Vérification si un joueur présent a bloqué l'utilisateur
                                const playerUserIds = lobbyToJoin.players.map((player) => this.getUserIdFromSocket(player.socketId));
                                const hasBlockedByUser = playerUserIds.some((playerId) =>
                                    user.blockedBy.some((blockedUser) => blockedUser.id === playerId),
                                );
                                if (hasBlockedByUser) {
                                    const language: Language = await this.userManagementService.getLanguageByUserId(socket.handshake.auth.userId);
                                    socket.emit(
                                        'invalidPin',
                                        language === Language.French
                                            ? 'Vous ne pouvez pas rejoindre cette partie, un joueur dans la partie vous a bloqué.'
                                            : 'You cannot join this game; a player in the game has blocked you.',
                                    );
                                    return;
                                }

                                // Vérification si un joueur présent est bloqué par l'utilisateur
                                const hasBlockedUser = playerUserIds.some((playerId) =>
                                    user.blockedPlayers.some((blockedUser) => blockedUser.id === playerId),
                                );
                                if (hasBlockedUser) {
                                    // Avertir l'utilisateur
                                    const language: Language = await this.userManagementService.getLanguageByUserId(socket.handshake.auth.userId);

                                    socket.emit('blockedUserWarning', {
                                        message:
                                            language === Language.French
                                                ? 'Un joueur que vous avez bloqué est dans cette partie. Voulez-vous tout de même rejoindre?'
                                                : 'A player you have blocked is in this game. Do you still want to join?',
                                        pin: pinToJoin,
                                    });
                                    return;
                                }

                                // console.log('wallet before', user.wallet);
                                user.wallet -= lobbyToJoin.entryFee;
                                await this.userManagementService.updateUser(user);
                                // console.log('wallet after ', user.wallet);
                                lobbyToJoin.entryFeeSum += lobbyToJoin.entryFee;

                                socket.join(pinToJoin);
                                pin = pinToJoin;
                                const newPlayer: Player = {
                                    socketId: socket.id,
                                    name: username,
                                    answerSubmitted: false,
                                    score: 0,
                                    activityState: PlayerColor.Red,
                                    isAbleToChat: true,
                                    bonusTimes: 0,
                                    isTyping: false,
                                    avatar,
                                    role: 'player',
                                };
                                lobbyToJoin.players.push(newPlayer);

                                const lobbiesList: LobbyDetails[] = Array.from(this.lobbies.values());
                                socket.broadcast.emit('lobbyList', lobbiesList);
                                sendLatestPlayers();
                                socket.emit('validPin', lobbyToJoin, pin, user);

                                const gameChannel: Channel = this.gameChannels.get(pin).channelData;
                                gameChannel.members.push(username);
                                socket.join(gameChannel.channelId);
                                socket.emit('channelCreated', gameChannel, true);
                            } catch (error) {
                                console.log('Erreur durant le traitement durant la validation du PIN');
                            }
                        }
                    }
                } else {
                    const language: Language = await this.userManagementService.getLanguageByUserId(socket.handshake.auth.userId);
                    socket.emit(
                        'invalidPin',
                        language === Language.French ? `Partie de PIN ${pinToJoin} introuvable.` : `Game of PIN ${pinToJoin} not found.`,
                    );
                }
            });
            socket.on('joinAsObserver', async (data) => {
                const { username, pinToJoin } = data;
                try {
                    const userId = socket.handshake.auth.userId;
                    const user = await this.userManagementService.getUserById(userId);

                    if (!user) {
                        socket.emit('error', 'User not found');
                        return;
                    }

                    const lobby = this.lobbies.get(pinToJoin);
                    if (lobby) {
                        pin = pinToJoin;
                        socket.join(pinToJoin);
                        lobby.players.push({
                            socketId: socket.id,
                            name: username,
                            score: 0,
                            activityState: PlayerColor.Red,
                            isAbleToChat: true,
                            bonusTimes: 0,
                            isTyping: false,
                            role: 'observer',
                        });
                        const lobbiesList: LobbyDetails[] = Array.from(this.lobbies.values());
                        socket.broadcast.emit('lobbyList', lobbiesList);

                        socket.emit('validPin', lobby, pinToJoin, user);
                        socket.emit('currentQuestionUpdated', lobby.currentQuestionNumber);
                        updateObserverAndPlayerCounts(pinToJoin);

                        const gameChannel: Channel = this.gameChannels.get(pin)?.channelData;
                        if (gameChannel) {
                            gameChannel.members.push(username);
                            socket.join(gameChannel.channelId);
                            socket.emit('channelCreated', gameChannel, true);
                            console.log(gameChannel.members);
                        }
                    } else {
                        socket.emit('error', 'Lobby not found');
                    }
                } catch (error) {
                    console.error('Error in joinAsObserver:', error);
                    socket.emit('error', 'An error occurred while joining as observer');
                }
            });
            socket.on('updateCurrentQuestionNumber', (data) => {
                const { pin, currentQuestionNumber } = data;
                const lobby = this.lobbies.get(pin);
                if (lobby) {
                    lobby.currentQuestionNumber = currentQuestionNumber;
                    lobby.qrlAnswers = [];
                    lobby.qreAnswers = [];
                    lobby.qcmAnswers = [];

                    // Emit the updated current question number to all clients
                    this.sio.to(pin).emit('currentQuestionUpdated', currentQuestionNumber);
                    console.log(currentQuestionNumber);
                }
            });

            socket.on('confirmJoin', async (data) => {
                const { username, avatar, pinToJoin } = data;

                console.log('data pin to join is : ', data.pinToJoin);

                if (this.lobbies.has(pinToJoin)) {
                    const lobbyToJoin = this.lobbies.get(pinToJoin);
                    if (lobbyToJoin.isLocked) {
                        const language: Language = await this.userManagementService.getLanguageByUserId(socket.handshake.auth.userId);
                        socket.emit(
                            'invalidPin',
                            language === Language.French
                                ? `La partie de PIN ${pinToJoin} a été verrouillée par l'organisateur.`
                                : `The game of PIN ${pinToJoin} has been locked by the organizer.`,
                        );
                    } else {
                        try {
                            const userId = socket.handshake.auth.userId;
                            const user = await this.userManagementService.getUserById(userId);

                            // console.log('wallet before', user.wallet);
                            user.wallet -= lobbyToJoin.entryFee;
                            await this.userManagementService.updateUser(user);
                            // console.log('wallet after ', user.wallet);
                            lobbyToJoin.entryFeeSum += lobbyToJoin.entryFee;

                            socket.join(pinToJoin);
                            pin = pinToJoin;
                            const newPlayer = {
                                socketId: socket.id,
                                name: username,
                                answerSubmitted: false,
                                score: 0,
                                activityState: PlayerColor.Red,
                                isAbleToChat: true,
                                bonusTimes: 0,
                                isTyping: false,
                                avatar,
                            };
                            lobbyToJoin.players.push(newPlayer);
                            sendLatestPlayers();
                            socket.emit('validPin', lobbyToJoin.game, pin, user);

                            const lobbiesList: LobbyDetails[] = Array.from(this.lobbies.values());
                            socket.broadcast.emit('lobbyList', lobbiesList);

                            const gameChannel: Channel = this.gameChannels.get(pin).channelData;
                            gameChannel.members.push(username);
                            socket.join(gameChannel.channelId);
                            socket.emit('channelCreated', gameChannel, true);
                        } catch (error) {
                            console.log('Erreur durant le traitement durant la validation du PIN');
                        }
                    }
                } else {
                    const language: Language = await this.userManagementService.getLanguageByUserId(socket.handshake.auth.userId);

                    socket.emit(
                        'invalidPin',
                        language === Language.French ? `Partie de PIN ${pinToJoin} introuvable.` : `Game of PIN ${pinToJoin} not found.`,
                    );
                }
            });

            socket.on('createLobby', (currentGame: Game, entryFee: number, isFriendsOnly: boolean) => {
                if (this.lobbies.size <= MAX_LOBBY_QUANTITY) {
                    const newPin = generateUniquePin();
                    this.lobbies.set(newPin, {
                        isLocked: false,
                        started: false,
                        players: [],
                        bannedNames: [],
                        game: currentGame,
                        qrlAnswers: [],
                        qreAnswers: [],
                        qcmAnswers: [],
                        pin: newPin,
                        entryFee,
                        entryFeeSum: 0,
                        friendOnly: isFriendsOnly,
                        currentQuestionNumber: 0,
                    });
                    socket.join(newPin);
                    pin = newPin;

                    const lobbyCreated = this.lobbies.get(newPin);
                    lobbyCreated.players.push({
                        socketId: socket.id,
                        name: ORGANIZER,
                        answerSubmitted: true,
                        score: 0,
                        activityState: PlayerColor.Green,
                        isAbleToChat: true,
                        bonusTimes: 0,
                        isTyping: false,
                    });
                    isOrganizer = true;
                    socket.emit('successfulLobbyCreation', pin);

                    const lobbiesList: LobbyDetails[] = Array.from(this.lobbies.values());
                    socket.broadcast.emit('lobbyList', lobbiesList);

                    const gameChannel: Channel = {
                        channelId: new ObjectId().toString(),
                        channelName: IN_GAME_CHANNEL,
                        members: ['Organisateur'],
                        membersList: [],
                    };
                    this.gameChannels.set(pin, { channelData: gameChannel, messages: [] });
                    socket.join(gameChannel.channelId);
                    socket.emit('channelCreated', gameChannel, true);
                } else socket.emit('failedLobbyCreation', "Quantité maximale de salles d'attente atteinte");
            });

            socket.on('getPlayers', () => {
                sendLatestPlayers();
            });

            socket.on('banPlayer', async (playerToBan: { socketId: SocketId; name: string }) => {
                const socketToBan = this.sio.sockets.sockets.get(playerToBan.socketId);
                const currentLobby = this.lobbies.get(pin);
                currentLobby.players = currentLobby.players.filter((player) => player.name !== playerToBan.name);
                currentLobby.bannedNames.push(playerToBan.name);

                const userIdToBan = this.getUserIdFromSocket(socketToBan.id);
                const language: Language = await this.userManagementService.getLanguageByUserId(userIdToBan);
                socketToBan.emit('lobbyClosed', 'BAN', language === Language.French ? 'Vous avez été banni' : 'You have been banned');
            });

            socket.on('toggleLock', () => {
                const currentLobby = this.lobbies.get(pin);
                currentLobby.isLocked = !currentLobby.isLocked;
                socket.emit('lockToggled', currentLobby.isLocked);
                const lobbiesList: LobbyDetails[] = Array.from(this.lobbies.values());
                socket.broadcast.emit('lobbyList', lobbiesList);
            });

            socket.on('lobbyStart', () => {
                const currentLobby = this.lobbies.get(pin);
                currentLobby.started = true;
                const lobbiesList: LobbyDetails[] = Array.from(this.lobbies.values());
                this.sio.emit('lobbyList', lobbiesList); // Actualise la liste des lobbys chez tous les clients
                socket.emit('lobbyStarted', currentLobby.started);
                socket.broadcast.emit('lobbyList', lobbiesList);
            });

            socket.on('leaveLobby', () => {
                leaveLobby();
            });

            socket.on('startCountdown', (initialCount: number, configuration: TimerConfiguration, gameMode: GameMode) => {
                if (configuration.isQuestionTransition) this.sio.to(pin).emit('questionTransition', configuration.isQuestionTransition);
                if (gameMode === GameMode.Testing) pin = socket.id;
                if (configuration.isInputInactivityCountdown) clearInterval(counter);
                this.sio.to(pin).emit('countdownStarted');
                startCountdown(initialCount, configuration);
            });

            socket.on('stopCountdown', () => {
                if (isOrganizer) this.sio.to(pin).emit('countdownStopped');
                clearInterval(counter);
            });

            socket.on('createChannel', async (channelName, callback) => {
                try {
                    const newChannel = await this.chatManager.createChannel(channelName);
                    this.sio.emit('channelCreated', newChannel);
                    this.sio.emit('channelsList', await this.chatManager.getAllChannels());

                    if (callback) {
                        callback({ success: true, channelId: newChannel.channelId });
                    }
                } catch (error) {
                    console.error('Error creating channel:', error);
                    if (callback) {
                        callback({ success: false, error: 'Error creating channel' });
                    }
                }
            });

            socket.on('deleteChannel', async (channelId: string, callback) => {
                if (channelId === GLOBAL_CHAT_ID) {
                    callback({ success: false, error: 'Cannot delete the Global channel.' });
                    return;
                }
                try {
                    await this.chatManager.deleteChannel(channelId);
                    this.sio.emit('channelDeleted', channelId);
                    callback({ success: true });
                } catch (error) {
                    console.error('Error deleting channel:', error);
                    callback({ success: false, error: 'Error deleting channel' });
                }
            });

            socket.on('joinChannel', async (channelId: string, username: string, callback) => {
                try {
                    const gameChannel = this.gameChannels.get(pin);
                    if (gameChannel?.channelData.channelId === channelId) {
                        const messages = gameChannel.messages;
                        socket.emit('messagesFetch', messages);
                        callback({ success: true });
                        return;
                    }

                    const joined = await this.chatManager.joinChannel(channelId, username);
                    if (joined) {
                        socket.join(channelId);
                        const messages = await this.chatManager.getMessagesById(channelId);
                        socket.emit('messagesFetch', messages);
                        callback({ success: true });
                    } else {
                        callback({ success: false, error: 'Could not join channel.' });
                    }
                } catch (error) {
                    console.error('Error joining channel:', error);
                    callback({ success: false, error: 'Error joining channel' });
                }
            });

            socket.on('leaveChannel', async (channelId: string, username: string, callback) => {
                try {
                    const userId = socket.handshake.auth.userId;
                    console.log('leaving channel');
                    await this.chatManager.leaveChannel(channelId, userId, username);
                    socket.leave(channelId);
                    callback({ success: true });
                } catch (error) {
                    console.error('Error leaving channel:', error);
                    callback({ success: false, error: 'Error leaving channel' });
                }
            });

            socket.on('chatMessage', async (message: Message) => {
                try {
                    message.time = getMontrealDateTime(true);
                    socket.join(message.channelId);

                    const gameChannel = this.gameChannels.get(pin);
                    if (gameChannel?.channelData.channelId === message.channelId) {
                        let sender: Player;
                        const lobby = this.lobbies.get(pin);
                        const endLobby = this.endGameLobbies.get(pin);

                        if (lobby) sender = lobby.players.find((player: Player) => player.name === message.sender);
                        else sender = endLobby.players.find((player: Player) => player.name === message.sender);

                        if (sender?.isAbleToChat || isOrganizer) {
                            console.log('SHOULD EXECUTE');
                            gameChannel.messages.push(message);
                            this.sio.to(message.channelId).emit('messageReceived', message);
                        } else socket.emit('PlayerMuted');
                    } else {
                        this.sio.to(message.channelId).emit('messageReceived', message);
                        await this.chatManager.saveMessageToBd(message);
                    }
                } catch (error) {
                    console.error("Erreur dans l'événement chatMessage : ", error);
                }
            });
            socket.on('joinMembersList', async (channelId, username, callback) => {
                try {
                    const joined = await this.chatManager.addToMembersList(channelId, username);
                    if (joined) {
                        callback({ success: true });
                    } else {
                        callback({ success: false });
                    }
                } catch (error) {
                    console.error('Error in joinMembersList:', error);
                    callback({ success: false });
                }
            });
            socket.on('removeFromMembersList', async (channelId, username, callback) => {
                try {
                    // Appeler la fonction pour retirer l'utilisateur de la membersList
                    await this.chatManager.removeFromMembersList(channelId, username);
                    console.log(`Successfully removed ${username} from membersList of channel ${channelId}`);

                    // Si le callback est fourni, envoyer la réponse de succès
                    if (typeof callback === 'function') {
                        callback({ success: true });
                    }
                } catch (error) {
                    console.error('Error in removeFromMembersList:', error);

                    // Si le callback est fourni, envoyer la réponse d'échec
                    if (typeof callback === 'function') {
                        callback({ success: false, error: 'Error removing user from membersList' });
                    }
                }
            });

            socket.on('getChat', async (channelId: string) => {
                try {
                    let messages;
                    const gameChannel = this.gameChannels.get(pin);

                    if (gameChannel?.channelData.channelId === channelId) {
                        messages = gameChannel.messages;
                    } else {
                        messages = await this.chatManager.getMessagesById(channelId);
                    }
                    socket.emit('messagesFetch', messages);
                } catch (error) {
                    console.error(`Error getting messages for channel ${channelId}:`, error);
                }
            });

            socket.on('answerSubmitted', (answer: Answer, submittedFromTimer: boolean) => {
                const currentLobby = this.lobbies.get(pin);
                if (currentLobby) {
                    const currentPlayer = currentLobby.players.find((player) => player.socketId === socket.id);
                    if (currentPlayer && currentPlayer.role !== 'observer') {
                        if (answer.questionType === QuestionType.QCM && !currentLobby.bonusRecipient && answer.isCorrect && !submittedFromTimer)
                            currentLobby.bonusRecipient = socket.id;
                        else if (answer.questionType === QuestionType.QRL) currentLobby.qrlAnswers.push(answer);

                        if (!currentLobby.currentQuestionType) currentLobby.currentQuestionType = answer.questionType;

                        currentLobby.players.forEach((player) => {
                            if (player.socketId === socket.id) {
                                player.answerSubmitted = true;
                                if (!submittedFromTimer) {
                                    player.activityState = PlayerColor.Green;
                                }
                            }
                        });

                        sendLatestPlayers();
                        checkQuestionEnd(currentLobby, answer);
                    }
                }
            });
            socket.on('qreAnswerSubmitted', (qreAnswer: QreAnswer, submittedFromTimer: boolean) => {
                const currentLobby = this.lobbies.get(pin);
                if (currentLobby) {
                    const currentPlayer = currentLobby.players.find((player) => player.socketId === socket.id);
                    if (currentPlayer && currentPlayer.role !== 'observer') {
                        currentLobby.qreAnswers.push(qreAnswer);
                        console.log(qreAnswer);

                        currentLobby.players.forEach((player) => {
                            if (player.socketId === socket.id) {
                                player.answerSubmitted = true;
                                if (!submittedFromTimer) {
                                    player.activityState = PlayerColor.Green;
                                }
                            }
                        });
                        this.sio.to(pin).emit('latestLobbyData', currentLobby);

                        sendLatestPlayers();
                    }
                }
            });
            socket.on('qcmAnswerSubmitted', (qcmAnswer: QcmAnswer) => {
                const currentLobby = this.lobbies.get(pin);
                if (currentLobby) {
                    const currentPlayer = currentLobby.players.find((player) => player.socketId === socket.id);
                    if (currentPlayer && currentPlayer.role !== 'observer') {
                        currentLobby.qcmAnswers.push(qcmAnswer);

                        currentLobby.players.forEach((player) => {
                            if (player.socketId === socket.id) {
                                player.answerSubmitted = true;
                                player.activityState = PlayerColor.Green;
                            }
                        });
                        console.log(qcmAnswer);
                        this.sio.to(pin).emit('latestLobbyData', currentLobby);
                    }
                }
            });

            socket.on('markInputActivity', () => {
                this.lobbies.get(pin).players.forEach((player: Player) => {
                    if (player.socketId === socket.id && !player.isTyping) setInputActivity(player, true);
                });
            });

            socket.on('evaluationPhaseCompleted', (qrlAnswers: Answer[]) => {
                this.sio.to(pin).emit('qrlResults', qrlAnswers);
            });

            socket.on('enablePanicMode', () => {
                this.sio.to(pin).emit('panicMode');
            });

            socket.on('histogramUpdate', (updateData: { [key: string]: number }) => {
                updateHistogram(updateData);
            });

            socket.on('submitScore', (updatedScore: number) => {
                const currentLobby = this.lobbies.get(pin);
                if (currentLobby) {
                    const currentPlayer = currentLobby.players.find((player) => player.socketId === socket.id);
                    if (currentPlayer) {
                        currentPlayer.score = updatedScore;
                        this.sio.to(pin).emit('scoreUpdated', currentPlayer);
                    }
                }
            });

            socket.on('gameEnded', async () => {
                if (isOrganizer) {
                    const lobby = this.lobbies.get(pin);

                    this.endGameLobbies.set(pin, lobby);
                    this.sio.to(pin).emit('showResults');

                    const db = this.databaseService.getDb();
                    const historyCollection = db.collection('Historique');
                    const game: GameInfo = {
                        name: lobby.game.title,
                        date: startDate,
                        numberPlayers: nbPlayers,
                        bestScore: lobby.players.sort((a, b) => {
                            return b.score - a.score;
                        })[0].score,
                    };

                    await historyCollection.insertOne(game);

                    this.lobbies.delete(pin);
                    const lobbiesList: LobbyDetails[] = Array.from(this.lobbies.values());
                    socket.broadcast.emit('lobbyList', lobbiesList);
                }
            });

            socket.on('resetHistogram', () => {
                const currentLobby = this.lobbies.get(pin);
                if (currentLobby) {
                    currentLobby.histogram = null;
                    this.sio.to(pin).emit('updateHistogram', currentLobby.histogram);
                }
            });

            socket.on('updateBonusTimes', (bonusTimes: number) => {
                const currentLobby = this.lobbies.get(pin);
                if (currentLobby) {
                    const currentPlayer = currentLobby.players.find((player) => player.socketId === socket.id);
                    if (currentPlayer) {
                        currentPlayer.bonusTimes = bonusTimes;
                        this.sio.to(pin).emit('latestPlayerList', currentLobby);
                    }
                }
            });

            socket.on('toggleMute', (playerToMute: Player) => {
                const lobby = this.lobbies.get(pin);
                if (lobby) {
                    const playerFound = lobby.players.find((player: Player) => player.name === playerToMute.name);
                    playerFound.isAbleToChat = !playerFound.isAbleToChat;
                }
            });

            socket.on('socketInteracted', () => {
                const currentLobby = this.lobbies.get(pin);
                if (currentLobby) {
                    currentLobby.players.forEach((player) => {
                        if (player.socketId === socket.id) {
                            player.activityState = PlayerColor.Yellow;
                        }
                    });
                    sendLatestPlayers();
                }
            });
            socket.on('resetPlayersActivityState', () => {
                const currentLobby = this.lobbies.get(pin);
                if (currentLobby) {
                    currentLobby.players.forEach((player) => {
                        player.activityState = PlayerColor.Red;
                    });
                    sendLatestPlayers();
                }
            });

            socket.on('getChannels', async () => {
                try {
                    const channels = await this.chatManager.getAllChannels();
                    socket.emit('channelsList', channels);
                } catch (error) {
                    console.error('Error getting channels:', error);
                    socket.emit('channelsListError', 'Error getting channels');
                }
            });

            socket.on('qrlHistogramUpdate', (updateData: { [key: string]: number }) => {
                qrlUpdateHistogram(updateData);
            });

            socket.on('gameStarted', () => {
                nbPlayers = this.lobbies.get(pin).players.length - 1;
                startDate = new Date().toLocaleString('sv', { timeZone: 'America/New_York' });
            });

            socket.on('getActiveLobbies', () => {
                const lobbiesList: LobbyDetails[] = Array.from(this.lobbies.values());
                socket.emit('lobbyList', lobbiesList);
            });

            // Gestion des amis ---------------------------------------------

            socket.on('getAllUsers', async () => {
                const allUsers = await this.userManagementService.getUsers();
                socket.emit('allUsers', allUsers);
            });
            socket.on('leaveObserver', (data) => {
                const { pin } = data;
                const currentLobby = this.lobbies.get(pin);

                if (currentLobby) {
                    currentLobby.players = currentLobby.players.filter((player) => player.socketId !== socket.id);
                    updateObserverAndPlayerCounts(pin); // Met à jour le compteur
                    const lobbiesList: LobbyDetails[] = Array.from(this.lobbies.values());
                    this.sio.emit('lobbyList', lobbiesList); // Diffuse la mise à jour
                }
                socket.leave(pin);
            });

            socket.on('sendFriendRequest', async (id: string) => {
                try {
                    const senderId = this.getUserIdFromSocket(socket.id);
                    const recipient = await this.userManagementService.getUserById(id);

                    console.log('socket user map is : ', this.socketUserMap);
                    console.log('user to send friend request to: ', id);
                    console.log('Type of user.id:', typeof id);
                    console.log('recipient: ', recipient.username);
                    console.log('senderId: ', senderId);

                    const language: Language = await this.userManagementService.getLanguageByUserId(socket.handshake.auth.userId);
                    if (!recipient) {
                        socket.emit('friendRequestError', { message: language === Language.French ? 'Utilisateur introuvable.' : 'User not found.' });
                        return;
                    }

                    if (recipient.pendingReceivedRequests.some((req) => req.id === senderId)) {
                        socket.emit('friendRequestError', {
                            message: language === Language.French ? 'Demande déjà envoyée.' : 'Request already sent.',
                        });
                        return;
                    }

                    console.log('recipient has requests : ', recipient.pendingReceivedRequests);

                    const senderData = await this.userManagementService.getUserById(senderId);
                    console.log('Sender data:', senderData);
                    const recipientUserReference: UserReference = { id: recipient.id, username: recipient.username, avatar: recipient.avatar };
                    const senderUserReference: UserReference = { id: senderId, username: senderData.username, avatar: senderData.avatar };

                    senderData.pendingSentRequests.push(recipientUserReference);

                    recipient.pendingReceivedRequests.push(senderUserReference);

                    await this.userManagementService.updateUser(senderData);
                    await this.userManagementService.updateUser(recipient);
                    const allUsers = await this.userManagementService.getUsers();
                    socket.emit('allUsers', allUsers);
                    // Notifier le destinataire en temps réel
                    const recipientSocketId = this.getSocketIdFromUser(id);
                    if (recipientSocketId) {
                        this.sio.to(recipientSocketId).emit('allUsers', allUsers);
                    }
                } catch (error) {
                    console.error("Erreur lors de l'envoi de la demande d'ami :", error);
                    const language: Language = await this.userManagementService.getLanguageByUserId(socket.handshake.auth.userId);

                    socket.emit('friendRequestError', {
                        message:
                            language === Language.French
                                ? 'Une erreur est survenue lors de la demande.'
                                : 'Unexpected error when sending friend request.',
                    });
                }
            });

            socket.on('acceptFriendRequest', async (id: string) => {
                try {
                    const senderId = this.getUserIdFromSocket(socket.id);
                    const recipient = await this.userManagementService.getUserById(id);
                    const language: Language = await this.userManagementService.getLanguageByUserId(socket.handshake.auth.userId);
                    if (!recipient) {
                        socket.emit('friendRequestError', { message: language === Language.French ? 'Utilisateur introuvable.' : 'User not found.' });
                        return;
                    }

                    recipient.pendingSentRequests = recipient.pendingSentRequests.filter((req) => req.id !== senderId);

                    const senderData = await this.userManagementService.getUserById(senderId);
                    if (!senderData) {
                        socket.emit('friendRequestError', {
                            message: language === Language.French ? 'Utilisateur expéditeur introuvable.' : 'Sender of friend request not found.',
                        });
                        return;
                    }
                    senderData.pendingReceivedRequests = senderData.pendingReceivedRequests.filter((req) => req.id !== id);
                    // Ajouter les utilisateurs dans leurs listes d'amis respectives
                    recipient.friends.push({ id: senderId, username: senderData.username, avatar: senderData.avatar });
                    senderData.friends.push({ id: recipient.id, username: recipient.username, avatar: recipient.avatar });

                    await this.userManagementService.updateUser(senderData);
                    await this.userManagementService.updateUser(recipient);

                    // // Notifier les deux utilisateurs en temps réel
                    const allUsers = await this.userManagementService.getUsers();
                    socket.emit('allUsers', allUsers);
                    // Notifier le destinataire en temps réel
                    const recipientSocketId = this.getSocketIdFromUser(id);
                    if (recipientSocketId) {
                        this.sio.to(recipientSocketId).emit('allUsers', allUsers);
                    }
                } catch (error) {
                    const language: Language = await this.userManagementService.getLanguageByUserId(socket.handshake.auth.userId);
                    console.error("Erreur lors de l'acceptation de la demande d'ami :", error);
                    socket.emit('friendRequestError', {
                        message:
                            language === Language.French
                                ? "Une erreur est survenue lors de l'acceptation de la demande."
                                : 'Unexpected error when accepting friend request.',
                    });
                }
            });

            socket.on('blockUser', async (id: string) => {
                try {
                    const senderId = this.getUserIdFromSocket(socket.id);
                    const recipient = await this.userManagementService.getUserById(id);
                    const language: Language = await this.userManagementService.getLanguageByUserId(socket.handshake.auth.userId);
                    if (!recipient) {
                        socket.emit('blockError', { message: language === Language.French ? 'Utilisateur introuvable.' : 'User not found.' });
                        return;
                    }

                    const senderData = await this.userManagementService.getUserById(senderId);
                    if (!senderData) {
                        socket.emit('blockError', {
                            message: language === Language.French ? 'Utilisateur expéditeur introuvable.' : 'Sender not found.',
                        });
                        return;
                    }
                    // si le block vient de la liste damis alors on enlever de chaque friends list
                    if (recipient.friends.some((req) => req.id === senderId)) {
                        recipient.friends = recipient.friends.filter((req) => req.id !== senderId);
                        senderData.friends = senderData.friends.filter((req) => req.id !== id);
                    }
                    // va le faire either way
                    recipient.blockedBy.push({ id: senderId, username: senderData.username, avatar: senderData.avatar });
                    senderData.blockedPlayers.push({ id: recipient.id, username: recipient.username, avatar: recipient.avatar });

                    await this.userManagementService.updateUser(senderData);
                    await this.userManagementService.updateUser(recipient);

                    const allUsers = await this.userManagementService.getUsers();
                    socket.emit('allUsers', allUsers);
                    // Notifier le destinataire en temps réel
                    const recipientSocketId = this.getSocketIdFromUser(id);
                    if (recipientSocketId) {
                        this.sio.to(recipientSocketId).emit('allUsers', allUsers);
                    }
                } catch (error) {
                    const language: Language = await this.userManagementService.getLanguageByUserId(socket.handshake.auth.userId);
                    console.error("Erreur lors du blocage de l'utilisateur :", error);
                    socket.emit('blockError', {
                        message:
                            language === Language.French
                                ? "Une erreur est survenue lors du blocage de l'utilisateur."
                                : 'Unexpected error when blocking user',
                    });
                }
            });

            socket.on('removeFriend', async (id: string) => {
                try {
                    const senderId = this.getUserIdFromSocket(socket.id);
                    const recipient = await this.userManagementService.getUserById(id);
                    const language: Language = await this.userManagementService.getLanguageByUserId(socket.handshake.auth.userId);
                    if (!recipient) {
                        socket.emit('removeFriendError', { message: language === Language.French ? 'Utilisateur introuvable.' : 'User not found.' });
                        return;
                    }

                    const senderData = await this.userManagementService.getUserById(senderId);
                    if (!senderData) {
                        socket.emit('removeFriendError', {
                            message: language === Language.French ? 'Utilisateur expéditeur introuvable.' : 'Sender not found.',
                        });
                        return;
                    }
                    if (senderData.friends.some((req) => req.id === id)) {
                        // Retirer les utilisateurs dans leurs listes d'amis respectives
                        recipient.friends = recipient.friends.filter((req) => req.id !== senderId);
                        senderData.friends = senderData.friends.filter((req) => req.id !== id);

                        await this.userManagementService.updateUser(senderData);
                        await this.userManagementService.updateUser(recipient);

                        const allUsers = await this.userManagementService.getUsers();
                        socket.emit('allUsers', allUsers);
                        // Notifier le destinataire en temps réel
                        const recipientSocketId = this.getSocketIdFromUser(id);
                        if (recipientSocketId) {
                            this.sio.to(recipientSocketId).emit('allUsers', allUsers);
                        }
                    } else {
                        socket.emit('removeFriendError', {
                            message: language === Language.French ? 'Utilisateur a déjà été retiré de la liste.' : 'User has already been removed.',
                        });
                        return;
                    }
                } catch (error) {
                    const language: Language = await this.userManagementService.getLanguageByUserId(socket.handshake.auth.userId);
                    console.error("Erreur lors du retrait de l'ami :", error);
                    socket.emit('removeFriendError', {
                        message:
                            language === Language.French
                                ? "Une erreur est survenue lors du retrait de l'ami."
                                : 'Unexpected error when removing friend',
                    });
                }
            });

            socket.on('unblockUser', async (id: string) => {
                try {
                    const language: Language = await this.userManagementService.getLanguageByUserId(socket.handshake.auth.userId);
                    const senderId = this.getUserIdFromSocket(socket.id);
                    const recipient = await this.userManagementService.getUserById(id);
                    if (!recipient) {
                        socket.emit('unblockError', { message: language === Language.French ? 'Utilisateur introuvable.' : 'User not found.' });
                        return;
                    }

                    const senderData = await this.userManagementService.getUserById(senderId);
                    if (!senderData) {
                        socket.emit('unblockError', {
                            message: language === Language.French ? 'Utilisateur expéditeur introuvable.' : 'Sender not found',
                        });
                        return;
                    }
                    // Ajouter les utilisateurs dans leurs listes d'amis respectives
                    senderData.blockedPlayers = senderData.blockedPlayers.filter((req) => req.id !== id);
                    recipient.blockedBy = recipient.blockedBy.filter((req) => req.id !== senderId);

                    await this.userManagementService.updateUser(senderData);
                    await this.userManagementService.updateUser(recipient);

                    // // Notifier les deux utilisateurs en temps réel
                    const allUsers = await this.userManagementService.getUsers();
                    socket.emit('allUsers', allUsers);
                    // Notifier le destinataire en temps réel
                    const recipientSocketId = this.getSocketIdFromUser(id);
                    if (recipientSocketId) {
                        this.sio.to(recipientSocketId).emit('allUsers', allUsers);
                    }
                } catch (error) {
                    console.error("Erreur lors du deblocage de l'utilisateur :", error);
                    const language: Language = await this.userManagementService.getLanguageByUserId(socket.handshake.auth.userId);

                    socket.emit('unblockError', {
                        message:
                            language === Language.French
                                ? "Une erreur est survenue lors du deblocage de l'utilisateur."
                                : 'Unexpected error when unblocking user',
                    });
                }
            });

            socket.on('declineFriendRequest', async (id: string) => {
                try {
                    const language: Language = await this.userManagementService.getLanguageByUserId(socket.handshake.auth.userId);

                    const senderId = this.getUserIdFromSocket(socket.id);
                    const recipient = await this.userManagementService.getUserById(id);
                    if (!recipient) {
                        socket.emit('friendRequestError', { message: language === Language.French ? 'Utilisateur introuvable.' : 'User not found' });
                        return;
                    }

                    recipient.pendingSentRequests = recipient.pendingSentRequests.filter((req) => req.id !== senderId);

                    const senderData = await this.userManagementService.getUserById(senderId);
                    if (!senderData) {
                        socket.emit('friendRequestError', {
                            message: language === Language.French ? 'Utilisateur expéditeur introuvable.' : 'Sender not found',
                        });
                        return;
                    }
                    senderData.pendingReceivedRequests = senderData.pendingReceivedRequests.filter((req) => req.id !== id);
                    await this.userManagementService.updateUser(senderData);
                    await this.userManagementService.updateUser(recipient);

                    // // Notifier les deux utilisateurs en temps réel
                    const allUsers = await this.userManagementService.getUsers();
                    socket.emit('allUsers', allUsers);
                    // Notifier le destinataire en temps réel
                    const recipientSocketId = this.getSocketIdFromUser(id);
                    if (recipientSocketId) {
                        this.sio.to(recipientSocketId).emit('allUsers', allUsers);
                    }
                } catch (error) {
                    const language: Language = await this.userManagementService.getLanguageByUserId(socket.handshake.auth.userId);
                    console.error("Erreur lors du refus de la demande d'ami :", error);
                    socket.emit('friendRequestError', {
                        message:
                            language === Language.French
                                ? 'Une erreur est survenue lors du refus de la demande.'
                                : 'Unexpected error when declining request',
                    });
                }
            });
            // Mettre en dernier, sinon cause bugs puisque listeners pas encore set
            try {
                // On sauvegarde la session active
                const userId = socket.handshake.auth.userId;
                const { isChatWindow } = socket.handshake.query;
                if (!isChatWindow) await this.sessionManagementService.setUserSession(userId);
                socket.emit('serverRestarted');
            } catch (error) {
                console.error('Error when trying to set user session.');
                console.error(error);
            }

            // Événement reçu à chaque déconnexion manuelle (par le client) OU automatique (perte de connexion internet ou fermeture de l'app)
            socket.on('disconnect', async () => {
                try {
                    leaveLobby();
                    const userID = this.socketUserMap.get(socket.id);
                    if (userID) {
                        this.socketUserMap.delete(socket.id);
                        this.userSocketMap.delete(userID);
                    }
                    // On libère la session active
                    const userId = socket.handshake.auth.userId;
                    const { isChatWindow } = socket.handshake.query;
                    if (!isChatWindow) await this.sessionManagementService.freeSession(userId);
                } catch (error) {
                    console.log('Socket disconnect error');
                    console.log(error);
                }
            });
        });
    }
}
