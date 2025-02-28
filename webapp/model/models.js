sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/ui/Device",
    "sap/ui/model/odata/v2/ODataModel"
], function (JSONModel, Device, ODataModel) {
    "use strict";

    return {
        /**
         * Creates a device model
         * @returns {sap.ui.model.json.JSONModel} the device model
         */
        createDeviceModel: function () {
            var oModel = new JSONModel(Device);
            oModel.setDefaultBindingMode("OneWay");
            return oModel;
        },
        
        /**
         * Creates a mock data model for testing
         * @returns {sap.ui.model.odata.v2.ODataModel} the mock model
         */
        createMockModel: function () {
            // Setup mock server
            jQuery.sap.require("sap.ui.core.util.MockServer");
            
            var oMockServer = new sap.ui.core.util.MockServer({
                rootUri: "/sap/opu/odata/sap/EMSD_AMS_SRV/"
            });
            
            // Configure mock server
            var sMetadataUrl = jQuery.sap.getModulePath("emsd.ams", "/localService/metadata.xml");
            var sMockdataPath = jQuery.sap.getModulePath("emsd.ams", "/localService/mockdata");
            
            oMockServer.simulate(sMetadataUrl, {
                sMockdataBaseUrl: sMockdataPath,
                bGenerateMissingMockData: true
            });
            
            // Start mock server
            oMockServer.start();
            
            // Create and return OData model
            var oModel = new ODataModel("/sap/opu/odata/sap/EMSD_AMS_SRV/");
            
            // Setup model settings
            oModel.setDefaultBindingMode("TwoWay");
            oModel.setDefaultCountMode("Inline");
            
            return oModel;
        }
    };
});