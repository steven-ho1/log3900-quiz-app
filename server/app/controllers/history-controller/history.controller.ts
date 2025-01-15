import { DatabaseService } from '@app/services/database/database.service';
import { InternalErrorMessage } from '@app/type/error';
import { handleInternalError } from '@app/utils/error-utils';
import { GameInfo } from '@common/game';
import { Request, Response, Router } from 'express';
import { StatusCodes } from 'http-status-codes';
import { Service } from 'typedi';

@Service()
export class HistoryController {
    private router: Router;

    constructor(private databaseService: DatabaseService) {
        this.configureRouter();
    }

    getRouter(): Router {
        return this.router;
    }

    private configureRouter(): void {
        this.router = Router();

        this.router.get('/', async (_req: Request, res: Response) => {
            try {
                const db = this.databaseService.getDb();
                const historyCollection = db.collection('Historique');

                const games = (await historyCollection.find({}).toArray()) as unknown as GameInfo[];

                if (games) res.status(StatusCodes.OK).json(games);
                else res.sendStatus(StatusCodes.NOT_FOUND);
            } catch (error) {
                handleInternalError(res, error, InternalErrorMessage.HistoryFetchError);
            }
        });

        this.router.delete('/', async (_req: Request, res: Response) => {
            try {
                const db = this.databaseService.getDb();
                const historyCollection = db.collection('Historique');

                await historyCollection.deleteMany({});
                res.sendStatus(StatusCodes.NO_CONTENT);
            } catch (error) {
                handleInternalError(res, error, InternalErrorMessage.HistoryDeletionError);
            }
        });
    }
}
