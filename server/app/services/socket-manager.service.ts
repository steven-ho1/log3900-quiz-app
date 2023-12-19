/* eslint-disable max-lines */ // ---- SOLUTION TEMPORAIRE ----
import { Game, GameInfo, QuestionType } from '@common/game';
import { GameMode } from '@common/game-mode';
import {
    ACTIVE_PLAYERS_TEXT,
    Answer,
    INACTIVE_PLAYERS_TEXT,
    LobbyDetails,
    Message,
    Pin,
    Player,
    PlayerColor,
    REQUIRED_PIN_LENGTH,
    SocketId,
} from '@common/lobby';
import { TimerConfiguration } from '@common/timer';
import * as http from 'http';
import * as io from 'socket.io';
import { DatabaseService } from './database.service';

const MAX_LOBBY_QUANTITY = 10000;
const DEFAULT_COUNTDOWN_PERIOD = 1000;
const PANIC_COUNTDOWN_PERIOD = 250;
const ORGANIZER = 'Organisateur';
const SUBMITTER1_SORTED_BEFORE = -1;
const SUBMITTER1_SORTED_AFTER = 1;
const ORIGINAL_ORDER = 0;
const TESTER = 'Testeur';

export class SocketManager {
    private sio: io.Server;
    private lobbies: Map<Pin, LobbyDetails> = new Map<Pin, LobbyDetails>();

    constructor(
        server: http.Server,
        private databaseService: DatabaseService,
    ) {
        this.sio = new io.Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });
    }

    handleSockets(): void {
        this.sio.on('connection', (socket) => {
            let pin: Pin = '';
            let nbPlayers = 0;
            let startDate = '';
            let isOrganizer = false;
            let counter: NodeJS.Timer;

            const SEND_LATEST_PLAYERS = () => {
                const lobbyDetails = this.lobbies.get(pin);
                this.sio.to(pin).emit('latestPlayerList', lobbyDetails);
            };

            const LEAVE_LOBBY = () => {
                if (pin) {
                    const currentLobby = this.lobbies.get(pin);
                    if (currentLobby) {
                        // Si l'organisateur quitte, on force la sortie de tous les joueurs
                        if (isOrganizer) socket.broadcast.to(pin).emit('lobbyClosed', 'NO HOST', "L'organisateur a quitté la partie.");
                        else {
                            // Retire le joueur du nombre de joueurs en train d'écrire
                            currentLobby.players.forEach((player: Player) => {
                                if (player.socketId === socket.id && player.isTyping) SET_INPUT_ACTIVITY(player, false);
                            });
                        }

                        currentLobby.players = currentLobby.players.filter((player) => player.socketId !== socket.id);
                        if (currentLobby.players.length === 1 && currentLobby.players[0].name === ORGANIZER) {
                            // Si l'organisateur est seul dans le lobby, on l'avertit
                            const organizerSocketId = currentLobby.players[0].socketId;
                            this.sio.to(organizerSocketId).emit('noPlayers');
                        }

                        if (currentLobby.players.length === 0) {
                            // Si le lobby est vide, on le supprime
                            this.lobbies.delete(pin);
                        } else {
                            // Sinon, mettre à jour la liste des joueurs et mettre fin à la question si le joueur est le dernier à soumettre
                            SEND_LATEST_PLAYERS();
                            CHECK_QUESTION_END(currentLobby, { submitter: '', questionType: currentLobby.currentQuestionType, grade: null });
                        }
                    }
                }
                if (pin !== socket.id) socket.leave(pin);
                pin = '';
                isOrganizer = false;
            };

            const GENERATE_RANDOM_PIN = () => {
                const pinLength = REQUIRED_PIN_LENGTH;
                return Math.floor(Math.random() * MAX_LOBBY_QUANTITY)
                    .toString()
                    .padStart(pinLength, '0');
            };

            const GENERATE_UNIQUE_PIN = () => {
                let newPin = '';
                do {
                    newPin = GENERATE_RANDOM_PIN();
                } while (this.lobbies.has(newPin));
                return newPin;
            };

            const UPDATE_HISTOGRAM = (updateData: { [key: string]: number }) => {
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

            const QRL_UPDATE_HISTOGRAM = (updateData: { [key: string]: number }) => {
                const currentLobby = this.lobbies.get(pin);
                currentLobby.histogram = updateData;
                this.sio.to(pin).emit('qrlUpdateHistogram', currentLobby.histogram);
            };

            const START_COUNTDOWN = (initialCount: number, configuration: TimerConfiguration): void => {
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
                                if (player.socketId === socket.id) SET_INPUT_ACTIVITY(player, false);
                            });
                        }
                        clearInterval(counter);
                    }
                }, countdownPeriod);
            };

            const SET_INPUT_ACTIVITY = (player: Player, isTyping: boolean) => {
                player.isTyping = isTyping;
                const incrementation = 1;
                const valueChange: number = isTyping ? incrementation : -incrementation;
                UPDATE_HISTOGRAM({ [ACTIVE_PLAYERS_TEXT]: valueChange });
                UPDATE_HISTOGRAM({ [INACTIVE_PLAYERS_TEXT]: -valueChange });
            };

            const CHECK_QUESTION_END = (currentLobby: LobbyDetails, answer: Answer) => {
                const areAllSubmitted = !currentLobby.players.some((player) => !player.answerSubmitted);
                if (areAllSubmitted) {
                    if (!currentLobby.currentQuestionType) return;

                    if (answer.questionType === QuestionType.QCM) this.sio.to(pin).emit('qcmEnd', currentLobby.bonusRecipient);
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
                            if (player.isTyping) SET_INPUT_ACTIVITY(player, false);
                        });
                    }

                    currentLobby.players.forEach((player) => {
                        if (player.name !== ORGANIZER) player.answerSubmitted = false;
                    });
                    currentLobby.qrlAnswers = [];
                    currentLobby.bonusRecipient = '';
                    currentLobby.currentQuestionType = undefined;
                }
            };

            socket.on('validatePin', (pinToJoin: Pin) => {
                if (this.lobbies.has(pinToJoin)) {
                    const lobbyToJoin = this.lobbies.get(pinToJoin);
                    if (lobbyToJoin.isLocked)
                        socket.emit('invalidPin', `La partie de PIN ${pinToJoin} a été verrouillée par l'organisateur. Attendez et réessayez.`);
                    else {
                        socket.join(pinToJoin);
                        pin = pinToJoin;
                        socket.emit('validPin', lobbyToJoin.game, pin);
                    }
                } else socket.emit('invalidPin', `La partie de PIN ${pinToJoin} n'a pas été trouvée. Êtes-vous sûr du PIN?`);
            });

            socket.on('joinLobby', (nameToValidate: string) => {
                const lowerCaseNameToValide = nameToValidate.toLowerCase();
                const currentLobby = this.lobbies.get(pin);

                if (currentLobby.players.find((player) => player.name.toLowerCase() === lowerCaseNameToValide))
                    socket.emit('failedLobbyConnection', 'Nom réservé par un autre joueur');
                else if (currentLobby.bannedNames.find((bannedName) => bannedName.toLowerCase() === lowerCaseNameToValide))
                    socket.emit('failedLobbyConnection', 'Nom Banni');
                else if (currentLobby.isLocked)
                    socket.emit('failedLobbyConnection', `La partie de PIN ${pin} a été verrouillée par l'organisateur. Attendez et réessayez.`);
                else {
                    currentLobby.players.push({
                        socketId: socket.id,
                        name: nameToValidate,
                        answerSubmitted: false,
                        score: 0,
                        activityState: PlayerColor.Red,
                        isAbleToChat: true,
                        bonusTimes: 0,
                        isTyping: false,
                    });
                    SEND_LATEST_PLAYERS();
                    socket.emit('successfulLobbyConnection', nameToValidate);
                }
            });

            socket.on('createLobby', (currentGame: Game) => {
                if (this.lobbies.size <= MAX_LOBBY_QUANTITY) {
                    const newPin = GENERATE_UNIQUE_PIN();
                    this.lobbies.set(newPin, { isLocked: false, players: [], bannedNames: [], game: currentGame, chat: [], qrlAnswers: [] });
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
                } else socket.emit('failedLobbyCreation', "Quantité maximale de salles d'attente atteinte");
            });

            socket.on('getPlayers', () => {
                SEND_LATEST_PLAYERS();
            });

            socket.on('banPlayer', (playerToBan: { socketId: SocketId; name: string }) => {
                const socketToBan = this.sio.sockets.sockets.get(playerToBan.socketId);
                const currentLobby = this.lobbies.get(pin);
                currentLobby.players = currentLobby.players.filter((player) => player.name !== playerToBan.name);
                currentLobby.bannedNames.push(playerToBan.name);
                socketToBan.emit('lobbyClosed', 'BAN', "Vous avez été expulsé de la salle d'attente.");
            });

            socket.on('toggleLock', () => {
                const currentLobby = this.lobbies.get(pin);
                currentLobby.isLocked = !currentLobby.isLocked;
                socket.emit('lockToggled', currentLobby.isLocked);
            });

            socket.on('leaveLobby', () => {
                LEAVE_LOBBY();
            });

            socket.on('disconnect', () => {
                LEAVE_LOBBY();
            });

            socket.on('startCountdown', (initialCount: number, configuration: TimerConfiguration, gameMode: GameMode) => {
                if (configuration.isQuestionTransition) this.sio.to(pin).emit('questionTransition', configuration.isQuestionTransition);
                if (gameMode === GameMode.Testing) pin = socket.id;
                if (configuration.isInputInactivityCountdown) clearInterval(counter);
                this.sio.to(pin).emit('countdownStarted');
                START_COUNTDOWN(initialCount, configuration);
            });

            socket.on('stopCountdown', () => {
                if (isOrganizer) this.sio.to(pin).emit('countdownStopped');
                clearInterval(counter);
            });

            socket.on('chatMessage', (message: Message) => {
                const currentLobby = this.lobbies.get(pin);
                if (currentLobby) {
                    const sender = currentLobby.players.find((player) => player.socketId === message.sender);
                    message.sender = sender.name;
                    if (sender.isAbleToChat) {
                        currentLobby.chat.push(message);
                        this.sio.to(pin).emit('messageReceived', currentLobby.chat);
                    } else {
                        socket.emit('PlayerMuted');
                    }
                }
            });

            socket.on('getChat', (gameMode: GameMode) => {
                if (gameMode === GameMode.Testing) {
                    pin = socket.id;
                    this.lobbies.set(pin, {
                        isLocked: false,
                        players: [
                            { socketId: socket.id, name: TESTER, isAbleToChat: true, isTyping: true, score: 0, activityState: PlayerColor.Green },
                        ],
                        chat: [],
                        qrlAnswers: [],
                    });
                }
                const currentLobby = this.lobbies.get(pin);
                if (currentLobby) {
                    this.sio.to(pin).emit('messageReceived', currentLobby.chat);
                }
            });

            socket.on('answerSubmitted', (answer: Answer, submittedFromTimer: boolean) => {
                const currentLobby = this.lobbies.get(pin);
                if (currentLobby) {
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

                    SEND_LATEST_PLAYERS();
                    CHECK_QUESTION_END(currentLobby, answer);
                }
            });

            socket.on('markInputActivity', () => {
                this.lobbies.get(pin).players.forEach((player: Player) => {
                    if (player.socketId === socket.id && !player.isTyping) SET_INPUT_ACTIVITY(player, true);
                });
            });

            socket.on('evaluationPhaseCompleted', (qrlAnswers: Answer[]) => {
                this.sio.to(pin).emit('qrlResults', qrlAnswers);
            });

            socket.on('enablePanicMode', () => {
                this.sio.to(pin).emit('panicMode');
            });

            socket.on('histogramUpdate', (updateData: { [key: string]: number }) => {
                UPDATE_HISTOGRAM(updateData);
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

            socket.on('gameEnded', () => {
                const lobby = this.lobbies.get(pin);
                if (isOrganizer) {
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

                    historyCollection.insertOne(game);
                }

                this.sio.to(pin).emit('showResults');
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
                const currentLobby = this.lobbies.get(pin);
                if (currentLobby) {
                    const socketToMute = this.sio.sockets.sockets.get(playerToMute.socketId);
                    const player = currentLobby.players.find((p) => p.socketId === playerToMute.socketId);
                    if (player) {
                        player.isAbleToChat = !player.isAbleToChat;
                        const eventToEmit = player.isAbleToChat ? 'PlayerUnmuted' : 'PlayerMuted';
                        socketToMute.emit(eventToEmit);
                    }
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
                    SEND_LATEST_PLAYERS();
                }
            });
            socket.on('resetPlayersActivityState', () => {
                const currentLobby = this.lobbies.get(pin);
                if (currentLobby) {
                    currentLobby.players.forEach((player) => {
                        player.activityState = PlayerColor.Red;
                    });
                    SEND_LATEST_PLAYERS();
                }
            });

            socket.on('qrlHistogramUpdate', (updateData: { [key: string]: number }) => {
                QRL_UPDATE_HISTOGRAM(updateData);
            });

            socket.on('gameStarted', () => {
                nbPlayers = this.lobbies.get(pin).players.length - 1;
                startDate = new Date().toLocaleString('sv', { timeZone: 'America/New_York' });
            });
        });
    }
}
