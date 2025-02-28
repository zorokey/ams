sap.ui.define([], function () {
    "use strict";

    return {
        /**
         * Formats a date into a readable string
         * @param {object} oDate date to format
         * @return {string} formatted date string
         */
        formatDate: function (oDate) {
            if (!oDate) {
                return "";
            }
            
            var oDateFormat = sap.ui.core.format.DateFormat.getDateTimeInstance({
                pattern: "yyyy-MM-dd HH:mm:ss"
            });
            
            return oDateFormat.format(new Date(oDate));
        },
        
        /**
         * Formats the equipment status
         * @param {string} sStatus the equipment status
         * @return {string} the status with corresponding state
         */
        formatEquipmentStatus: function (sStatus) {
            var sState;
            
            switch (sStatus) {
                case "AVLB":
                    sState = "Success"; // Available
                    break;
                case "MALF":
                    sState = "Error"; // Malfunction
                    break;
                case "MAINT":
                    sState = "Warning"; // Under Maintenance
                    break;
                default:
                    sState = "None";
            }
            
            return sState;
        }
    };
});