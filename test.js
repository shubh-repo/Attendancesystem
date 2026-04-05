const kolkataTimeStr = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" });
const [today, currentTime] = kolkataTimeStr.split(' ');
console.log("Kolkata parts:", {today, currentTime});

const toMins = t => { const p = t.split(':'); return parseInt(p[0]) * 60 + parseInt(p[1]); };
const curMins = toMins(currentTime);
console.log("curMins:", curMins);
