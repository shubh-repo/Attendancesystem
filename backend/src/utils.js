export const getKolkataDateTime = () => {
    const kolkataTimeStr = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" });
    const [today, currentTime] = kolkataTimeStr.split(' ');
    // Handle midnight '24:00:00' corner case from toLocaleString in some runtimes:
    const safeTime = currentTime && currentTime.startsWith('24') ? currentTime.replace('24', '00') : currentTime;
    return { today, currentTime: safeTime };
};

export const toMins = (t) => {
    if (!t) return 0;
    const p = t.split(':');
    return parseInt(p[0]) * 60 + parseInt(p[1]);
};
