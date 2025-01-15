import { DatabaseService } from '@app/services/database/database.service';
import { Choice, Game, Question } from '@common/game';
import { Limit } from '@common/limit';
import { UpdateResult } from 'mongodb';
import * as randomstring from 'randomstring';
import { Service } from 'typedi';

const ID_LENGTH = 6;

@Service()
export class GameManagerService {
    error: Error;
    constructor(private databaseService: DatabaseService) {}

    async getGames(): Promise<Game[]> {
        const db = this.databaseService.getDb();
        const gamesCollection = db.collection('Games');

        const games = (await gamesCollection.find({}).toArray()) as unknown as Game[];

        return games;
    }

    async getGameById(gameId: string): Promise<Game> {
        const db = this.databaseService.getDb();
        const gamesCollection = db.collection('Games');

        const game = await gamesCollection.findOne({ id: gameId });

        if (game) return game as unknown as Game;
        return null;
    }

    async exportGame(id: string): Promise<{ fileName: string | undefined; gameToExport: Game | undefined }> {
        let fileName;

        const games: Game[] = await this.getGames();
        const gameToExport: Game = games.find((game) => game.id === id);

        if (gameToExport) {
            fileName = `./data/Game${id}.json`;
            delete gameToExport.isVisible;
        }

        return { fileName, gameToExport };
    }

    async modifyGame(id: string, modifiedGame: Game): Promise<{ result: UpdateResult<Document>; games: Game[] }> {
        // const ajv = new Ajv({ allErrors: true });
        // const schemaContent = await this.fileManager.readJsonFile('./data/game-schema.json');
        // const schema = JSON.parse(schemaContent.toString());

        // const valid = ajv.validate(schema, modifiedGame) && this.validateGame(modifiedGame);
        // if (!valid) {
        //     if (ajv.errors) this.error = new Error(ajv.errors[0].instancePath + ' ' + ajv.errors[0].message);
        //     return null;
        // }

        const db = this.databaseService.getDb();
        const gamesCollection = db.collection('Games');

        const result = await gamesCollection.updateOne({ id }, { $set: modifiedGame });
        const games = (await gamesCollection.find({}).toArray()) as unknown as Game[];

        return { result, games };
    }

    async modifyGameVisibility(id: string, newVisibility: { isVisible: boolean }): Promise<{ result: UpdateResult<Document>; games: Game[] }> {
        const db = this.databaseService.getDb();
        const gamesCollection = db.collection('Games');

        const result = await gamesCollection.updateOne({ id }, { $set: { isVisible: newVisibility.isVisible } });
        const games = (await gamesCollection.find({}).toArray()) as unknown as Game[];

        return { result, games };
    }

    async modifyGamePublicState(id: string, newPublicState: { isPublic: boolean }): Promise<{ result: UpdateResult<Document>; games: Game[] }> {
        const db = this.databaseService.getDb();
        const gamesCollection = db.collection('Games');

        const result = await gamesCollection.updateOne({ id }, { $set: { isPublic: newPublicState.isPublic } });
        const games = (await gamesCollection.find({}).toArray()) as unknown as Game[];

        return { result, games };
    }

    async addGame(newGame: Game): Promise<Game[]> {
        // const ajv = new Ajv({ allErrors: true });
        // const schemaContent = await this.fileManager.readJsonFile('./data/game-schema.json');
        // const schema = JSON.parse(schemaContent.toString());

        const existingGames: Game[] = await this.getGames();
        do {
            newGame.id = randomstring.generate(ID_LENGTH);
        } while (existingGames.some((game) => game.id === newGame.id));

        // const valid = ajv.validate(schema, newGame) && this.validateGame(newGame);
        // if (!valid) {
        //     if (ajv.errors) this.error = new Error(ajv.errors[0].instancePath + ' ' + ajv.errors[0].message);

        //     return null;
        // }

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
            if (question.type === 'QRE' && !this.validateQREQuestion(question)) {
                return false; // Retourne false si la question QRE n'est pas valide
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

    validateQREQuestion(question: Question): boolean {
        const { lowerBound, upperBound, correctSlideAnswer, toleranceMargin } = question;

        // Vérification des bornes
        if (lowerBound >= upperBound) {
            this.error = new Error('Bornes invalides pour une question');
            return false;
        }

        // Vérification de la réponse correcte
        if (correctSlideAnswer < lowerBound || correctSlideAnswer > upperBound) {
            this.error = new Error('Réponse invalide pour une QRE');
            return false;
        }

        // Vérification de la marge de tolérance
        // eslint-disable-next-line @typescript-eslint/no-magic-numbers
        const marginLimit = 0.25 * Math.abs(upperBound - lowerBound);
        if (toleranceMargin > marginLimit) {
            this.error = new Error('La marge de tolérance dépasse 25%');
            return false;
        }

        return true;
    }

    async deleteGameById(id: string) {
        const db = this.databaseService.getDb();
        const gamesCollection = db.collection('Games');

        return await gamesCollection.deleteOne({ id });
    }
    async addFeedbackToGame(gameId: string, feedback: { userId: string; rating: number; comment: string }) {
        const game = await this.getGameById(gameId);
        if (!game) {
            throw new Error('Jeu non trouvé');
        }

        if (!game.feedback) {
            game.feedback = [];
        }

        game.feedback.push(feedback);
        await this.updateGame(gameId, game);
    }
    async updateGame(gameId: string, updatedGame: Game): Promise<void> {
        const db = this.databaseService.getDb();
        const gamesCollection = db.collection('Games');

        await gamesCollection.updateOne({ id: gameId }, { $set: updatedGame });
    }
}
