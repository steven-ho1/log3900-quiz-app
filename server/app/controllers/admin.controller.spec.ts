import { Application } from '@app/app';
import { expect } from 'chai';
import { StatusCodes } from 'http-status-codes';
import * as supertest from 'supertest';
import { Container } from 'typedi';
import { AdminController } from './admin.controller';

describe('AdminController', () => {
    let expressApp: Express.Application;
    let adminController: AdminController;

    beforeEach(async () => {
        adminController = new AdminController();

        const appInstance = Container.get(Application);

        appInstance.app.use(adminController.getRouter());

        expressApp = appInstance.app;
    });

    it('should return OK status and valid true if password is correct', async () => {
        return supertest(expressApp)
            .post('/api/admin/verify-admin-password')
            .send({ password: 'admin' })
            .expect(StatusCodes.OK)
            .then((response) => {
                expect(response.body.valid).to.equal(true);
            });
    });

    it('should return UNAUTHORIZED status and valid false if password is incorrect', async () => {
        return supertest(expressApp)
            .post('/api/admin/verify-admin-password')
            .send({ password: 'wrongPassword' })
            .expect(StatusCodes.UNAUTHORIZED)
            .then((response) => {
                expect(response.body.valid).to.equal(false);
            });
    });
});
