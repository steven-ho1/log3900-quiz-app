import { Request, Response, Router } from 'express';
import { StatusCodes } from 'http-status-codes';
import { Service } from 'typedi';

@Service()
export class AdminController {
    private readonly router: Router;
    private readonly adminPassword: string = 'admin';

    constructor() {
        this.router = Router();
        this.configureRoutes();
    }

    getRouter(): Router {
        return this.router;
    }

    private configureRoutes(): void {
        this.router.post('/verify-admin-password', (req: Request, res: Response) => {
            const { password } = req.body;
            if (password === this.adminPassword) {
                res.status(StatusCodes.OK).send({ valid: true });
            } else {
                res.status(StatusCodes.UNAUTHORIZED).send({ valid: false });
            }
        });
    }
}
