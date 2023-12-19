import { Application } from '@app/app';
import { FileManagerService } from '@app/services/file-manager.service';
import { GameManagerService } from '@app/services/game-manager.service';
import { Game } from '@common/game';
import { expect } from 'chai';
import { StatusCodes } from 'http-status-codes';
import { SinonStubbedInstance, createStubInstance } from 'sinon';
import * as supertest from 'supertest';
import { Container } from 'typedi';

describe('GameController', () => {
    let expressApp: Express.Application;
    let gameManager: SinonStubbedInstance<GameManagerService>;
    let fileManager: SinonStubbedInstance<FileManagerService>;

    const games: Game[] = [
        {
            id: '0',
            title: 'Test 1',
            description: 'test 1',
            duration: 15,
            isVisible: true,
            lastModification: 'Today',
            questions: [],
        },
    ];

    beforeEach(async () => {
        gameManager = createStubInstance(GameManagerService);
        gameManager.getGames.resolves(games);
        gameManager.exportGame.resolves('./data/Game0.json');
        gameManager.modifyGame.resolves(games);
        gameManager.modifyGameVisibility.resolves(games);
        gameManager.addGame.resolves(games);
        gameManager.deleteGameById.resolves();
        fileManager = createStubInstance(FileManagerService);
        fileManager.deleteFile.resolves();
        const app = Container.get(Application);
        Object.defineProperty(app['gameController'], 'gameManager', { value: gameManager });
        Object.defineProperty(app['gameController'], 'fileManager', { value: fileManager });
        expressApp = app.app;
    });

    it('should call getGames and return the list of games on valid get request to root', async () => {
        return supertest(expressApp)
            .get('/api/games')
            .expect(StatusCodes.OK)
            .then((response) => {
                expect(gameManager.getGames.called).to.equal(true);
                expect(response.body).to.deep.equal(games);
            });
    });

    it('should call exportGame and deleteFile on valid get request to /:id', async () => {
        return supertest(expressApp)
            .get('/api/games/0')
            .expect(StatusCodes.OK)
            .then(() => {
                expect(gameManager.exportGame.called).to.equal(true);
                expect(fileManager.deleteFile.called).to.equal(true);
            });
    });

    it('should call modifyGame and return the list of the games modified on valid patch request to /:id', async () => {
        return supertest(expressApp)
            .patch('/api/games/0')
            .expect(StatusCodes.OK)
            .then((response) => {
                expect(gameManager.modifyGame.called).to.equal(true);
                expect(response.body).to.deep.equal(games);
            });
    });

    it('should call modifyGameVisibility and return the list of the games modified on valid patch request to /visibility/:id', async () => {
        return supertest(expressApp)
            .patch('/api/games/visibility/0')
            .expect(StatusCodes.OK)
            .then((response) => {
                expect(gameManager.modifyGameVisibility.called).to.equal(true);
                expect(response.body).to.deep.equal(games);
            });
    });

    it('should call addGame and return the list of the games modified on valid post request to root', async () => {
        return supertest(expressApp)
            .post('/api/games')
            .expect(StatusCodes.CREATED)
            .then((response) => {
                expect(gameManager.addGame.called).to.equal(true);
                expect(response.body).to.deep.equal(games);
            });
    });

    it('should call addGame and return an error if the game is not valid', async () => {
        gameManager.addGame.resolves(null);
        gameManager.error = new Error('test');
        return supertest(expressApp)
            .post('/api/games')
            .expect(StatusCodes.BAD_REQUEST)
            .then((response) => {
                expect(gameManager.addGame.called).to.equal(true);
                expect(response.body.message).to.not.equal(undefined);
            });
    });

    it('should call removeGame on valid delete request to /:id', async () => {
        return supertest(expressApp)
            .delete('/api/games/0')
            .expect(StatusCodes.NO_CONTENT)
            .then(() => {
                expect(gameManager.deleteGameById.called).to.equal(true);
            });
    });
});
