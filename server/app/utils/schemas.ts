import * as Joi from 'joi';

export const completedGameSchema = Joi.object({
    correctAnswerRatio: Joi.number().min(0).max(1).required(),
    gameDuration: Joi.number().min(0).required(),
    earnedPoints: Joi.number().min(0).required(),
    hasWon: Joi.boolean().required(),
});
