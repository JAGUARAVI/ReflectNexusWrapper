export = (duration: number): string => {
    let seconds: string | number = Math.floor((duration / 1000) % 60),
        minutes: string | number = Math.floor((duration / (1000 * 60)) % 60),
        hours: string | number = Math.floor((duration / (1000 * 60 * 60)) % 24);

    hours = (hours < 10 && hours > 0) ? "0" + hours : hours;
    minutes = (minutes < 10) ? "0" + minutes : minutes;
    seconds = (seconds < 10) ? "0" + seconds : seconds;

    if (!hours) return minutes + ":" + seconds;
    return hours + ":" + minutes + ":" + seconds;
}
