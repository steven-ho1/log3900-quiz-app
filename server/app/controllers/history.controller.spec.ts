import { Application } from '@app/app';
import { DatabaseService } from '@app/services/database.service';
import { GameInfo } from '@common/game';
import { expect } from 'chai';
import { StatusCodes } from 'http-status-codes';
import { Collection, Db, FindCursor } from 'mongodb';
import * as Sinon from 'sinon';
import * as supertest from 'supertest';
import { Container } from 'typedi';

describe('HistoryController', () => {
    let expressApp: Express.Application;
    let mockDatabaseService: Sinon.SinonStubbedInstance<DatabaseService>;
    let mockCollection: Sinon.SinonStubbedInstance<Collection<GameInfo>>;
    let mockCursor: Sinon.SinonStubbedInstance<FindCursor<GameInfo>>;

    const games: GameInfo[] = [
        { name: 'Ntest3', date: '2003-11-16 18:27:34', numberPlayers: 50, bestScore: 1130 },
        { name: 'Ctest', date: '2023-11-16 18:27:35', numberPlayers: 5, bestScore: 130 },
        { name: 'Atest2', date: '2003-11-26 18:27:35', numberPlayers: 500, bestScore: 13130 },
        { name: 'Ptest4', date: '2053-11-16 18:27:35', numberPlayers: 1, bestScore: 0 },
    ];

    beforeEach(async () => {
        const app = Container.get(Application);
        expressApp = app.app;
        mockDatabaseService = Sinon.createStubInstance(DatabaseService);

        mockCollection = {
            find: Sinon.stub(),
            insertOne: Sinon.stub(),
            updateOne: Sinon.stub(),
            deleteOne: Sinon.stub(),
            deleteMany: Sinon.stub(),
        } as unknown as Sinon.SinonStubbedInstance<Collection<GameInfo>>;

        mockCursor = {
            toArray: Sinon.stub(),
        } as unknown as Sinon.SinonStubbedInstance<FindCursor<GameInfo>>;

        mockCollection.find.returns(mockCursor as unknown as FindCursor<GameInfo>);

        mockDatabaseService.getDb.returns({ collection: () => mockCollection } as unknown as Db);

        app['historyController']['databaseService'] = mockDatabaseService;
    });

    it('should return the list of games played on valid get request to root', async () => {
        mockCursor.toArray.resolves(games);
        return supertest(expressApp)
            .get('/api/history')
            .expect(StatusCodes.OK)
            .then((response) => {
                expect(response.body).to.deep.equal(games);
            });
    });

    it('should return NOT_FOUND if the list is not defined on valid get request to root', async () => {
        Object.defineProperty(Container.get(Application)['historyController'], 'games', { value: undefined });
        return supertest(expressApp).get('/api/history').expect(StatusCodes.NOT_FOUND);
    });

    it('should empty the list on valid delete request to root', async () => {
        return supertest(expressApp)
            .delete('/api/history')
            .expect(StatusCodes.OK)
            .then((response) => {
                expect(response.body).to.deep.equal([]);
            });
    });
});
