const isWithinSchedule = (schedule, date = new Date()) => {
    if (!schedule) return true;
    const day = date.getDay();
    if (Array.isArray(schedule.days) && !schedule.days.includes(day)) {
        return false;
    }
    if (!schedule.start || !schedule.end) {
        return true;
    }
    const [startH, startM] = schedule.start.split(":").map(Number);
    const [endH, endM] = schedule.end.split(":").map(Number);
    const minutes = date.getHours() * 60 + date.getMinutes();
    const start = startH * 60 + startM;
    const end = endH * 60 + endM;
    if (start <= end) {
        return minutes >= start && minutes <= end;
    }
    return minutes >= start || minutes <= end;
};

export { isWithinSchedule };
