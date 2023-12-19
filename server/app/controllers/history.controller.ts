import { DatabaseService } from '@app/services/database.service';
import { GameInfo } from '@common/game';
import { Request, Response, Router } from 'express';
import { StatusCodes } from 'http-status-codes';
import { Service } from 'typedi';

@Service()
export class HistoryController {
    router: Router;

    constructor(private databaseService: DatabaseService) {
        this.configureRouter();
    }

    private configureRouter(): void {
        this.router = Router();

        this.router.get('/', async (req: Request, res: Response) => {
            const db = this.databaseService.getDb();
            const historyCollection = db.collection('Historique');

            const games = (await historyCollection.find({}).toArray()) as unknown as GameInfo[];
            if (games) res.status(StatusCodes.OK).send(games);
            else res.status(StatusCodes.NOT_FOUND).send();
        });

        this.router.delete('/', async (req: Request, res: Response) => {
            const db = this.databaseService.getDb();
            const historyCollection = db.collection('Historique');

            await historyCollection.deleteMany({});
            res.status(StatusCodes.OK).send([]);
        });
    }
}
