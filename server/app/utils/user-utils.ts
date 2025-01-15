import * as cryptoRandomString from 'crypto-random-string';

const DEFAULT_UNIQUE_ID_LENGTH = 12;
const RESET_CODE_MIN = 1000;
const RESET_CODE_OFFSET = 9000;
export const RESET_CODE_DURATION = 3600; // One hour
export const SALT_LENGTH = 10;

const extractInitials = (fullName: string) => {
    const initials: string = fullName
        .split(' ')
        .map((name) => name[0])
        .join('');

    return initials;
};

export const generateUserID = (username: string, uniqueIdLength: number = DEFAULT_UNIQUE_ID_LENGTH) => {
    const initials = extractInitials(username);
    const uniqueId = cryptoRandomString({
        length: uniqueIdLength,
        type: 'alphanumeric',
    });

    return `${initials}-${uniqueId}`;
};

// 1000 to 9999
export const generateResetCode = () => Math.floor(RESET_CODE_MIN + Math.random() * RESET_CODE_OFFSET).toString();

export const generateResetEmailMessage = (resetCode: string, language: string) => {
    return language === 'FR'
        ? `
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Réinitialisation du mot de passe</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    background-color: #f6f6f6;
                    margin: 0;
                    padding: 20px;
                }
                .container {
                    max-width: 600px;
                    margin: 0 auto;
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
                    padding: 20px;
                }
                h1 {
                    color: #333;
                    font-size: 24px;
                    margin-bottom: 10px;
                }
                p {
                    color: #555;
                    line-height: 1.6;
                }
                .footer {
                    margin-top: 20px;
                    font-size: 12px;
                    color: #aaa;
                    text-align: center;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Réinitialisation de mot de passe</h1>
                <p>Bonjour,</p>
                <p>Nous avons reçu une demande pour réinitialiser votre mot de passe sur <strong>Late Night at Trivia Theater</strong>.</p>
                <p>Voici votre code de réinitialisation :</p>
                <h2 style="font-weight: bold; text-align: center;">${resetCode}</h2>
                <p>Utilisez ce code pour réinitialiser votre mot de passe. Ce code expirera dans une heure.</p>
                <p>Si vous n'avez pas fait cette demande, vous pouvez ignorer ce courriel.</p>
                <div class="footer">
                    <p>Merci,</p>
                    <p>L'équipe de Trivia Theater</p>
                </div>
            </div>
        </body>
        </html>
    `
        : `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Password Reset</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    background-color: #f6f6f6;
                    margin: 0;
                    padding: 20px;
                }
                .container {
                    max-width: 600px;
                    margin: 0 auto;
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
                    padding: 20px;
                }
                h1 {
                    color: #333;
                    font-size: 24px;
                    margin-bottom: 10px;
                }
                p {
                    color: #555;
                    line-height: 1.6;
                }
                .footer {
                    margin-top: 20px;
                    font-size: 12px;
                    color: #aaa;
                    text-align: center;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Password Reset</h1>
                <p>Hello,</p>
                <p>We received a request to reset your password for <strong>Late Night at Trivia Theater</strong>.</p>
                <p>Here is your reset code:</p>
                <h2 style="font-weight: bold; text-align: center;">${resetCode}</h2>
                <p>Use this code to reset your password. This code will expire in one hour.</p>
                <p>If you did not make this request, you can ignore this email.</p>
                <div class="footer">
                    <p>Thank you,</p>
                    <p>The Trivia Theater Team</p>
                </div>
            </div>
        </body>
        </html>
        `;
};
