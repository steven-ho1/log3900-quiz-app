import { Game } from '@common/game';
import { expect } from 'chai';
import * as fs from 'fs';
import { Collection, Db, InsertManyResult, MongoClient, ObjectId, WithId } from 'mongodb';
import * as Sinon from 'sinon';
import { DatabaseService } from './database.service';

describe('DatabaseService', () => {
    let databaseService: DatabaseService;
    let mockClient: Sinon.SinonStubbedInstance<MongoClient>;
    let mockDb: Sinon.SinonStubbedInstance<Db>;
    let mockCollection: Sinon.SinonStubbedInstance<Collection>;

    beforeEach(() => {
        mockClient = Sinon.createStubInstance(MongoClient);
        mockDb = Sinon.createStubInstance(Db);
        mockCollection = Sinon.createStubInstance(Collection);

        // Stub the MongoClient methods, but avoid stubbing 'db' again
        mockClient.connect.resolves();
        mockClient.close.resolves();
        // Link 'db' and 'collection' methods to the stubs
        mockClient.db.returns(mockDb as unknown as Db);
        mockDb.collection.returns(mockCollection as unknown as Collection);

        databaseService = new DatabaseService();
        databaseService['client'] = mockClient as unknown as MongoClient;
    });

    afterEach(() => {
        Sinon.restore();
    });

    it('should connect to the database', async () => {
        await databaseService.connect();
        expect(mockClient.connect.calledOnce).to.equal(true);
    });

    it('should disconnect from the database', async () => {
        await databaseService.disconnect();
        expect(mockClient.close.calledOnce).to.equal(true);
    });
    it('should get the database', () => {
        const db = databaseService.getDb();
        expect(db).to.equal(mockDb);
        expect(mockClient.db.calledWith('Log2990_database')).to.equal(true);
    });

    it('should import games from a file', async () => {
        const filePath = 'path/to/games.json';
        const gamesData: WithId<Game>[] = [];

        Sinon.stub(fs, 'readFileSync').returns(JSON.stringify(gamesData));

        mockCollection.insertMany.resolves({
            acknowledged: true,
            insertedCount: gamesData.length,
            insertedIds: gamesData.reduce((acc, _, i) => ({ ...acc, [i]: new ObjectId() }), {}),
        } as InsertManyResult<unknown>);

        await databaseService.importGames(filePath);

        expect(mockClient.connect.calledOnce).to.equal(true);
        expect(mockDb.collection.calledWith('Games')).to.equal(true);
        expect(mockCollection.insertMany.calledWith(gamesData)).to.equal(true);
    });

    it('should log an error if connection fails', async () => {
        const errorMessage = 'Connection error';
        mockClient.connect.rejects(new Error('Connection error'));

        const consoleErrorStub = Sinon.stub(console, 'error');

        await databaseService.connect();

        expect(consoleErrorStub.calledOnce).to.equal(true);
        expect(consoleErrorStub.calledWith('Error connecting to MongoDB:', Sinon.match.instanceOf(Error))).to.equal(true);
        expect(consoleErrorStub.getCall(0).args[1].message).to.equal(errorMessage);
    });

    it('should log an error if disconnect fails', async () => {
        const errorMessage = 'Disconnect error';
        mockClient.close.rejects(new Error('Disconnect error'));

        const consoleErrorStub = Sinon.stub(console, 'error');

        await databaseService.disconnect();

        expect(consoleErrorStub.calledOnce).to.equal(true);
        expect(consoleErrorStub.calledWith('Error disconnecting from MongoDB:', Sinon.match.instanceOf(Error))).to.equal(true);
        expect(consoleErrorStub.getCall(0).args[1].message).to.equal(errorMessage);
    });

    it('should handle errors during game import', async () => {
        const errorMessage = 'Connection error';
        mockClient.connect.rejects(new Error('Connection error'));

        const consoleErrorStub = Sinon.stub(console, 'error');

        await databaseService.importGames('path/Log2990_database');

        expect(consoleErrorStub.calledOnce).to.equal(true);
        expect(consoleErrorStub.calledWith('Error importing games data:', Sinon.match.instanceOf(Error))).to.equal(true);
        expect(consoleErrorStub.getCall(0).args[1].message).to.equal(errorMessage);
    });
});
