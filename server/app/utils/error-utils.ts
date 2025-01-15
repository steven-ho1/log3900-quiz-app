/* eslint-disable no-console */
import { InternalErrorMessage } from '@app/type/error';
import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';

export const handleInternalError = (res: Response, error: unknown, internalErrorMessage: InternalErrorMessage | string) => {
    console.error(internalErrorMessage);
    console.error(error);
    if (!res.headersSent) res.sendStatus(StatusCodes.INTERNAL_SERVER_ERROR);
};
