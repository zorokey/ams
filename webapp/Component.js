sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/Device",
    "emsd/ams/model/models",
    "./localService/mockserver"
], function (UIComponent, Device, models, mockserver) {
    "use strict";

    return UIComponent.extend("emsd.ams.Component", {
        metadata: {
            manifest: "json"
        },

        /**
         * The component is initialized by UI5 automatically during the startup
         */
        init: function () {
            // Initialize the mock server
            mockserver.init();
            
            // Call the base component's init function
            UIComponent.prototype.init.apply(this, arguments);

            // Enable routing
            this.getRouter().initialize();

            // Set the device model
            this.setModel(models.createDeviceModel(), "device");
        }
    });
});