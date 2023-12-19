import { FileManagerService } from '@app/services/file-manager.service';
import { GameManagerService } from '@app/services/game-manager.service';
import { Game } from '@common/game';
import { Request, Response, Router } from 'express';
import { StatusCodes } from 'http-status-codes';
import { Service } from 'typedi';

@Service()
export class GameController {
    router: Router;

    constructor(
        private readonly gameManager: GameManagerService,
        private fileManager: FileManagerService,
    ) {
        this.configureRouter();
    }

    private configureRouter(): void {
        this.router = Router();

        this.router.get('/', async (req: Request, res: Response) => {
            const games: Game[] = await this.gameManager.getGames();
            res.json(games);
        });

        this.router.get('/:id', async (req: Request, res: Response) => {
            const file: string = await this.gameManager.exportGame(req.params.id);
            res.download(file, async () => {
                await this.fileManager.deleteFile(file);
                res.send();
            });
        });

        this.router.patch('/:id', async (req: Request, res: Response) => {
            const games: Game[] = await this.gameManager.modifyGame(req.params.id, req.body);
            res.json(games);
        });

        this.router.patch('/visibility/:id', async (req: Request, res: Response) => {
            const games: Game[] = await this.gameManager.modifyGameVisibility(req.params.id, req.body);
            res.json(games);
        });

        this.router.post('/', async (req: Request, res: Response) => {
            const games = await this.gameManager.addGame(req.body);
            if (games === null) {
                return res.status(StatusCodes.BAD_REQUEST).send({ message: 'Json invalide: ' + this.gameManager.error.message });
            } else {
                return res.status(StatusCodes.CREATED).json(games);
            }
        });

        this.router.delete('/:id', async (req: Request, res: Response) => {
            await this.gameManager.deleteGameById(req.params.id);
            res.status(StatusCodes.NO_CONTENT).send();
        });
    }
}
