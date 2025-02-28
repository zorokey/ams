sap.ui.define([
    "sap/ui/core/util/MockServer",
    "sap/base/Log"
], function (MockServer, Log) {
    "use strict";
    return {
        /**
         * Initialize the mock server
         */
        init: function () {
            Log.info("Initializing MockServer");
            
            // Create an instance of the mock server
            var oMockServer = new MockServer({
                rootUri: "/sap/opu/odata/sap/EMSD_AMS_SRV/"
            });
            
            // Configure delayed responses
            MockServer.config({
                autoRespond: true,
                autoRespondAfter: 0
            });
            
            // Get the path to the metadata file
            var sMetadataPath = jQuery.sap.getModulePath("emsd.ams", "/localService/metadata.xml");
            
            try {
                // Read the metadata content
                var sMetadataString = jQuery.sap.syncGetText(sMetadataPath).data;
                
                // Configure the mock server
                oMockServer.simulate(sMetadataString, {
                    sMockdataBaseUrl: jQuery.sap.getModulePath("emsd.ams", "/localService/mockdata"),
                    bGenerateMissingMockData: true
                });
                
                // Add logging for GET requests
                oMockServer.attachAfter("GET", function(oEvent) {
                    var oXhr = oEvent.getParameter("oXhr");
                    console.log("Processed GET request: " + oXhr.url);
                });
                
                // Start the server
                oMockServer.start();
                console.log("MockServer started successfully");
            } catch (oError) {
                console.error("MockServer initialization failed: " + oError.message);
            }
        }
    };
});