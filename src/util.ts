import localize from "./localize";
export class Util {
    /**获取时间过去多久
     * @param {number} timeStamp 13位毫秒时间戳
     * @return {string} 文字描述 失败返回空
     */
    static timeAgo(timeStamp: number): string {
        let minute = 1000 * 60;
        let hour = minute * 60;
        let day = hour * 24;
        let week = day * 7;
        let halfamonth = day * 15;
        let month = day * 30;
        let now = new Date().getTime();
        let diffValue = now - timeStamp;

        if (diffValue < 0) {
            return '';
        }
        let minC = diffValue / minute;
        let hourC = diffValue / hour;
        let dayC = diffValue / day;
        let weekC = diffValue / week;
        let monthC = diffValue / month;
        if (monthC >= 1 && monthC < 4) {
            return localize("ldgGist.monthsAgo", parseInt(monthC.toString()).toString());
        } else if (weekC >= 1 && weekC < 4) {
            return localize("ldgGist.weeksAgo", parseInt(weekC.toString()).toString());
        } else if (dayC >= 1 && dayC < 7) {
            return localize("ldgGist.daysAgo", parseInt(dayC.toString()).toString());
        } else if (hourC >= 1 && hourC < 24) {
            return localize("ldgGist.hoursAgo", parseInt(hourC.toString()).toString());
        } else if (minC >= 1 && minC < 60) {
            return localize("ldgGist.minutesAgo", parseInt(minC.toString()).toString());
        } else if (diffValue >= 0 && diffValue <= minute) {
            return localize("ldgGist.now");
        } else {
            let datetime = new Date();
            datetime.setTime(timeStamp);
            let rYear = datetime.getFullYear();
            let rMonth = datetime.getMonth() + 1 < 10 ? "0" + (datetime.getMonth() + 1) : datetime.getMonth() + 1;
            let rDate = datetime.getDate() < 10 ? "0" + datetime.getDate() : datetime.getDate();
            return rYear + "-" + rMonth + "-" + rDate;
        }
    }
    /**
     * 字节转换为"B", "KB", "MB", "GB", "TB"
     * @param  {Number} bytes   [字节数：B]
     * @param  {Number} decimal [小数位数]
     * @return {string}        [转换后的字符串]
     */
    static byteConvert(bytes: number, decimal: number = 2) :string{
        var units = ["B", "KB", "MB", "GB", "TB"];
        for (var i = 1; bytes / Math.pow(1024, i) >= 1; i++) {
        }
        return (bytes / Math.pow(1024, i - 1)).toFixed(decimal) + units[i - 1];
    }
}