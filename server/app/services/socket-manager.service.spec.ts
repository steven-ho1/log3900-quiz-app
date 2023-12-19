/* eslint-disable max-lines */
import { GameInfo, QuestionType } from '@common/game';
import { GameMode } from '@common/game-mode';
import { ACTIVE_PLAYERS_TEXT, Answer, LobbyDetails, Message, Pin, Player, PlayerColor } from '@common/lobby';
import { Server } from 'app/server';
import { expect } from 'chai';
import { Collection, Db } from 'mongodb';
import * as sinon from 'sinon';
import { Socket, io as ioClient } from 'socket.io-client';
import { Container } from 'typedi';
import { DatabaseService } from './database.service';
import { SocketManager } from './socket-manager.service';

const RESPONSE_DELAY = 100;

describe('SocketManager service tests', () => {
    let service: SocketManager;
    let server: Server;
    let clientSocket: Socket;
    let roomPin: Pin;
    let mockDatabaseService: sinon.SinonStubbedInstance<DatabaseService>;
    let mockCollection: sinon.SinonStubbedInstance<Collection<GameInfo>>;

    const urlString = 'http://localhost:3000';

    const createGame = () => {
        clientSocket.emit('createLobby', '');

        clientSocket.on('successfulLobbyCreation', (pin: Pin) => {
            roomPin = pin;
        });
    };

    beforeEach(async () => {
        server = Container.get(Server);
        await server.init();
        service = server['socketManager'];
        clientSocket = ioClient(urlString);
        sinon.stub(console, 'log');

        mockDatabaseService = sinon.createStubInstance(DatabaseService);

        mockCollection = {
            insertOne: sinon.stub(),
        } as unknown as sinon.SinonStubbedInstance<Collection<GameInfo>>;

        mockDatabaseService.getDb.returns({ collection: () => mockCollection } as unknown as Db);

        service['databaseService'] = mockDatabaseService;
    });

    afterEach(() => {
        clientSocket.close();
        service['sio'].close();
        sinon.restore();
    });

    it('should handle validatePin event by emitting invalidPin event if the pin is invalid', (done) => {
        const invalidPin = '0000';

        clientSocket.emit('validatePin', invalidPin);

        clientSocket.on('invalidPin', (reason: string) => {
            expect(reason).to.equal(`La partie de PIN ${invalidPin} n'a pas été trouvée. Êtes-vous sûr du PIN?`);
            done();
        });
    });

    it('should handle validatePin event by emitting invalidPin event if the lobby is locked', (done) => {
        createGame();

        setTimeout(() => {
            clientSocket.emit('toggleLock');
            clientSocket.emit('validatePin', roomPin);

            clientSocket.on('invalidPin', (reason: string) => {
                expect(reason).to.equal(`La partie de PIN ${roomPin} a été verrouillée par l'organisateur. Attendez et réessayez.`);
                done();
            });
        }, RESPONSE_DELAY);
    });

    it('should handle validatePin event by emitting validPin event in case of success', (done) => {
        createGame();

        setTimeout(() => {
            clientSocket.emit('validatePin', roomPin);

            clientSocket.on('validPin', (gameId: string, pin: Pin) => {
                expect(pin).to.equal(roomPin);
                expect(gameId).to.equal('');
                done();
            });
        }, RESPONSE_DELAY);
    });

    it('should handle joinLobby event by emitting failedLobbyConnection event if the name is already taken', (done) => {
        const name = 'Organisateur';
        createGame();

        setTimeout(() => {
            clientSocket.emit('joinLobby', name);

            clientSocket.on('failedLobbyConnection', (reason: string) => {
                expect(reason).to.equal('Nom réservé par un autre joueur');
                done();
            });
        }, RESPONSE_DELAY);
    });

    it('should handle joinLobby event by emitting failedLobbyConnection event if the name is banned', (done) => {
        const name = 'test';
        createGame();

        setTimeout(() => {
            service['lobbies'].get(roomPin).bannedNames.push(name);
            clientSocket.emit('joinLobby', name);

            clientSocket.on('failedLobbyConnection', (reason: string) => {
                expect(reason).to.equal('Nom Banni');
                done();
            });
        }, RESPONSE_DELAY);
    });

    it('should handle joinLobby event by emitting failedLobbyConnection event if the lobby is locked', (done) => {
        const name = 'test';
        createGame();

        setTimeout(() => {
            clientSocket.emit('toggleLock');
            clientSocket.emit('joinLobby', name);

            clientSocket.on('failedLobbyConnection', (message: string) => {
                expect(message).to.equal(`La partie de PIN ${roomPin} a été verrouillée par l'organisateur. Attendez et réessayez.`);
                done();
            });
        }, RESPONSE_DELAY);
    });

    it('should handle joinLobby event by emitting successfulLobbyConnection event if the name is correct', (done) => {
        const name = 'test';
        createGame();

        clientSocket.emit('joinLobby', name);

        clientSocket.on('successfulLobbyConnection', (validName: string) => {
            expect(validName).to.equal(name);
            done();
        });
    });

    it('createLobby should return failedLobbyCreation if the maximum number of lobby is reached', (done) => {
        const maxLobby = 10000;
        for (let i = 0; i <= maxLobby; i++) {
            service['lobbies'].set(i.toString(), null);
        }

        clientSocket.emit('createLobby', '');

        clientSocket.on('failedLobbyCreation', (reason: string) => {
            expect(reason).to.equal("Quantité maximale de salles d'attente atteinte");
            done();
        });
    });

    it('createLobby should return successfulLobbyyCreation if the creation is a success', (done) => {
        let isSuccessful = false;

        clientSocket.emit('createLobby', '');

        clientSocket.on('successfulLobbyCreation', () => {
            isSuccessful = true;
        });

        setTimeout(() => {
            expect(isSuccessful).to.equal(true);
            done();
        }, RESPONSE_DELAY);
    });

    it('getPlayers should return latestPlayerList with the lobby details', (done) => {
        clientSocket.emit('createLobby', null);
        clientSocket.emit('getPlayers');

        clientSocket.on('latestPlayerList', (lobbyDetails: LobbyDetails) => {
            expect(lobbyDetails.bannedNames.length).to.equal(0);
            expect(lobbyDetails.game).to.equal(null);
            expect(lobbyDetails.isLocked).to.equal(false);
            expect(lobbyDetails.players.length).to.equal(1);

            done();
        });
    });

    it('banPlayer should add the name of the player banned to the list of banned names and return lobbyClosed', (done) => {
        const clientSocket2 = ioClient(urlString);
        const nameClient2 = 'test';
        createGame();

        setTimeout(() => {
            const pin = roomPin;
            clientSocket2.emit('validatePin', pin);
            clientSocket2.emit('joinLobby', nameClient2);

            setTimeout(() => {
                clientSocket.emit('banPlayer', { socketId: clientSocket2.id, name: nameClient2 });

                clientSocket2.once('lobbyClosed', (reason: string, message: string) => {
                    expect(reason).to.equal('BAN');
                    expect(message).to.equal("Vous avez été expulsé de la salle d'attente.");
                });

                setTimeout(() => {
                    expect(service['lobbies'].get(pin).bannedNames.length).to.equal(1);
                    expect(service['lobbies'].get(pin).bannedNames[0]).to.equal(nameClient2);

                    expect(service['lobbies'].get(pin).players.length).to.equal(1);
                    expect(service['lobbies'].get(pin).players[0].name).to.not.equal(nameClient2);

                    clientSocket2.close();
                    done();
                }, RESPONSE_DELAY);
            }, RESPONSE_DELAY);
        }, RESPONSE_DELAY);
    });

    it('toggleLock should return lockToggled and change isLocked', (done) => {
        createGame();

        clientSocket.emit('toggleLock');

        clientSocket.on('lockToggled', (isLocked: boolean) => {
            expect(isLocked).to.equal(true);
            done();
        });
    });

    it('leaveLobby should return nothing if the player is not in a lobby', (done) => {
        createGame();

        setTimeout(() => {
            clientSocket.emit('leaveLobby');
            service['lobbies'].delete(roomPin);

            setTimeout(() => {
                expect(service['lobbies'].get(roomPin)).to.equal(undefined);
                done();
            }, RESPONSE_DELAY);
        }, RESPONSE_DELAY);
    });

    it('leaveLobby should return lobbyClosed if the host leave', (done) => {
        const clientSocket2 = ioClient(urlString);
        createGame();

        setTimeout(() => {
            clientSocket2.emit('validatePin', roomPin);
            clientSocket2.emit('joinLobby', '');

            setTimeout(() => {
                clientSocket.emit('leaveLobby');
            }, RESPONSE_DELAY);
        }, RESPONSE_DELAY);

        clientSocket2.once('lobbyClosed', (reason: string, message: string) => {
            expect(reason).to.equal('NO HOST');
            expect(message).to.equal("L'organisateur a quitté la partie.");
            clientSocket2.close();
            done();
        });
    });

    it('leaveLobby should delete the lobby if the last player leaves', (done) => {
        const lobbyNb = service['lobbies'].size;
        createGame();

        setTimeout(() => {
            expect(service['lobbies'].size).to.equal(lobbyNb + 1);

            clientSocket.emit('leaveLobby');

            setTimeout(() => {
                expect(service['lobbies'].size).to.equal(lobbyNb);
                done();
            }, RESPONSE_DELAY);
        }, RESPONSE_DELAY);
    });

    it('leaveLobby should return latestPlayerList if a player leaves', (done) => {
        const clientSocket2 = ioClient(urlString);
        createGame();

        setTimeout(() => {
            clientSocket2.emit('validatePin', roomPin);
            clientSocket2.emit('joinLobby', '');

            setTimeout(() => {
                expect(service['lobbies'].get(roomPin).players.length).to.equal(2);
                service['lobbies'].get(roomPin).players[1].isTyping = true;

                clientSocket2.emit('leaveLobby');

                clientSocket2.once('latestPlayerList', () => {
                    setTimeout(() => {
                        expect(service['lobbies'].get(roomPin).players.length).to.equal(1);
                        clientSocket2.close();
                        done();
                    }, RESPONSE_DELAY);
                });
            }, RESPONSE_DELAY);
        }, RESPONSE_DELAY);
    });

    it('startCountdown should emit questionTransition event if the next question is loading', (done) => {
        createGame();

        setTimeout(() => {
            clientSocket.emit('startCountdown', 0, { isQuestionTransition: true });

            clientSocket.on('questionTransition', (isQuestionTransition: boolean) => {
                expect(isQuestionTransition).to.equal(true);
                done();
            });
        }, RESPONSE_DELAY);
    });

    it('startCountdown should emit countdown if the timer is greater than 0', (done) => {
        let time = 4;

        setTimeout(() => {
            clientSocket.emit('startCountdown', time, { isPanicModeEnabled: true }, GameMode.Testing);

            clientSocket.on('countdown', (count: number) => {
                expect(count).to.equal(time);
                clientSocket.on('countdown', (newCount: number) => {
                    expect(newCount).to.equal(--time);
                    done();
                });
                done();
            });
        }, RESPONSE_DELAY);
    });

    it('startCountdown should emit countdownEnd if the timer is less or equal than 1', (done) => {
        createGame();
        const spy = sinon.spy(service['sio'], 'to');

        setTimeout(() => {
            clientSocket.emit('startCountdown', 1, { isQuestionTransition: false, isPanicModeEnabled: false }, GameMode.RealGame);

            clientSocket.on('countdownEnd', () => {
                sinon.assert.called(spy);
                done();
            });
        }, RESPONSE_DELAY);
    });

    it('startCountDown should update the histogram of active players when the reason is the inactivity of the player', (done) => {
        const clientSocket2 = ioClient(urlString);
        createGame();
        const nbActivePlayers = -1;

        setTimeout(() => {
            clientSocket2.emit('validatePin', roomPin);
            clientSocket2.emit('joinLobby', '');

            clientSocket2.emit('startCountdown', 2, { isInputInactivityCountdown: true }, GameMode.RealGame);

            clientSocket.once('updateHistogram', (histogram: { [key: string]: number }) => {
                expect(histogram[ACTIVE_PLAYERS_TEXT]).to.equal(nbActivePlayers);
                done();
            });
        }, RESPONSE_DELAY);
    });

    it('startCountDown should do nothing if the player is not in a lobby', (done) => {
        let histogramUpdated = false;

        clientSocket.emit('startCountdown', 2, { isInputInactivityCountdown: true }, GameMode.RealGame);

        clientSocket.once('updateHistogram', () => {
            histogramUpdated = true;
        });

        setTimeout(() => {
            expect(histogramUpdated).to.equal(false);
            done();
        }, RESPONSE_DELAY);
    });

    it('stopCountdown should stop the timer', (done) => {
        let countdownEnded = false;
        const waitTime = 2500;
        createGame();
        clientSocket.emit('startCountdown', 2, { isQuestionTransition: false, isPanicModeEnabled: false }, GameMode.RealGame);

        clientSocket.emit('stopCountdown');

        clientSocket.on('countdownEnd', () => {
            countdownEnded = true;
        });

        setTimeout(() => {
            expect(countdownEnded).to.equal(false);
            done();
        }, waitTime);
    });

    it('stopCountdown should do nothing if the player is not the organizer', (done) => {
        const clientSocket2 = ioClient(urlString);
        let countdownStopped = false;
        createGame();

        setTimeout(() => {
            clientSocket2.emit('validatePin', roomPin);
            clientSocket2.emit('joinLobby', '');

            setTimeout(() => {
                clientSocket2.emit('stopCountdown');
                clientSocket2.on('countdownStopped', () => {
                    countdownStopped = true;
                });

                setTimeout(() => {
                    expect(countdownStopped).to.equal(false);
                    done();
                }, RESPONSE_DELAY);
            }, RESPONSE_DELAY);
        }, RESPONSE_DELAY);
    });

    it('markInputActivity should update the histogram of active players', (done) => {
        createGame();
        const nbActivePlayers = 1;

        clientSocket.emit('markInputActivity');

        clientSocket.once('updateHistogram', (histogram: { [key: string]: number }) => {
            expect(histogram[ACTIVE_PLAYERS_TEXT]).to.equal(nbActivePlayers);
            done();
        });
    });

    it('markInputActivity should do nothing if all players are typing', (done) => {
        let inputMarked = false;
        createGame();

        setTimeout(() => {
            service['lobbies'].get(roomPin).players[0].isTyping = true;

            clientSocket.emit('markInputActivity');

            clientSocket.on('updateHistogram', () => {
                inputMarked = true;
            });

            setTimeout(() => {
                expect(inputMarked).to.equal(false);
                done();
            }, RESPONSE_DELAY);
        }, RESPONSE_DELAY);
    });

    it('evaluationPhaseCompleted should emit qrlResults to the room', (done) => {
        const clientSocket2 = ioClient(urlString);
        const answer: Answer = { submitter: 'player', questionType: QuestionType.QRL, text: 'test', grade: null };
        createGame();

        setTimeout(() => {
            clientSocket2.emit('validatePin', roomPin);
            clientSocket2.emit('joinLobby', '');

            setTimeout(() => {
                clientSocket.emit('evaluationPhaseCompleted', [answer]);

                clientSocket2.on('qrlResults', (answers: Answer[]) => {
                    expect(answers).to.deep.equal([answer]);
                    done();
                });
            }, RESPONSE_DELAY);
        }, RESPONSE_DELAY);
    });

    it('chatMessage should return messageReceived', (done) => {
        createGame();

        setTimeout(() => {
            const message: Message = { sender: clientSocket.id, content: 'content1', time: new Date().toDateString() };
            service['lobbies'].get(roomPin).chat = [];
            clientSocket.emit('chatMessage', message);
            clientSocket.on('messageReceived', (currentLobbyChat: Message[]) => {
                expect(currentLobbyChat[0].content).to.equal('content1');
                expect(currentLobbyChat[0].time).to.deep.equal(message.time);
                done();
            });
        }, RESPONSE_DELAY);
    });

    it('chatMessage should do nothing if the player is not in a lobby', (done) => {
        const message: Message = { sender: clientSocket.id, content: 'content1', time: new Date().toDateString() };
        let messageSent = false;
        clientSocket.emit('chatMessage', message);

        clientSocket.on('messageReceived', () => {
            messageSent = true;
        });

        setTimeout(() => {
            expect(messageSent).to.equal(false);
            done();
        }, RESPONSE_DELAY);
    });

    it('chatMessage should return PlayerMuted if the player is not allowed to chat', (done) => {
        createGame();

        setTimeout(() => {
            let eventReceived = false;
            const message: Message = { sender: clientSocket.id, content: 'content1', time: new Date().toDateString() };
            service['lobbies'].get(roomPin).players[0].isAbleToChat = false;
            clientSocket.emit('chatMessage', message);
            clientSocket.on('PlayerMuted', () => {
                eventReceived = true;
                expect(eventReceived).to.equal(true);
                done();
            });
        }, RESPONSE_DELAY);
    });

    it('getChat should return chat', (done) => {
        const chatMock: Message[] = [{ sender: 'cat', content: 'Meow', time: new Date().toDateString() }];
        createGame();
        setTimeout(() => {
            service['lobbies'].get(roomPin).chat = chatMock;
            clientSocket.emit('getChat');

            clientSocket.on('messageReceived', (chat) => {
                expect(chat).to.deep.equal(chatMock);
                done();
            });
        }, RESPONSE_DELAY);
    });

    it('getChat should add a lobby if in testing mode', (done) => {
        clientSocket.emit('getChat', GameMode.Testing);

        clientSocket.on('messageReceived', () => {
            expect(service['lobbies'].size).to.greaterThan(0);
            done();
        });
    });

    it('getChat should do nothing if the player is not in a lobby and not in testing mode', (done) => {
        let chatObtained = false;
        clientSocket.emit('getChat', GameMode.RealGame);

        clientSocket.on('messageReceived', () => {
            chatObtained = true;
        });

        setTimeout(() => {
            expect(chatObtained).to.equal(false);
            done();
        }, RESPONSE_DELAY);
    });

    it('answerSubmitted should do nothing if the player is not in a lobby', (done) => {
        let answerSubmitted = false;

        clientSocket.emit('answerSubmitted');

        clientSocket.on('canLoadNextQuestion', () => {
            answerSubmitted = true;
        });
        clientSocket.on('allSubmitted', () => {
            answerSubmitted = true;
        });

        setTimeout(() => {
            expect(answerSubmitted).to.equal(false);
            done();
        }, RESPONSE_DELAY);
    });

    it('answerSubmitted should return qcmEnd if the question is a qcm', (done) => {
        const clientSocket2 = ioClient(urlString);
        const clientSocket3 = ioClient(urlString);
        const answer: Answer = {
            submitter: 'player',
            questionType: QuestionType.QCM,
            isCorrect: true,
            grade: null,
        };
        let nbSubmitted = 0;
        createGame();

        setTimeout(() => {
            clientSocket2.emit('validatePin', roomPin);
            clientSocket2.emit('joinLobby', 'test1');
            clientSocket3.emit('validatePin', roomPin);
            clientSocket3.emit('joinLobby', 'test2');

            setTimeout(() => {
                clientSocket2.emit('answerSubmitted', answer, false);
                clientSocket3.emit('answerSubmitted', answer, true);
                clientSocket2.on('qcmEnd', (bonusRecipient: string) => {
                    expect(bonusRecipient).to.equal(clientSocket2.id);
                    nbSubmitted++;
                });
                clientSocket3.on('qcmEnd', (bonusRecipient: string) => {
                    expect(bonusRecipient).to.not.equal(clientSocket3.id);
                    nbSubmitted++;
                });

                setTimeout(() => {
                    expect(nbSubmitted).to.equal(2);
                    done();
                }, RESPONSE_DELAY);
            }, RESPONSE_DELAY);
        }, RESPONSE_DELAY);
    });

    it('answerSubmitted should return qrlEnd if the question is a qrl', (done) => {
        const clientSocket2 = ioClient(urlString);
        const clientSocket3 = ioClient(urlString);
        const answer1: Answer = {
            submitter: 'test1',
            questionType: QuestionType.QRL,
            isCorrect: true,
            grade: null,
        };
        const answer2: Answer = {
            submitter: 'test2',
            questionType: QuestionType.QRL,
            isCorrect: true,
            grade: null,
        };
        let nbSubmitted = 0;
        createGame();

        setTimeout(() => {
            clientSocket2.emit('validatePin', roomPin);
            clientSocket2.emit('joinLobby', 'test1');
            clientSocket3.emit('validatePin', roomPin);
            clientSocket3.emit('joinLobby', 'test2');

            setTimeout(() => {
                service['lobbies'].get(roomPin).players[1].isTyping = true;
                clientSocket2.emit('answerSubmitted', answer1, false);
                clientSocket3.emit('answerSubmitted', answer2, true);
                clientSocket2.on('qrlEnd', (answers: [Answer]) => {
                    expect(answers).to.deep.equal([answer1, answer2]);
                    nbSubmitted++;
                });
                clientSocket3.on('qrlEnd', (answers: [Answer]) => {
                    expect(answers).to.deep.equal([answer1, answer2]);
                    nbSubmitted++;
                });

                setTimeout(() => {
                    expect(nbSubmitted).to.equal(2);
                    done();
                }, RESPONSE_DELAY);
            }, RESPONSE_DELAY);
        }, RESPONSE_DELAY);
    });

    it('answerSubmitted should return the good order if the submitters are in the wrong order', (done) => {
        const clientSocket2 = ioClient(urlString);
        const clientSocket3 = ioClient(urlString);
        const answer1: Answer = {
            submitter: 'test2',
            questionType: QuestionType.QRL,
            isCorrect: true,
            grade: null,
        };
        const answer2: Answer = {
            submitter: 'test1',
            questionType: QuestionType.QRL,
            isCorrect: true,
            grade: null,
        };
        let nbSubmitted = 0;
        createGame();

        setTimeout(() => {
            clientSocket2.emit('validatePin', roomPin);
            clientSocket2.emit('joinLobby', 'test1');
            clientSocket3.emit('validatePin', roomPin);
            clientSocket3.emit('joinLobby', 'test2');

            setTimeout(() => {
                service['lobbies'].get(roomPin).players[1].isTyping = true;
                clientSocket2.emit('answerSubmitted', answer1, false);
                clientSocket3.emit('answerSubmitted', answer2, true);
                clientSocket2.on('qrlEnd', (answers: [Answer]) => {
                    expect(answers).to.deep.equal([answer2, answer1]);
                    nbSubmitted++;
                });
                clientSocket3.on('qrlEnd', (answers: [Answer]) => {
                    expect(answers).to.deep.equal([answer2, answer1]);
                    nbSubmitted++;
                });

                setTimeout(() => {
                    expect(nbSubmitted).to.equal(2);
                    done();
                }, RESPONSE_DELAY);
            }, RESPONSE_DELAY);
        }, RESPONSE_DELAY);
    });

    it('answerSubmitted should return the good order if the submitters have the same name', (done) => {
        const clientSocket2 = ioClient(urlString);
        const clientSocket3 = ioClient(urlString);
        const answer: Answer = {
            submitter: 'test',
            questionType: QuestionType.QRL,
            isCorrect: true,
            grade: null,
        };
        let nbSubmitted = 0;
        createGame();

        setTimeout(() => {
            clientSocket2.emit('validatePin', roomPin);
            clientSocket2.emit('joinLobby', 'test1');
            clientSocket3.emit('validatePin', roomPin);
            clientSocket3.emit('joinLobby', 'test2');

            setTimeout(() => {
                clientSocket2.emit('answerSubmitted', answer, false);
                clientSocket3.emit('answerSubmitted', answer, true);
                clientSocket2.on('qrlEnd', (answers: [Answer]) => {
                    expect(answers).to.deep.equal([answer, answer]);
                    nbSubmitted++;
                });
                clientSocket3.on('qrlEnd', (answers: [Answer]) => {
                    expect(answers).to.deep.equal([answer, answer]);
                    nbSubmitted++;
                });

                setTimeout(() => {
                    expect(nbSubmitted).to.equal(2);
                    done();
                }, RESPONSE_DELAY);
            }, RESPONSE_DELAY);
        }, RESPONSE_DELAY);
    });

    it('should handle enablePanicMode by emitting panicMode event to everyone in the room', (done) => {
        createGame();
        const spy = sinon.spy(service['sio'], 'to');

        setTimeout(() => {
            clientSocket.emit('enablePanicMode');
            clientSocket.on('panicMode', () => {
                sinon.assert.called(spy);
                done();
            });
        }, RESPONSE_DELAY);
    });

    it('histogramUpdate should do nothing if the player is not in a lobby', (done) => {
        let histogramUpdated = false;

        clientSocket.emit('histogramUpdate');

        clientSocket.on('updateHistogram', () => {
            histogramUpdated = true;
        });

        setTimeout(() => {
            expect(histogramUpdated).to.equal(false);
            done();
        }, RESPONSE_DELAY);
    });

    it('histogramUpdate should update the histogram and send updateHistogram', (done) => {
        const data = { answer: 2 };
        createGame();

        setTimeout(() => {
            service['lobbies'].get(roomPin).histogram = {};
            service['lobbies'].get(roomPin).histogram['answer'] = 1;

            clientSocket.emit('histogramUpdate', { answer: 1 });

            clientSocket.on('updateHistogram', (updateData: { [key: string]: number }) => {
                expect(updateData).to.deep.equal(data);
                done();
            });
        }, RESPONSE_DELAY);
    });

    it('histogramUpdate should create an histogram if one does not already exist', (done) => {
        const data = { answer: 1 };
        Object.getPrototypeOf(data).unwantedKey = 0;
        createGame();

        clientSocket.emit('histogramUpdate', data);

        clientSocket.on('updateHistogram', (updateData: { [key: string]: number }) => {
            expect(updateData).to.deep.equal(data);
            done();
        });
    });

    it('resetHistogram should do nothing if the player is not in a lobby', (done) => {
        let histogramUpdated = false;

        clientSocket.emit('resetHistogram');

        clientSocket.on('updateHistogram', () => {
            histogramUpdated = true;
        });

        setTimeout(() => {
            expect(histogramUpdated).to.equal(false);
            done();
        }, RESPONSE_DELAY);
    });

    it('resetHistogram should update the histogram and send updateHistogram', (done) => {
        const data = { ['1']: 1 };
        createGame();

        clientSocket.emit('resetHistogram', data);

        clientSocket.on('updateHistogram', (updateData: { [key: string]: number }) => {
            expect(updateData).to.deep.equal(null);
            done();
        });
    });

    it('submitScore should update the player score and emit scoreUpdated', (done) => {
        const score = 50;
        createGame();

        setTimeout(() => {
            clientSocket.emit('submitScore', score);

            clientSocket.on('scoreUpdated', (player: Player) => {
                expect(player.socketId).to.equal(clientSocket.id);
                expect(service['lobbies'].get(roomPin).players[0].score).to.equal(score);
                done();
            });
        }, RESPONSE_DELAY);
    });

    it('submitScore without a room should do nothing', (done) => {
        const score = 30;
        let scoreSubmitted = false;
        clientSocket.emit('submitScore', score);

        clientSocket.on('scoreUpdated', () => {
            scoreSubmitted = true;
        });

        setTimeout(() => {
            expect(scoreSubmitted).to.equal(false);
            done();
        }, RESPONSE_DELAY);
    });

    it('submitScore should do nothing if the player is not in the room', (done) => {
        const score = 30;
        let scoreSubmitted = false;
        createGame();

        setTimeout(() => {
            service['lobbies'].get(roomPin).players.pop();
            clientSocket.emit('submitScore', score);

            clientSocket.on('scoreUpdated', () => {
                scoreSubmitted = true;
            });

            setTimeout(() => {
                expect(scoreSubmitted).to.equal(false);
                done();
            }, RESPONSE_DELAY);
        }, RESPONSE_DELAY);
    });

    it('gameEnded should emit showResults and insert the game in the database', (done) => {
        const clientSocket2 = ioClient(urlString);
        createGame();

        setTimeout(() => {
            clientSocket2.emit('validatePin', roomPin);
            clientSocket2.emit('joinLobby', '');

            setTimeout(() => {
                service['lobbies'].get(roomPin).players[1].score = 100;
                clientSocket.emit('gameEnded');

                clientSocket.on('showResults', () => {
                    expect(mockCollection.insertOne.called).to.equal(true);
                    done();
                });
            }, RESPONSE_DELAY);
        }, RESPONSE_DELAY);
    });

    it('gameEnded should not insert the game in the database if the player is not the organizer', (done) => {
        const clientSocket2 = ioClient(urlString);
        mockCollection.insertOne.resetHistory();
        createGame();

        setTimeout(() => {
            clientSocket2.emit('validatePin', roomPin);
            clientSocket2.emit('joinLobby', '');

            setTimeout(() => {
                service['lobbies'].get(roomPin).players[1].score = 100;
                clientSocket2.emit('gameEnded');

                clientSocket.on('showResults', () => {
                    expect(mockCollection.insertOne.called).to.equal(false);
                    done();
                });
            }, RESPONSE_DELAY);
        }, RESPONSE_DELAY);
    });

    it('updateBonusTimes should update the player bonusTimes and emit latestPlayerList', (done) => {
        const bonusTimes = 6;
        createGame();

        setTimeout(() => {
            clientSocket.emit('updateBonusTimes', bonusTimes);

            clientSocket.on('latestPlayerList', (lobby: LobbyDetails) => {
                expect(lobby).to.deep.equal(service['lobbies'].get(roomPin));
                expect(lobby.players[0].bonusTimes).to.equal(bonusTimes);
                done();
            });
        }, RESPONSE_DELAY);
    });

    it('updateBonusTimes without a room should do nothing', (done) => {
        const bonusTimes = 3;
        let playerListReceived = false;
        clientSocket.emit('updateBonusTimes', bonusTimes);

        clientSocket.on('latestPlayerList', () => {
            playerListReceived = true;
        });

        setTimeout(() => {
            expect(playerListReceived).to.equal(false);
            done();
        }, RESPONSE_DELAY);
    });

    it('updateBonusTimes should do nothing if the player is not in the room', (done) => {
        const bonusTimes = 3;
        let playerListReceived = false;
        createGame();

        setTimeout(() => {
            service['lobbies'].get(roomPin).players.pop();
            clientSocket.emit('updateBonusTimes', bonusTimes);

            clientSocket.on('latestPlayerList', () => {
                playerListReceived = true;
            });

            setTimeout(() => {
                expect(playerListReceived).to.equal(false);
                done();
            }, RESPONSE_DELAY);
        }, RESPONSE_DELAY);
    });

    it('toggleMute should toggle the isAbleToChat status of a player', (done) => {
        const clientSocket2 = ioClient(urlString);
        const nameClient2 = 'test';
        const player: Player = {
            socketId: clientSocket2.id,
            name: nameClient2,
            answerSubmitted: true,
            score: 0,
            bonusTimes: 0,
            activityState: PlayerColor.Red,
            isAbleToChat: true,
            isTyping: false,
        };
        let playerMuted = false;
        createGame();

        setTimeout(() => {
            const pin = roomPin;
            clientSocket2.emit('validatePin', pin);
            clientSocket2.emit('joinLobby', nameClient2);

            setTimeout(() => {
                player.socketId = service['lobbies'].get(pin).players[1].socketId;
                clientSocket.emit('toggleMute', player);

                clientSocket2.on('PlayerMuted', () => {
                    playerMuted = true;
                });

                setTimeout(() => {
                    clientSocket.emit('toggleMute', player);

                    clientSocket2.on('PlayerUnmuted', () => {
                        expect(playerMuted).to.equal(true);
                        done();
                    });
                }, RESPONSE_DELAY);
            }, RESPONSE_DELAY);
        }, RESPONSE_DELAY);
    });

    it('toggleMute should do nothing if the player is not in a lobby', (done) => {
        let muteToggled = false;

        clientSocket.emit('toggleMute');

        clientSocket.on('PlayerMuted', () => {
            muteToggled = true;
        });

        setTimeout(() => {
            expect(muteToggled).to.equal(false);
            done();
        }, RESPONSE_DELAY);
    });

    it('toggleMute should do nothing if the player is not in the lobby', (done) => {
        const player: Player = {
            socketId: '',
            name: '',
            score: 0,
            activityState: PlayerColor.Red,
            isAbleToChat: false,
            isTyping: false,
        };
        let muteToggled = false;
        createGame();

        clientSocket.emit('toggleMute', player);

        clientSocket.on('PlayerMuted', () => {
            muteToggled = true;
        });

        setTimeout(() => {
            expect(muteToggled).to.equal(false);
            done();
        }, RESPONSE_DELAY);
    });

    it('socketInteracted should change the status of the player of interacted to yellow', (done) => {
        const clientSocket2 = ioClient(urlString);
        createGame();

        setTimeout(() => {
            clientSocket2.emit('validatePin', roomPin);
            clientSocket2.emit('joinLobby', '');

            setTimeout(() => {
                clientSocket2.emit('socketInteracted');

                clientSocket.on('latestPlayerList', (lobby: LobbyDetails) => {
                    expect(lobby).to.deep.equal(service['lobbies'].get(roomPin));
                    expect(lobby.players[1].activityState).to.equal(PlayerColor.Yellow);
                    done();
                });
            }, RESPONSE_DELAY);
        }, RESPONSE_DELAY);
    });

    it('socketInteracted should do nothing if the player is not in a lobby', (done) => {
        let socketInteracted = false;

        clientSocket.emit('socketInteracted');

        clientSocket.on('latestPlayerList', () => {
            socketInteracted = true;
        });

        setTimeout(() => {
            expect(socketInteracted).to.equal(false);
            done();
        }, RESPONSE_DELAY);
    });

    it('resetPlayersActivityState should reset the status of all players in lobby to red', (done) => {
        createGame();

        setTimeout(() => {
            clientSocket.emit('resetPlayersActivityState');

            clientSocket.on('latestPlayerList', (lobby: LobbyDetails) => {
                expect(lobby).to.deep.equal(service['lobbies'].get(roomPin));
                lobby.players.forEach((player) => {
                    expect(player.activityState).to.equal(PlayerColor.Red);
                });
                done();
            });
        }, RESPONSE_DELAY);
    });

    it('resetPlayersActivityState should do nothing if the player is not in a lobby', (done) => {
        let activityStateReseted = false;

        clientSocket.emit('resetPlayersActivityState');

        clientSocket.on('latestPlayerList', () => {
            activityStateReseted = true;
        });

        setTimeout(() => {
            expect(activityStateReseted).to.equal(false);
            done();
        }, RESPONSE_DELAY);
    });

    it('should update histogram when receiving qrlHistogramUpdate event', (done) => {
        const updateData = { [1]: 10, [2]: 20 };
        createGame();
        setTimeout(() => {
            clientSocket.emit('qrlHistogramUpdate', updateData);

            clientSocket.on('qrlUpdateHistogram', (updateDatas) => {
                expect(service['lobbies'].get(roomPin).histogram).to.deep.equal(updateDatas);
                done();
            });
        }, RESPONSE_DELAY);
    });

    it('gameStarted should update the date and the number of players', (done) => {
        createGame();

        clientSocket.emit('gameStarted');
        clientSocket.emit('gameEnded');

        clientSocket.on('showResults', () => {
            expect(
                mockCollection.insertOne.calledOnceWith({
                    numberPlayers: 0,
                    name: service['lobbies'].get(roomPin).game.title,
                    date: new Date().toLocaleString('sv', { timeZone: 'America/New_York' }),
                    bestScore: service['lobbies'].get(roomPin).players.sort((a, b) => {
                        return b.score - a.score;
                    })[0].score,
                }),
            ).to.equal(true);
            done();
        });
    });
});
