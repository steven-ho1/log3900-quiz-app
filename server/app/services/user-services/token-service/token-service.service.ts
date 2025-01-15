/* eslint-disable no-console */
import { InternalErrorMessage } from '@app/type/error';
import { handleInternalError } from '@app/utils/error-utils';
import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { JwtPayload, sign, verify, VerifyErrors } from 'jsonwebtoken';
import { Service } from 'typedi';

@Service()
export class TokenService {
    validateToken = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const token = this.getToken(req);
            if (!token) {
                console.log('No token found');
                res.sendStatus(StatusCodes.UNAUTHORIZED);
                return;
            }

            verify(token, process.env.TOKEN_SECRET, async (error: VerifyErrors, decodedToken: JwtPayload) => {
                try {
                    if (error) {
                        res.sendStatus(StatusCodes.UNAUTHORIZED);
                        console.log('Token error: ' + error.message);
                        return;
                    }
                    console.log('Token validated');
                    const userId = decodedToken.id;
                    res.locals.id = userId;

                    next();
                } catch (callbackError) {
                    handleInternalError(res, callbackError, InternalErrorMessage.TokenValidationError);
                }
            });
        } catch (error) {
            handleInternalError(res, error, InternalErrorMessage.TokenValidationError);
        }
    };

    getToken(req: Request) {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        return token;
    }

    generateToken(id: string) {
        const token = sign({ id }, process.env.TOKEN_SECRET);
        return token;
    }
}
