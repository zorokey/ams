sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel"
], function (Controller, JSONModel) {
  "use strict";

  return Controller.extend("emsd.ams.controller.App", {
      onInit: function () {
          // Initialize view model
          var oViewModel = new JSONModel({
              busy: false,
              delay: 0
          });
          this.getView().setModel(oViewModel, "appView");
      }
  });
});