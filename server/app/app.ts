/* eslint-disable max-params */
import { HttpException } from '@app/classes/http.exception';
import { GameController } from '@app/controllers/game-controller/game.controller';
import * as compression from 'compression';
import * as cookieParser from 'cookie-parser';
import * as cors from 'cors';
import * as express from 'express';
import { StatusCodes } from 'http-status-codes';
import { Service } from 'typedi';
import { AuthController } from './controllers/auth-controller/auth-controller';
import { HistoryController } from './controllers/history-controller/history.controller';
import { UserController } from './controllers/user-controller/user-controller';

@Service()
export class Application {
    app: express.Application;
    private readonly internalError: number = StatusCodes.INTERNAL_SERVER_ERROR;

    constructor(
        private readonly authController: AuthController,
        private readonly gameController: GameController,
        private readonly historyController: HistoryController,
        private readonly userController: UserController,
    ) {
        this.app = express();
        this.config();
        this.bindRoutes();
    }

    bindRoutes(): void {
        this.app.use('/api/auth', this.authController.getRouter());
        this.app.use('/api/users', this.userController.getRouter());
        this.app.use('/api/games', this.gameController.getRouter());
        this.app.use('/api/history', this.historyController.getRouter());
        this.app.use('/api/leaderboard', this.userController.getRouter());

        this.errorHandling();
    }

    private config(): void {
        // Middlewares configuration
        this.app.use(compression());
        this.app.use(express.json({ limit: '1000mb' }));
        this.app.use(express.urlencoded({ extended: true }));
        this.app.use(cookieParser());
        this.app.use(cors());
    }

    private errorHandling(): void {
        // When previous handlers have not served a request: path wasn't found
        this.app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
            const err: HttpException = new HttpException('Not Found');
            next(err);
        });

        // development error handler
        // will print stacktrace
        if (this.app.get('env') === 'development') {
            this.app.use((err: HttpException, req: express.Request, res: express.Response) => {
                res.status(err.status || this.internalError);
                res.send({
                    message: err.message,
                    error: err,
                });
            });
        }

        // production error handler
        // no stacktraces  leaked to user (in production env only)
        this.app.use((err: HttpException, req: express.Request, res: express.Response) => {
            res.status(err.status || this.internalError);
            res.send({
                message: err.message,
                error: {},
            });
        });
    }
}
