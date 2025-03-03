sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent"
], function (Controller, UIComponent) {
    "use strict";

    return Controller.extend("emsd.ams.controller.BaseController", {
        getRouter: function () {
            return UIComponent.getRouterFor(this);
        },

        getResourceBundle: function () {
            return this.getOwnerComponent().getModel("i18n").getResourceBundle();
        },

        setModel: function (oModel, sName) {
            this.getView().setModel(oModel, sName);
        },

        getModel: function (sName) {
            return this.getView().getModel(sName);
        }
    });
});