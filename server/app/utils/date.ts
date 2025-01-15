export const getMontrealDateTime = (onlyTime?: boolean) => {
    let now: Date | string = new Date();

    const options: Intl.DateTimeFormatOptions = {
        timeZone: 'America/Toronto',
    };

    if (onlyTime) now = now.toLocaleTimeString('en-GB', options);
    else now = now.toLocaleString('en-GB', options);

    return now;
};
