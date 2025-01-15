/* eslint-disable no-console */

export const setCrashHandlers = () => {
    // Listen for uncaught exceptions
    process.on('uncaughtException', (err) => {
        console.error('Unhandled Exception:', err);
    });

    // Listen for unhandled promise rejections
    process.on('unhandledRejection', (reason) => {
        console.error('Unhandled Rejection:', reason);
    });
};
