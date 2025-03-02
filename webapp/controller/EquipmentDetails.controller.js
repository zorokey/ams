sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
    "sap/ui/core/routing/History",
    "sap/m/MessageToast"
], function (Controller, UIComponent, History, MessageToast) {
    "use strict";

    return Controller.extend("emsd.ams.controller.EquipmentDetails", {
        onInit: function () {
            var oRouter = UIComponent.getRouterFor(this);
            oRouter.getRoute("EquipmentDetails").attachPatternMatched(this._onObjectMatched, this);
        },
        
        /**
         * Event handler for pattern matched
         * @param {sap.ui.base.Event} oEvent - The pattern matched event
         */
        _onObjectMatched: function (oEvent) {
            var sEquipmentId = oEvent.getParameter("arguments").equipmentId;
            
            this.getView().bindElement({
                path: "/EquipmentSet('" + sEquipmentId + "')",
                events: {
                    dataRequested: function () {
                        // Show busy indicator if needed
                    },
                    dataReceived: function (oData) {
                        // Hide busy indicator if needed
                    }
                }
            });
        },
        
        /**
         * Event handler for navigating back
         */
        onNavBack: function () {
            var oHistory = History.getInstance();
            var sPreviousHash = oHistory.getPreviousHash();
            
            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                var oRouter = UIComponent.getRouterFor(this);
                oRouter.navTo("EquipmentList", {}, true);
            }
        },
        
        /**
         * Event handler for editing equipment
         */
        onEditEquipment: function () {
            MessageToast.show("Edit function not implemented in this demo");
        }
    });
});