import * as dotenv from 'dotenv';
import * as nodemailer from 'nodemailer';

dotenv.config();

// Configurer Nodemailer pour envoyer le courriel
// https://medium.com/@y.mehnati_49486/how-to-send-an-email-from-your-gmail-account-with-nodemailer-837bf09a7628
// https://support.google.com/a/answer/176600?hl=en
export const transporter = nodemailer.createTransport({
    service: 'Gmail',
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.TRANSPORTER_EMAIL,
        pass: process.env.TRANSPORTER_PASSWORD,
    },
});
