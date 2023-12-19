import { DatabaseService } from '@app/services/database.service';
import { FileManagerService } from '@app/services/file-manager.service';
import { Choice, Game, Question } from '@common/game';
import { Limit } from '@common/limit';
import Ajv from 'ajv';
import * as randomstring from 'randomstring';
import { Service } from 'typedi';

const JSON_SPACE = 4;
const ID_LENGTH = 6;

@Service()
export class GameManagerService {
    error: Error;
    constructor(
        private databaseService: DatabaseService,
        private fileManager: FileManagerService,
    ) {}

    async getGames(): Promise<Game[]> {
        const db = this.databaseService.getDb();
        const gamesCollection = db.collection('Games');

        const games = (await gamesCollection.find({}).toArray()) as unknown as Game[];

        return games;
    }

    async exportGame(id: string): Promise<string> {
        const games: Game[] = await this.getGames();
        const gameToExport: Game = games.find((game) => game.id === id);
        const file = `./data/Game${id}.json`;

        delete gameToExport.isVisible;
        await this.fileManager.writeJsonFile(file, JSON.stringify(gameToExport, null, JSON_SPACE));

        return file;
    }

    async modifyGame(id: string, modifiedGame: Game): Promise<Game[]> {
        const ajv = new Ajv({ allErrors: true });
        const schemaContent = await this.fileManager.readJsonFile('./data/game-schema.json');
        const schema = JSON.parse(schemaContent.toString());

        const valid = ajv.validate(schema, modifiedGame) && this.validateGame(modifiedGame);
        if (!valid) {
            if (ajv.errors) this.error = new Error(ajv.errors[0].instancePath + ' ' + ajv.errors[0].message);

            return null;
        }

        const db = this.databaseService.getDb();
        const gamesCollection = db.collection('Games');

        await gamesCollection.updateOne({ id }, { $set: modifiedGame });

        const games = (await gamesCollection.find({}).toArray()) as unknown as Game[];

        return games;
    }

    async modifyGameVisibility(id: string, newVisibility: { isVisible: boolean }): Promise<Game[]> {
        const db = this.databaseService.getDb();
        const gamesCollection = db.collection('Games');

        await gamesCollection.updateOne({ id }, { $set: { isVisible: newVisibility.isVisible } });

        const games = (await gamesCollection.find({}).toArray()) as unknown as Game[];

        return games;
    }

    async addGame(newGame: Game): Promise<Game[]> {
        const ajv = new Ajv({ allErrors: true });
        const schemaContent = await this.fileManager.readJsonFile('./data/game-schema.json');
        const schema = JSON.parse(schemaContent.toString());

        const existingGames: Game[] = await this.getGames();
        do {
            newGame.id = randomstring.generate(ID_LENGTH);
        } while (existingGames.some((game) => game.id === newGame.id));

        const valid = ajv.validate(schema, newGame) && this.validateGame(newGame);
        if (!valid) {
            if (ajv.errors) this.error = new Error(ajv.errors[0].instancePath + ' ' + ajv.errors[0].message);

            return null;
        }

        const db = this.databaseService.getDb();
        const gamesCollection = db.collection('Games');

        await gamesCollection.insertOne(newGame);

        const allGames = (await gamesCollection.find({}).toArray()) as unknown as Game[];

        return allGames;
    }

    validateGame(game: Game): boolean {
        if (game.title.length > Limit.MaxTitleLength) {
            this.error = new Error('Nom trop long');
            return false;
        }
        if (game.description.length === 0 || game.description.length > Limit.MaxDescriptionLength) {
            this.error = new Error('Description invalide');
            return false;
        }
        if (game.duration < Limit.MinDuration || game.duration > Limit.MaxDuration) {
            this.error = new Error('Temps invalide');
            return false;
        }
        if (game.questions.length === 0) {
            this.error = new Error('Questions invalides');
            return false;
        }
        return this.validateQuestions(game.questions);
    }

    validateQuestions(questions: Question[]): boolean {
        let choicesValid = true;
        for (const question of questions) {
            if (question.text.length === 0 || question.text.length > Limit.MaxQuestionLength) {
                this.error = new Error(`Question: "${question.text}" invalide`);
                return false;
            }
            if (question.points < Limit.MinPoints || question.points > Limit.MaxPoints) {
                this.error = new Error(`Points de la question: "${question.text}" invalides`);
                return false;
            }
            if (question.points % Limit.MinPoints !== 0) {
                this.error = new Error(`Points de la question: "${question.text}" invalides`);
                return false;
            }
            if (question.choices && (question.choices.length < Limit.MinChoicesNumber || question.choices.length > Limit.MaxChoicesNumber)) {
                this.error = new Error(`Choix de la question: "${question.text}" invalides`);
                return false;
            }

            if (question.choices) choicesValid = this.validateChoices(question.choices);
        }
        return choicesValid;
    }

    validateChoices(choices: Choice[]): boolean {
        let nBadChoices = 0;
        let nGoodChoices = 0;
        for (const choice of choices) {
            if (choice.text.length === 0 || choice.text.length > Limit.MaxChoiceLength) {
                this.error = new Error(`Choix: "${choice.text}" invalide`);
                return false;
            }
            if (choice.isCorrect) nGoodChoices++;
            else nBadChoices++;
        }
        if (nBadChoices < Limit.MinBadChoices) {
            this.error = new Error('Nombre de mauvais choix invalides');
            return false;
        }
        if (nGoodChoices < Limit.MinGoodChoices) {
            this.error = new Error('Nombre de bons choix invalides');
            return false;
        }

        return true;
    }

    async deleteGameById(id: string): Promise<void> {
        const db = this.databaseService.getDb();
        const gamesCollection = db.collection('Games');

        await gamesCollection.deleteOne({ id });
    }
}
