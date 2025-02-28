sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/routing/History"
], function (Controller, History) {
  "use strict";

  return Controller.extend("emsd.ams.controller.NotFound", {
      /**
       * Handler for nav back button
       */
      onNavBack: function () {
          var oHistory = History.getInstance();
          var sPreviousHash = oHistory.getPreviousHash();
          
          if (sPreviousHash !== undefined) {
              window.history.go(-1);
          } else {
              this.getOwnerComponent().getRouter().navTo("equipmentList", {}, { replaceHash: true });
          }
      }
  });
});