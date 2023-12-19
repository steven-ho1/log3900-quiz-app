/* eslint-disable max-lines */
import { Choice, Game, Question } from '@common/game';
import { expect } from 'chai';
import { Collection, Db, FindCursor, InsertOneResult, UpdateResult } from 'mongodb';
import * as Sinon from 'sinon';
import { DatabaseService } from './database.service';
import { FileManagerService } from './file-manager.service';
import { GameManagerService } from './game-manager.service';

describe('GameManagerService', () => {
    let gameManager: GameManagerService;
    let mockDatabaseService: Sinon.SinonStubbedInstance<DatabaseService>;
    let mockFileManagerService: Sinon.SinonStubbedInstance<FileManagerService>;
    let mockCollection: Sinon.SinonStubbedInstance<Collection<Game>>;
    let mockCursor: Sinon.SinonStubbedInstance<FindCursor<Game>>;
    const games: Game[] = [
        {
            id: '0',
            title: 'test',
            description: 'description of test',
            duration: 20,
            lastModification: '2023-09-30',
            isVisible: true,
            questions: [],
        },
    ];

    const modifiedGame: Game = {
        id: '0',
        title: 'modified test',
        description: 'modified description',
        duration: 30,
        lastModification: '2023-10-01',
        isVisible: false,
        questions: [],
    };
    const schemaObject = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        description: 'A quiz',
        type: 'object',
    };
    enum QuestionType {
        QCM = 'QCM',
        QRL = 'QRL',
    }

    beforeEach(() => {
        mockDatabaseService = Sinon.createStubInstance(DatabaseService);
        mockFileManagerService = Sinon.createStubInstance(FileManagerService);

        mockCollection = {
            find: Sinon.stub(),
            insertOne: Sinon.stub(),
            updateOne: Sinon.stub(),
            deleteOne: Sinon.stub(),
        } as unknown as Sinon.SinonStubbedInstance<Collection<Game>>;

        mockCursor = {
            toArray: Sinon.stub(),
        } as unknown as Sinon.SinonStubbedInstance<FindCursor<Game>>;
        const schemaString = JSON.stringify(schemaObject);
        const schemaBuffer = Buffer.from(schemaString);

        mockFileManagerService.readJsonFile.resolves(schemaBuffer);

        mockCollection.find.returns(mockCursor as unknown as FindCursor<Game>);

        mockDatabaseService.getDb.returns({ collection: () => mockCollection } as unknown as Db);

        gameManager = new GameManagerService(
            mockDatabaseService as unknown as DatabaseService,
            mockFileManagerService as unknown as FileManagerService,
        );
    });

    it('getGames should retrieve games from the database', async () => {
        mockCursor.toArray.resolves(games);
        const result = await gameManager.getGames();
        expect(result).to.deep.equal(games);
    });

    it('exportGame should export a game to a file', async () => {
        mockCursor.toArray.resolves([games[0]]);
        mockFileManagerService.writeJsonFile.resolves();
        const filePath = await gameManager.exportGame('0');
        expect(filePath).to.equal('./data/Game0.json');
    });

    it('modifyGame should update a game in the database', async () => {
        const validQuestion = {
            text: 'Valid Question Text',
            points: 10,
            type: QuestionType.QCM,
            choices: [
                { text: 'Choice 1', isCorrect: true },
                { text: 'Choice 2', isCorrect: false },
            ],
        };

        const validModifiedGame: Game = {
            ...modifiedGame,
            title: 'Valid Title',
            description: 'Valid Description',
            duration: 30,
            questions: [validQuestion],
        };

        const updateResult: UpdateResult<Game> = {
            matchedCount: 1,
            modifiedCount: 1,
            acknowledged: true,
            upsertedCount: 0,
            upsertedId: null,
        };
        mockCollection.updateOne.resolves(updateResult);
        mockCursor.toArray.resolves([validModifiedGame]);
        mockFileManagerService.readJsonFile.resolves(Buffer.from(JSON.stringify(schemaObject)));

        const result = await gameManager.modifyGame('0', validModifiedGame);

        expect(result).to.not.equal(null);
        expect(result.length).to.not.equal(0);
        expect(result[0]).to.deep.equal(validModifiedGame);
    });

    it("modifyGameVisibility should update a game's visibility", async () => {
        const visibilityUpdate = { isVisible: false };
        mockCollection.updateOne.resolves();
        mockCursor.toArray.resolves([{ ...games[0], isVisible: visibilityUpdate.isVisible }]);
        const result = await gameManager.modifyGameVisibility('0', visibilityUpdate);
        expect(result[0].isVisible).to.equal(visibilityUpdate.isVisible);
    });

    it('deleteGameById should remove a game from the database', async () => {
        mockCollection.deleteOne.resolves();
        mockCursor.toArray.resolves([]);
        await gameManager.deleteGameById('0');
        const result = await gameManager.getGames();
        expect(result.length).to.equal(0);
    });
    it('validateGame should return false if one of the elements is not valid and true otherwise', async () => {
        const nbChar = 1000;
        const wrongDuration = 100;
        const mockValidateQuestions = Sinon.stub(gameManager, 'validateQuestions').returns(true);

        expect(gameManager.validateGame(modifiedGame)).to.equal(false);
        expect(gameManager.error.message).to.equal('Questions invalides');

        modifiedGame.questions.push({
            text: '',
            points: 0,
            type: QuestionType.QCM,
            choices: [],
        });

        expect(gameManager.validateGame(modifiedGame)).to.equal(true);
        expect(mockValidateQuestions.called).to.equal(true);

        mockValidateQuestions.returns(false);
        expect(gameManager.validateGame(modifiedGame)).to.equal(false);
        mockValidateQuestions.returns(true);

        for (let i = 0; i < nbChar; i++) modifiedGame.title += 't';

        expect(gameManager.validateGame(modifiedGame)).to.equal(false);
        expect(gameManager.error.message).to.equal('Nom trop long');

        modifiedGame.title = 'test2';
        modifiedGame.description = '';

        expect(gameManager.validateGame(modifiedGame)).to.equal(false);
        expect(gameManager.error.message).to.equal('Description invalide');

        for (let i = 0; i < nbChar; i++) modifiedGame.description += 't';

        expect(gameManager.validateGame(modifiedGame)).to.equal(false);
        expect(gameManager.error.message).to.equal('Description invalide');

        modifiedGame.description = 'description of test 2';
        modifiedGame.duration = 0;

        expect(gameManager.validateGame(modifiedGame)).to.equal(false);
        expect(gameManager.error.message).to.equal('Temps invalide');

        modifiedGame.duration = wrongDuration;

        expect(gameManager.validateGame(modifiedGame)).to.equal(false);
        expect(gameManager.error.message).to.equal('Temps invalide');
    });

    it('validateQuestions should return false if one of the elements is invalid and true otherwise', async () => {
        const nbChar = 1000;
        const wrongPoints = 150;
        const wrongPoints2 = 54;

        const qcmQuestion: Question = {
            text: 'test',
            points: 10,
            type: QuestionType.QCM,
            choices: [
                { text: '', isCorrect: true },
                { text: '', isCorrect: false },
            ],
        };

        const qrlQuestion: Question = {
            text: 'test',
            points: 10,
            type: QuestionType.QRL,
        };

        const mockValidateChoices = Sinon.stub(gameManager, 'validateChoices').returns(true);

        expect(gameManager.validateQuestions([])).to.equal(true);

        expect(gameManager.validateQuestions([qcmQuestion])).to.equal(true);
        expect(mockValidateChoices.called).to.equal(true);

        expect(gameManager.validateQuestions([qrlQuestion])).to.equal(true);

        mockValidateChoices.returns(false);
        expect(gameManager.validateQuestions([qcmQuestion])).to.equal(false);
        mockValidateChoices.returns(true);

        qcmQuestion.text = '';
        expect(gameManager.validateQuestions([qcmQuestion])).to.equal(false);
        expect(gameManager.error.message).to.equal(`Question: "${qcmQuestion.text}" invalide`);

        for (let i = 0; i < nbChar; i++) qcmQuestion.text += 't';
        expect(gameManager.validateQuestions([qcmQuestion])).to.equal(false);
        expect(gameManager.error.message).to.equal(`Question: "${qcmQuestion.text}" invalide`);

        qcmQuestion.text = 'test';
        qcmQuestion.points = 0;

        expect(gameManager.validateQuestions([qcmQuestion])).to.equal(false);
        expect(gameManager.error.message).to.equal(`Points de la question: "${qcmQuestion.text}" invalides`);

        qcmQuestion.points = wrongPoints;

        expect(gameManager.validateQuestions([qcmQuestion])).to.equal(false);
        expect(gameManager.error.message).to.equal(`Points de la question: "${qcmQuestion.text}" invalides`);

        qcmQuestion.points = wrongPoints2;

        expect(gameManager.validateQuestions([qcmQuestion])).to.equal(false);
        expect(gameManager.error.message).to.equal(`Points de la question: "${qcmQuestion.text}" invalides`);

        qcmQuestion.points = 10;
        qcmQuestion.choices.push({ text: '', isCorrect: true });
        qcmQuestion.choices.push({ text: '', isCorrect: true });
        qcmQuestion.choices.push({ text: '', isCorrect: true });

        expect(gameManager.validateQuestions([qcmQuestion])).to.equal(false);
        expect(gameManager.error.message).to.equal(`Choix de la question: "${qcmQuestion.text}" invalides`);

        qcmQuestion.choices.pop();
        qcmQuestion.choices.pop();
        qcmQuestion.choices.pop();
        qcmQuestion.choices.pop();

        expect(gameManager.validateQuestions([qcmQuestion])).to.equal(false);
        expect(gameManager.error.message).to.equal(`Choix de la question: "${qcmQuestion.text}" invalides`);
    });

    it('validateChoices should return false if one of the elements is invalid and true otherwise', async () => {
        const nbChar = 1000;
        const choices: Choice[] = [
            {
                text: 'test',
                isCorrect: false,
            },
            {
                text: 'test2',
                isCorrect: true,
            },
        ];

        expect(gameManager.validateChoices(choices)).to.equal(true);

        choices[0].text = '';

        expect(gameManager.validateChoices(choices)).to.equal(false);
        expect(gameManager.error.message).to.equal(`Choix: "${choices[0].text}" invalide`);

        for (let i = 0; i < nbChar; i++) choices[0].text += 't';

        expect(gameManager.validateChoices(choices)).to.equal(false);
        expect(gameManager.error.message).to.equal(`Choix: "${choices[0].text}" invalide`);

        choices[0].text = 'test';
        choices[0].isCorrect = true;

        expect(gameManager.validateChoices(choices)).to.equal(false);
        expect(gameManager.error.message).to.equal('Nombre de mauvais choix invalides');

        choices[0].isCorrect = false;
        choices[1].isCorrect = false;

        expect(gameManager.validateChoices(choices)).to.equal(false);
        expect(gameManager.error.message).to.equal('Nombre de bons choix invalides');
    });

    it('should return null and set error if validation fails when modifyGame', async () => {
        const invalidGame: Game = {
            id: 'string',
            title: 'string',
            description: 'string',
            duration: 0,
            lastModification: 'string',
            questions: [],
        };
        const result = await gameManager.modifyGame('someId', invalidGame);

        expect(result).to.equal(null);
        expect(gameManager.error).to.not.equal(null);
    });

    it('modifyGame should return null if there are errors in the game provided', async () => {
        mockFileManagerService.readJsonFile.resolves(Buffer.from('{"type":"string"}'));

        const result = await gameManager.modifyGame('', JSON.parse('{"test":"0"}'));

        expect(result).to.equal(null);
    });

    it('should return null and set error if validation fails when adding a new game', async () => {
        const gameToAdd: Game = {
            id: '0',
            title: 'test',
            description: 'description of test',
            duration: 20,
            lastModification: '2023-09-30',
            isVisible: true,
            questions: [], // empty array so should call error
        };
        mockFileManagerService.readJsonFile.resolves(Buffer.from(JSON.stringify(schemaObject)));
        mockCursor.toArray.onCall(0).resolves([]);

        const result = await gameManager.addGame(gameToAdd);
        expect(result).to.equal(null);
    });

    it('should add a new game', async () => {
        const gameToAdd: Game = {
            id: '0',
            title: 'test1',
            description: 'description of test',
            duration: 20,
            lastModification: '2023-09-30',
            isVisible: true,
            questions: [],
        };
        const qcmQuestion: Question = {
            text: 'test',
            points: 10,
            type: QuestionType.QCM,
            choices: [
                { text: 'firsttest', isCorrect: true },
                { text: 'secondtest', isCorrect: false },
            ],
        };
        const qrlQuestion: Question = {
            text: 'test',
            points: 10,
            type: QuestionType.QRL,
        };

        gameToAdd.questions.push(qcmQuestion, qrlQuestion);
        const insertResult: InsertOneResult<Game> = {
            acknowledged: true,
            insertedId: null,
        };

        mockFileManagerService.readJsonFile.resolves(Buffer.from(JSON.stringify(schemaObject)));
        mockCursor.toArray.onCall(0).resolves([games[0]]);
        mockCursor.toArray.onCall(1).resolves([games[0], gameToAdd]);
        mockCollection.insertOne.resolves(insertResult);

        const result = await gameManager.addGame(gameToAdd);
        expect(result).to.not.equal(null);
        expect(result.length).to.not.equal(0);
        expect(result[0]).to.deep.equal(games[0]);
        expect(result[1]).to.deep.equal(gameToAdd);
    });

    it('addGame should return null if there are errors in the game provided', async () => {
        Sinon.stub(gameManager, 'getGames').resolves([]);
        mockFileManagerService.readJsonFile.resolves(Buffer.from('{"type":"string"}'));

        const result = await gameManager.addGame(JSON.parse('{"test":"0"}'));

        expect(result).to.equal(null);
    });
});
